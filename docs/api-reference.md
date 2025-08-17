# GitAutonomic - API Reference

## Overview

GitAutonomic provides comprehensive REST and GraphQL APIs for integration, monitoring, and management. This document covers all available endpoints, authentication methods, and usage examples.

## Authentication

### JWT Token Authentication

Most API endpoints require JWT authentication. Obtain a token through GitHub OAuth.

```bash
# Get token via OAuth flow
curl -X POST https://your-domain.com/api/auth/github \
  -H "Content-Type: application/json" \
  -d '{"code": "github_oauth_code"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer your_jwt_token" \
  https://your-domain.com/api/agents
```

### GitHub App Authentication

For webhook and GitHub integration endpoints, use GitHub App authentication.

```bash
# GitHub webhook (signed with webhook secret)
curl -X POST https://your-domain.com/webhook \
  -H "X-GitHub-Event: issues" \
  -H "X-GitHub-Delivery: 12345-abcde" \
  -H "X-Hub-Signature-256: sha256=signature" \
  -d @webhook_payload.json
```

## Core API Endpoints

### 1. Agent Management

#### Get All Agents
```http
GET /api/agents
Authorization: Bearer <token>
```

**Response:**
```json
{
  "agents": [
    {
      "id": "agent_123",
      "installationId": 12345,
      "owner": "username",
      "repo": "repository",
      "issueNumber": 42,
      "status": "executing",
      "confidence": 0.85,
      "progress": {
        "totalTasks": 12,
        "completedTasks": 8,
        "currentTask": "Implementing user authentication"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T11:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "hasMore": true
  }
}
```

#### Get Specific Agent
```http
GET /api/agents/{agentId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "agent": {
    "id": "agent_123",
    "installationId": 12345,
    "owner": "username",
    "repo": "repository",
    "issueNumber": 42,
    "issueTitle": "Implement user authentication system",
    "branchName": "ai/issue-42-agent",
    "prNumber": 156,
    "status": "executing",
    "phase": "implementation",
    "confidence": 0.85,
    "iterations": 3,
    "planVersion": 2,
    "tasks": [
      {
        "id": "task_1",
        "title": "Create user model",
        "status": "completed",
        "riskScore": 0.2,
        "estimatedComplexity": 0.3
      },
      {
        "id": "task_2", 
        "title": "Implement authentication middleware",
        "status": "in_progress",
        "riskScore": 0.6,
        "estimatedComplexity": 0.7
      }
    ],
    "metrics": {
      "coverageLines": 0.87,
      "securityScore": 95,
      "qualityScore": 88
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "lastIterationAt": "2024-01-15T11:45:00Z"
  }
}
```

#### Control Agent
```http
POST /api/agents/{agentId}/control
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "pause|resume|reset|terminate",
  "reason": "Optional reason for the action"
}
```

#### Get Agent Logs
```http
GET /api/agents/{agentId}/logs
Authorization: Bearer <token>
```

**Query Parameters:**
- `level`: `error|warn|info|debug`
- `since`: ISO timestamp
- `limit`: Number of log entries (default: 100)

### 2. Repository Management

#### Get Repository Configuration
```http
GET /api/repos/{owner}/{repo}/config
Authorization: Bearer <token>
```

**Response:**
```json
{
  "config": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "maxIterations": 8,
    "restrictPaths": ["src/**", "tests/**"],
    "coverage": {
      "minLines": 0.75
    },
    "security": {
      "semgrepEnabled": true
    }
  },
  "ownership": {
    "defaultAccess": "read",
    "paths": {
      "src/core/**": {
        "access": "restricted",
        "approvers": ["senior-team"]
      }
    }
  }
}
```

#### Update Repository Configuration
```http
PUT /api/repos/{owner}/{repo}/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "maxIterations": 10,
  "coverage": {
    "minLines": 0.80
  }
}
```

#### Get Repository Stats
```http
GET /api/repos/{owner}/{repo}/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "stats": {
    "totalAgents": 25,
    "activeAgents": 3,
    "completedIssues": 22,
    "successRate": 0.88,
    "averageCompletionTime": "25.5 minutes",
    "qualityMetrics": {
      "averageCoverage": 0.85,
      "averageSecurityScore": 92,
      "averageQualityScore": 87
    },
    "lastActivity": "2024-01-15T11:45:00Z"
  }
}
```

