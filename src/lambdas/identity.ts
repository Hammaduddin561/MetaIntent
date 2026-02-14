import { IdentityRequest, IdentityResponse } from '../models/types';
import { LLMAdapterFactory } from '../adapters/LLMAdapterFactory';
import { Logger } from '../utils/logger';
import { PROMPTS, DEFAULT_LLM_CONFIG } from '../models/constants';

const logger = new Logger();

export const handler = async (event: IdentityRequest): Promise<IdentityResponse> => {
  const { sessionId, modality, data } = event;

  try {
    await logger.info(sessionId, 'IdentityVerifier', 'Verifying identity', { modality });

    let textInput: string;

    if (modality === 'text') {
      textInput = data as string;
      await logger.info(sessionId, 'IdentityVerifier', 'Processing text input');
    } else if (modality === 'voice') {
      await logger.info(sessionId, 'IdentityVerifier', 'Processing voice input (simulated)');
      // In production, this would use AWS Transcribe to convert audio to text
      // For now, we'll add a prefix to show it was processed as voice
      textInput = `[Voice Input] ${data as string}`;
    } else if (modality === 'document') {
      await logger.info(sessionId, 'IdentityVerifier', 'Processing document input (simulated)');
      // In production, this would use AWS Textract to extract text from documents
      // For now, we'll add a prefix to show it was processed as document
      textInput = `[Document Scan] ${data as string}`;
    } else {
      textInput = data as string;
    }

    const prompt = PROMPTS.IDENTITY_EXTRACTION.replace('{input}', textInput);
    const adapter = LLMAdapterFactory.getPrimaryAdapter();
    const llmResponse = await adapter.invoke(prompt, DEFAULT_LLM_CONFIG);
    
    const result = JSON.parse(llmResponse.content);

    const response: IdentityResponse = {
      verified: result.confidence > 0.7,
      confidence: result.confidence,
      extractedFields: {
        name: result.name,
        dob: result.dob,
        documentId: result.documentId,
      },
      missingFields: result.missingFields || [],
    };

    await logger.info(sessionId, 'IdentityVerifier', 'Identity verified', { verified: response.verified });

    return response;

  } catch (error: any) {
    await logger.error(sessionId, 'IdentityVerifier', 'Failed to verify identity', { error: error.message });
    throw error;
  } finally {
    await logger.flush();
  }
};
