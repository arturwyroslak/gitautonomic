# GitAutonomic - Configuration Guide

## Overview

GitAutonomic offers extensive configuration options to customize its behavior for your specific project needs. This guide covers all configuration files, options, and best practices.

## Configuration Files

### 1. Environment Variables (`.env`)

The primary configuration file for system-level settings.

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456                    # Your GitHub App ID
GITHUB_APP_PRIVATE_KEY="-----BEGIN..." # GitHub App private key (PEM format)
GITHUB_WEBHOOK_SECRET=webhook_secret    # Webhook signature verification

# GitHub OAuth (Dashboard)
GITHUB_CLIENT_ID=oauth_client_id        # OAuth app client ID
GITHUB_CLIENT_SECRET=oauth_secret       # OAuth app client secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

# Authentication
JWT_SECRET=your_jwt_secret_key          # JWT token signing key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/gitautonomic
REDIS_URL=redis://localhost:6379

# AI Providers
OPENAI_API_KEY=sk-...                   # OpenAI API key
CUSTOM_LLM_ENDPOINT=                    # Custom LLM endpoint URL
CUSTOM_LLM_API_KEY=                     # Custom LLM API key
EMBEDDINGS_MODEL=text-embedding-3-small # Embedding model

# System Configuration
RISK_HIGH_THRESHOLD=0.7                 # Risk threshold (0.0-1.0)
COVERAGE_MIN_LINES=0.75                 # Minimum test coverage
AGENT_WORK_ROOT=/tmp/ai-agent-work      # Workspace directory
LOG_LEVEL=info                          # Logging level
PORT=3000                               # Server port
NODE_ENV=production                     # Environment
```

### 2. Repository Configuration (`.aiagent.yml`)

Per-repository settings that control GitAutonomic's behavior for that specific repository.

```yaml
# AI Provider Settings
provider: openai                        # AI provider: openai, github_models, custom
model: gpt-4o-mini                      # Specific model to use
temperature: 0.1                        # Response creativity (0.0-1.0)
max_tokens: 4000                        # Maximum tokens per request

# Execution Limits
max_iterations: 8                       # Maximum planning iterations
max_tasks_per_iteration: 4              # Tasks per execution cycle
max_total_files_per_iter: 24            # File modification limit per iteration
timeout_minutes: 30                     # Maximum execution time

# Code Modification Settings
diff:
  max_bytes: 64000                      # Maximum diff size in bytes
  max_deletes_ratio: 0.45               # Maximum deletion ratio
  max_file_pct_change_minor: 0.35       # File change threshold
  large_file_line_threshold: 800        # Large file definition
  enable_refine_for_large: true         # Enable refinement for large changes

# Quality Gates
coverage:
  min_lines: 0.75                       # Minimum line coverage
  target_lines: 0.82                    # Target line coverage
  min_statements: 0.70                  # Minimum statement coverage
  min_branches: 0.65                    # Minimum branch coverage
  min_functions: 0.80                   # Minimum function coverage

# Security Settings
security:
  max_high_severity_issues: 5           # Max allowed high-severity issues
  max_medium_severity_issues: 15        # Max allowed medium-severity issues
  semgrep_enabled: true                 # Enable Semgrep scanning
  bandit_enabled: true                  # Enable Bandit scanning (Python)
  eslint_security_enabled: true         # Enable ESLint security rules
  block_on_high_severity: true          # Block on high-severity findings

# Risk Assessment
risk:
  high_threshold: 0.7                   # High-risk threshold
  escalate_threshold: 0.85              # Auto-escalation threshold
  auto_approve_low_risk: true           # Auto-approve low-risk changes

# Adaptive Behavior
adaptive:
  confidence_increase_per_success: 0.07 # Confidence boost on success
  confidence_decrease_on_fail: 0.1      # Confidence penalty on failure
  min_batch: 1                          # Minimum task batch size
  max_batch: 12                         # Maximum task batch size
  dynamic_risk_weight: 0.35             # Dynamic risk weighting
  exploitation_bias: 0.55               # Exploration vs exploitation

# Termination Conditions
termination:
  required_confidence: 0.94             # Required confidence to complete
  max_idle_iterations: 4                # Max iterations without progress

# Path Restrictions
restrict_paths:
  - "src/**"                            # Allow modifications in src
  - "tests/**"                          # Allow test modifications
  - "docs/**"                           # Allow documentation updates
  - "!src/legacy/**"                    # Exclude legacy code
  - "!config/secrets/**"                # Exclude sensitive configs
  - "!node_modules/**"                  # Exclude dependencies

