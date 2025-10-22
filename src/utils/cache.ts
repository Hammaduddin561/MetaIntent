// Cache manager for S3-based caching

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { CacheEntry, LLMBackend } from '../models/types';
import { ENV, CACHE_TTL_SECONDS } from '../models/constants';
import { CacheError } from '../models/errors';
import * as crypto from 'crypto';

export class CacheManager {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    this.client = new S3Client({ region: ENV.AWS_REGION });
    this.bucketName = ENV.CACHE_BUCKET_NAME;
  }

  /**
   * Generate cache key from request
   */
  generateCacheKey(request: any): string {
    const requestString = JSON.stringify({
      type: request.type,
      input: request.input || request.prompt,
      context: request.context,
    });
    
    return crypto.createHash('sha256').update(requestString).digest('hex');
  }

  /**
   * Get cached entry
   */
  async get(cacheKey: string): Promise<CacheEntry | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: `cache/${cacheKey}.json`,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        return null;
      }

      const bodyString = await response.Body.transformToString();
      const entry: CacheEntry = JSON.parse(bodyString);

      // Check if cache entry is still valid
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl * 1000) {
        return null; // Cache expired
      }

      // Increment hit count
      entry.hitCount++;
      await this.set(entry);

      return entry;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return null; // Cache miss
      }
      throw new CacheError(`Failed to get cache entry: ${error.message}`);
    }
  }

  /**
   * Set cache entry
   */
  async set(entry: CacheEntry): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `cache/${entry.cacheKey}.json`,
        Body: JSON.stringify(entry),
        ContentType: 'application/json',
      });

      await this.client.send(command);
    } catch (error: any) {
      throw new CacheError(`Failed to set cache entry: ${error.message}`);
    }
  }

  /**
   * Create and store cache entry
   */
  async cacheResponse(
    request: any,
    response: any,
    llmBackend: LLMBackend
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(request);
    
    const entry: CacheEntry = {
      cacheKey,
      request: {
        type: request.type || 'unknown',
        input: request.input || request.prompt || '',
        context: request.context,
      },
      response,
      timestamp: Date.now(),
      ttl: CACHE_TTL_SECONDS,
      hitCount: 0,
      llmBackend,
    };

    await this.set(entry);
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(cacheKey: string): Promise<void> {
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: `cache/${cacheKey}.json`,
      });

      await this.client.send(command);
    } catch (error: any) {
      throw new CacheError(`Failed to invalidate cache: ${error.message}`);
    }
  }
}
