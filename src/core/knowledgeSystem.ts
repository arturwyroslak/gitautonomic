// Vector Embeddings and Knowledge Graph System
import { cfg } from '../config.js';
import pino from 'pino';
import { prisma } from '../storage/prisma.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface EmbeddingDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  timestamp: Date;
  type: 'code' | 'issue' | 'comment' | 'documentation' | 'plan';
}

export interface KnowledgeNode {
  id: string;
  type: 'function' | 'class' | 'module' | 'endpoint' | 'concept';
  name: string;
  properties: Record<string, any>;
  relationships: KnowledgeRelationship[];
}

export interface KnowledgeRelationship {
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'depends_on' | 'similar_to';
  target: string;
  weight: number;
  metadata: Record<string, any>;
}

export interface SemanticSearchResult {
  document: EmbeddingDocument;
  similarity: number;
  explanation: string;
}

export class VectorEmbeddingStore {
  private embeddings: Map<string, EmbeddingDocument> = new Map();
  private embeddingModel: EmbeddingModel;

  constructor(embeddingModel: EmbeddingModel) {
    this.embeddingModel = embeddingModel;
  }

  async addDocument(doc: Omit<EmbeddingDocument, 'embedding' | 'timestamp'>): Promise<void> {
    try {
      const embedding = await this.embeddingModel.embed(doc.content);
      const document: EmbeddingDocument = {
        ...doc,
        embedding,
        timestamp: new Date()
      };

      this.embeddings.set(doc.id, document);
      
      // Store in database for persistence
      await prisma.embeddingDocument.create({
        data: {
          id: doc.id,
          content: doc.content,
          metadata: JSON.stringify(doc.metadata),
          embedding: JSON.stringify(embedding),
          type: doc.type,
          timestamp: document.timestamp
        }
      });

      log.info(`Added document ${doc.id} to embedding store`);
    } catch (error) {
      log.error(`Failed to add document ${doc.id}: ${error}`);
      throw error;
    }
  }

  async semanticSearch(query: string, options: {
    type?: EmbeddingDocument['type'];
    limit?: number;
    threshold?: number;
    metadata?: Record<string, any>;
  } = {}): Promise<SemanticSearchResult[]> {
    const { limit = 10, threshold = 0.7 } = options;
    
    try {
      const queryEmbedding = await this.embeddingModel.embed(query);
      const results: SemanticSearchResult[] = [];

      for (const doc of this.embeddings.values()) {
        if (options.type && doc.type !== options.type) continue;
        if (options.metadata && !this.matchesMetadata(doc.metadata, options.metadata)) continue;
        if (!doc.embedding) continue;

        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
        if (similarity >= threshold) {
          results.push({
            document: doc,
            similarity,
            explanation: this.generateExplanation(query, doc, similarity)
          });
        }
      }

      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      log.error(`Semantic search failed: ${error}`);
      return [];
    }
  }

  async findSimilarCode(codeSnippet: string, language?: string): Promise<SemanticSearchResult[]> {
    return this.semanticSearch(codeSnippet, {
      type: 'code',
      limit: 5,
      metadata: language ? { language } : undefined
    });
  }

  async findRelevantIssues(description: string): Promise<SemanticSearchResult[]> {
    return this.semanticSearch(description, {
      type: 'issue',
      limit: 10,
      threshold: 0.6
    });
  }