# File Patterns
skip_files:
  - "*.generated.*"                     # Skip generated files
  - "*.min.js"                          # Skip minified files
  - "*.bundle.*"                        # Skip bundled files
  - ".env*"                             # Skip environment files
  - "package-lock.json"                 # Skip lock files

# Commands
commands:
  test: "npm test"                      # Test command
  build: "npm run build"                # Build command
  lint: "npm run lint"                  # Lint command
  format: "npm run format"              # Format command
  type_check: "npm run type-check"      # Type checking

# Memory and Context
memory:
  max_strategic: 24                     # Max strategic memories
  max_technical: 120                    # Max technical memories
  compression_every: 5                  # Compress memory every N iterations
  min_salience_for_retention: 0.42     # Minimum salience to retain
  decay_interval_ms: 1800000           # Memory decay interval (30 min)

# Reasoning Configuration
reasoning:
  trace_enabled: true                   # Enable reasoning traces
  keep_last_per_phase: 6               # Keep N traces per phase
  meta_refine_every: 3                  # Meta-refinement frequency

# Evaluation Settings
eval:
  auto_expand: true                     # Auto-expand incomplete tasks
  max_new_tasks_per_eval: 4             # Max new tasks per evaluation
  confidence_gate: 0.55                 # Confidence threshold for evaluation

# Git Configuration
git:
  default_base: main                    # Default base branch
  commit_author_name: "AI Agent"        # Commit author name
  commit_author_email: "ai@example.com" # Commit author email
  pull_request_title_prefix: "AI Agent:" # PR title prefix
  auto_pr_create: true                  # Auto-create pull requests
  auto_merge_low_risk: false            # Auto-merge low-risk PRs

# Workspace Settings
workspace:
  temp_root: "/tmp/ai-agent-work"       # Temporary workspace root
  cleanup_after_completion: true       # Clean up after completion
  preserve_on_error: true              # Preserve workspace on errors

# Semgrep Configuration
semgrep:
  config_path: ".semgrep.yml"          # Semgrep config file
  fail_on_severity: "ERROR"            # Failure severity level
  custom_rules: []                      # Custom rule paths

# Performance Settings
performance:
  max_concurrent_tasks: 3               # Max concurrent task execution
  api_call_delay_ms: 100               # Delay between API calls
  retry_max_attempts: 3                # Max retry attempts
  retry_delay_ms: 1000                 # Retry delay

# Notification Settings
notifications:
  slack_webhook_url: ""                 # Slack notification webhook
  email_notifications: false           # Enable email notifications
  notify_on_completion: true           # Notify on task completion
  notify_on_errors: true               # Notify on errors
  notify_on_high_risk: true            # Notify on high-risk changes

# Feature Flags
features:
  enable_ast_refining: true            # Enable AST-level refining
  enable_cross_file_analysis: true     # Enable cross-file analysis
  enable_predictive_planning: true     # Enable predictive planning
  enable_multi_agent_coordination: true # Enable multi-agent mode
  enable_learning_from_feedback: true  # Enable feedback learning
```

### 3. Ownership Configuration (`.aiagent-ownership.yml`)

Defines access control and approval requirements for different parts of the codebase.

```yaml
# Global Settings
default_access: read                    # Default access level
require_human_approval: true           # Require human approval for changes
auto_approve_tests: true               # Auto-approve test-only changes
auto_approve_docs: true                # Auto-approve documentation changes

# Access Levels
# - open: Full access, no approval required
# - controlled: Requires team approval
# - restricted: Requires senior approval
# - blocked: No AI modifications allowed

# Path-based Ownership Rules
paths:
  # Core Application Logic
  "src/core/**":
    access: restricted
    description: "Core application logic requiring senior review"
    approvers:
      - senior-developers
      - tech-leads
      - architects
    min_approvals: 2
    require_security_review: true
    max_changes_per_pr: 5

  # API Endpoints
  "src/api/**":
    access: controlled
    description: "API endpoints requiring backend team approval"
    approvers:
      - backend-team
      - api-team
    min_approvals: 1
    require_tests: true
    max_file_size_kb: 50

  # Frontend Components
  "src/components/**":
    access: controlled
    description: "Frontend components requiring frontend team approval"
    approvers:
      - frontend-team
      - ui-team
    min_approvals: 1
    require_tests: true
    accessibility_check: true

  # Database Migrations
  "migrations/**":
    access: restricted
    description: "Database migrations requiring DBA approval"
    approvers:
      - database-admins
      - senior-developers
    min_approvals: 2
    require_rollback_plan: true

  # Configuration Files
  "config/**":
    access: restricted
    description: "Configuration files requiring DevOps approval"
    approvers:
      - devops-team
      - security-team
    min_approvals: 2
    require_security_review: true

  # Tests
  "tests/**":
    access: open
    description: "Test files with open access"
    auto_approve: true
    require_coverage_increase: false

  # Documentation
  "docs/**":
    access: open
    description: "Documentation with open access"
    auto_approve: true
    require_spell_check: true

  # Build and CI Configuration
  ".github/**":
    access: restricted
    description: "CI/CD configuration requiring DevOps approval"
    approvers:
      - devops-team
      - build-team
    min_approvals: 1
    require_testing: true

  # Security-Sensitive Areas
  "src/auth/**":
    access: restricted
    description: "Authentication code requiring security review"
    approvers:
      - security-team
      - senior-developers
    min_approvals: 2
    require_security_audit: true
    max_complexity_increase: 0.1

  "src/payment/**":
    access: blocked
    description: "Payment processing - no AI modifications"
    reason: "Critical financial code requires manual review only"

