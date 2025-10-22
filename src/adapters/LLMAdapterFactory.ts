// Factory for creating LLM adapter instances

import { LLMAdapter, LLMBackend } from '../models/types';
import { BedrockAdapter } from './BedrockAdapter';
import { NIMAdapter } from './NIMAdapter';
import { ENV } from '../models/constants';

export class LLMAdapterFactory {
  private static bedrockInstance: BedrockAdapter | null = null;
  private static nimInstance: NIMAdapter | null = null;

  /**
   * Get LLM adapter instance for specified backend
   */
  static getAdapter(backend: LLMBackend): LLMAdapter {
    switch (backend) {
      case 'bedrock':
        if (!this.bedrockInstance) {
          this.bedrockInstance = new BedrockAdapter(
            ENV.BEDROCK_MODEL_ID,
            ENV.AWS_REGION
          );
        }
        return this.bedrockInstance;
      
      case 'nim':
        if (!this.nimInstance) {
          this.nimInstance = new NIMAdapter(
            ENV.NIM_ENDPOINT_NAME,
            ENV.AWS_REGION
          );
        }
        return this.nimInstance;
      
      default:
        throw new Error(`Unknown LLM backend: ${backend}`);
    }
  }

  /**
   * Get primary LLM adapter from environment configuration
   */
  static getPrimaryAdapter(): LLMAdapter {
    return this.getAdapter(ENV.PRIMARY_LLM_BACKEND);
  }

  /**
   * Get fallback LLM adapter from environment configuration
   */
  static getFallbackAdapter(): LLMAdapter {
    return this.getAdapter(ENV.FALLBACK_LLM_BACKEND);
  }

  /**
   * Reset adapter instances (useful for testing)
   */
  static reset(): void {
    this.bedrockInstance = null;
    this.nimInstance = null;
  }
}
