// Embedding service for vector-based memory and similarity search
import OpenAI from 'openai';
import { cfg } from '../config.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface EmbeddingVector {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  text: string;
  timestamp: Date;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
  metadata: Record<string, any>;
  text: string;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'local' | 'huggingface';
  model: string;
  dimensions: number;
  maxTokens: number;
  batchSize: number;
}

export class EmbeddingService {
  private openai?: OpenAI;
  private embeddings: Map<string, EmbeddingVector> = new Map();
  private config: EmbeddingConfig;

  constructor() {
    this.config = {
      provider: (process.env.EMBEDDINGS_PROVIDER as any) || 'openai',
      model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
      dimensions: parseInt(process.env.EMBEDDINGS_DIMENSIONS || '1536'),
      maxTokens: parseInt(process.env.EMBEDDINGS_MAX_TOKENS || '8192'),
      batchSize: parseInt(process.env.EMBEDDINGS_BATCH_SIZE || '100')
    };

    if (this.config.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  async generateEmbedding(text: string, metadata: Record<string, any> = {}): Promise<EmbeddingVector> {
    try {
      const cleanedText = this.preprocessText(text);
      
      let vector: number[];
      
      switch (this.config.provider) {
        case 'openai':
          vector = await this.generateOpenAIEmbedding(cleanedText);
          break;
        case 'local':
          vector = await this.generateLocalEmbedding(cleanedText);
          break;
        case 'huggingface':
          vector = await this.generateHuggingFaceEmbedding(cleanedText);
          break;
        default:
          throw new Error(`Unsupported embedding provider: ${this.config.provider}`);
      }

      const embedding: EmbeddingVector = {
        id: this.generateId(text, metadata),
        vector,
        metadata,
        text: cleanedText,
        timestamp: new Date()
      };

      this.embeddings.set(embedding.id, embedding);
      return embedding;

    } catch (error) {
      log.error(`Failed to generate embedding: ${error}`);
      throw error;
    }
  }

  async generateBatchEmbeddings(
    texts: string[], 
    metadataList: Record<string, any>[] = []
  ): Promise<EmbeddingVector[]> {
    const results: EmbeddingVector[] = [];
    
    // Process in batches to avoid API rate limits
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchMetadata = metadataList.slice(i, i + this.config.batchSize);
      
      const batchPromises = batch.map((text, index) => 
        this.generateEmbedding(text, batchMetadata[index] || {})
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to respect rate limits
      if (i + this.config.batchSize < texts.length) {
        await this.delay(100);
      }
    }
    
    return results;
  }

  async findSimilar(
    queryText: string, 
    limit: number = 10, 
    threshold: number = 0.7,
    filterMetadata?: Record<string, any>
  ): Promise<SimilarityResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      const results: SimilarityResult[] = [];

      for (const [id, embedding] of this.embeddings) {
        // Apply metadata filters if provided
        if (filterMetadata && !this.matchesFilter(embedding.metadata, filterMetadata)) {
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding.vector, embedding.vector);
        
        if (similarity >= threshold) {
          results.push({
            id,
            similarity,
            metadata: embedding.metadata,
            text: embedding.text
          });
        }
      }

      // Sort by similarity descending and limit results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      log.error(`Similarity search failed: ${error}`);
      throw error;
    }
  }

  async findSemanticMatches(
    concepts: string[],
    context: string = '',
    limit: number = 5
  ): Promise<SimilarityResult[]> {
    // Combine concepts and context for richer query
    const queryText = context 
      ? `${context}\n\nKey concepts: ${concepts.join(', ')}`
      : concepts.join(' ');

    return await this.findSimilar(queryText, limit, 0.6);
  }

  async clusterEmbeddings(
    embeddings: EmbeddingVector[],
    numClusters: number = 5
  ): Promise<Array<{ centroid: number[]; members: EmbeddingVector[] }>> {
    if (embeddings.length < numClusters) {
      // Not enough data for clustering
      return embeddings.map(emb => ({
        centroid: emb.vector,
        members: [emb]
      }));
    }

    // Simple k-means clustering implementation
    const clusters = this.kMeansClustering(embeddings, numClusters);
    return clusters;
  }

  async updateEmbedding(id: string, text?: string, metadata?: Record<string, any>): Promise<EmbeddingVector | null> {
    const existing = this.embeddings.get(id);
    if (!existing) return null;

    const updatedText = text || existing.text;
    const updatedMetadata = { ...existing.metadata, ...metadata };

    // Only regenerate embedding if text changed
    let vector = existing.vector;
    if (text && text !== existing.text) {
      const newEmbedding = await this.generateEmbedding(updatedText);
      vector = newEmbedding.vector;
    }

    const updated: EmbeddingVector = {
      ...existing,
      text: updatedText,
      metadata: updatedMetadata,
      vector,
      timestamp: new Date()
    };

    this.embeddings.set(id, updated);
    return updated;
  }