### 3. Task Management

#### Get Tasks for Agent
```http
GET /api/agents/{agentId}/tasks
Authorization: Bearer <token>
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "task_1",
      "title": "Create user model",
      "description": "Implement User model with authentication fields",
      "status": "completed",
      "type": "implementation",
      "riskScore": 0.2,
      "estimatedComplexity": 0.3,
      "dependencies": [],
      "files": ["src/models/User.js"],
      "createdAt": "2024-01-15T10:30:00Z",
      "completedAt": "2024-01-15T10:45:00Z"
    }
  ]
}
```

#### Get Task Details
```http
GET /api/tasks/{taskId}
Authorization: Bearer <token>
```

#### Update Task Status
```http
PATCH /api/tasks/{taskId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "completed|blocked|in_progress",
  "notes": "Optional status update notes"
}
```

### 4. Metrics and Analytics

#### Get System Metrics
```http
GET /api/metrics/system
Authorization: Bearer <token>
```

**Response:**
```json
{
  "metrics": {
    "activeAgents": 15,
    "queuedJobs": 8,
    "systemLoad": {
      "cpu": 45.2,
      "memory": 67.8,
      "disk": 23.1
    },
    "apiUsage": {
      "requestsPerMinute": 25,
      "tokensPerMinute": 1250,
      "costPerHour": 0.15
    },
    "performance": {
      "averageResponseTime": 150,
      "successRate": 0.94,
      "errorRate": 0.06
    }
  }
}
```

#### Get Performance Analytics
```http
GET /api/analytics/performance
Authorization: Bearer <token>
```

**Query Parameters:**
- `period`: `hour|day|week|month`
- `from`: ISO timestamp
- `to`: ISO timestamp

**Response:**
```json
{
  "analytics": {
    "period": "day",
    "data": [
      {
        "timestamp": "2024-01-15T00:00:00Z",
        "completedTasks": 45,
        "averageCompletionTime": 1520,
        "successRate": 0.92,
        "qualityScore": 87.5
      }
    ],
    "summary": {
      "totalCompletedTasks": 450,
      "averageCompletionTime": 1485,
      "overallSuccessRate": 0.94
    }
  }
}
```

#### Get Quality Metrics
```http
GET /api/analytics/quality
Authorization: Bearer <token>
```

**Response:**
```json
{
  "quality": {
    "coverage": {
      "current": 0.87,
      "trend": "increasing",
      "history": [0.82, 0.84, 0.86, 0.87]
    },
    "security": {
      "score": 94,
      "criticalIssues": 0,
      "highIssues": 2,
      "mediumIssues": 5
    },
    "codeQuality": {
      "maintainabilityIndex": 78,
      "cyclomaticComplexity": 12.5,
      "technicalDebt": "2.5 hours"
    }
  }
}
```

### 5. Security and Compliance

#### Get Security Report
```http
GET /api/security/report
Authorization: Bearer <token>
```

**Query Parameters:**
- `repo`: Repository filter
- `severity`: `critical|high|medium|low`
- `since`: ISO timestamp

**Response:**
```json
{
  "report": {
    "summary": {
      "totalIssues": 12,
      "criticalIssues": 0,
      "highIssues": 2,
      "mediumIssues": 5,
      "lowIssues": 5
    },
    "issues": [
      {
        "id": "sec_001",
        "severity": "high",
        "type": "sql_injection",
        "description": "Potential SQL injection vulnerability",
        "file": "src/api/users.js",
        "line": 42,
        "recommendation": "Use parameterized queries",
        "status": "open",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "compliance": {
      "securityStandards": {
        "owasp": "compliant",
        "pci": "needs_review",
        "gdpr": "compliant"
      }
    }
  }
}
```

#### Get Audit Log
```http
GET /api/audit/log
Authorization: Bearer <token>
```

**Query Parameters:**
- `action`: Action type filter
- `user`: User filter
- `since`: ISO timestamp
- `limit`: Number of entries

### 6. Webhooks and Events

#### GitHub Webhook Endpoint
```http
POST /webhook
X-GitHub-Event: issues|pull_request|push|check_suite
X-GitHub-Delivery: unique-delivery-id
X-Hub-Signature-256: sha256=signature
Content-Type: application/json

{
  "action": "opened",
  "issue": { ... },
  "repository": { ... },
  "installation": { ... }
}
```

