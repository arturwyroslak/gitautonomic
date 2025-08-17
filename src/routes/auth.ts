import express from 'express';
import { 
  getGitHubAuthUrl, 
  exchangeCodeForToken, 
  getGitHubUser, 
  getGitHubUserEmails,
  generateToken,
  authenticateToken,
  User
} from '../auth.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = express.Router();

// Temporary in-memory user store (replace with database in production)
const users = new Map<string, User>();

// GitHub OAuth initiation
router.get('/github', (req, res) => {
  const authUrl = getGitHubAuthUrl();
  res.redirect(authUrl);
});

// GitHub OAuth callback
router.get('/github/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    log.error({ error }, 'GitHub OAuth error');
    return res.redirect('/?error=oauth_error');
  }

  if (!code) {
    return res.redirect('/?error=missing_code');
  }

  try {
    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(code as string);
    if (!accessToken) {
      return res.redirect('/?error=token_exchange_failed');
    }

    // Get user info from GitHub
    const [githubUser, emails] = await Promise.all([
      getGitHubUser(accessToken),
      getGitHubUserEmails(accessToken)
    ]);

    const primaryEmail = emails.find(email => email.primary)?.email || githubUser.email;

    // Create or update user
    const user: User = {
      id: `github_${githubUser.id}`,
      username: githubUser.login,
      email: primaryEmail,
      githubId: githubUser.id.toString(),
      avatarUrl: githubUser.avatar_url,
      accessToken: accessToken,
    };

    users.set(user.id, user);

    // Generate JWT token
    const token = generateToken(user);

    // Set cookie and redirect to dashboard
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect('/dashboard');
  } catch (error) {
    log.error({ error }, 'GitHub OAuth callback error');
    res.redirect('/?error=auth_failed');
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Find user by email (simplified - add proper password hashing in production)
  const user = Array.from(users.values()).find(u => u.email === email);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  res.json({ token, user: { ...user, accessToken: undefined } });
});

// Register endpoint
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password required' });
  }

  // Check if user already exists
  const existingUser = Array.from(users.values()).find(u => u.email === email || u.username === username);
  if (existingUser) {
    return res.status(409).json({ error: 'User already exists' });
  }

  // Create new user
  const user: User = {
    id: `user_${Date.now()}`,
    username,
    email,
  };

  users.set(user.id, user);

  const token = generateToken(user);
  res.status(201).json({ token, user });
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const fullUser = users.get(user.id);
  
  if (!fullUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ ...fullUser, accessToken: undefined });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

export default router;