  async removeEmbedding(id: string): Promise<boolean> {
    return this.embeddings.delete(id);
  }

  async exportEmbeddings(): Promise<EmbeddingVector[]> {
    return Array.from(this.embeddings.values());
  }

  async importEmbeddings(embeddings: EmbeddingVector[]): Promise<void> {
    for (const embedding of embeddings) {
      this.embeddings.set(embedding.id, embedding);
    }
  }

  getStats(): {
    total: number;
    dimensions: number;
    memoryUsage: string;
    provider: string;
  } {
    const total = this.embeddings.size;
    const sampleVector = Array.from(this.embeddings.values())[0];
    const dimensions = sampleVector?.vector.length || this.config.dimensions;
    
    // Rough memory calculation
    const bytesPerFloat = 8; // double precision
    const estimatedBytes = total * dimensions * bytesPerFloat;
    const memoryUsage = this.formatBytes(estimatedBytes);

    return {
      total,
      dimensions,
      memoryUsage,
      provider: this.config.provider
    };
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.embeddings.create({
      model: this.config.model,
      input: text
    });

    return response.data[0]?.embedding || [];
  }

  private async generateLocalEmbedding(text: string): Promise<number[]> {
    // Placeholder for local embedding model integration
    // In practice, this would interface with Ollama, Sentence Transformers, etc.
    log.warn('Local embedding generation not implemented - returning mock embedding');
    
    // Return a mock embedding vector
    return Array.from({ length: this.config.dimensions }, () => Math.random() * 2 - 1);
  }

  private async generateHuggingFaceEmbedding(text: string): Promise<number[]> {
    // Placeholder for Hugging Face API integration
    log.warn('Hugging Face embedding generation not implemented - returning mock embedding');
    
    // Return a mock embedding vector
    return Array.from({ length: this.config.dimensions }, () => Math.random() * 2 - 1);
  }

  private preprocessText(text: string): string {
    // Clean and normalize text for embedding
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.-]/g, '')
      .trim()
      .slice(0, this.config.maxTokens * 4); // Rough token estimation
  }

  private generateId(text: string, metadata: Record<string, any>): string {
    // Generate deterministic ID based on content
    const content = JSON.stringify({ text: text.slice(0, 100), metadata });
    return Buffer.from(content).toString('base64').slice(0, 16);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private matchesFilter(metadata: Record<string, any>, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private kMeansClustering(
    embeddings: EmbeddingVector[], 
    k: number, 
    maxIterations: number = 100
  ): Array<{ centroid: number[]; members: EmbeddingVector[] }> {
    const dimensions = embeddings[0]?.vector.length || this.config.dimensions;
    
    // Initialize centroids randomly
    let centroids: number[][] = Array.from({ length: k }, () =>
      Array.from({ length: dimensions }, () => Math.random() * 2 - 1)
    );

    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign points to clusters
      const clusters: EmbeddingVector[][] = Array.from({ length: k }, () => []);
      
      for (const embedding of embeddings) {
        if (!embedding.vector) continue;
        
        let bestCluster = 0;
        let bestSimilarity = -1;
        
        for (let i = 0; i < k; i++) {
          const centroid = centroids[i];
          if (!centroid) continue;
          const similarity = this.cosineSimilarity(embedding.vector, centroid);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestCluster = i;
          }
        }
        
        clusters[bestCluster]?.push(embedding);
      }

      // Update centroids
      const newCentroids: number[][] = clusters.map(cluster => {
        if (cluster.length === 0) return centroids[0] || Array.from({ length: dimensions }, () => 0);
        
        const sum = Array.from({ length: dimensions }, () => 0);
        for (const embedding of cluster) {
          if (!embedding.vector) continue;
          for (let i = 0; i < dimensions; i++) {
            const value = embedding.vector[i];
            if (value !== undefined) {
              sum[i] = (sum[i] || 0) + value;
            }
          }
        }
        
        return sum.map(val => val / cluster.length);
      });

      // Check for convergence
      const converged = centroids.every((centroid, i) => {
        const newCentroid = newCentroids[i];
        return newCentroid && this.cosineSimilarity(centroid, newCentroid) > 0.99;
      });

      centroids = newCentroids;
      
      if (converged) break;
    }

    // Final assignment
    const finalClusters: Array<{ centroid: number[]; members: EmbeddingVector[] }> = 
      centroids.map(centroid => ({ centroid, members: [] }));

    for (const embedding of embeddings) {
      if (!embedding.vector) continue;
      
      let bestCluster = 0;
      let bestSimilarity = -1;
      
      for (let i = 0; i < k; i++) {
        const centroid = centroids[i];
        if (!centroid) continue;
        const similarity = this.cosineSimilarity(embedding.vector, centroid);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = i;
        }
      }
      
      finalClusters[bestCluster]?.members.push(embedding);
    }

    return finalClusters;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const embeddingService = new EmbeddingService();