import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ThinkingSession {
  id: string;
  timestamp: Date;
  topic: string;
  thoughts: ThoughtEntry[];
  context: Record<string, any>;
  tags: string[];
  conclusion?: string;
}

export interface ThoughtEntry {
  id: string;
  timestamp: Date;
  content: string;
  type: 'thought' | 'analysis' | 'decision' | 'question' | 'conclusion';
  reasoning?: string;
  confidence?: number;
  relatedTo?: string[];
}

export interface ThinkOptions {
  topic?: string;
  context?: Record<string, any>;
  tags?: string[];
  sessionId?: string;
  saveToFile?: boolean;
  maxDuration?: number; // minutes
}

export interface ThinkResult {
  success: boolean;
  sessionId: string;
  thoughtId: string;
  summary: string;
  insights?: string[];
  actionItems?: string[];
  error?: string;
}

export class ThinkTool {
  private sessions = new Map<string, ThinkingSession>();
  private readonly storageDir = '.thinking_sessions';

  /**
   * Use for complex reasoning and brainstorming
   */
  async think(thought: string, options: ThinkOptions = {}): Promise<ThinkResult> {
    try {
      const sessionId = options.sessionId || this.generateSessionId();
      const session = await this.getOrCreateSession(sessionId, options);
      
      const thoughtEntry: ThoughtEntry = {
        id: this.generateThoughtId(),
        timestamp: new Date(),
        content: thought,
        type: this.inferThoughtType(thought),
        confidence: this.calculateConfidence(thought)
      };

      // Add reasoning analysis
      thoughtEntry.reasoning = await this.analyzeReasoning(thought, session);
      
      // Find related thoughts
      thoughtEntry.relatedTo = this.findRelatedThoughts(thought, session);

      session.thoughts.push(thoughtEntry);
      
      // Save session if requested
      if (options.saveToFile !== false) {
        await this.saveSession(session);
      }

      // Generate insights and action items
      const insights = await this.generateInsights(session);
      const actionItems = await this.generateActionItems(session);

      const summary = this.generateSummary(thoughtEntry, session);

      return {
        success: true,
        sessionId: session.id,
        thoughtId: thoughtEntry.id,
        summary,
        insights,
        actionItems
      };

    } catch (error) {
      log.error(`Think operation failed: ${error}`);
      return {
        success: false,
        sessionId: options.sessionId || 'unknown',
        thoughtId: 'unknown',
        summary: 'Failed to process thought',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Continue a thinking session with additional thoughts
   */
  async continueThinking(sessionId: string, thought: string): Promise<ThinkResult> {
    return this.think(thought, { sessionId });
  }

  /**
   * Conclude a thinking session with final thoughts
   */
  async concludeSession(sessionId: string, conclusion: string): Promise<ThinkResult> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          sessionId,
          thoughtId: 'unknown',
          summary: 'Session not found',
          error: 'Session not found'
        };
      }

      session.conclusion = conclusion;

      const conclusionEntry: ThoughtEntry = {
        id: this.generateThoughtId(),
        timestamp: new Date(),
        content: conclusion,
        type: 'conclusion',
        confidence: 0.9
      };

      session.thoughts.push(conclusionEntry);
      await this.saveSession(session);

      const finalSummary = this.generateFinalSummary(session);

      return {
        success: true,
        sessionId: session.id,
        thoughtId: conclusionEntry.id,
        summary: finalSummary,
        insights: await this.generateInsights(session),
        actionItems: await this.generateActionItems(session)
      };

    } catch (error) {
      return {
        success: false,
        sessionId,
        thoughtId: 'unknown',
        summary: 'Failed to conclude session',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get session summary
   */
  async getSessionSummary(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId) || await this.loadSession(sessionId);
    if (!session) {
      return 'Session not found';
    }

    return this.generateFinalSummary(session);
  }

  /**
   * List all thinking sessions
   */
  async listSessions(): Promise<Array<{ id: string; topic: string; thoughtCount: number; timestamp: Date }>> {
    const sessions = Array.from(this.sessions.values());
    
    // Also load sessions from disk
    try {
      const files = await fs.readdir(this.storageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          if (!this.sessions.has(sessionId)) {
            const session = await this.loadSession(sessionId);
            if (session) {
              sessions.push(session);
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist or other error
    }

    return sessions.map(session => ({
      id: session.id,
      topic: session.topic,
      thoughtCount: session.thoughts.length,
      timestamp: session.timestamp
    }));
  }

  /**
   * Search thoughts across sessions
   */
  async searchThoughts(query: string): Promise<Array<{ sessionId: string; thoughtId: string; content: string; relevance: number }>> {
    const results: Array<{ sessionId: string; thoughtId: string; content: string; relevance: number }> = [];
    const sessions = Array.from(this.sessions.values());

    for (const session of sessions) {
      for (const thought of session.thoughts) {
        const relevance = this.calculateRelevance(query, thought.content);
        if (relevance > 0.3) { // Threshold for relevance
          results.push({
            sessionId: session.id,
            thoughtId: thought.id,
            content: thought.content,
            relevance
          });
        }
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  private async getOrCreateSession(sessionId: string, options: ThinkOptions): Promise<ThinkingSession> {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try to load from disk
      const loadedSession = await this.loadSession(sessionId);
      if (loadedSession) {
        session = loadedSession;
      }
    }

    if (!session) {
      session = {
        id: sessionId,
        timestamp: new Date(),
        topic: options.topic || 'General Thinking',
        thoughts: [],
        context: options.context || {},
        tags: options.tags || []
      };
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  private async saveSession(session: ThinkingSession): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const filePath = path.join(this.storageDir, `${session.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
    } catch (error) {
      log.warn(`Could not save thinking session: ${error}`);
    }
  }

  private async loadSession(sessionId: string): Promise<ThinkingSession | null> {
    try {
      const filePath = path.join(this.storageDir, `${sessionId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(content);
      
      // Convert timestamp strings back to Date objects
      session.timestamp = new Date(session.timestamp);
      session.thoughts.forEach((thought: any) => {
        thought.timestamp = new Date(thought.timestamp);
      });

      this.sessions.set(sessionId, session);
      return session;
    } catch {
      return null;
    }
  }

  private inferThoughtType(thought: string): ThoughtEntry['type'] {
    const lowerThought = thought.toLowerCase();
    
    if (lowerThought.includes('decision') || lowerThought.includes('choose') || lowerThought.includes('conclude')) {
      return 'decision';
    }
    if (lowerThought.includes('analyze') || lowerThought.includes('examine') || lowerThought.includes('consider')) {
      return 'analysis';
    }
    if (lowerThought.includes('?') || lowerThought.includes('what if') || lowerThought.includes('how')) {
      return 'question';
    }
    if (lowerThought.includes('therefore') || lowerThought.includes('in conclusion') || lowerThought.includes('final')) {
      return 'conclusion';
    }
    
    return 'thought';
  }

  private calculateConfidence(thought: string): number {
    const certaintyIndicators = ['definitely', 'certainly', 'clearly', 'obviously', 'sure'];
    const uncertaintyIndicators = ['maybe', 'perhaps', 'might', 'could', 'uncertain', 'unclear'];
    
    const lowerThought = thought.toLowerCase();
    let confidence = 0.5; // baseline
    
    certaintyIndicators.forEach(indicator => {
      if (lowerThought.includes(indicator)) confidence += 0.1;
    });
    
    uncertaintyIndicators.forEach(indicator => {
      if (lowerThought.includes(indicator)) confidence -= 0.1;
    });
    
    return Math.max(0, Math.min(1, confidence));
  }

  private async analyzeReasoning(thought: string, session: ThinkingSession): Promise<string> {
    // Simple reasoning analysis based on thought patterns
    const reasoning: string[] = [];
    
    if (session.thoughts.length > 0) {
      reasoning.push('Building on previous thoughts');
    }
    
    if (thought.includes('because') || thought.includes('since') || thought.includes('due to')) {
      reasoning.push('Causal reasoning identified');
    }
    
    if (thought.includes('therefore') || thought.includes('thus') || thought.includes('hence')) {
      reasoning.push('Logical conclusion drawn');
    }
    
    if (thought.includes('however') || thought.includes('but') || thought.includes('although')) {
      reasoning.push('Contrasting perspective considered');
    }

    return reasoning.join('; ') || 'Direct observation';
  }

  private findRelatedThoughts(thought: string, session: ThinkingSession): string[] {
    const related: string[] = [];
    const thoughtWords = thought.toLowerCase().split(/\s+/);
    
    for (const existingThought of session.thoughts) {
      const existingWords = existingThought.content.toLowerCase().split(/\s+/);
      const commonWords = thoughtWords.filter(word => 
        existingWords.includes(word) && word.length > 3
      );
      
      if (commonWords.length > 2) {
        related.push(existingThought.id);
      }
    }
    
    return related;
  }

  private async generateInsights(session: ThinkingSession): Promise<string[]> {
    const insights: string[] = [];
    
    // Pattern analysis
    const thoughtTypes = session.thoughts.map(t => t.type);
    const uniqueTypes = [...new Set(thoughtTypes)];
    
    if (uniqueTypes.includes('analysis') && uniqueTypes.includes('decision')) {
      insights.push('Analytical thinking followed by decision-making pattern detected');
    }
    
    if (session.thoughts.length > 5) {
      insights.push('Deep exploration of the topic with multiple perspectives');
    }
    
    const avgConfidence = session.thoughts.reduce((sum, t) => sum + (t.confidence || 0.5), 0) / session.thoughts.length;
    if (avgConfidence > 0.7) {
      insights.push('High confidence in reasoning and conclusions');
    } else if (avgConfidence < 0.4) {
      insights.push('Exploratory thinking with areas needing more clarity');
    }
    
    return insights;
  }

  private async generateActionItems(session: ThinkingSession): Promise<string[]> {
    const actions: string[] = [];
    
    // Look for actionable language in thoughts
    for (const thought of session.thoughts) {
      const content = thought.content.toLowerCase();
      if (content.includes('should') || content.includes('need to') || content.includes('must')) {
        const actionText = thought.content.substring(0, 100) + (thought.content.length > 100 ? '...' : '');
        actions.push(`Consider: ${actionText}`);
      }
    }
    
    // Generic action items based on thought patterns
    if (session.thoughts.some(t => t.type === 'question')) {
      actions.push('Research answers to identified questions');
    }
    
    if (session.thoughts.some(t => t.type === 'decision')) {
      actions.push('Implement or validate decisions made');
    }
    
    return actions.slice(0, 5); // Limit to 5 action items
  }

  private generateSummary(thought: ThoughtEntry, session: ThinkingSession): string {
    return `💭 **Thought Recorded**
    
**Type:** ${thought.type}
**Confidence:** ${Math.round((thought.confidence || 0) * 100)}%
**Session:** ${session.topic}
**Total Thoughts:** ${session.thoughts.length}

**Content:** ${thought.content}`;
  }

  private generateFinalSummary(session: ThinkingSession): string {
    const thoughtsByType = session.thoughts.reduce((acc, thought) => {
      acc[thought.type] = (acc[thought.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summary = `🧠 **Thinking Session Summary**

**Topic:** ${session.topic}
**Duration:** ${session.thoughts.length} thoughts
**Started:** ${session.timestamp.toISOString()}

**Thought Distribution:**
${Object.entries(thoughtsByType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

${session.conclusion ? `\n**Conclusion:** ${session.conclusion}` : ''}

**Recent Thoughts:**
${session.thoughts.slice(-3).map(t => `- ${t.type}: ${t.content.substring(0, 100)}...`).join('\n')}`;

    return summary;
  }

  private calculateRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    const matches = queryWords.filter(word => contentWords.includes(word));
    return matches.length / queryWords.length;
  }

  private generateSessionId(): string {
    return `think_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateThoughtId(): string {
    return `thought_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

export const thinkTool = new ThinkTool();