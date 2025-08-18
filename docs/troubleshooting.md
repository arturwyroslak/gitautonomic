# GitAutonomic - Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when deploying, configuring, or using GitAutonomic. Issues are organized by category for quick resolution.

## System Health Checks

### Quick Diagnostic Commands

```bash
# Check system status
curl http://localhost:3000/healthz

# Verify all components
curl http://localhost:3000/api/health/comprehensive

# Get system metrics
curl http://localhost:3000/api/metrics

# Check database connectivity
curl http://localhost:3000/api/health/db

# Verify Redis connection
curl http://localhost:3000/api/health/redis

# Test AI provider connectivity
curl http://localhost:3000/api/health/ai-providers
```

### Service Status Verification

```bash
# Check GitAutonomic service
sudo systemctl status gitautonomic

# View recent logs
sudo journalctl -u gitautonomic --since "1 hour ago" -f

# Check database service
sudo systemctl status postgresql

# Check Redis service
sudo systemctl status redis-server

# Check Docker services (if using Docker)
docker-compose ps
docker-compose logs -f
```

## Installation Issues

### 1. Node.js Version Incompatibility

**Symptoms:**
- "Unsupported engine" errors during npm install
- Application crashes with import/export errors

**Solution:**
```bash
# Check Node.js version
node --version

# Install correct version (20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Database Connection Issues

**Symptoms:**
- "Connection refused" errors
- "Authentication failed" messages
- Migration failures

**Diagnosis:**
```bash
# Test PostgreSQL connection
psql -h localhost -U gitautonomic_user -d gitautonomic -c "SELECT 1;"

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo journalctl -u postgresql -f
```

**Solutions:**

**Connection Refused:**
```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check if service is listening
sudo netstat -tlnp | grep 5432
```

**Authentication Failed:**
```bash
# Reset user password
sudo -u postgres psql
ALTER USER gitautonomic_user WITH PASSWORD 'new_secure_password';
\q

# Update .env file with new password
sed -i 's/DATABASE_URL=.*/DATABASE_URL=postgresql:\/\/gitautonomic_user:new_secure_password@localhost:5432\/gitautonomic/' .env
```

**Migration Failures:**
```bash
# Reset database (WARNING: Data loss)
sudo -u postgres psql
DROP DATABASE IF EXISTS gitautonomic;
CREATE DATABASE gitautonomic;
GRANT ALL PRIVILEGES ON DATABASE gitautonomic TO gitautonomic_user;
\q

# Run migrations again
npm run migrate
```

### 3. Redis Connection Problems

**Symptoms:**
- Queue jobs not processing
- "Redis connection failed" errors
- Memory usage errors

**Diagnosis:**
```bash
# Test Redis connection
redis-cli ping

# Check Redis memory usage
redis-cli info memory

# View Redis logs
sudo journalctl -u redis-server -f
```

**Solutions:**

**Redis Not Running:**
```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Memory Issues:**
```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Adjust memory settings
maxmemory 512mb
maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis-server
```

**Connection Authentication:**
```bash
# If password protected, update .env
REDIS_URL=redis://:your_password@localhost:6379
```

**BullMQ Configuration Issues:**

**Symptoms:**
- "BullMQ: Your redis options maxRetriesPerRequest must be null" error
- Worker startup failures
- Queue jobs not processing

**Root Cause:**
BullMQ requires specific Redis connection options to function properly. The `maxRetriesPerRequest` option must be set to `null` to prevent ioredis from retrying failed requests indefinitely, which can cause issues with BullMQ's internal mechanisms.

**Solution:**
Update your Redis connection configuration in `src/queue.ts`:

```typescript
// Correct BullMQ-compatible configuration
const connection = new Redis(cfg.redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableOfflineQueue: false   // Recommended to avoid command buffering when Redis is down
});
```

**Verification:**
```bash
# Test worker startup
npm run dev:worker

# Or build and start worker
npm run build && npm run start:worker

# Check logs for successful startup without BullMQ errors
```

### 4. Prisma Migration Issues

**Symptoms:**
- "relation 'table_name' already exists" errors
- "constraint 'constraint_name' already exists" errors  
- Migration failures during deployment
- Inconsistent database state between environments

**Common Root Causes:**
- Double application of migrations
- Mixing `prisma db push` with `prisma migrate` commands
- Non-idempotent initialization scripts
- Manual database changes not reflected in migrations
- Incomplete migration rollbacks