#### Get Webhook Deliveries
```http
GET /api/webhooks/deliveries
Authorization: Bearer <token>
```

#### Replay Webhook
```http
POST /api/webhooks/deliveries/{deliveryId}/replay
Authorization: Bearer <token>
```

### 7. Configuration Management

#### Get Installation Configuration
```http
GET /api/installations/{installationId}/config
Authorization: Bearer <token>
```

#### Update Installation Configuration
```http
PUT /api/installations/{installationId}/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "adaptiveness": {
    "enabled": true,
    "aggressiveness": 0.7
  }
}
```

### 8. Queue Management

#### Get Queue Status
```http
GET /api/queue/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "queues": {
    "plan": {
      "waiting": 5,
      "active": 2,
      "completed": 145,
      "failed": 3
    },
    "exec": {
      "waiting": 8,
      "active": 3,
      "completed": 142,
      "failed": 5
    },
    "eval": {
      "waiting": 2,
      "active": 1,
      "completed": 138,
      "failed": 2
    }
  }
}
```

#### Get Queue Jobs
```http
GET /api/queue/{queueName}/jobs
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: `waiting|active|completed|failed`
- `limit`: Number of jobs

#### Retry Failed Jobs
```http
POST /api/queue/{queueName}/retry
Authorization: Bearer <token>
Content-Type: application/json

{
  "jobIds": ["job_123", "job_456"]
}
```

## GraphQL API

### Endpoint
```
POST /api/graphql
Authorization: Bearer <token>
Content-Type: application/json
```

### Schema Overview

```graphql
type Query {
  agents(filter: AgentFilter, pagination: Pagination): AgentConnection
  agent(id: ID!): Agent
  repositories(filter: RepoFilter): [Repository]
  repository(owner: String!, name: String!): Repository
  metrics(period: TimePeriod): Metrics
  securityReport(filter: SecurityFilter): SecurityReport
}

type Mutation {
  controlAgent(id: ID!, action: AgentAction!, reason: String): Agent
  updateRepoConfig(owner: String!, name: String!, config: ConfigInput!): Repository
  retryFailedJobs(queueName: String!, jobIds: [ID!]!): [Job]
}

