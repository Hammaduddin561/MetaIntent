import { ChainRequest, ChainResponse, APICall } from '../models/types';
import { LLMAdapterFactory } from '../adapters/LLMAdapterFactory';
import { Logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { PROMPTS, DEFAULT_LLM_CONFIG } from '../models/constants';

const logger = new Logger();

export const handler = async (event: ChainRequest): Promise<ChainResponse> => {
  const { sessionId, goal, availableAPIs, context } = event;

  try {
    await logger.info(sessionId, 'APIChainOrchestrator', 'Planning API chain', { goal });

    const prompt = PROMPTS.API_CHAIN_PLANNING
      .replace('{goal}', goal)
      .replace('{apis}', JSON.stringify(availableAPIs))
      .replace('{context}', JSON.stringify(context));

    const adapter = LLMAdapterFactory.getPrimaryAdapter();
    const llmResponse = await adapter.invoke(prompt, { ...DEFAULT_LLM_CONFIG, maxTokens: 2048 });
    
    const plannedCalls: APICall[] = JSON.parse(llmResponse.content);
    const executedCalls: APICall[] = [];
    const results: Record<string, any> = {};

    for (const call of plannedCalls) {
      try {
        await logger.info(sessionId, 'APIChainOrchestrator', `Executing API: ${call.apiName}`);

        const result = await retryWithBackoff(async () => {
          return { success: true, data: `Mock response for ${call.apiName}` };
        });

        call.response = result;
        results[call.apiName] = result;
        executedCalls.push(call);

        await logger.info(sessionId, 'APIChainOrchestrator', `API ${call.apiName} succeeded`);

      } catch (error: any) {
        call.error = error.message;
        executedCalls.push(call);
        await logger.warn(sessionId, 'APIChainOrchestrator', `API ${call.apiName} failed`, { error: error.message });
      }
    }

    const response: ChainResponse = {
      executedCalls,
      results,
      status: executedCalls.every(c => !c.error) ? 'success' : 'partial',
    };

    await logger.info(sessionId, 'APIChainOrchestrator', 'API chain completed', { status: response.status });

    return response;

  } catch (error: any) {
    await logger.error(sessionId, 'APIChainOrchestrator', 'Failed to execute API chain', { error: error.message });
    throw error;
  } finally {
    await logger.flush();
  }
};
