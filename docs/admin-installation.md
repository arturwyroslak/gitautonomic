# GitAutonomic - Administrator Installation Guide

## Prerequisites

### System Requirements

#### Minimum Requirements
- **OS**: Linux (Ubuntu 20.04+), macOS 10.15+, or Windows 10 with WSL2
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 4GB (8GB+ recommended)
- **Storage**: 10GB free space (SSD recommended)
- **Network**: Stable internet connection

#### Recommended Requirements
- **OS**: Linux (Ubuntu 22.04+ or similar)
- **CPU**: 4+ cores
- **RAM**: 16GB+
- **Storage**: 50GB+ SSD
- **Network**: High-speed internet for AI model calls

### Software Dependencies

#### Required Software
- **Node.js**: Version 20.10.0 or higher
- **PostgreSQL**: Version 14+ 
- **Redis**: Version 6+
- **Git**: Version 2.30+
- **Docker**: Version 20+ (optional but recommended)
- **Docker Compose**: Version 2+ (if using Docker)

#### Installation Commands

**Ubuntu/Debian:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install Docker (optional)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin
```

**macOS (using Homebrew):**
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node@20 postgresql redis git
brew install --cask docker
```

## GitHub App Setup

### 1. Create GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Fill in the details:

**Basic Information:**
- **App name**: `GitAutonomic-[YourOrg]` (must be unique)
- **Description**: `Autonomous AI DevOps Engineer for GitHub repositories`
- **Homepage URL**: `https://your-domain.com` (or ngrok URL for development)
- **Webhook URL**: `https://your-domain.com/webhook`
- **Webhook secret**: Generate a secure random string (save this)

**Permissions:**
```
Repository permissions:
- Actions: Read & Write
- Checks: Read & Write  
- Contents: Read & Write
- Issues: Read & Write
- Metadata: Read
- Pull requests: Read & Write
- Security events: Read
- Statuses: Read & Write

Organization permissions:
- Members: Read (optional)

Account permissions:
- Email addresses: Read
```

**Events:**
- [x] Check run
- [x] Check suite
- [x] Issues
- [x] Issue comment
- [x] Pull request
- [x] Pull request review
- [x] Push
- [x] Repository

### 2. Configure GitHub App

1. After creation, note down:
   - **App ID**
   - **Client ID** 
   - **Client Secret**
2. Generate and download the **Private Key** (`.pem` file)
3. Install the app on your organization/repositories

### 3. GitHub OAuth Setup (for dashboard)

1. In GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Configure:
   - **Application name**: `GitAutonomic Dashboard`
   - **Homepage URL**: `https://your-domain.com`
   - **Callback URL**: `https://your-domain.com/api/auth/github/callback`

## Database Setup

### PostgreSQL Configuration

#### 1. Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE gitautonomic;

# Create user
CREATE USER gitautonomic_user WITH ENCRYPTED PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE gitautonomic TO gitautonomic_user;
GRANT ALL ON SCHEMA public TO gitautonomic_user;

# Exit
\q
```

#### 2. Configure Connection

Create database URL:
```
DATABASE_URL=postgresql://gitautonomic_user:your_secure_password@localhost:5432/gitautonomic
```

### Redis Configuration

#### 1. Configure Redis

Edit `/etc/redis/redis.conf`:
```bash
sudo nano /etc/redis/redis.conf
```

Key settings:
```
# Bind to localhost for security
bind 127.0.0.1

# Set password (optional but recommended)
requirepass your_redis_password

# Persistence settings
save 900 1
save 300 10
save 60 10000

# Memory settings
maxmemory 256mb
maxmemory-policy allkeys-lru
```

#### 2. Start Redis

```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

Redis URL:
```
REDIS_URL=redis://localhost:6379
# Or with password: redis://:your_redis_password@localhost:6379
```

## Application Installation

### 1. Clone Repository

```bash
git clone https://github.com/arturwyroslak/gitautonomic.git
cd gitautonomic
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
-----END PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# GitHub OAuth for Dashboard
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret
GITHUB_REDIRECT_URI=https://your-domain.com/api/auth/github/callback

# JWT Secret
JWT_SECRET=your_super_secure_jwt_secret

# Database Configuration
DATABASE_URL=postgresql://gitautonomic_user:password@localhost:5432/gitautonomic

# Redis Configuration
REDIS_URL=redis://localhost:6379

# AI Provider Configuration
OPENAI_API_KEY=your_openai_api_key
CUSTOM_LLM_ENDPOINT=https://your-custom-llm-endpoint.com
CUSTOM_LLM_API_KEY=your_custom_api_key
EMBEDDINGS_MODEL=text-embedding-3-small

# System Configuration
RISK_HIGH_THRESHOLD=0.7
COVERAGE_MIN_LINES=0.75
AGENT_WORK_ROOT=/tmp/ai-agent-work
LOG_LEVEL=info
PORT=3000
NODE_ENV=production
```

### 4. Database Migration

```bash
# Generate Prisma client
npm run prisma:gen

# Run database migrations
npm run migrate
```

### 5. Build Application

```bash
npm run build
```

## AI Provider Setup

### OpenAI Configuration