**Diagnosis:**
```bash
# Check migration status
npx prisma migrate status

# View applied migrations in database
sudo -u postgres psql gitautonomic -c "SELECT * FROM _prisma_migrations ORDER BY applied_at;"

# Compare schema with database
npx prisma db pull
git diff prisma/schema.prisma

# Check for duplicate constraints/indexes
sudo -u postgres psql gitautonomic -c "
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
GROUP BY indexname, tablename 
HAVING COUNT(*) > 1;
"
```

**Production Migration Flow (Recommended):**
```bash
# 1. Generate migration on development
npx prisma migrate dev --name your_migration_name

# 2. Commit migration files to version control
git add prisma/migrations/
git commit -m "Add migration: your_migration_name"

# 3. Deploy to production (DO NOT use migrate dev in production)
npx prisma migrate deploy

# 4. Generate client if needed
npx prisma generate
```

**Development Migration Flow:**
```bash
# For local development changes
npx prisma db push  # Quick prototyping only

# When ready to create proper migration
npx prisma migrate dev --name describe_your_changes
```

**Recovery from "Already Exists" Errors:**

**Non-Destructive Recovery (Recommended):**
```bash
# Mark problematic migration as applied without running it
npx prisma migrate resolve --applied 20231201_migration_name

# Verify migration status
npx prisma migrate status

# Continue with pending migrations
npx prisma migrate deploy
```

**Manual Resolution for Duplicate Relations:**
```sql
-- Check what already exists
\d+ table_name

-- If table exists but migration failed, mark as resolved
-- Do NOT drop existing tables unless you're certain
```

**Prevention with Idempotent SQL Patterns:**

For initialization scripts and manual migrations, use idempotent patterns:

```sql
-- Idempotent table creation
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL
);

-- Idempotent index creation  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);

-- Idempotent constraint addition
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE users ADD CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  EXCEPTION 
    WHEN duplicate_object THEN
      -- Constraint already exists, continue
      NULL;
  END;
END $$;

-- Idempotent column addition
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  EXCEPTION 
    WHEN duplicate_column THEN
      -- Column already exists, continue  
      NULL;
  END;
END $$;

-- Idempotent function creation
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Emergency Database Reset (⚠️ DATA LOSS):**
```bash
# Only use this for development environments!
# This will destroy all data!

# Stop application
sudo systemctl stop gitautonomic

# Reset database completely
sudo -u postgres psql -c "DROP DATABASE IF EXISTS gitautonomic;"
sudo -u postgres psql -c "CREATE DATABASE gitautonomic;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gitautonomic TO gitautonomic_user;"

# Apply all migrations from scratch
npx prisma migrate deploy

# Restart application
sudo systemctl start gitautonomic
```

**Migration Best Practices:**
- Always test migrations on a copy of production data first
- Use `npx prisma migrate dev` only in development
- Use `npx prisma migrate deploy` in production
- Never edit applied migration files
- Use `prisma migrate resolve` for recovery, not manual SQL fixes
- Keep initialization scripts idempotent
- Back up database before major migrations
- Use transactions for complex migrations when possible

## GitHub Integration Issues

### 1. Webhook Delivery Failures

**Symptoms:**
- GitHub shows webhook delivery failures
- No response to GitHub events
- Red status indicators in GitHub App settings

**Diagnosis:**
```bash
# Check webhook endpoint accessibility
curl -X POST https://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen": "test"}'

# Verify SSL certificate
openssl s_client -connect your-domain.com:443

# Check firewall rules
sudo ufw status
```

**Solutions:**

**Endpoint Not Accessible:**
```bash
# Check if application is running
sudo systemctl status gitautonomic

# Verify port binding
sudo netstat -tlnp | grep 3000

# Check Nginx configuration (if using reverse proxy)
sudo nginx -t
sudo systemctl reload nginx
```

**SSL Certificate Issues:**
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Check certificate validity
sudo certbot certificates
```

**Firewall Blocking:**
```bash
# Allow GitHub webhook IPs
sudo ufw allow from 192.30.252.0/22 to any port 3000
sudo ufw allow from 185.199.108.0/22 to any port 3000
sudo ufw allow from 140.82.112.0/20 to any port 3000
sudo ufw allow from 143.55.64.0/20 to any port 3000
```

### 2. GitHub App Authentication Issues

**Symptoms:**
- "Invalid installation" errors
- API rate limit exceeded unexpectedly
- Authentication failures in logs

