# GitAutonomic - User Guide

## Introduction

GitAutonomic is an autonomous AI-powered DevOps engineer that integrates seamlessly with your GitHub repositories. It automatically analyzes issues, creates development plans, implements solutions, and ensures quality through comprehensive testing and security validation.

## Getting Started

### What GitAutonomic Does

GitAutonomic functions as your AI team member that:

- **Analyzes Issues**: Understands requirements from GitHub issues and comments
- **Creates Plans**: Generates detailed development plans with task breakdowns
- **Implements Solutions**: Writes code, creates tests, and modifies existing code
- **Ensures Quality**: Runs security scans, tests, and code quality checks
- **Self-Evaluates**: Continuously assesses work quality and fills gaps
- **Communicates Progress**: Provides real-time updates and reports

### Prerequisites

- GitHub repository with GitAutonomic installed
- Basic understanding of GitHub issues and pull requests
- Familiarity with your project's codebase and requirements

## Basic Usage

### 1. Creating an Issue for GitAutonomic

GitAutonomic responds to GitHub issues. Here's how to create effective issues:

#### Issue Structure

```markdown
**Feature Request: User Authentication System**

## Description
Implement a complete user authentication system with login, registration, and password reset functionality.

## Requirements
- User registration with email verification
- Secure password hashing
- JWT token-based authentication
- Password reset functionality
- Session management
- Rate limiting for login attempts

## Acceptance Criteria
- [ ] Users can register with email and password
- [ ] Email verification required before login
- [ ] Secure password storage (bcrypt)
- [ ] JWT tokens for session management
- [ ] Password reset via email
- [ ] Login rate limiting (5 attempts per minute)
- [ ] Comprehensive test coverage
- [ ] Security audit passed

## Technical Notes
- Use existing database schema
- Follow project's coding standards
- Integrate with current error handling
- Ensure backward compatibility
```

#### Effective Issue Writing Tips

**Be Specific:**
- Include clear requirements and acceptance criteria
- Specify technical constraints or preferences
- Mention integration points with existing code

**Provide Context:**
- Reference related issues or documentation
- Include relevant file paths or components
- Explain business value and user impact

**Set Expectations:**
- Define what constitutes "done"
- Include testing requirements
- Specify documentation needs

### 2. GitAutonomic Workflow

When you create or update an issue, GitAutonomic automatically:

#### Phase 1: Analysis and Planning (1-2 minutes)
1. **Issue Analysis**: Reads and understands the requirements
2. **Codebase Exploration**: Analyzes existing code and architecture
3. **Plan Generation**: Creates detailed implementation plan
4. **Branch Creation**: Creates feature branch (e.g., `ai/issue-123-agent`)
5. **Draft PR Creation**: Opens draft pull request with the plan

#### Phase 2: Implementation (5-30 minutes depending on complexity)
1. **Task Execution**: Implements each task in the plan
2. **Code Generation**: Creates new files and modifies existing code
3. **Test Creation**: Generates comprehensive tests
4. **Security Validation**: Runs security scans
5. **Quality Checks**: Performs code quality analysis

#### Phase 3: Evaluation and Refinement (2-5 minutes)
1. **Self-Assessment**: Evaluates implementation against requirements
2. **Gap Detection**: Identifies missing functionality
3. **Plan Updates**: Adds additional tasks if needed
4. **Final Validation**: Ensures all criteria are met

#### Phase 4: Completion
1. **PR Ready**: Marks pull request as ready for review
2. **Documentation**: Updates relevant documentation
3. **Summary Report**: Provides implementation summary

### 3. Monitoring Progress

#### GitHub Status Checks

GitAutonomic provides real-time status through GitHub checks:

- **ai-plan**: ✅ Plan generation and validation
- **ai-exec**: 🔄 Implementation progress  
- **ai-eval**: 📊 Self-evaluation results
- **ai-security**: 🛡️ Security scan status
- **ai-complete**: 🎯 Overall completion status

#### Pull Request Comments

GitAutonomic posts regular updates in PR comments:

```markdown
## GitAutonomic Progress Report

**Plan v2 - Updated after self-evaluation**

### Completed Tasks (8/12)
- ✅ User model creation
- ✅ Registration endpoint
- ✅ Password hashing implementation
- ✅ JWT token generation
- ✅ Email verification system
- ✅ Login endpoint
- ✅ Password reset functionality
- ✅ Rate limiting implementation

### In Progress (2/12)
- 🔄 Session management middleware
- 🔄 Frontend integration

### Pending (2/12)
- ⏳ Comprehensive test suite
- ⏳ Security audit validation

### Quality Metrics
- Test Coverage: 87%
- Security Score: 95/100
- Code Quality: A-

**Estimated completion: 15 minutes**
```

## Advanced Usage

### 1. Controlling GitAutonomic Behavior

#### Repository Configuration

Create `.aiagent.yml` in your repository root:

```yaml
# AI Provider Configuration
provider: openai              # openai, github_models, custom
model: gpt-4o-mini           # specific model to use
temperature: 0.1             # creativity level (0.0-1.0)

# Execution Limits
max_iterations: 8            # maximum planning iterations
max_tasks_per_iteration: 4   # tasks per execution cycle
max_total_files_per_iter: 24 # file limit per iteration

# Code Modification Settings
diff:
  max_bytes: 64000          # maximum diff size
  max_deletes_ratio: 0.45   # limit code deletion
  max_file_pct_change_minor: 0.35  # change threshold

# Quality Gates
coverage:
  min_lines: 0.75           # minimum test coverage
  target_lines: 0.82        # target coverage

security:
  max_high_severity_issues: 5
  semgrep_enabled: true
  bandit_enabled: true
  eslint_security_enabled: true

# Path Restrictions
restrict_paths:
  - "src/**"                # allow modifications in src
  - "tests/**"              # allow test modifications
  - "!src/legacy/**"        # exclude legacy code
  - "!config/secrets/**"    # exclude sensitive configs

# Custom Commands
test_command: "npm test"
build_command: "npm run build"
lint_command: "npm run lint"

# Skip Patterns
skip_files:
  - "*.generated.*"
  - "node_modules/**"
  - ".git/**"
```

#### Ownership and Access Control

Create `.aiagent-ownership.yml` for fine-grained access control:

```yaml
# Global settings
default_access: read

# Path-based ownership
paths:
  # Core application - requires senior approval
  "src/core/**":
    access: restricted
    approvers:
      - senior-dev-team
      - tech-lead
    min_approvals: 2

  # API endpoints - backend team approval
  "src/api/**":
    access: controlled
    approvers:
      - backend-team
    min_approvals: 1

  # Frontend components - frontend team
  "src/components/**":
    access: controlled
    approvers:
      - frontend-team
    min_approvals: 1

  # Tests - open access
  "tests/**":
    access: open

  # Documentation - open access
  "docs/**":
    access: open

  # Configuration - restricted
  "config/**":
    access: restricted
    approvers:
      - devops-team
      - security-team
    min_approvals: 2

# Security policies
security:
  # Block modifications to sensitive files
  protected_files:
    - ".env*"
    - "secrets/**"
    - "private-keys/**"
  
  # Require security review for certain changes
  security_review_required:
    - "auth/**"
    - "security/**"
    - "payment/**"
```

### 2. Interactive Commands

You can guide GitAutonomic using special comments in issues or PRs:

#### Control Commands

```markdown
<!-- AI-CONTROL: { "action": "pause", "reason": "waiting for review" } -->
```

Available actions:
- `pause`: Temporarily stop execution
- `resume`: Resume paused execution
- `reset`: Reset to planning phase
- `priority`: Change task priority
- `skip`: Skip specific task
- `rollback`: Revert recent changes

#### Guidance Comments

Provide additional context or requirements:

```markdown
@gitautonomic Please focus on performance optimization in this implementation.
```

```markdown
@gitautonomic Use the existing UserService pattern for consistency.
```

```markdown
@gitautonomic Ensure this integrates with the current authentication middleware.
```

### 3. Quality and Security Standards

#### Automatic Quality Checks

GitAutonomic automatically:

- **Code Quality**: Analyzes complexity, maintainability, and style
- **Test Coverage**: Ensures adequate test coverage
- **Security Scanning**: Runs multiple security analysis tools
- **Performance**: Checks for common performance issues
- **Documentation**: Validates and updates documentation

#### Security Features

- **Static Analysis**: Semgrep, Bandit, ESLint Security
- **Dependency Scanning**: Known vulnerability detection
- **Secret Detection**: Prevents credential leaks
- **Access Control**: Enforces ownership policies
- **Audit Trail**: Complete change tracking

### 4. Working with Complex Issues

#### Multi-Part Features

For large features, break them into smaller, related issues:

```markdown
**Epic: E-commerce Shopping Cart**

Related Issues:
- #123 Product catalog implementation
- #124 Shopping cart functionality  
- #125 Checkout process
- #126 Payment integration
- #127 Order management

This issue focuses on the shopping cart functionality specifically.
```

#### Cross-Repository Dependencies

Reference related repositories or external dependencies:

```markdown
**Integration with User Service**

Dependencies:
- Requires API changes in user-service repository
- Database migration needed in shared-db
- Frontend updates for user-dashboard

External Dependencies:
- Stripe API integration
- Redis caching layer
```

## Dashboard and Monitoring

### 1. Accessing the Dashboard

Visit your GitAutonomic dashboard at `https://your-domain.com/dashboard`

#### Dashboard Features

- **Agent Activity**: Real-time view of active agents
- **Performance Metrics**: Success rates, execution times
- **Security Status**: Security scan results and alerts
- **Quality Trends**: Code quality metrics over time
- **Resource Usage**: API usage and cost tracking

### 2. Understanding Metrics

#### Success Metrics
- **Completion Rate**: Percentage of successfully completed issues
- **First-Pass Success**: Issues completed without re-planning
- **Quality Score**: Aggregated quality metrics
- **Security Score**: Security assessment results

#### Performance Metrics
- **Average Execution Time**: Time from issue to completion
- **Planning Accuracy**: How often initial plans are sufficient
- **Code Quality Trend**: Quality improvements over time
- **Test Coverage Growth**: Coverage percentage changes

