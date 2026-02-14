import { IntentRequest, IntentResponse } from '../models/types';
import { LLMAdapterFactory } from '../adapters/LLMAdapterFactory';
import { FallbackHandler } from '../utils/fallback';
import { Logger } from '../utils/logger';
import { CacheManager } from '../utils/cache';
import { PROMPTS, DEFAULT_LLM_CONFIG } from '../models/constants';

const logger = new Logger();
const cacheManager = new CacheManager();
const fallbackHandler = new FallbackHandler();

export const handler = async (event: IntentRequest): Promise<IntentResponse> => {
  const { sessionId, input, context } = event;

  try {
    await logger.info(sessionId, 'IntentClassifier', 'Classifying intent', { input });

    const cacheKey = cacheManager.generateCacheKey({ type: 'intent', input, context });
    const cached = await cacheManager.get(cacheKey);
    
    if (cached) {
      await logger.info(sessionId, 'IntentClassifier', 'Cache hit');
      return cached.response;
    }

    const prompt = PROMPTS.INTENT_CLASSIFICATION
      .replace('{input}', input)
      .replace('{context}', JSON.stringify(context));

    const adapter = LLMAdapterFactory.getPrimaryAdapter();
    
    try {
      const llmResponse = await adapter.invoke(prompt, DEFAULT_LLM_CONFIG);
      const result: IntentResponse = JSON.parse(llmResponse.content);

      await cacheManager.cacheResponse({ type: 'intent', input, context }, result, 'bedrock');
      await logger.info(sessionId, 'IntentClassifier', 'Intent classified', { intent: result.intent });

      return result;

    } catch (error: any) {
      if (FallbackHandler.shouldTriggerFallback(error)) {
        await logger.warn(sessionId, 'IntentClassifier', 'Primary LLM failed, using fallback');
        
        const fallbackResponse = await fallbackHandler.handle({
          originalRequest: { type: 'intent', input, context, prompt, config: DEFAULT_LLM_CONFIG },
          failureReason: error.message,
          attemptedBackends: ['bedrock'],
          sessionId,
        });

        return fallbackResponse.response;
      }
      throw error;
    }

  } catch (error: any) {
    await logger.error(sessionId, 'IntentClassifier', 'Failed to classify intent', { error: error.message });
    throw error;
  } finally {
    await logger.flush();
  }
};
