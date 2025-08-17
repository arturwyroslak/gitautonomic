# GitAutonomic - Deployment Guide

## Overview

This guide covers deployment strategies for GitAutonomic across different environments and platforms, from development setups to enterprise-scale production deployments.

## Deployment Architecture Options

### 1. Single-Server Deployment
**Best for:** Small teams, development environments
**Capacity:** 1-10 repositories, <100 daily issues

```
┌─────────────────────────────────────┐
│           Single Server             │
├─────────────────────────────────────┤
│  GitAutonomic App + Worker          │
│  PostgreSQL Database                │
│  Redis Queue                        │
│  Nginx Reverse Proxy               │
└─────────────────────────────────────┘
```

### 2. Multi-Service Deployment
**Best for:** Medium teams, staging environments
**Capacity:** 10-50 repositories, 100-500 daily issues

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   App Server │  │ Worker Nodes │  │   Database   │
│              │  │              │  │              │
│ GitAutonomic │  │ 2-4 Workers  │  │ PostgreSQL   │
│ Web Service  │  │ BullMQ       │  │ + Redis      │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 3. Microservices Architecture
**Best for:** Large teams, production environments
**Capacity:** 50+ repositories, 500+ daily issues

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ API Gateway │  │ Load Balancer│  │ Monitoring  │
└─────────────┘  └─────────────┘  └─────────────┘
       │                │                │
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Auth Service│  │ Web Service │  │Worker Cluster│
└─────────────┘  └─────────────┘  └─────────────┘
       │                │                │
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Database   │  │ Redis Cluster│  │AI Providers │
│  Cluster    │  │              │  │ Load Balancer│
└─────────────┘  └─────────────┘  └─────────────┘
```

## Cloud Platform Deployments

### AWS Deployment

#### 1. ECS Fargate Deployment
**Advantages:** Serverless containers, automatic scaling, managed infrastructure

**Infrastructure Setup:**
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name gitautonomic-cluster

# Create VPC and networking
aws ec2 create-vpc --cidr-block 10.0.0.0/16
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24
```

**Task Definition:**
```json
{
  "family": "gitautonomic",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "gitautonomic-app",
      "image": "your-account.dkr.ecr.region.amazonaws.com/gitautonomic:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "${DATABASE_URL}"
        },
        {
          "name": "REDIS_URL", 
          "value": "${REDIS_URL}"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:gitautonomic/openai:key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/gitautonomic",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**RDS Setup:**
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier gitautonomic-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --allocated-storage 100 \
  --storage-type gp2 \
  --db-name gitautonomic \
  --master-username dbadmin \
  --master-user-password YourSecurePassword123 \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name gitautonomic-subnet-group
```

**ElastiCache Redis:**
```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id gitautonomic-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --cache-subnet-group-name gitautonomic-cache-subnet
```

**Application Load Balancer:**
```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name gitautonomic-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx

# Create target group
aws elbv2 create-target-group \
  --name gitautonomic-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /healthz
```

#### 2. EKS Kubernetes Deployment
**Advantages:** Container orchestration, advanced scaling, multi-cloud portability

**Cluster Setup:**
```bash
# Create EKS cluster using eksctl
eksctl create cluster \
  --name gitautonomic-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10 \
  --managed
```

**Kubernetes Manifests:**
```yaml
# gitautonomic-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: gitautonomic

---
# gitautonomic-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: gitautonomic-config
  namespace: gitautonomic
data:
  DATABASE_URL: "postgresql://username:password@postgres-service:5432/gitautonomic"
  REDIS_URL: "redis://redis-service:6379"
  NODE_ENV: "production"
  PORT: "3000"

---
# gitautonomic-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: gitautonomic-secrets
  namespace: gitautonomic
type: Opaque
data:
  OPENAI_API_KEY: <base64-encoded-key>
  GITHUB_APP_PRIVATE_KEY: <base64-encoded-key>
  JWT_SECRET: <base64-encoded-secret>

---
# gitautonomic-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gitautonomic-app
  namespace: gitautonomic
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gitautonomic-app
  template:
    metadata:
      labels:
        app: gitautonomic-app
    spec:
      containers:
      - name: gitautonomic
        image: your-registry/gitautonomic:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: gitautonomic-config
        - secretRef:
            name: gitautonomic-secrets
        livenessProbe:
          httpGet:
            path: /healthz
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /healthz
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"

---
# gitautonomic-worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gitautonomic-worker
  namespace: gitautonomic
spec:
  replicas: 5
  selector:
    matchLabels:
      app: gitautonomic-worker
  template:
    metadata:
      labels:
        app: gitautonomic-worker
    spec:
      containers:
      - name: worker
        image: your-registry/gitautonomic:latest
        command: ["node", "dist/worker.js"]
        envFrom:
        - configMapRef:
            name: gitautonomic-config
        - secretRef:
            name: gitautonomic-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"

---
# gitautonomic-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: gitautonomic-service
  namespace: gitautonomic
spec:
  selector:
    app: gitautonomic-app
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
# gitautonomic-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gitautonomic-ingress
  namespace: gitautonomic
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/cert-id
spec:
  rules:
  - host: gitautonomic.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gitautonomic-service
            port:
              number: 80
```

