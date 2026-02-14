// Fallback handler for multi-tier fallback strategy

import { FallbackRequest, FallbackResponse, LLMConfig } from '../models/types';
import { LLMAdapterFactory } from '../adapters/LLMAdapterFactory';
import { CacheManager } from './cache';
import { Logger } from './logger';
import { STATIC_RESPONSES } from '../models/constants';
import {
  LLMTimeoutError,
  LLMRateLimitError,
  LLMServiceUnavailableError,
} from '../models/errors';

export class FallbackHandler {
  private cacheManager: CacheManager;
  private logger: Logger;

  constructor() {
    this.cacheManager = new CacheManager();
    this.logger = new Logger();
  }

  /**
   * Handle fallback logic when primary LLM fails
   */
  async handle(request: FallbackRequest): Promise<FallbackResponse> {
    await this.logger.warn(
      request.sessionId,
      'FallbackHandler',
      `Fallback triggered: ${request.failureReason}`,
      { attemptedBackends: request.attemptedBackends }
    );

    // Tier 1: Try alternative LLM backend
    if (!request.attemptedBackends.includes('bedrock') || !request.attemptedBackends.includes('nim')) {
      try {
        const response = await this.tryAlternativeBackend(request);
        return {
          strategy: 'alternative_backend',
          response,
          requiresUserInput: false,
        };
      } catch (error: any) {
        await this.logger.warn(
          request.sessionId,
          'FallbackHandler',
          'Alternative backend failed',
          { error: error.message }
        );
      }
    }

    // Tier 2: Try cache
    try {
      const cachedResponse = await this.tryCache(request);
      if (cachedResponse) {
        return {
          strategy: 'cache',
          response: cachedResponse,
          requiresUserInput: false,
        };
      }
    } catch (error: any) {
      await this.logger.warn(
        request.sessionId,
        'FallbackHandler',
        'Cache lookup failed',
        { error: error.message }
      );
    }

    // Tier 3: Use static flow
    const staticResponse = this.getStaticResponse(request);
    if (staticResponse) {
      return {
        strategy: 'static_flow',
        response: staticResponse,
        requiresUserInput: false,
      };
    }

    // Tier 4: Request manual user input
    return {
      strategy: 'manual',
      response: {
        message: 'We are experiencing technical difficulties. Please try again or provide more information.',
      },
      requiresUserInput: true,
    };
  }

  /**
   * Try alternative LLM backend
   */
  private async tryAlternativeBackend(request: FallbackRequest): Promise<any> {
    const fallbackBackend = request.attemptedBackends.includes('bedrock') ? 'nim' : 'bedrock';
    const adapter = LLMAdapterFactory.getAdapter(fallbackBackend);

    // Extract prompt and config from original request
    const { prompt, config } = this.extractLLMRequest(request.originalRequest);

    await this.logger.info(
      request.sessionId,
      'FallbackHandler',
      `Trying alternative backend: ${fallbackBackend}`
    );

    const response = await adapter.invoke(prompt, config);
    return response;
  }

  /**
   * Try to get response from cache
   */
  private async tryCache(request: FallbackRequest): Promise<any | null> {
    const cacheKey = this.cacheManager.generateCacheKey(request.originalRequest);
    
    await this.logger.info(
      request.sessionId,
      'FallbackHandler',
      'Checking cache for similar request'
    );

    const cachedEntry = await this.cacheManager.get(cacheKey);
    
    if (cachedEntry) {
      await this.logger.info(
        request.sessionId,
        'FallbackHandler',
        'Cache hit - using cached response'
      );
      return cachedEntry.response;
    }

    return null;
  }

  /**
   * Get static response for common scenarios
   */
  private getStaticResponse(request: FallbackRequest): any | null {
    const requestType = request.originalRequest.type || '';

    // Identity verification prompt
    if (requestType.includes('identity') || requestType.includes('verify')) {
      return STATIC_RESPONSES.IDENTITY_VERIFICATION_PROMPT;
    }

    // Clarification prompt
    if (requestType.includes('clarify') || requestType.includes('intent')) {
      return STATIC_RESPONSES.CLARIFICATION_PROMPT;
    }

    return null;
  }

  /**
   * Extract LLM request details from original request
   */
  private extractLLMRequest(originalRequest: any): { prompt: string; config: LLMConfig } {
    return {
      prompt: originalRequest.prompt || originalRequest.input || '',
      config: originalRequest.config || {
        maxTokens: 1024,
        temperature: 0.7,
      },
    };
  }

  /**
   * Determine if error should trigger fallback
   */
  static shouldTriggerFallback(error: Error): boolean {
    return (
      error instanceof LLMTimeoutError ||
      error instanceof LLMRateLimitError ||
      error instanceof LLMServiceUnavailableError
    );
  }

  /**
   * Create fallback request from error context
   */
  static createFallbackRequest(
    originalRequest: any,
    error: Error,
    attemptedBackends: string[],
    sessionId: string
  ): FallbackRequest {
    return {
      originalRequest,
      failureReason: error.message,
      attemptedBackends,
      sessionId,
    };
  }
}