### 3. Alerts and Notifications

Configure notifications for:
- **High-Risk Changes**: Modifications requiring extra review
- **Security Issues**: Newly discovered vulnerabilities
- **Quality Degradation**: Declining code quality metrics
- **Execution Failures**: Failed implementations requiring attention

## Best Practices

### 1. Writing Effective Issues

#### Do:
- ✅ Provide clear, specific requirements
- ✅ Include acceptance criteria
- ✅ Reference existing code patterns
- ✅ Specify testing requirements
- ✅ Include business context

#### Don't:
- ❌ Write vague or ambiguous requests
- ❌ Skip acceptance criteria
- ❌ Ignore existing code patterns
- ❌ Forget about testing needs
- ❌ Mix multiple unrelated features

### 2. Code Review Guidelines

When reviewing GitAutonomic's work:

#### Check For:
- **Requirement Coverage**: All acceptance criteria met
- **Code Quality**: Follows project standards
- **Test Adequacy**: Comprehensive test coverage
- **Security**: No security vulnerabilities
- **Integration**: Proper integration with existing code
- **Documentation**: Updated and accurate documentation

#### Review Process:
1. **Automated Checks**: Ensure all status checks pass
2. **Code Review**: Review implementation details
3. **Testing**: Verify functionality works as expected
4. **Security Review**: Check for security implications
5. **Approval**: Approve when satisfied with quality

### 3. Troubleshooting Common Issues

#### Agent Appears Stuck
1. Check GitHub status checks for error details
2. Review recent PR comments for progress updates
3. Use `@gitautonomic status` command for current state
4. Contact administrator if issue persists

#### Quality Issues
1. Review failed quality checks in PR
2. Check if issue requirements were clear enough
3. Provide additional guidance in PR comments
4. Request specific improvements needed

#### Integration Problems
1. Verify existing code patterns were referenced
2. Check for missing dependency information
3. Ensure database schema details were provided
4. Review error logs in PR comments

## Advanced Features

### 1. Multi-Agent Coordination

For complex features, GitAutonomic deploys specialized agents:

- **Frontend Agent**: UI/UX implementation
- **Backend Agent**: API and business logic
- **Security Agent**: Security validation
- **Test Agent**: Comprehensive testing
- **DevOps Agent**: Infrastructure and deployment

### 2. Learning and Adaptation

GitAutonomic learns from your codebase:

- **Pattern Recognition**: Identifies common patterns
- **Style Adaptation**: Matches your coding style
- **Architecture Understanding**: Learns your architecture
- **Team Preferences**: Adapts to team decisions

### 3. Predictive Capabilities

Advanced features include:

- **Bug Prediction**: Identifies potential issues before they occur
- **Performance Optimization**: Suggests performance improvements
- **Technical Debt**: Identifies and prioritizes technical debt
- **Capacity Planning**: Predicts resource needs

## FAQ

### General Questions

**Q: How long does GitAutonomic take to complete an issue?**
A: Simple issues (1-2 files): 5-10 minutes. Complex features: 30-60 minutes. Large refactoring: 1-3 hours.

**Q: Can GitAutonomic work on any programming language?**
A: Yes, it supports all major languages with specialized analysis for JavaScript/TypeScript, Python, Java, Go, and others.

**Q: What if I don't like the implementation?**
A: You can provide feedback in PR comments, request changes, or ask for alternative approaches.

### Technical Questions

**Q: How does GitAutonomic ensure code quality?**
A: It runs multiple quality checks including linting, security scans, test coverage analysis, and code complexity assessment.

**Q: Can GitAutonomic modify production code?**
A: Only if configured to do so. By default, it works on development branches and requires human approval for merging.

**Q: What happens if GitAutonomic makes a mistake?**
A: All changes are tracked and can be easily reverted. The system also has built-in rollback capabilities.

### Security Questions

**Q: Is GitAutonomic secure?**
A: Yes, it follows security best practices including encrypted communication, secure credential storage, and comprehensive audit logging.

**Q: Can GitAutonomic access sensitive information?**
A: Only what's necessary for its function and only with proper permissions. Sensitive files can be excluded via configuration.

**Q: How is code privacy maintained?**
A: Code is processed securely with encryption in transit and at rest. AI providers process only necessary code snippets.

## Support and Feedback

### Getting Help

1. **Documentation**: Check this guide and other documentation
2. **Dashboard**: Use the built-in dashboard for monitoring
3. **GitHub Issues**: Report issues in the GitAutonomic repository
4. **Community**: Join discussions and share experiences

### Providing Feedback

Help improve GitAutonomic by:
- Reporting bugs or unexpected behavior
- Suggesting new features or improvements
- Sharing successful use cases
- Contributing to documentation

### Best Ways to Get Support

1. **Clear Description**: Provide detailed issue descriptions
2. **Screenshots**: Include relevant screenshots or logs
3. **Context**: Share repository and configuration details
4. **Steps to Reproduce**: List steps that led to the issue

---

*This user guide covers the essential aspects of working with GitAutonomic. For technical details and advanced configuration, refer to the system architecture documentation.*