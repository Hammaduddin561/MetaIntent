// NVIDIA NIM adapter for SageMaker endpoint

import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
  InvokeEndpointCommandInput,
} from '@aws-sdk/client-sagemaker-runtime';
import { LLMAdapter, LLMConfig, LLMResponse } from '../models/types';
import {
  LLMTimeoutError,
  LLMRateLimitError,
  LLMServiceUnavailableError,
} from '../models/errors';
import { LLM_COSTS } from '../models/constants';

export class NIMAdapter implements LLMAdapter {
  private client: SageMakerRuntimeClient;

  constructor(
    private endpointName: string,
    region: string
  ) {
    this.client = new SageMakerRuntimeClient({ region });
  }

  /**
   * Invoke NVIDIA NIM via SageMaker endpoint
   */
  async invoke(prompt: string, config: LLMConfig): Promise<LLMResponse> {
    const requestBody = {
      prompt,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stop: config.stopSequences || [],
    };

    if (config.systemPrompt) {
      (requestBody as any).system_prompt = config.systemPrompt;
    }

    const input: InvokeEndpointCommandInput = {
      EndpointName: this.endpointName,
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: JSON.stringify(requestBody),
    };

    try {
      const command = new InvokeEndpointCommand(input);
      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response from NIM endpoint');
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.Body));

      // Parse NIM response format
      const content = responseBody.generated_text || responseBody.text || '';
      const inputTokens = responseBody.usage?.prompt_tokens || this.estimateTokens(prompt);
      const outputTokens = responseBody.usage?.completion_tokens || this.estimateTokens(content);

      return {
        content,
        usage: {
          inputTokens,
          outputTokens,
        },
        metadata: {
          endpointName: this.endpointName,
          model: responseBody.model || 'nim',
        },
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Invoke with retry logic
   */
  async invokeWithRetry(
    prompt: string,
    config: LLMConfig,
    retries: number
  ): Promise<LLMResponse> {
    let lastError: Error;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.invoke(prompt, config);
      } catch (error: any) {
        lastError = error;
        
        // Don't retry non-retryable errors
        if (error.retryable === false) {
          throw error;
        }

        // Wait before retry with exponential backoff
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(prompt: string, config: LLMConfig): number {
    const inputTokens = this.estimateTokens(prompt);
    const outputTokens = config.maxTokens;

    const inputCost = (inputTokens / 1000) * LLM_COSTS.NIM_INPUT;
    const outputCost = (outputTokens / 1000) * LLM_COSTS.NIM_OUTPUT;

    return inputCost + outputCost;
  }

  /**
   * Estimate token count from text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Handle SageMaker/NIM-specific errors
   */
  private handleError(error: any): Error {
    const errorMessage = error.message || 'Unknown NIM error';

    // Timeout errors
    if (error.name === 'TimeoutError' || errorMessage.includes('timeout')) {
      return new LLMTimeoutError(errorMessage);
    }

    // Rate limit errors
    if (
      error.name === 'ThrottlingException' ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('throttl')
    ) {
      return new LLMRateLimitError(errorMessage);
    }

    // Service unavailable
    if (
      error.name === 'ServiceUnavailable' ||
      error.$metadata?.httpStatusCode === 503 ||
      errorMessage.includes('endpoint') && errorMessage.includes('unavailable')
    ) {
      return new LLMServiceUnavailableError(errorMessage);
    }

    // Model not ready
    if (errorMessage.includes('ModelNotReadyException')) {
      return new LLMServiceUnavailableError('NIM endpoint not ready');
    }

    // Generic error
    return new Error(`NIM error: ${errorMessage}`);
  }
}