1. Create account at [OpenAI](https://platform.openai.com)
2. Generate API key in API settings
3. Add to `.env` file:
```bash
OPENAI_API_KEY=sk-...
```

### Alternative Providers

#### GitHub Models
```bash
# Use GitHub token with Models access
CUSTOM_LLM_ENDPOINT=https://models.inference.ai.azure.com
CUSTOM_LLM_API_KEY=your_github_token
```

#### Local LLM (Ollama)
```bash
# Install Ollama locally
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# Configure in .env
CUSTOM_LLM_ENDPOINT=http://localhost:11434
```

## Security Configuration

### 1. File Permissions

```bash
# Secure environment file
chmod 600 .env

# Create secure work directory
sudo mkdir -p /tmp/ai-agent-work
sudo chown $(whoami):$(whoami) /tmp/ai-agent-work
chmod 750 /tmp/ai-agent-work
```

### 2. Firewall Configuration

```bash
# Ubuntu/Debian with UFW
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw allow from 192.30.252.0/22 to any port 3000  # GitHub webhook IPs
sudo ufw allow from 185.199.108.0/22 to any port 3000
sudo ufw allow from 140.82.112.0/20 to any port 3000
sudo ufw allow from 143.55.64.0/20 to any port 3000
```

### 3. SSL/TLS Setup

#### Using Let's Encrypt with Nginx

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx

# Configure Nginx
sudo nano /etc/nginx/sites-available/gitautonomic
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/gitautonomic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

## Service Setup

### 1. Systemd Service

Create service file:
```bash
sudo nano /etc/systemd/system/gitautonomic.service
```

Service configuration:
```ini
[Unit]
Description=GitAutonomic AI Agent
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=gitautonomic
WorkingDirectory=/opt/gitautonomic
ExecStart=/usr/bin/node dist/server.js
ExecStartPre=/usr/bin/node dist/worker.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/gitautonomic/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/gitautonomic /tmp/ai-agent-work

[Install]
WantedBy=multi-user.target
```

### 2. Create Service User

```bash
# Create service user
sudo useradd -r -s /bin/false gitautonomic

# Copy application
sudo cp -r . /opt/gitautonomic
sudo chown -R gitautonomic:gitautonomic /opt/gitautonomic

# Start service
sudo systemctl daemon-reload
sudo systemctl enable gitautonomic
sudo systemctl start gitautonomic
```

## Docker Deployment (Alternative)

### 1. Docker Compose Setup

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./agent-work:/tmp/ai-agent-work
    restart: unless-stopped

  worker:
    build: .
    command: node dist/worker.js
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./agent-work:/tmp/ai-agent-work
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=gitautonomic
      - POSTGRES_USER=gitautonomic
      - POSTGRES_PASSWORD=your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 2. Deploy with Docker

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec app npm run migrate

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Monitoring Setup

### 1. Health Checks

Set up monitoring endpoints:
```bash
# Application health
curl http://localhost:3000/healthz

# Database connectivity
curl http://localhost:3000/api/health/db

# Redis connectivity  
curl http://localhost:3000/api/health/redis
```

### 2. Log Monitoring

```bash
# View application logs
sudo journalctl -u gitautonomic -f

# Or with Docker
docker-compose logs -f app
```

### 3. Metrics Collection

Configure external monitoring tools:
- **Prometheus**: Metrics scraping
- **Grafana**: Visualization
- **Alertmanager**: Alert routing

## Backup Strategy

### 1. Database Backup

```bash
# Create backup script
cat > /opt/gitautonomic/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/gitautonomic"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -h localhost -U gitautonomic_user gitautonomic > $BACKUP_DIR/gitautonomic_$DATE.sql
gzip $BACKUP_DIR/gitautonomic_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "gitautonomic_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/gitautonomic/backup-db.sh

# Add to crontab
echo "0 2 * * * /opt/gitautonomic/backup-db.sh" | sudo crontab -
```

### 2. Application Backup

```bash
# Backup configuration and logs
tar -czf gitautonomic-config-$(date +%Y%m%d).tar.gz \
  /opt/gitautonomic/.env \
  /opt/gitautonomic/logs \
  /etc/systemd/system/gitautonomic.service
```

## Troubleshooting

### Common Issues

#### 1. GitHub Webhook Delivery Failures
```bash
# Check webhook endpoint accessibility
curl -X POST https://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Verify firewall and DNS settings
```

#### 2. Database Connection Issues
```bash
# Test database connection
psql -h localhost -U gitautonomic_user -d gitautonomic -c "SELECT 1;"

# Check service status
sudo systemctl status postgresql
```

#### 3. Redis Connection Issues
```bash
# Test Redis connection
redis-cli ping

# Check service status
sudo systemctl status redis-server
```

#### 4. AI Provider API Issues
```bash
# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Log Analysis

```bash
# Application logs
sudo journalctl -u gitautonomic --since "1 hour ago"

# Error patterns
sudo journalctl -u gitautonomic | grep -i error

# Performance monitoring
sudo journalctl -u gitautonomic | grep -i "response time"
```

## Maintenance

### Regular Tasks

#### Weekly
- Review application logs
- Check disk usage
- Verify backup integrity
- Update dependencies

#### Monthly  
- Security updates
- Performance review
- Cost analysis
- Capacity planning

### Update Procedure

```bash
# Backup current installation
cp -r /opt/gitautonomic /opt/gitautonomic.backup

# Pull latest code
cd /opt/gitautonomic
git pull origin main

# Install dependencies
npm install

# Run migrations
npm run migrate

# Build application
npm run build

# Restart service
sudo systemctl restart gitautonomic
```

## Security Best Practices

### 1. Access Control
- Use dedicated service account
- Implement principle of least privilege
- Regular access review

### 2. Network Security
- Firewall configuration
- VPN access for administration
- Rate limiting

### 3. Data Protection
- Environment variable encryption
- Database encryption at rest
- Secure backup storage

### 4. Monitoring
- Security event logging
- Intrusion detection
- Vulnerability scanning

---

*This installation guide provides comprehensive setup instructions for GitAutonomic. For support, refer to the troubleshooting section or contact the development team.*