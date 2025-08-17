# GitAutonomic Docker Setup

This guide explains how to quickly deploy GitAutonomic using Docker Compose with automatic setup and configuration.

## Quick Start

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file with your configuration:**
   ```bash
   nano .env
   ```
   
   Required variables:
   - `GITHUB_APP_ID` - Your GitHub App ID
   - `GITHUB_APP_PRIVATE_KEY` - Your GitHub App private key
   - `GITHUB_WEBHOOK_SECRET` - Your GitHub App webhook secret
   - `OPENAI_API_KEY` - Your OpenAI API key

   Optional variables (for web dashboard):
   - `GITHUB_CLIENT_ID` - Your GitHub OAuth App client ID
   - `GITHUB_CLIENT_SECRET` - Your GitHub OAuth App client secret

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

That's it! The setup will automatically:
- Build the application
- Start PostgreSQL database with persistent storage
- Start Redis cache with persistent storage
- Run database migrations
- Generate Prisma client
- Start the API server
- Start the background worker

## Services

The Docker Compose setup includes:

- **API Server** (`api`) - Main application server on port 3000
- **Worker** (`worker`) - Background job processor
- **PostgreSQL** (`db`) - Database on port 5433
- **Redis** (`redis`) - Cache and queue on port 6379
- **Database Setup** (`db-setup`) - One-time setup service for migrations

## Configuration

### Environment Variables

All configuration is done through the `.env` file. The Docker Compose setup will automatically use these variables.

### Port Configuration

You can customize ports in your `.env` file:
```env
PORT=3000          # API server port
DB_PORT=5433       # PostgreSQL port (external)
REDIS_PORT=6379    # Redis port (external)
```

### Data Persistence

The setup includes persistent volumes for:
- PostgreSQL data (`postgres_data` volume)
- Redis data (`redis_data` volume)

## Management Commands

### View logs
```bash
docker-compose logs -f
```

### Restart services
```bash
docker-compose restart
```

### Stop services
```bash
docker-compose down
```

### Stop and remove all data
```bash
docker-compose down -v
```

### Rebuild after code changes
```bash
docker-compose build
docker-compose up -d
```

### Run database migrations manually
```bash
docker-compose exec api npm run migrate
```

## Health Checks

All services include health checks:
- Database: PostgreSQL ready check
- Redis: Redis ping check  
- API: HTTP health endpoint check

You can check service health:
```bash
docker-compose ps
```

## Troubleshooting

### View container logs
```bash
docker-compose logs [service-name]
```

### Access database directly
```bash
docker-compose exec db psql -U postgres -d gitautonomic
```

### Access Redis directly
```bash
docker-compose exec redis redis-cli
```

### Reset database
```bash
docker-compose down
docker volume rm gitautonomic_postgres_data
docker-compose up -d
```

## Production Deployment

For production deployment, consider:

1. **Use external databases** instead of containers
2. **Set up proper backup strategies** for persistent volumes
3. **Configure reverse proxy** (nginx/traefik) for SSL termination
4. **Use Docker secrets** for sensitive environment variables
5. **Monitor container health** and set up alerting

See `docs/instrukcja-wdrożenia-pl.md` for a complete production deployment guide.