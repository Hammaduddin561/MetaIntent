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
    const modelId = this.modelId;
    const isAnthropic = modelId.includes('anthropic');
    const isMeta = modelId.includes('meta.llama');
    const isMistral = modelId.includes('mistral');

    let requestBody: any;

    if (isAnthropic) {
      requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [{ role: 'user', content: prompt }],
      };
      if (config.systemPrompt) requestBody.system = config.systemPrompt;
      if (config.stopSequences) requestBody.stop_sequences = config.stopSequences;
    } else if (isMeta) {
      const fullPrompt = config.systemPrompt
        ? `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${config.systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n`
        : `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n`;
      requestBody = {
        prompt: fullPrompt,
        max_gen_len: config.maxTokens,
        temperature: Math.max(0.01, config.temperature), // Llama doesn't accept 0
      };
    } else if (isMistral) {
      const sysPrefix = config.systemPrompt ? `${config.systemPrompt}\n\n` : '';
      requestBody = {
        prompt: `<s>[INST] ${sysPrefix}${prompt} [/INST]`,
        max_tokens: config.maxTokens,
        temperature: Math.max(0.01, config.temperature),
      };
    } else {
      // Generic fallback — try Anthropic format
      requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [{ role: 'user', content: prompt }],
      };
    }

    const input: InvokeModelCommandInput = {
      modelId: modelId,
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

      // Parse response based on model provider
      if (isAnthropic) {
        return {
          content: responseBody.content[0].text,
          usage: {
            inputTokens: responseBody.usage.input_tokens,
            outputTokens: responseBody.usage.output_tokens,
          },
          metadata: { modelId, stopReason: responseBody.stop_reason },
        };
      } else if (isMeta) {
        return {
          content: responseBody.generation || '',
          usage: {
            inputTokens: responseBody.prompt_token_count || Math.ceil(prompt.length / 4),
            outputTokens: responseBody.generation_token_count || Math.ceil((responseBody.generation || '').length / 4),
          },
          metadata: { modelId, stopReason: responseBody.stop_reason },
        };
      } else if (isMistral) {
        const text = responseBody.outputs?.[0]?.text || '';
        return {
          content: text,
          usage: {
            inputTokens: Math.ceil(prompt.length / 4),
            outputTokens: Math.ceil(text.length / 4),
          },
          metadata: { modelId, stopReason: responseBody.outputs?.[0]?.stop_reason },
        };
      }

      // Fallback parse
      return {
        content: responseBody.content?.[0]?.text || responseBody.generation || responseBody.outputs?.[0]?.text || JSON.stringify(responseBody),
        usage: { inputTokens: 0, outputTokens: 0 },
        metadata: { modelId },
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