type Subscription {
  agentUpdates(agentId: ID): Agent
  systemMetrics: Metrics
  securityAlerts: SecurityAlert
}
```

### Example Queries

#### Get Agents with Tasks
```graphql
query GetAgentsWithTasks {
  agents(filter: { status: ACTIVE }) {
    nodes {
      id
      owner
      repo
      issueNumber
      status
      confidence
      tasks {
        id
        title
        status
        riskScore
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

#### Get Repository Analytics
```graphql
query GetRepoAnalytics($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    stats {
      totalAgents
      successRate
      averageCompletionTime
      qualityMetrics {
        coverage
        securityScore
        maintainabilityIndex
      }
    }
    recentAgents(limit: 10) {
      id
      status
      createdAt
      completedAt
    }
  }
}
```

#### Subscribe to Agent Updates
```graphql
subscription AgentUpdates($agentId: ID!) {
  agentUpdates(agentId: $agentId) {
    id
    status
    confidence
    progress {
      totalTasks
      completedTasks
      currentTask
    }
    lastUpdate
  }
}
```

## WebSocket API

### Real-time Updates

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('wss://your-domain.com/ws');
ws.onopen = () => {
  // Subscribe to agent updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'agents',
    agentId: 'agent_123'
  }));
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Agent update:', update);
};
```

### Available Channels

- `agents`: Agent status updates
- `metrics`: System metrics
- `security`: Security alerts
- `queue`: Queue status changes

## Rate Limits

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|---------|
| General API | 1000 requests | 1 hour |
| Agent Control | 100 requests | 1 hour |
| Analytics | 500 requests | 1 hour |
| GraphQL | 200 requests | 1 hour |
| WebSocket | 50 connections | per user |

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "agentId",
      "reason": "Agent not found"
    },
    "timestamp": "2024-01-15T12:00:00Z",
    "requestId": "req_123456"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_REQUIRED` | Missing or invalid authentication |
| `AUTHORIZATION_FAILED` | Insufficient permissions |
| `VALIDATION_ERROR` | Invalid request parameters |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `AGENT_BUSY` | Agent is currently busy |
| `CONFIGURATION_ERROR` | Invalid configuration |

## SDK and Client Libraries

### JavaScript/TypeScript SDK

```bash
npm install @gitautonomic/sdk
```

```javascript
import { GitAutonomicClient } from '@gitautonomic/sdk';

const client = new GitAutonomicClient({
  baseUrl: 'https://your-domain.com',
  token: 'your-jwt-token'
});

// Get agents
const agents = await client.agents.list();

// Control agent
await client.agents.control('agent_123', 'pause', 'Manual review needed');

// Get real-time updates
client.agents.subscribe('agent_123', (update) => {
  console.log('Agent update:', update);
});
```

### Python SDK

```bash
pip install gitautonomic-sdk
```

```python
from gitautonomic import GitAutonomicClient

client = GitAutonomicClient(
    base_url='https://your-domain.com',
    token='your-jwt-token'
)

# Get agents
agents = client.agents.list()

# Control agent
client.agents.control('agent_123', action='pause', reason='Manual review needed')

# Get metrics
metrics = client.metrics.system()
```

### Go SDK

```bash
go get github.com/gitautonomic/go-sdk
```

```go
package main

import (
    "github.com/gitautonomic/go-sdk"
)

func main() {
    client := gitautonomic.NewClient("https://your-domain.com", "your-jwt-token")
    
    agents, err := client.Agents.List(context.Background())
    if err != nil {
        log.Fatal(err)
    }
    
    for _, agent := range agents {
        fmt.Printf("Agent %s: %s\n", agent.ID, agent.Status)
    }
}
```

## Integration Examples

### CI/CD Integration

```yaml
# .github/workflows/gitautonomic.yml
name: GitAutonomic Integration
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  check-agent-status:
    runs-on: ubuntu-latest
    steps:
      - name: Check Agent Status
        run: |
          AGENT_ID=$(curl -H "Authorization: Bearer ${{ secrets.GITAUTONOMIC_TOKEN }}" \
            "${{ secrets.GITAUTONOMIC_URL }}/api/agents?repo=${{ github.repository }}&pr=${{ github.event.number }}" \
            | jq -r '.agents[0].id')
          
          STATUS=$(curl -H "Authorization: Bearer ${{ secrets.GITAUTONOMIC_TOKEN }}" \
            "${{ secrets.GITAUTONOMIC_URL }}/api/agents/$AGENT_ID" \
            | jq -r '.agent.status')
          
          if [ "$STATUS" = "completed" ]; then
            echo "✅ GitAutonomic agent completed successfully"
          else
            echo "⏳ GitAutonomic agent still working: $STATUS"
            exit 1
          fi
```

### Slack Integration

```javascript
// Slack bot integration
const { WebClient } = require('@slack/web-api');
const slack = new WebClient(process.env.SLACK_TOKEN);

// Listen for agent completions
client.agents.subscribe('*', async (update) => {
  if (update.status === 'completed') {
    await slack.chat.postMessage({
      channel: '#dev-notifications',
      text: `🤖 GitAutonomic completed issue #${update.issueNumber} in ${update.owner}/${update.repo}`,
      attachments: [{
        color: 'good',
        fields: [
          { title: 'Quality Score', value: update.metrics.qualityScore, short: true },
          { title: 'Coverage', value: `${update.metrics.coverage * 100}%`, short: true }
        ]
      }]
    });
  }
});
```

### Monitoring Integration

```javascript
// Prometheus metrics export
const client = require('prom-client');

const agentCounter = new client.Counter({
  name: 'gitautonomic_agents_total',
  help: 'Total number of agents',
  labelNames: ['status', 'repo']
});

const completionTime = new client.Histogram({
  name: 'gitautonomic_completion_time_seconds',
  help: 'Agent completion time',
  buckets: [60, 300, 900, 1800, 3600]
});

// Update metrics from API
setInterval(async () => {
  const agents = await gitautonomic.agents.list();
  agents.forEach(agent => {
    agentCounter.inc({ status: agent.status, repo: `${agent.owner}/${agent.repo}` });
    if (agent.completedAt) {
      const duration = new Date(agent.completedAt) - new Date(agent.createdAt);
      completionTime.observe(duration / 1000);
    }
  });
}, 30000);
```

---

*This API reference provides comprehensive documentation for integrating with GitAutonomic. For additional examples and advanced usage, refer to the SDK documentation and community examples.*