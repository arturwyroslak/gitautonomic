# GitAutonomic Production Setup Guide

## 🚀 Production Deployment Configuration

This guide covers the production setup requirements for GitAutonomic autonomous AI agent.

## Environment Configuration

### Required Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/gitautonomic
REDIS_URL=redis://localhost:6379

# GitHub App Configuration
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY_PATH=/path/to/private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# AI Provider Configuration
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Security Configuration
JWT_SECRET=your-secure-jwt-secret
ENCRYPTION_KEY=your-32-char-encryption-key

# Optional: Additional AI Providers
ANTHROPIC_API_KEY=your-anthropic-key
HUGGINGFACE_API_KEY=your-huggingface-key
```

### Database Setup

1. **Install PostgreSQL**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Docker
docker run --name gitautonomic-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
```

2. **Create Database**
```sql
CREATE DATABASE gitautonomic;
CREATE USER gitautonomic_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE gitautonomic TO gitautonomic_user;
```

3. **Run Migrations**
```bash
npm run migrate
npm run prisma:gen
```

### Redis Setup

1. **Install Redis**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# Docker
docker run --name gitautonomic-redis -p 6379:6379 -d redis:7-alpine
```

2. **Configure Redis**
```bash
# /etc/redis/redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

## Security Hardening

### 1. SSL/TLS Configuration

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    
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

### 2. Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw deny 3000     # Block direct access to app
sudo ufw deny 5432     # Block direct database access
sudo ufw deny 6379     # Block direct Redis access
sudo ufw enable
```

### 3. Rate Limiting

```javascript
// In your Express app
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_agent_memory_agent_id ON "AgentMemory"("issueAgentId");
CREATE INDEX idx_agent_memory_type ON "AgentMemory"("type");
CREATE INDEX idx_agent_memory_salience ON "AgentMemory"("salience");
CREATE INDEX idx_feedback_event_agent_id ON "FeedbackEvent"("agentId");
CREATE INDEX idx_feedback_event_created_at ON "FeedbackEvent"("createdAt");

-- Analyze tables for query optimization
ANALYZE "AgentMemory";
ANALYZE "FeedbackEvent";
ANALYZE "EmbeddingDocument";
```

### 2. Redis Configuration

```bash
# redis.conf optimization
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
```

### 3. Node.js Optimization

```bash
# Set Node.js production flags
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
UV_THREADPOOL_SIZE=128
```

## Monitoring and Logging

### 1. Application Monitoring

```javascript
// monitoring.js
import pino from 'pino';
import { createPrometheusMetrics } from './metrics';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: false,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// Prometheus metrics
const metrics = createPrometheusMetrics();
```

### 2. Health Checks

```javascript
// health.js
export const healthCheck = async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      github: await checkGitHub(),
      openai: await checkOpenAI()
    }
  };
  
  const allHealthy = Object.values(health.services).every(status => status === 'healthy');
  res.status(allHealthy ? 200 : 503).json(health);
};
```

### 3. Error Tracking

```javascript
// error-tracking.js
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

export const errorHandler = (error, req, res, next) => {
  Sentry.captureException(error);
  logger.error(error);
  res.status(500).json({ error: 'Internal server error' });
};
```

## Docker Production Setup

### Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
```

### docker-compose.production.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: gitautonomic
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Backup Strategy

### 1. Database Backup

```bash
#!/bin/bash
# backup-db.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/gitautonomic"
mkdir -p $BACKUP_DIR

pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/gitautonomic_$TIMESTAMP.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

### 2. Redis Backup

```bash
#!/bin/bash
# backup-redis.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/redis"
mkdir -p $BACKUP_DIR

redis-cli --rdb $BACKUP_DIR/dump_$TIMESTAMP.rdb
gzip $BACKUP_DIR/dump_$TIMESTAMP.rdb
```

## Scaling Configuration

### Horizontal Scaling
```yaml
# kubernetes-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gitautonomic-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gitautonomic
  template:
    metadata:
      labels:
        app: gitautonomic
    spec:
      containers:
      - name: app
        image: gitautonomic:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: gitautonomic-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

## Maintenance

### Regular Tasks

1. **Update Dependencies**
```bash
npm audit
npm update
npm run test
```

2. **Database Maintenance**
```sql
-- Weekly vacuum
VACUUM ANALYZE;

-- Reindex if needed
REINDEX DATABASE gitautonomic;
```

3. **Log Rotation**
```bash
# logrotate configuration
/var/log/gitautonomic/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 nodejs nodejs
    postrotate
        systemctl reload gitautonomic
    endscript
}
```

## Troubleshooting

### Common Issues

1. **Memory Issues**
```bash
# Monitor memory usage
npm run memory-usage
# Restart with more memory
NODE_OPTIONS="--max-old-space-size=8192" npm start
```

2. **Database Connection Issues**
```bash
# Check connection
psql $DATABASE_URL -c "SELECT version();"
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

3. **Redis Issues**
```bash
# Check Redis status
redis-cli ping
# Monitor Redis
redis-cli monitor
```

## Security Checklist

- [ ] SSL/TLS certificates configured
- [ ] Database credentials secured
- [ ] API keys stored in environment variables
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Regular security updates scheduled
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured
- [ ] Log retention policy set

## Performance Checklist

- [ ] Database indexes optimized
- [ ] Redis caching configured
- [ ] CDN configured for static assets
- [ ] Gzip compression enabled
- [ ] Connection pooling configured
- [ ] Memory limits set appropriately
- [ ] CPU limits set appropriately
- [ ] Load balancer configured

---

**Support**: For production deployment support, check the documentation or create an issue in the repository.