**Horizontal Pod Autoscaler:**
```yaml
# gitautonomic-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gitautonomic-app-hpa
  namespace: gitautonomic
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gitautonomic-app
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Google Cloud Platform (GCP)

#### Cloud Run Deployment
**Advantages:** Serverless, automatic scaling, pay-per-use

```yaml
# cloudrun-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: gitautonomic
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "2"
        run.googleapis.com/max-scale: "100"
        run.googleapis.com/min-scale: "1"
    spec:
      containerConcurrency: 10
      containers:
      - image: gcr.io/PROJECT_ID/gitautonomic:latest
        ports:
        - name: http1
          containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: gitautonomic-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: gitautonomic-secrets
              key: redis-url
        resources:
          limits:
            memory: "2Gi"
            cpu: "2"
```

**Cloud SQL and Memorystore Setup:**
```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create gitautonomic-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-4096 \
  --region=us-central1 \
  --storage-size=100GB \
  --storage-type=SSD

# Create database
gcloud sql databases create gitautonomic --instance=gitautonomic-db

# Create Memorystore Redis instance
gcloud redis instances create gitautonomic-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_6_x
```

### Microsoft Azure

#### Container Instances Deployment
```bash
# Create resource group
az group create --name gitautonomic-rg --location eastus

# Create Azure Container Registry
az acr create --resource-group gitautonomic-rg \
  --name gitautonomicregistry --sku Basic

# Create container instance
az container create \
  --resource-group gitautonomic-rg \
  --name gitautonomic-app \
  --image gitautonomicregistry.azurecr.io/gitautonomic:latest \
  --cpu 2 \
  --memory 4 \
  --registry-login-server gitautonomicregistry.azurecr.io \
  --registry-username <registry-username> \
  --registry-password <registry-password> \
  --dns-name-label gitautonomic \
  --ports 3000 \
  --environment-variables \
    NODE_ENV=production \
    PORT=3000 \
  --secure-environment-variables \
    DATABASE_URL="postgresql://..." \
    OPENAI_API_KEY="sk-..."
```

#### Azure Kubernetes Service (AKS)
```bash
# Create AKS cluster
az aks create \
  --resource-group gitautonomic-rg \
  --name gitautonomic-aks \
  --node-count 3 \
  --node-vm-size Standard_D2s_v3 \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 10 \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group gitautonomic-rg --name gitautonomic-aks
```

## On-Premise Deployment

### Docker Swarm Deployment

#### 1. Initialize Swarm
```bash
# On manager node
docker swarm init --advertise-addr <manager-ip>

# On worker nodes
docker swarm join --token <worker-token> <manager-ip>:2377
```

#### 2. Deploy Stack
```yaml
# docker-compose.swarm.yml
version: '3.8'

services:
  app:
    image: gitautonomic:latest
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      placement:
        constraints:
          - node.role == worker
    networks:
      - gitautonomic-network
    volumes:
      - agent-work:/tmp/ai-agent-work

  worker:
    image: gitautonomic:latest
    command: node dist/worker.js
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 5
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      placement:
        constraints:
          - node.role == worker
    networks:
      - gitautonomic-network
    volumes:
      - agent-work:/tmp/ai-agent-work

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=gitautonomic
      - POSTGRES_USER=gitautonomic
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
    secrets:
      - postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    networks:
      - gitautonomic-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    networks:
      - gitautonomic-network

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == worker
    networks:
      - gitautonomic-network

