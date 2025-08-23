// Enhanced Embedding Service for GitAutonomic
import pino from 'pino';
import { cfg } from '../config.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface EmbeddingVector {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  provider: 'openai' | 'huggingface' | 'local';
  apiKey?: string;
  endpoint?: string;
}

export class EmbeddingService {
  private vectors: Map<string, EmbeddingVector> = new Map();
  private config: EmbeddingConfig;
  private providerInstance: EmbeddingProvider | null = null;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      provider: 'openai',
      apiKey: cfg.openaiKey,
      ...config
    };
    
    this.initializeProvider();
  }

  private initializeProvider(): void {
    try {
      switch (this.config.provider) {
        case 'openai':
          this.providerInstance = new OpenAIEmbeddingProvider(this.config);
          break;
        case 'huggingface':
          this.providerInstance = new HuggingFaceEmbeddingProvider(this.config);
          break;
        case 'local':
          this.providerInstance = new LocalEmbeddingProvider(this.config);
          break;
        default:
          throw new Error(`Unsupported embedding provider: ${this.config.provider}`);
      }
      
      log.info(`Initialized ${this.config.provider} embedding provider`);
    } catch (error) {
      log.warn(`Failed to initialize embedding provider: ${error}, falling back to mock`);
      this.providerInstance = new MockEmbeddingProvider(this.config);
    }
  }

  async generateEmbedding(
    text: string, 
    metadata: Record<string, any> = {}
  ): Promise<EmbeddingVector> {
    if (!this.providerInstance) {
      throw new Error('Embedding provider not initialized');
    }

    try {
      const vector = await this.providerInstance.embed(text);
      const id = `emb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const embeddingVector: EmbeddingVector = {
        id,
        vector,
        metadata: {
          text: text.substring(0, 500), // Store truncated text for reference
          originalLength: text.length,
          ...metadata
        },
        timestamp: new Date()
      };
      
      // Store in memory for fast access
      this.vectors.set(id, embeddingVector);
      
      // Clean up old vectors periodically
      if (this.vectors.size > 10000) {
        this.cleanupOldVectors();
      }
      
      log.debug(`Generated embedding ${id} for text length ${text.length}`);
      return embeddingVector;
      
    } catch (error) {
      log.error(`Failed to generate embedding: ${error}`);
      throw error;
    }
  }

  async findSimilar(
    queryText: string, 
    limit: number = 10, 
    threshold: number = 0.7,
    metadata?: Record<string, any>
  ): Promise<SimilarityResult[]> {
    if (!this.providerInstance) {
      return [];
    }

    try {
      const queryVector = await this.providerInstance.embed(queryText);
      const results: SimilarityResult[] = [];
      
      for (const [id, embeddingVector] of this.vectors) {
        // Filter by metadata if provided
        if (metadata && !this.matchesMetadata(embeddingVector.metadata, metadata)) {
          continue;
        }
        
        const similarity = this.cosineSimilarity(queryVector, embeddingVector.vector);
        
        if (similarity >= threshold) {
          results.push({
            id,
            similarity,
            metadata: embeddingVector.metadata
          });
        }
      }
      
      // Sort by similarity and return top results
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      log.debug(`Found ${sortedResults.length} similar embeddings for query`);
      return sortedResults;
      
    } catch (error) {
      log.error(`Failed to find similar embeddings: ${error}`);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      log.warn('Vector dimension mismatch in similarity calculation');
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }
    
    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dotProduct / norm;
  }

  private matchesMetadata(
    embeddingMeta: Record<string, any>, 
    filterMeta: Record<string, any>
  ): boolean {
    for (const [key, value] of Object.entries(filterMeta)) {
      if (embeddingMeta[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private cleanupOldVectors(): void {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    let removed = 0;
    
    for (const [id, vector] of this.vectors) {
      if (vector.timestamp < cutoffTime) {
        this.vectors.delete(id);
        removed++;
      }
    }
    
    log.info(`Cleaned up ${removed} old embedding vectors`);
  }

  async getStats(): Promise<{
    totalVectors: number;
    memoryUsage: number;
    oldestVector: Date | null;
    providerType: string;
  }> {
    let oldestVector: Date | null = null;
    
    for (const vector of this.vectors.values()) {
      if (!oldestVector || vector.timestamp < oldestVector) {
        oldestVector = vector.timestamp;
      }
    }
    
    return {
      totalVectors: this.vectors.size,
      memoryUsage: this.vectors.size * this.config.dimensions * 8, // Rough estimate in bytes
      oldestVector,
      providerType: this.config.provider
    };
  }

  clearCache(): void {
    this.vectors.clear();
    log.info('Cleared embedding vector cache');
  }
}

// Abstract base class for embedding providers
abstract class EmbeddingProvider {
  constructor(protected config: EmbeddingConfig) {}
  abstract embed(text: string): Promise<number[]>;
}

// OpenAI embedding provider
class OpenAIEmbeddingProvider extends EmbeddingProvider {
  private apiKey: string;

  constructor(config: EmbeddingConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('OpenAI API key required for OpenAI embedding provider');
    }
    this.apiKey = config.apiKey;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: this.config.model
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
      
    } catch (error) {
      log.error(`OpenAI embedding failed: ${error}`);
      throw error;
    }
  }
}

// HuggingFace embedding provider
class HuggingFaceEmbeddingProvider extends EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    // Placeholder for HuggingFace implementation
    log.warn('HuggingFace embedding provider not implemented, using mock');
    return this.generateMockEmbedding(text);
  }

  private generateMockEmbedding(text: string): number[] {
    // Generate a simple hash-based pseudo-embedding
    const embedding = new Array(this.config.dimensions).fill(0);
    for (let i = 0; i < text.length && i < this.config.dimensions; i++) {
      embedding[i % this.config.dimensions] += text.charCodeAt(i) / 256;
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }
}

// Local embedding provider (for custom models)
class LocalEmbeddingProvider extends EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    // Placeholder for local model implementation
    log.warn('Local embedding provider not implemented, using mock');
    return this.generateMockEmbedding(text);
  }

  private generateMockEmbedding(text: string): number[] {
    // Generate a simple hash-based pseudo-embedding
    const embedding = new Array(this.config.dimensions).fill(0);
    for (let i = 0; i < text.length && i < this.config.dimensions; i++) {
      embedding[i % this.config.dimensions] += text.charCodeAt(i) / 256;
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }
}

// Mock embedding provider for testing
class MockEmbeddingProvider extends EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    // Generate a deterministic mock embedding based on text content
    const embedding = new Array(this.config.dimensions).fill(0);
    
    for (let i = 0; i < text.length && i < this.config.dimensions; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i % this.config.dimensions] += Math.sin(charCode * 0.1) * 0.5;
      embedding[(i + 1) % this.config.dimensions] += Math.cos(charCode * 0.1) * 0.5;
    }
    
    // Add some random noise for variability
    for (let i = 0; i < this.config.dimensions; i++) {
      embedding[i] += (Math.random() - 0.5) * 0.1;
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(val => val / norm) : embedding;
  }
}

// Export singleton instance
export const enhancedEmbeddingService = new EmbeddingService();