# Team Definitions
teams:
  senior-developers:
    members:
      - "@alice"
      - "@bob"
      - "@charlie"
    slack_channel: "#senior-devs"

  backend-team:
    members:
      - "@backend-dev1"
      - "@backend-dev2"
    slack_channel: "#backend"

  frontend-team:
    members:
      - "@frontend-dev1"
      - "@frontend-dev2"
    slack_channel: "#frontend"

  security-team:
    members:
      - "@security-lead"
      - "@security-analyst"
    slack_channel: "#security"
    escalation_email: "security@company.com"

  devops-team:
    members:
      - "@devops-engineer1"
      - "@devops-engineer2"
    slack_channel: "#devops"

# File Type Rules
file_types:
  "*.sql":
    access: restricted
    require_dba_approval: true
    max_statements: 10

  "*.env*":
    access: blocked
    reason: "Environment files contain sensitive data"

  "*.key":
    access: blocked
    reason: "Key files are security-sensitive"

  "*.test.*":
    access: open
    auto_approve: true

  "*.spec.*":
    access: open
    auto_approve: true

  "*.md":
    access: open
    auto_approve: true

# Security Policies
security:
  # Files that should never be modified
  protected_files:
    - ".env"
    - ".env.production"
    - "secrets/**"
    - "private-keys/**"
    - "certificates/**"

  # Patterns that trigger security review
  security_review_triggers:
    - "password"
    - "secret"
    - "token"
    - "auth"
    - "crypto"
    - "ssl"
    - "certificate"

  # Maximum risk score for auto-approval
  max_auto_approve_risk: 0.3

  # Require security review for these languages/frameworks
  security_review_languages:
    - "*.java"      # Java security concerns
    - "*.py"        # Python security concerns
    - "*.js"        # JavaScript security concerns

# Change Limits
limits:
  # Maximum changes per pull request
  max_files_per_pr: 25
  max_lines_added_per_pr: 1000
  max_lines_deleted_per_pr: 500
  
  # Maximum complexity increases
  max_complexity_increase: 0.2
  max_depth_increase: 2
  
  # Performance thresholds
  max_build_time_increase_percent: 10
  max_bundle_size_increase_kb: 100

# Approval Workflows
workflows:
  # Standard workflow for most changes
  standard:
    steps:
      - automated_tests
      - security_scan
      - code_review
      - approval
    
  # Fast-track for low-risk changes
  fast_track:
    conditions:
      - test_only_changes
      - documentation_only
      - low_risk_score
    steps:
      - automated_tests
      - auto_approve

  # High-security workflow for sensitive changes
  high_security:
    conditions:
      - security_sensitive_files
      - high_risk_score
      - core_system_changes
    steps:
      - automated_tests
      - security_scan
      - security_review
      - senior_approval
      - final_approval

# Notification Settings
notifications:
  # Notify on ownership rule violations
  on_access_violation:
    channels:
      - slack: "#security-alerts"
      - email: "security@company.com"
    
  # Notify on approval requests
  on_approval_request:
    channels:
      - slack: true  # Use team's slack channel
      - email: false
    
  # Notify on security issues
  on_security_issue:
    channels:
      - slack: "#security-alerts"
      - email: "security@company.com"
    urgent: true

# Override Rules
overrides:
  # Emergency override for critical fixes
  emergency:
    enabled: true
    approvers:
      - "@tech-lead"
      - "@security-lead"
    conditions:
      - production_down
      - security_incident
      - data_loss_risk
    notification_required: true
    audit_trail: true

  # Maintenance window overrides
  maintenance:
    enabled: true
    schedule:
      - "Saturday 02:00-06:00 UTC"
      - "Sunday 02:00-06:00 UTC"
    reduced_approval_requirements: true
