# GitAutonomic Evaluation Script - Computer Science Assignment

## Overview

This project implements an autonomous AI agent evaluation system for GitHub repositories. The evaluation script (`eval-runner.js`) demonstrates the core functionality of the system for academic purposes.

## What is GitAutonomic?

GitAutonomic is an autonomous AI bot that:
- Monitors GitHub repositories for issues and pull requests
- Automatically generates action plans to address problems
- Executes code changes, tests, and documentation updates
- **Evaluates its own progress** and adapts strategies accordingly

## The Evaluation System

The evaluation system is the "brain" that allows the AI agent to:

1. **Assess Current Progress**: Analyze completed vs pending tasks
2. **Calculate Confidence Scores**: Determine how well the agent is performing
3. **Suggest New Tasks**: Identify additional work needed for completion
4. **Adapt Strategy**: Adjust approach based on success/failure patterns
5. **Make Decisions**: Determine when to continue, pause, or finish work

## Key Features Demonstrated

### 🔍 **Intelligent Task Assessment**
- Evaluates task completion status
- Calculates risk scores for pending work
- Measures code coverage and quality metrics

### 🧠 **Self-Learning Capabilities**
- Adjusts confidence based on past performance
- Learns from successful and failed attempts
- Adapts to repository-specific patterns

### 📊 **Dynamic Task Generation**
- Automatically suggests new tasks when gaps are identified
- Prioritizes tasks based on risk and impact
- Respects configured limits to prevent task explosion

### ⚖️ **Risk Management**
- Evaluates risk scores for all operations
- Escalates high-risk changes for review
- Balances thoroughness with safety

## Technical Implementation

### Core Components

1. **evalService.ts** - Main evaluation logic
2. **eval-runner.js** - Demonstration script
3. **Configuration System** - Customizable evaluation parameters
4. **Database Integration** - Persistent storage of agent state

### Evaluation Process Flow

```
1. Fetch Agent Data
   ↓
2. Analyze Current Tasks
   ↓
3. Calculate Coverage & Metrics
   ↓
4. Generate Evaluation Report
   ↓
5. Suggest New Tasks (if needed)
   ↓
6. Update Confidence Score
   ↓
7. Determine Next Action
```

## Running the Evaluation Script

### Prerequisites
- Node.js 20+
- npm dependencies installed (`npm install`)

### Available Commands

#### 1. Demo Mode (No Database Required)
```bash
npm run eval:demo
```
Runs a complete mock evaluation with sample data to demonstrate all features.

#### 2. System Configuration
```bash
npm run eval:config
```
Displays current system configuration and evaluation parameters.

#### 3. List Active Agents (Requires Database)
```bash
npm run eval:list
```
Shows all active agents in the system with their current status.

#### 4. Run Real Evaluation (Requires Database)
```bash
npm run eval:run <agent-id>
```
Executes evaluation on a specific agent.

#### 5. Help
```bash
npm run eval:help
```
Shows usage instructions and examples.

## Sample Output

When running `npm run eval:demo`, you'll see:

```
============================================================
🤖 GitAutonomic Evaluation Script
   Computer Science Class Assignment
============================================================

📊 System Configuration:
   Auto Expand Tasks: true
   Max New Tasks/Eval: 4
   Confidence Gate: 0.55
   Risk High Threshold: 0.7
   Coverage Min Lines: 0.75

🧪 Running Mock Evaluation Demo
────────────────────────────────────────
📝 Agent Information:
   ID: demo-agent-123
   Issue: Implement user authentication system
   Current Confidence: 75.0%
   Total Tasks: 3

📋 Current Tasks:
   1. ✅ Design login UI 🟢 (risk: 20%)
   2. ⏳ Implement backend auth 🔴 (risk: 60%)
   3. ⏳ Add unit tests 🟡 (risk: 30%)

🔍 Evaluation Results:
   Coverage Score: 82.0%
   Rationale: Good progress on UI implementation...
   Confidence Adjustment: +5.0%
   New Confidence: 80.0%
   Continue Processing: Yes

🆕 Suggested New Tasks:
   1. Add password encryption [security] 🔴 (high priority)
   2. Implement session management [backend] 🟡 (medium priority)

✅ Mock evaluation completed successfully!
```

## Configuration Parameters

The system uses the following key configuration parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `eval.autoExpand` | true | Automatically create new tasks when needed |
| `eval.maxNewTasksPerEval` | 4 | Maximum new tasks to create per evaluation |
| `eval.confidenceGate` | 0.55 | Minimum confidence threshold for operations |
| `risk.highThreshold` | 0.7 | Risk score threshold for high-risk classification |
| `coverage.minLines` | 0.75 | Minimum code coverage requirement |

## Academic Value

This project demonstrates several important computer science concepts:

### 1. **Artificial Intelligence**
- Agent-based systems
- Self-evaluation and adaptation
- Decision-making algorithms

### 2. **Software Engineering**
- Automated testing and evaluation
- Continuous integration concepts
- Code quality metrics

### 3. **Database Systems**
- Persistent state management
- Transactional operations
- Data modeling

### 4. **System Architecture**
- Modular design patterns
- Configuration management
- Event-driven architecture

## Testing

The project includes comprehensive tests:

```bash
# Run all tests
npm test

# Run evaluation-specific tests
npm test tests/evalServiceBasic.test.ts
```

## Extensions and Future Work

Potential enhancements for advanced students:

1. **Machine Learning Integration**: Use ML models to improve evaluation accuracy
2. **Multi-Repository Support**: Evaluate across multiple repositories simultaneously
3. **Performance Optimization**: Implement caching and parallel processing
4. **Advanced Metrics**: Add more sophisticated code quality measurements
5. **User Interface**: Build a web dashboard for evaluation monitoring

## Conclusion

This evaluation script demonstrates a sophisticated autonomous agent system that can assess its own performance, adapt its strategies, and make intelligent decisions about next steps. It showcases modern software development practices and AI concepts suitable for computer science coursework.

The system is production-ready and actively used in real GitHub repositories, making it an excellent example of practical AI application in software development.