networks:
  gitautonomic-network:
    driver: overlay
    attachable: true

volumes:
  postgres_data:
  redis_data:
  agent_work:

secrets:
  postgres_password:
    external: true
```

#### 3. Deploy to Swarm
```bash
# Create secrets
echo "secure_postgres_password" | docker secret create postgres_password -

# Deploy stack
docker stack deploy -c docker-compose.swarm.yml gitautonomic
```

### Kubernetes On-Premise

#### 1. Storage Configuration
```yaml
# storage-class.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer

---
# postgres-pv.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: fast-ssd
  local:
    path: /mnt/ssd/postgres
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - db-node-1
```

#### 2. Database Setup
```yaml
# postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: gitautonomic
        - name: POSTGRES_USER
          value: gitautonomic
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi
```

## High Availability Setup

### Database High Availability

#### PostgreSQL Streaming Replication
```bash
# Master configuration (postgresql.conf)
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
synchronous_commit = on
synchronous_standby_names = 'standby1'

# Standby configuration
standby_mode = 'on'
primary_conninfo = 'host=master-ip port=5432 user=replication'
```

#### Redis Sentinel Configuration
```bash
# redis-sentinel.conf
port 26379
sentinel monitor mymaster 127.0.0.1 6379 2
sentinel down-after-milliseconds mymaster 30000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 180000
```

### Application High Availability

#### Multi-Region Deployment
```yaml
# multi-region-setup.yaml
regions:
  primary:
    name: us-east-1
    instances: 3
    database: primary
    
  secondary:
    name: us-west-2
    instances: 2
    database: read_replica
    
  disaster_recovery:
    name: eu-west-1
    instances: 1
    database: backup_restore
```

#### Load Balancer Configuration
```nginx
# nginx-ha.conf
upstream gitautonomic_backend {
    least_conn;
    server app1.internal:3000 max_fails=3 fail_timeout=30s;
    server app2.internal:3000 max_fails=3 fail_timeout=30s;
    server app3.internal:3000 max_fails=3 fail_timeout=30s;
    server app4.internal:3000 backup;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name gitautonomic.company.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://gitautonomic_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Retry logic
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
    }
    
    location /healthz {
        access_log off;
        proxy_pass http://gitautonomic_backend;
    }
}
```

## Monitoring and Observability

### Prometheus Monitoring Setup

#### 1. Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "gitautonomic_rules.yml"

scrape_configs:
  - job_name: 'gitautonomic'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### 2. Alert Rules
```yaml
# gitautonomic_rules.yml
groups:
  - name: gitautonomic.rules
    rules:
      - alert: GitAutonomicDown
        expr: up{job="gitautonomic"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "GitAutonomic is down"
          description: "GitAutonomic has been down for more than 1 minute."
          
      - alert: HighErrorRate
        expr: rate(gitautonomic_http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          
      - alert: QueueBacklog
        expr: gitautonomic_queue_waiting_jobs > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Queue backlog detected"
          
      - alert: DatabaseConnectionLoss
        expr: gitautonomic_database_connections_active == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Database connection lost"
```

### Grafana Dashboard

#### Application Metrics Dashboard
```json
{
  "dashboard": {
    "title": "GitAutonomic Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(gitautonomic_http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Agent Performance",
        "type": "table",
        "targets": [
          {
            "expr": "gitautonomic_agent_completion_time_seconds",
            "legendFormat": "{{agent_type}}"
          }
        ]
      },
      {
        "title": "Queue Status",
        "type": "stat",
        "targets": [
          {
            "expr": "gitautonomic_queue_waiting_jobs",
            "legendFormat": "Waiting"
          },
          {
            "expr": "gitautonomic_queue_active_jobs", 
            "legendFormat": "Active"
          }
        ]
      }
    ]
  }
}
```

### Logging Setup

#### Structured Logging Configuration
```typescript
// logger.config.ts
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL
      },
      index: 'gitautonomic-logs'
    })
  ]
});
```

## Backup and Disaster Recovery

### Backup Strategy

#### 1. Database Backup
```bash
#!/bin/bash
# backup-database.sh
BACKUP_DIR="/opt/backups/gitautonomic"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h $DB_HOST -U $DB_USER -d gitautonomic \
  --verbose --no-password \
  --format=custom \
  --compress=9 \
  > $BACKUP_DIR/gitautonomic_db_$DATE.backup