```

### 4. Advanced Configuration Options

#### AI Provider Configuration

```yaml
# Provider-specific settings
providers:
  openai:
    model: gpt-4o-mini
    temperature: 0.1
    max_tokens: 4000
    timeout: 30000
    retry_attempts: 3
    
  github_models:
    model: gpt-4o
    endpoint: "https://models.inference.ai.azure.com"
    temperature: 0.1
    
  custom:
    endpoint: "http://localhost:11434"
    model: "codellama"
    headers:
      Authorization: "Bearer custom-token"
```

#### Memory and Learning Configuration

```yaml
memory:
  # Vector store settings
  vector_store:
    dimension: 1536
    index_type: "cosine"
    batch_size: 100
    
  # Knowledge graph settings
  knowledge_graph:
    max_nodes: 10000
    max_edges: 50000
    relationship_threshold: 0.7
    
  # Learning settings
  learning:
    feedback_weight: 0.3
    success_memory_retention: 0.9
    failure_memory_retention: 0.5
    pattern_recognition_threshold: 0.8
```

#### Performance Tuning

```yaml
performance:
  # Concurrency settings
  concurrency:
    max_concurrent_agents: 5
    max_concurrent_tasks_per_agent: 3
    queue_batch_size: 10
    
  # Caching settings
  cache:
    embedding_cache_ttl: 3600
    plan_cache_ttl: 1800
    analysis_cache_ttl: 600
    
  # Rate limiting
  rate_limits:
    api_calls_per_minute: 100
    max_file_reads_per_minute: 500
    max_git_operations_per_minute: 20
```

## Configuration Best Practices

### 1. Security Configuration

- **Restrict sensitive paths**: Always block AI access to configuration files, secrets, and critical infrastructure
- **Require approvals**: Set up appropriate approval workflows for different risk levels
- **Monitor changes**: Enable comprehensive logging and alerting
- **Regular audits**: Periodically review and update ownership rules

### 2. Quality Gates

- **Progressive thresholds**: Start with lower thresholds and gradually increase them
- **Context-aware limits**: Different limits for different types of files
- **Feedback loops**: Use quality metrics to improve configuration over time

### 3. Performance Optimization

- **Resource limits**: Set appropriate limits to prevent resource exhaustion
- **Caching strategy**: Configure caching for frequently accessed data
- **Monitoring**: Track performance metrics and adjust as needed

### 4. Team Collaboration

- **Clear ownership**: Define clear ownership and approval rules
- **Communication**: Set up appropriate notification channels
- **Documentation**: Keep configuration documented and up-to-date

## Configuration Templates

### Startup Project Template

```yaml
# .aiagent.yml for new projects
provider: openai
model: gpt-4o-mini
temperature: 0.1
max_iterations: 6
max_tasks_per_iteration: 3

coverage:
  min_lines: 0.6
  target_lines: 0.8

security:
  max_high_severity_issues: 0
  semgrep_enabled: true

restrict_paths:
  - "src/**"
  - "tests/**"
  - "docs/**"

commands:
  test: "npm test"
  build: "npm run build"
  lint: "npm run lint"
```

### Enterprise Project Template

```yaml
# .aiagent.yml for enterprise projects
provider: github_models
model: gpt-4o
temperature: 0.05
max_iterations: 10
max_tasks_per_iteration: 2

coverage:
  min_lines: 0.85
  target_lines: 0.95

security:
  max_high_severity_issues: 0
  max_medium_severity_issues: 5
  semgrep_enabled: true
  bandit_enabled: true

risk:
  high_threshold: 0.5
  auto_approve_low_risk: false

restrict_paths:
  - "src/**"
  - "tests/**"
  - "!src/core/security/**"
  - "!src/payment/**"

commands:
  test: "npm run test:full"
  build: "npm run build:production"
  lint: "npm run lint:strict"
  security: "npm run security:scan"
```

## Troubleshooting Configuration

### Common Issues

#### 1. Agent Stuck in Planning
```yaml
# Increase iteration limits
max_iterations: 12
termination:
  max_idle_iterations: 6
```

#### 2. Quality Gate Failures
```yaml
# Adjust thresholds gradually
coverage:
  min_lines: 0.70  # Start lower, increase over time
```

#### 3. Security Scan Failures
```yaml
# Allow more issues initially
security:
  max_high_severity_issues: 3
  max_medium_severity_issues: 10
```

#### 4. Performance Issues
```yaml
# Reduce concurrency
performance:
  max_concurrent_tasks: 2
  api_call_delay_ms: 200
```

### Validation Tools

Check configuration validity:
```bash
# Validate .aiagent.yml
npm run validate-config

# Test ownership rules
npm run test-ownership

# Check path restrictions
npm run check-paths
```

---

*This configuration guide provides comprehensive options for customizing GitAutonomic. Start with basic configuration and gradually add advanced features as needed.*