**Diagnosis:**
```bash
# Test GitHub App authentication
curl -H "Authorization: Bearer $(node -e 'console.log(require("./dist/util/github-auth").generateJWT())')" \
  https://api.github.com/app

# Check installation permissions
curl -H "Authorization: token $(node -e 'console.log(require("./dist/util/github-auth").getInstallationToken("INSTALLATION_ID"))')" \
  https://api.github.com/installation/repositories
```

**Solutions:**

**Invalid Private Key:**
```bash
# Verify private key format in .env
# Ensure proper line breaks and PEM format
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwgg...
-----END PRIVATE KEY-----"
```

**Insufficient Permissions:**
1. Go to GitHub App settings
2. Review and update permissions:
   - Contents: Read & Write
   - Issues: Read & Write
   - Pull requests: Read & Write
   - Checks: Read & Write
3. Install app on repositories

**Rate Limiting:**
```bash
# Implement better rate limiting in config
GITHUB_RATE_LIMIT_BUFFER=100
GITHUB_REQUEST_DELAY=1000
```

### 3. OAuth Integration Problems

**Symptoms:**
- Dashboard login failures
- "OAuth state mismatch" errors
- Redirect URI problems

**Solutions:**

**OAuth Configuration:**
```bash
# Verify OAuth app settings in GitHub
# Callback URL must match exactly
GITHUB_REDIRECT_URI=https://your-domain.com/api/auth/github/callback

# Check state parameter handling
# Clear browser cookies and try again
```

## AI Provider Issues

### 1. OpenAI API Failures

**Symptoms:**
- "Invalid API key" errors
- Rate limit exceeded
- Model not found errors

**Diagnosis:**
```bash
# Test OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check usage and limits
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Solutions:**

**Invalid API Key:**
```bash
# Verify API key in OpenAI dashboard
# Ensure key has sufficient permissions
# Update .env file
OPENAI_API_KEY=sk-proj-...
```

**Rate Limiting:**
```bash
# Implement backoff strategy
OPENAI_REQUEST_DELAY=2000
OPENAI_MAX_RETRIES=3

# Consider upgrading OpenAI plan
# Implement request queuing
```

**Model Access Issues:**
```bash
# Verify model availability
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | grep "gpt-4"

# Update model configuration if needed
DEFAULT_MODEL=gpt-3.5-turbo
FALLBACK_MODEL=gpt-3.5-turbo
```

### 2. Custom LLM Provider Issues

**Symptoms:**
- Connection timeouts
- Authentication failures
- Incompatible response formats

**Solutions:**

**Connection Issues:**
```bash
# Test custom endpoint
curl -X POST $CUSTOM_LLM_ENDPOINT/v1/chat/completions \
  -H "Authorization: Bearer $CUSTOM_LLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"test"}]}'

# Adjust timeout settings
CUSTOM_LLM_TIMEOUT=30000
```

**Format Compatibility:**
```bash
# Ensure endpoint follows OpenAI API format
# Update provider configuration if needed
CUSTOM_LLM_FORMAT=openai  # or 'custom'
```

## Performance Issues

### 1. Slow Response Times

**Symptoms:**
- Long delays in processing GitHub events
- Timeouts in dashboard
- High CPU/memory usage

**Diagnosis:**
```bash
# Check system resources
top
htop
free -h
df -h

# Monitor application performance
curl http://localhost:3000/api/metrics | grep response_time

# Check database performance
sudo -u postgres psql gitautonomic -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;
"
```

**Solutions:**

**Database Optimization:**
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_issue_agents_status ON issue_agents(status);
CREATE INDEX CONCURRENTLY idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX CONCURRENTLY idx_iterations_agent_id ON iterations(agent_id);

-- Update table statistics
ANALYZE;

-- Vacuum database
VACUUM ANALYZE;
```

**Memory Optimization:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096"

# Optimize PostgreSQL
# Edit /etc/postgresql/*/main/postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
```

**Queue Optimization:**
```bash
# Add more worker processes
WORKER_CONCURRENCY=4
QUEUE_MAX_JOBS=100

# Implement job batching
BATCH_SIZE=10
BATCH_DELAY=5000
```

### 2. Memory Leaks

**Symptoms:**
- Gradually increasing memory usage
- Application crashes due to out of memory
- Slow garbage collection

**Diagnosis:**
```bash
# Monitor memory usage over time
while true; do
  ps aux | grep node | grep -v grep
  sleep 60
done

# Check for memory leaks in Node.js
node --inspect dist/server.js
# Connect Chrome DevTools for memory profiling
```

**Solutions:**

**Memory Leak Prevention:**
```javascript
// Implement proper cleanup in application
process.on('SIGTERM', () => {
  // Close database connections
  // Clear timers and intervals
  // Cleanup temp files
});

