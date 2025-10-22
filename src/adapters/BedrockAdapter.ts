// AWS Bedrock adapter for Claude 4.5

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { LLMAdapter, LLMConfig, LLMResponse } from '../models/types';
import {
  LLMTimeoutError,
  LLMRateLimitError,
  LLMServiceUnavailableError,
} from '../models/errors';
import { LLM_COSTS } from '../models/constants';

export class BedrockAdapter implements LLMAdapter {
  private client: BedrockRuntimeClient;

  constructor(
    private modelId: string,
    region: string
  ) {
    this.client = new BedrockRuntimeClient({ region });
  }

  /**
   * Invoke Claude 4.5 via Bedrock
   */
  async invoke(prompt: string, config: LLMConfig): Promise<LLMResponse> {
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    if (config.systemPrompt) {
      (requestBody as any).system = config.systemPrompt;
    }

    if (config.stopSequences) {
      (requestBody as any).stop_sequences = config.stopSequences;
    }

    const input: InvokeModelCommandInput = {
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    };

    try {
      const command = new InvokeModelCommand(input);
      const response = await this.client.send(command);

      if (!response.body) {
        throw new Error('Empty response from Bedrock');
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return {
        content: responseBody.content[0].text,
        usage: {
          inputTokens: responseBody.usage.input_tokens,
          outputTokens: responseBody.usage.output_tokens,
        },
        metadata: {
          modelId: this.modelId,
          stopReason: responseBody.stop_reason,
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
    // Rough token estimation: ~4 characters per token
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = config.maxTokens;

    const inputCost = (inputTokens / 1000) * LLM_COSTS.BEDROCK_CLAUDE_INPUT;
    const outputCost = (outputTokens / 1000) * LLM_COSTS.BEDROCK_CLAUDE_OUTPUT;

    return inputCost + outputCost;
  }

  /**
   * Handle Bedrock-specific errors
   */
  private handleError(error: any): Error {
    const errorMessage = error.message || 'Unknown Bedrock error';

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
      error.name === 'ServiceUnavailableException' ||
      error.$metadata?.httpStatusCode === 503
    ) {
      return new LLMServiceUnavailableError(errorMessage);
    }

    // Generic error
    return new Error(`Bedrock error: ${errorMessage}`);
  }
}