  async findRelatedDocumentation(topic: string): Promise<SemanticSearchResult[]> {
    return this.semanticSearch(topic, {
      type: 'documentation',
      limit: 5,
      threshold: 0.65
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private matchesMetadata(docMetadata: Record<string, any>, queryMetadata: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(queryMetadata)) {
      if (docMetadata[key] !== value) return false;
    }
    return true;
  }

  private generateExplanation(query: string, doc: EmbeddingDocument, similarity: number): string {
    const confidence = similarity > 0.8 ? 'high' : similarity > 0.6 ? 'medium' : 'low';
    return `Found ${doc.type} with ${confidence} relevance (${Math.round(similarity * 100)}% similarity)`;
  }

  async reindexAll(): Promise<void> {
    log.info('Starting reindexing of all documents');
    
    const documents = await prisma.embeddingDocument.findMany();
    
    for (const doc of documents) {
      try {
        const embedding = await this.embeddingModel.embed(doc.content);
        
        await prisma.embeddingDocument.update({
          where: { id: doc.id },
          data: { 
            embedding: JSON.stringify(embedding),
            timestamp: new Date()
          }
        });

        this.embeddings.set(doc.id, {
          id: doc.id,
          content: doc.content,
          metadata: JSON.parse(doc.metadata),
          embedding,
          timestamp: new Date(),
          type: doc.type as EmbeddingDocument['type']
        });
      } catch (error) {
        log.error(`Failed to reindex document ${doc.id}: ${error}`);
      }
    }
    
    log.info('Reindexing completed');
  }
}

export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private adjacencyList: Map<string, Map<string, KnowledgeRelationship>> = new Map();

  async addNode(node: KnowledgeNode): Promise<void> {
    this.nodes.set(node.id, node);
    this.adjacencyList.set(node.id, new Map());

    // Store in database
    await prisma.knowledgeNode.create({
      data: {
        id: node.id,
        type: node.type,
        name: node.name,
        properties: JSON.stringify(node.properties)
      }
    });

    log.debug(`Added knowledge node: ${node.id}`);
  }

  async addRelationship(sourceId: string, relationship: KnowledgeRelationship): Promise<void> {
    if (!this.adjacencyList.has(sourceId)) {
      this.adjacencyList.set(sourceId, new Map());
    }

    this.adjacencyList.get(sourceId)!.set(relationship.target, relationship);

    // Store in database
    await prisma.knowledgeRelationship.create({
      data: {
        id: `${sourceId}-${relationship.target}-${relationship.type}`,
        sourceId,
        targetId: relationship.target,
        type: relationship.type,
        weight: relationship.weight,
        metadata: JSON.stringify(relationship.metadata)
      }
    });

    log.debug(`Added relationship: ${sourceId} -> ${relationship.target} (${relationship.type})`);
  }

  async findRelatedNodes(nodeId: string, maxDepth = 2): Promise<{
    nodes: KnowledgeNode[];
    paths: Array<{ path: string[]; weight: number }>;
  }> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; path: string[] }> = [{ id: nodeId, depth: 0, path: [nodeId] }];
    const relatedNodes: KnowledgeNode[] = [];
    const paths: Array<{ path: string[]; weight: number }> = [];

    while (queue.length > 0) {
      const { id, depth, path } = queue.shift()!;
      
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      const node = this.nodes.get(id);
      if (node && id !== nodeId) {
        relatedNodes.push(node);
        paths.push({
          path: [...path],
          weight: this.calculatePathWeight(path)
        });
      }

      if (depth < maxDepth) {
        const neighbors = this.adjacencyList.get(id);
        if (neighbors) {
          for (const [targetId, relationship] of neighbors) {
            if (!visited.has(targetId)) {
              queue.push({
                id: targetId,
                depth: depth + 1,
                path: [...path, targetId]
              });
            }
          }
        }
      }
    }

    return {
      nodes: relatedNodes,
      paths: paths.sort((a, b) => b.weight - a.weight)
    };
  }

  async findShortestPath(sourceId: string, targetId: string): Promise<{
    path: string[];
    weight: number;
    relationships: KnowledgeRelationship[];
  } | null> {
    const distances = new Map<string, number>();
    const previous = new Map<string, string>();
    const queue = new Set<string>();

    // Initialize distances
    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
      queue.add(nodeId);
    }
    distances.set(sourceId, 0);

    while (queue.size > 0) {
      // Find node with minimum distance
      let current = '';
      let minDistance = Infinity;
      for (const nodeId of queue) {
        const distance = distances.get(nodeId) || Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          current = nodeId;
        }
      }

      if (current === '' || minDistance === Infinity) break;
      
      queue.delete(current);

      if (current === targetId) break;

      const neighbors = this.adjacencyList.get(current);
      if (neighbors) {
        for (const [neighborId, relationship] of neighbors) {
          if (queue.has(neighborId)) {
            const alt = (distances.get(current) || 0) + (1 / relationship.weight);
            if (alt < (distances.get(neighborId) || Infinity)) {
              distances.set(neighborId, alt);
              previous.set(neighborId, current);
            }
          }
        }
      }
    }

    // Reconstruct path
    if (!previous.has(targetId)) return null;

    const path: string[] = [];
    const relationships: KnowledgeRelationship[] = [];
    let current = targetId;

    while (current) {
      path.unshift(current);
      const prev = previous.get(current);
      if (prev) {
        const relationship = this.adjacencyList.get(prev)?.get(current);
        if (relationship) {
          relationships.unshift(relationship);
        }
        current = prev;
      } else {
        break;
      }
    }

    return {
      path,
      weight: distances.get(targetId) || Infinity,
      relationships
    };
  }

  async analyzeClusters(): Promise<{
    clusters: Array<{ nodes: string[]; centrality: number }>;
    hubs: string[];
    bridges: string[];
  }> {
    // Simplified clustering analysis
    const clusters: Array<{ nodes: string[]; centrality: number }> = [];
    const hubs: string[] = [];
    const bridges: string[] = [];

    // Find nodes with high degree centrality (hubs)
    for (const [nodeId, relationships] of this.adjacencyList) {
      const degree = relationships.size;
      if (degree > 5) { // Threshold for hub detection
        hubs.push(nodeId);
      }
    }

    // Find bridge nodes (simplified)
    for (const nodeId of this.nodes.keys()) {
      if (this.isBridge(nodeId)) {
        bridges.push(nodeId);
      }
    }

    return { clusters, hubs, bridges };
  }

  private calculatePathWeight(path: string[]): number {
    let weight = 1;
    for (let i = 0; i < path.length - 1; i++) {
      const relationship = this.adjacencyList.get(path[i])?.get(path[i + 1]);
      if (relationship) {
        weight *= relationship.weight;
      }
    }
    return weight;
  }

  private isBridge(nodeId: string): boolean {
    // Simplified bridge detection
    const relationships = this.adjacencyList.get(nodeId);
    return relationships ? relationships.size > 1 && relationships.size < 5 : false;
  }

  async generateInsights(): Promise<{
    patterns: string[];
    anomalies: string[];
    recommendations: string[];
  }> {
    const patterns: string[] = [];
    const anomalies: string[] = [];
    const recommendations: string[] = [];

    // Analyze patterns
    const analysis = await this.analyzeClusters();
    
    if (analysis.hubs.length > 0) {
      patterns.push(`Identified ${analysis.hubs.length} hub nodes with high connectivity`);
    }

    if (analysis.bridges.length > 0) {
      patterns.push(`Found ${analysis.bridges.length} bridge nodes that connect different parts of the system`);
    }

    // Detect anomalies
    for (const [nodeId, node] of this.nodes) {
      const relationships = this.adjacencyList.get(nodeId);
      if (relationships && relationships.size === 0) {
        anomalies.push(`Isolated node detected: ${node.name}`);
      }
    }

    // Generate recommendations
    if (analysis.hubs.length > 10) {
      recommendations.push('Consider refactoring to reduce coupling around hub nodes');
    }

    if (anomalies.length > 5) {
      recommendations.push('Review isolated components for potential removal or integration');
    }

    return { patterns, anomalies, recommendations };
  }
}