// Configure garbage collection
NODE_OPTIONS="--max-old-space-size=4096 --gc-interval=100"
```

**Resource Cleanup:**
```bash
# Clear temporary files regularly
find /tmp/ai-agent-work -type f -mtime +1 -delete

# Implement log rotation
# Add to /etc/logrotate.d/gitautonomic
/var/log/gitautonomic/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 gitautonomic gitautonomic
}
```

## Security Issues

### 1. Access Control Problems

**Symptoms:**
- Unauthorized access to repositories
- Bypass of approval workflows
- Security policy violations

**Diagnosis:**
```bash
# Check ownership configuration
cat .aiagent-ownership.yml

# Verify security policies
npm run test-security-policies

# Review access logs
grep "access_denied" /var/log/gitautonomic/security.log
```

**Solutions:**

**Fix Ownership Rules:**
```yaml
# Update .aiagent-ownership.yml
ownership:
  - path: "src/critical/**"
    owners: ["security-team", "lead-dev"]
    required_approvals: 2
  - path: "**"
    owners: ["dev-team"]
    required_approvals: 1
```

**Strengthen Security Policies:**
```yaml
# Update .aiagent.yml
security:
  strict_mode: true
  scan_on_change: true
  required_tools: ["semgrep", "bandit"]
  block_on_high_risk: true
```

### 2. Vulnerability Scanning Issues

**Symptoms:**
- Security scans failing
- False positives blocking development
- Missing security tool outputs

**Solutions:**

**Fix Semgrep Configuration:**
```bash
# Update Semgrep rules
semgrep --config=auto --output=semgrep.json src/

# Custom rules configuration
cat > .semgrep.yml << 'EOF'
rules:
  - id: custom-rule
    pattern: dangerous_function($X)
    message: Dangerous function usage detected
    severity: WARNING
    languages: [javascript, typescript]
EOF
```

**Configure Bandit for Python:**
```bash
# Create Bandit configuration
cat > .bandit << 'EOF'
[bandit]
exclude_dirs = ['tests', 'node_modules']
skips = ['B101', 'B601']
EOF
```

## Agent Behavior Issues

### 1. Agents Not Starting

**Symptoms:**
- No response to GitHub issues
- Agents stuck in "planning" state
- Error logs showing initialization failures

**Diagnosis:**
```bash
# Check agent status
curl http://localhost:3000/api/agents | jq '.agents[] | {id, status, error}'

# View agent logs
sudo journalctl -u gitautonomic | grep -i "agent"

# Check database for stuck agents
sudo -u postgres psql gitautonomic -c "
SELECT id, status, created_at, updated_at 
FROM issue_agents 
WHERE status = 'planning' AND created_at < NOW() - INTERVAL '1 hour';
"
```

**Solutions:**

**Reset Stuck Agents:**
```sql
-- Reset stuck agents
UPDATE issue_agents 
SET status = 'failed', 
    error_message = 'Timeout - reset by administrator'
WHERE status = 'planning' 
  AND created_at < NOW() - INTERVAL '1 hour';
```

**Fix Configuration Issues:**
```bash
# Verify AI provider configuration
npm run test-ai-providers

# Check workspace permissions
ls -la /tmp/ai-agent-work/
sudo chown -R gitautonomic:gitautonomic /tmp/ai-agent-work/
```

### 2. Poor Code Quality

**Symptoms:**
- Generated code doesn't work
- Tests failing consistently
- Code style violations

**Solutions:**

**Improve Prompts:**
```yaml
# Update .aiagent.yml
ai:
  code_quality:
    enforce_style_guide: true
    run_tests_before_commit: true
    require_documentation: true
  prompts:
    code_generation: |
      Generate high-quality, production-ready code that:
      - Follows project style guidelines
      - Includes comprehensive error handling
      - Has proper documentation
      - Includes relevant tests
```

**Enhanced Quality Checks:**
```bash
# Enable additional quality gates
ENABLE_ESLINT=true
ENABLE_PRETTIER=true
ENABLE_TYPE_CHECKING=true
MIN_TEST_COVERAGE=80
```

## Monitoring and Alerting

### 1. Missing Metrics

**Symptoms:**
- Dashboard showing no data
- Alerts not firing
- Missing performance data

**Solutions:**

**Enable Metrics Collection:**
```bash
# Verify metrics endpoint
curl http://localhost:3000/api/metrics

# Check Prometheus configuration
# Add to prometheus.yml
scrape_configs:
  - job_name: 'gitautonomic'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

