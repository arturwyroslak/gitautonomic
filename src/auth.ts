import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

export interface User {
  id: string;
  username: string;
  email: string;
  githubId?: string;
  avatarUrl?: string;
  accessToken?: string;
}

// GitHub OAuth configuration
export const githubOAuth = {
  clientId: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback',
  scope: 'read:user user:email repo',
};

// Generate JWT token
export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      githubId: user.githubId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verify JWT token
export function verifyToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    log.error({ error }, 'Token verification failed');
    return null;
  }
}

// Middleware to authenticate requests
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  (req as any).user = user;
  next();
}

// GitHub OAuth helpers
export function getGitHubAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: githubOAuth.clientId!,
    redirect_uri: githubOAuth.redirectUri,
    scope: githubOAuth.scope,
    state: Math.random().toString(36).substring(2, 15),
  });
  
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string | null> {
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: githubOAuth.clientId,
        client_secret: githubOAuth.clientSecret,
        code,
      }),
    });

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    log.error({ error }, 'Failed to exchange code for token');
    return null;
  }
}

export async function getGitHubUser(accessToken: string): Promise<any> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user from GitHub');
    }

    return await response.json();
  } catch (error) {
    log.error({ error }, 'Failed to fetch GitHub user');
    throw error;
  }
}

export async function getGitHubUserEmails(accessToken: string): Promise<any[]> {
  try {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user emails from GitHub');
    }

    return await response.json();
  } catch (error) {
    log.error({ error }, 'Failed to fetch GitHub user emails');
    return [];
  }
}