export class LearningFeedbackLoop {
  private feedbackHistory: Map<string, FeedbackEvent[]> = new Map();

  async processFeedback(feedback: {
    agentId: string;
    action: string;
    outcome: 'success' | 'failure' | 'partial';
    userRating?: number;
    comments?: string;
    context: Record<string, any>;
  }): Promise<void> {
    const event: FeedbackEvent = {
      ...feedback,
      timestamp: new Date(),
      processed: false
    };

    if (!this.feedbackHistory.has(feedback.agentId)) {
      this.feedbackHistory.set(feedback.agentId, []);
    }

    this.feedbackHistory.get(feedback.agentId)!.push(event);

    // Store in database
    await prisma.feedbackEvent.create({
      data: {
        id: `${feedback.agentId}-${Date.now()}`,
        agentId: feedback.agentId,
        action: feedback.action,
        outcome: feedback.outcome,
        userRating: feedback.userRating,
        comments: feedback.comments,
        context: JSON.stringify(feedback.context),
        timestamp: event.timestamp,
        processed: false
      }
    });

    // Trigger learning update
    await this.updateLearningModel(feedback);
  }

  private async updateLearningModel(feedback: any): Promise<void> {
    // Update learning model based on feedback
    // This would involve updating ML model weights, preferences, etc.
    log.info(`Updating learning model with feedback for agent ${feedback.agentId}`);
  }

  async generateActionableInsights(agentId: string): Promise<{
    successPatterns: string[];
    failurePatterns: string[];
    improvementSuggestions: string[];
    confidenceScore: number;
  }> {
    const history = this.feedbackHistory.get(agentId) || [];
    const successPatterns: string[] = [];
    const failurePatterns: string[] = [];
    const improvementSuggestions: string[] = [];

    // Analyze success patterns
    const successes = history.filter(f => f.outcome === 'success');
    const failures = history.filter(f => f.outcome === 'failure');

    if (successes.length > 0) {
      successPatterns.push(`${successes.length} successful actions identified`);
    }

    if (failures.length > 0) {
      failurePatterns.push(`${failures.length} failed actions require attention`);
    }

    // Generate improvement suggestions
    if (failures.length > successes.length) {
      improvementSuggestions.push('Consider adjusting approach based on failure patterns');
    }

    const confidenceScore = successes.length / Math.max(history.length, 1);

    return {
      successPatterns,
      failurePatterns,
      improvementSuggestions,
      confidenceScore
    };
  }
}

interface EmbeddingModel {
  embed(text: string): Promise<number[]>;
}

interface FeedbackEvent {
  agentId: string;
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  userRating?: number;
  comments?: string;
  context: Record<string, any>;
  timestamp: Date;
  processed: boolean;
}

export {
  EmbeddingDocument,
  KnowledgeNode,
  KnowledgeRelationship,
  SemanticSearchResult,
  EmbeddingModel,
  FeedbackEvent
};