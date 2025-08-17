# GitAutonomic - Quick Start Guide

## Welcome to GitAutonomic!

GitAutonomic is your AI-powered DevOps engineer that works autonomously in your GitHub repositories. This guide will get you up and running in minutes.

## 🚀 What You'll Achieve

By the end of this guide, you'll have:
- GitAutonomic responding to GitHub issues
- AI agents automatically creating and implementing solutions
- Continuous quality assurance and testing
- Real-time progress monitoring

## Prerequisites (5 minutes)

### Required Accounts
- [GitHub Account](https://github.com) with admin access to repositories
- [OpenAI Account](https://platform.openai.com) with API access (or alternative AI provider)

### System Requirements
- **Node.js 20+** 
- **PostgreSQL 14+**
- **Redis 6+**

**Quick Install (Ubuntu/Debian):**
```bash
# Install everything at once
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs postgresql postgresql-contrib redis-server git
```

## Step 1: Create GitHub App (10 minutes)

### 1.1 Navigate to GitHub App Creation
Go to: **GitHub Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**

### 1.2 Fill Basic Information
```
App name: GitAutonomic-YourName
Description: AI DevOps Engineer
Homepage URL: https://your-domain.com (or use ngrok for testing)
Webhook URL: https://your-domain.com/webhook
```

### 1.3 Set Permissions
**Repository permissions:**
- ✅ Actions: Read & Write
- ✅ Checks: Read & Write  
- ✅ Contents: Read & Write
- ✅ Issues: Read & Write
- ✅ Pull requests: Read & Write
- ✅ Metadata: Read

**Subscribe to events:**
- ✅ Issues
- ✅ Issue comments
- ✅ Pull requests
- ✅ Pull request reviews
- ✅ Push

### 1.4 Save Important Information
After creation, note down:
- **App ID**
- **Client ID**
- **Client Secret**
- **Webhook Secret** (you set this)
- **Private Key** (download the .pem file)

### 1.5 Install on Repository
- Go to "Install App" tab
- Install on your target repository

## Step 2: Setup Database (5 minutes)

```bash
# Switch to postgres user and create database
sudo -u postgres psql << 'EOF'
CREATE DATABASE gitautonomic;
CREATE USER gitautonomic_user WITH ENCRYPTED PASSWORD 'secure_password_123';
GRANT ALL PRIVILEGES ON DATABASE gitautonomic TO gitautonomic_user;
GRANT ALL ON SCHEMA public TO gitautonomic_user;
\q
EOF

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## Step 3: Deploy GitAutonomic (10 minutes)

### 3.1 Clone and Setup
```bash
# Clone repository
git clone https://github.com/arturwyroslak/gitautonomic.git
cd gitautonomic

# Install dependencies
npm install
```

### 3.2 Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**Minimal .env configuration:**
```bash
# GitHub App (from Step 1)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwgg...
-----END PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Database (from Step 2)
DATABASE_URL=postgresql://gitautonomic_user:secure_password_123@localhost:5432/gitautonomic

# Redis
REDIS_URL=redis://localhost:6379

# AI Provider
OPENAI_API_KEY=sk-proj-your-openai-key

# System
JWT_SECRET=your-super-secure-random-string
AGENT_WORK_ROOT=/tmp/ai-agent-work
PORT=3000
NODE_ENV=development
```

### 3.3 Initialize Database
```bash
# Generate Prisma client
npm run prisma:gen

# Run database migrations
npm run migrate

# Build application
npm run build
```

### 3.4 Start GitAutonomic
```bash
# Start in development mode
npm run dev

# Or start production mode
npm start
```

**You should see:**
```
✅ Database connected
✅ Redis connected
✅ GitHub App authenticated
🚀 GitAutonomic server running on port 3000
```

## Step 4: Test Your Setup (5 minutes)

### 4.1 Health Check
```bash
curl http://localhost:3000/healthz
# Should return: {"status":"ok","timestamp":"..."}
```

### 4.2 Test GitHub Integration
1. Go to your repository
2. Create a new issue:

```markdown
**Title:** Test GitAutonomic Setup

**Description:**
Create a simple "Hello World" function in the repository.

## Requirements
- Create a new file `src/hello.ts`
- Export a function that returns "Hello, GitAutonomic!"
- Add a simple test for the function

## Acceptance Criteria
- [ ] Function created and exported
- [ ] Test passes
- [ ] Code follows TypeScript best practices
```

3. Submit the issue
4. Within 1-2 minutes, you should see:
   - GitAutonomic comments on the issue
   - A new branch and pull request created
   - Code implementation with tests

## Step 5: Access Dashboard (Optional)

### 5.1 Setup OAuth for Dashboard
1. Go to: **GitHub Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. Configure:
   ```
   Application name: GitAutonomic Dashboard
   Homepage URL: http://localhost:3000
   Callback URL: http://localhost:3000/api/auth/github/callback
   ```

3. Add to `.env`:
   ```bash
   GITHUB_CLIENT_ID=your_oauth_client_id
   GITHUB_CLIENT_SECRET=your_oauth_client_secret
   GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
   ```

### 5.2 Access Dashboard
1. Open browser to `http://localhost:3000`
2. Login with GitHub
3. View agent activity, metrics, and logs

## Step 6: Customize Configuration (10 minutes)

### 6.1 Repository Configuration
Create `.aiagent.yml` in your repository:

```yaml
# AI provider settings
provider: openai
model: gpt-4o-mini
max_iterations: 5

# Quality controls
test_command: "npm test"
build_command: "npm run build"
lint_command: "npm run lint"

# Paths AI can modify
restrict_paths:
  include:
    - "src/**"
    - "tests/**"
    - "docs/**"
  exclude:
    - "node_modules/**"
    - ".git/**"

# Security and quality
require_tests: true
coverage_threshold: 0.75
risk_threshold: 0.7
```

### 6.2 Ownership Rules
Create `.aiagent-ownership.yml`:

```yaml
ownership_rules:
  # Source code - full access
  - paths: ["src/**"]
    permissions: [read, write, create, delete]
    restrictions:
      no_bulk_delete: true
      preserve_exports: true
    
  # Tests - full access
  - paths: ["tests/**", "**/*.test.ts"]
    permissions: [read, write, create, delete]
  
  # Config files - restricted
  - paths: ["package.json", "tsconfig.json"]
    permissions: [read, write]
    restrictions:
      require_approval: true
      no_delete: true

global_restrictions:
  max_files_per_commit: 15
  max_lines_changed_per_file: 300
  require_tests_for_new_features: true
```

## Common Use Cases

### 🐛 Bug Fix Request
```markdown
**Title:** Fix user authentication redirect loop

**Description:**
Users are experiencing infinite redirect loops when logging in.

**Steps to Reproduce:**
1. Go to login page
2. Enter credentials
3. Get redirected back to login

**Expected:** User should be logged in and redirected to dashboard
```

### ✨ Feature Request
```markdown
**Title:** Add user profile page

**Description:**
Create a user profile page where users can view and edit their information.

**Requirements:**
- Display user avatar, name, email
- Edit form for name and bio
- Save button with validation
- Responsive design

**Acceptance Criteria:**
- [ ] Profile page accessible at /profile
- [ ] Form validation works
- [ ] Changes save to database
- [ ] Mobile responsive
```

### 🧪 Test Enhancement
```markdown
**Title:** Increase test coverage for auth module

**Description:**
The authentication module needs better test coverage.

**Current Coverage:** 45%
**Target Coverage:** 85%

**Focus Areas:**
- Error handling scenarios
- Edge cases for token validation
- Integration tests for OAuth flow
```

## Advanced Features (Ready to Use)

Once your basic setup is working, GitAutonomic automatically provides:

### 🤖 Multi-Agent Orchestration
- **Frontend Agent**: React/Vue component generation
- **Backend Agent**: API development
- **Security Agent**: Vulnerability scanning
- **Test Agent**: Comprehensive test suites
- **DevOps Agent**: CI/CD optimization

### 🧠 Adaptive Intelligence
- Learns from your codebase patterns
- Adapts to team coding style
- Improves suggestions over time
- Predictive issue detection

### 🔒 Enterprise Security
- SAST/DAST integration
- Policy enforcement
- Audit trails
- Role-based access control

### 📊 Real-time Monitoring
- Performance metrics
- Quality trends
- Cost optimization
- Predictive analytics

## Troubleshooting Quick Fixes

### GitAutonomic Not Responding to Issues
```bash
# Check service status
curl http://localhost:3000/healthz

# View logs
tail -f logs/gitautonomic.log

# Restart service
npm run dev
```

### Database Connection Issues
```bash
# Test database connection
psql -h localhost -U gitautonomic_user -d gitautonomic -c "SELECT 1;"

# Reset if needed
sudo systemctl restart postgresql
```

### GitHub Webhook Issues
```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}'

# Check GitHub App webhook deliveries in GitHub settings
```

### AI Provider Issues
```bash
# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

## Next Steps

🎉 **Congratulations!** GitAutonomic is now running and ready to assist your development workflow.

### Immediate Actions:
1. **Create your first real issue** with a feature you actually need
2. **Review the generated code** and provide feedback through GitHub comments
3. **Explore the dashboard** to understand agent behavior
4. **Customize configurations** to match your project needs

### Learning Resources:
- 📖 [Full User Guide](user-guide.md) - Comprehensive usage instructions
- 🏗️ [System Architecture](system-architecture.md) - Understanding how it works
- ⚙️ [Configuration Guide](configuration.md) - Advanced customization
- 🔧 [Troubleshooting](troubleshooting.md) - Common issues and solutions
- 🚀 [Advanced Features](advanced-features.md) - Enterprise capabilities

### Community:
- 💬 **GitHub Discussions** - Ask questions and share experiences
- 🐛 **Issues** - Report bugs or request features
- 🔄 **Pull Requests** - Contribute improvements

### Support:
- 📧 **Email Support** - For enterprise customers
- 📚 **Documentation** - Comprehensive guides and references
- 🛠️ **Professional Services** - Custom implementation and training

---

**Ready to experience autonomous development?** Create your first issue and watch GitAutonomic work its magic! ✨

*Happy coding with your new AI DevOps engineer!* 🤖👩‍💻👨‍💻