**Configure Alerting:**
```yaml
# alertmanager.yml
groups:
  - name: gitautonomic
    rules:
      - alert: GitAutonomicDown
        expr: up{job="gitautonomic"} == 0
        for: 5m
        annotations:
          summary: "GitAutonomic is down"
```

### 2. Log Analysis Issues

**Symptoms:**
- Logs not appearing
- Log formatting problems
- Missing structured logging

**Solutions:**

**Configure Structured Logging:**
```bash
# Update .env
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=true
```

**Log Aggregation:**
```bash
# Install and configure log aggregation
sudo apt install rsyslog
echo "local0.* /var/log/gitautonomic/app.log" >> /etc/rsyslog.conf
sudo systemctl restart rsyslog
```

## Backup and Recovery

### 1. Database Backup Issues

**Symptoms:**
- Backup scripts failing
- Corrupted backup files
- Recovery failures

**Solutions:**

**Fix Backup Script:**
```bash
#!/bin/bash
# Enhanced backup script
BACKUP_DIR="/opt/backups/gitautonomic"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database backup with compression
pg_dump -h localhost -U gitautonomic_user gitautonomic | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Verify backup integrity
gunzip -t $BACKUP_DIR/db_$DATE.sql.gz
if [ $? -ne 0 ]; then
    echo "Backup verification failed!"
    exit 1
fi

# Cleanup old backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

**Test Recovery Procedure:**
```bash
# Test database recovery
createdb gitautonomic_test
gunzip -c backup.sql.gz | psql gitautonomic_test
```

### 2. Configuration Backup

**Solutions:**
```bash
# Backup all configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  .env \
  .aiagent.yml \
  .aiagent-ownership.yml \
  /etc/systemd/system/gitautonomic.service \
  /etc/nginx/sites-available/gitautonomic
```

## Emergency Procedures

### 1. Complete System Reset

```bash
# Stop all services
sudo systemctl stop gitautonomic
sudo systemctl stop nginx

# Backup current state
cp -r /opt/gitautonomic /opt/gitautonomic.backup.$(date +%Y%m%d)

# Reset database
sudo -u postgres psql -c "DROP DATABASE gitautonomic;"
sudo -u postgres psql -c "CREATE DATABASE gitautonomic;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gitautonomic TO gitautonomic_user;"

# Reinstall application
cd /opt/gitautonomic
git pull origin main
npm install
npm run build
npm run migrate

# Restart services
sudo systemctl start gitautonomic
sudo systemctl start nginx
```

### 2. Emergency Rollback

```bash
# Stop agent processing
curl -X POST http://localhost:3000/api/admin/emergency-stop

# Rollback to previous version
cd /opt/gitautonomic
git log --oneline -10
git checkout [previous_commit_hash]
npm install
npm run build

# Restart with rollback
sudo systemctl restart gitautonomic
```

## Getting Additional Help

### 1. Log Collection for Support

```bash
# Collect comprehensive logs
mkdir -p /tmp/gitautonomic-debug
sudo journalctl -u gitautonomic --since "24 hours ago" > /tmp/gitautonomic-debug/app.log
sudo journalctl -u postgresql --since "24 hours ago" > /tmp/gitautonomic-debug/postgres.log
sudo journalctl -u redis-server --since "24 hours ago" > /tmp/gitautonomic-debug/redis.log
cp .env.example /tmp/gitautonomic-debug/  # Never include actual .env!
cp .aiagent.yml /tmp/gitautonomic-debug/
cp .aiagent-ownership.yml /tmp/gitautonomic-debug/

# Package for support
tar -czf gitautonomic-debug-$(date +%Y%m%d).tar.gz /tmp/gitautonomic-debug/
```

### 2. Health Report Generation

```bash
# Generate comprehensive health report
curl http://localhost:3000/api/health/report > health-report.json

# System information
uname -a > system-info.txt
docker --version >> system-info.txt
node --version >> system-info.txt
npm --version >> system-info.txt
pg_config --version >> system-info.txt
redis-server --version >> system-info.txt
```

### 3. Performance Profiling

```bash
# Collect performance data
curl http://localhost:3000/api/metrics > metrics.txt
ps aux | grep node > process-info.txt
free -h > memory-info.txt
df -h > disk-info.txt
netstat -tlnp > network-info.txt
```

---

*This troubleshooting guide covers the most common issues with GitAutonomic. For complex problems or additional support, please refer to the project's GitHub issues or contact the development team with the diagnostic information collected using the procedures above.*