# Redis backup
redis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb

# Application state backup
tar -czf $BACKUP_DIR/app_state_$DATE.tar.gz \
  /opt/gitautonomic/.env \
  /opt/gitautonomic/logs \
  /tmp/ai-agent-work

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/ s3://gitautonomic-backups/$(date +%Y/%m/%d)/ --recursive

# Cleanup old backups
find $BACKUP_DIR -name "*.backup" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.rdb" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

#### 2. Automated Backup with Kubernetes CronJob
```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: gitautonomic-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              pg_dump $DATABASE_URL | gzip > /backup/gitautonomic_$(date +%Y%m%d_%H%M%S).sql.gz
              aws s3 cp /backup/ s3://backups/gitautonomic/ --recursive
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: gitautonomic-secrets
                  key: database-url
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
```

### Disaster Recovery Procedures

#### 1. Complete System Recovery
```bash
#!/bin/bash
# disaster-recovery.sh

# Step 1: Restore infrastructure
terraform apply -var="environment=dr"

# Step 2: Restore database
pg_restore --host=$DR_DB_HOST --username=$DB_USER \
  --dbname=gitautonomic --verbose \
  latest_backup.backup

# Step 3: Restore Redis
redis-cli --rdb latest_redis.rdb

# Step 4: Deploy application
kubectl apply -f k8s/production/

# Step 5: Verify system health
curl -f http://dr-endpoint/healthz

# Step 6: Update DNS
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://failover-dns.json
```

#### 2. Point-in-Time Recovery
```bash
# Restore to specific timestamp
pg_restore --host=$DB_HOST --username=$DB_USER \
  --dbname=gitautonomic_recovery \
  --verbose \
  backup_before_incident.backup

# Compare and migrate data
psql -h $DB_HOST -U $DB_USER -d gitautonomic_recovery \
  -f migration_scripts/data_recovery.sql
```

## Security Considerations

### Network Security
```bash
# Firewall rules
ufw allow from 192.168.1.0/24 to any port 5432  # Database access
ufw allow from 0.0.0.0/0 to any port 443        # HTTPS
ufw allow from github-webhook-ips to any port 443 # GitHub webhooks
ufw deny from 0.0.0.0/0 to any port 3000        # Direct app access
```

### Secret Management
```yaml
# vault-integration.yaml
auth:
  vault:
    role: gitautonomic
    method: kubernetes
    path: auth/kubernetes

secrets:
  - name: database
    path: secret/gitautonomic/database
    keys: [url, username, password]
    
  - name: github
    path: secret/gitautonomic/github
    keys: [app_id, private_key, webhook_secret]
    
  - name: ai_providers
    path: secret/gitautonomic/ai
    keys: [openai_key, anthropic_key]
```

### Certificate Management
```yaml
# cert-manager.yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: gitautonomic-tls
spec:
  secretName: gitautonomic-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - gitautonomic.company.com
  - api.gitautonomic.company.com
```

## Performance Optimization

### Application-Level Optimizations
```typescript
// performance-optimizations.ts
export const performanceConfig = {
  // Connection pooling
  database: {
    poolSize: 20,
    idleTimeout: 30000,
    queryTimeout: 60000
  },
  
  // Redis configuration
  redis: {
    connectionPool: 10,
    commandTimeout: 5000,
    retryDelayOnFailover: 100
  },
  
  // Worker optimization
  workers: {
    concurrency: 5,
    maxConcurrency: 20,
    stalledInterval: 30000,
    retryProcess: 3
  }
};
```

### Database Performance Tuning
```sql
-- PostgreSQL performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_segments = 32;
ALTER SYSTEM SET checkpoint_completion_target = 0.7;
ALTER SYSTEM SET wal_buffers = '16MB';

-- Reload configuration
SELECT pg_reload_conf();

-- Create performance indexes
CREATE INDEX CONCURRENTLY idx_issue_agents_status_created 
ON issue_agents(status, created_at) WHERE status IN ('active', 'planning');

CREATE INDEX CONCURRENTLY idx_tasks_priority_status 
ON tasks(priority DESC, status) WHERE status = 'pending';
```

---

*This deployment guide provides comprehensive instructions for deploying GitAutonomic across various environments and platforms. Choose the deployment strategy that best fits your infrastructure requirements and scale.*