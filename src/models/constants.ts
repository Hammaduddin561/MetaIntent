// Constants for MetaIntent Agent

import { RetryConfig } from './types';

// Environment variables
export const ENV = {
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  SESSION_TABLE_NAME: process.env.SESSION_TABLE_NAME || 'MetaIntent-Sessions',
  CACHE_BUCKET_NAME: process.env.CACHE_BUCKET_NAME || 'metaintent-cache',
  LOG_BUCKET_NAME: process.env.LOG_BUCKET_NAME || 'metaintent-logs',
  BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  NIM_ENDPOINT_NAME: process.env.NIM_ENDPOINT_NAME || 'metaintent-nim',
  PRIMARY_LLM_BACKEND: (process.env.PRIMARY_LLM_BACKEND || 'bedrock') as 'bedrock' | 'nim',
  FALLBACK_LLM_BACKEND: (process.env.FALLBACK_LLM_BACKEND || 'nim') as 'bedrock' | 'nim',
};

// Retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

// Session TTL (24 hours in seconds)
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

// Cache TTL (1 hour in seconds)
export const CACHE_TTL_SECONDS = 60 * 60;

// LLM cost estimates (per 1K tokens)
export const LLM_COSTS = {
  BEDROCK_CLAUDE_INPUT: 0.003,  // $3 per 1M input tokens
  BEDROCK_CLAUDE_OUTPUT: 0.015, // $15 per 1M output tokens
  NIM_INPUT: 0.002,              // Estimated
  NIM_OUTPUT: 0.010,             // Estimated
};

// Budget threshold (80% of $100)
export const BUDGET_ALERT_THRESHOLD = 80;

// Default LLM configuration
export const DEFAULT_LLM_CONFIG = {
  maxTokens: 1024,
  temperature: 0.7,
};

// Prompt templates
export const PROMPTS = {
  INTENT_CLASSIFICATION: `You are an intent classifier for an onboarding system. Analyze the user input and determine their intent.

User input: {input}
Session context: {context}

Respond with JSON:
{
  "intent": "verify_identity" | "provide_info" | "clarify" | "complete",
  "confidence": 0.0-1.0,
  "extractedData": {},
  "nextAction": "description of next step"
}`,

  IDENTITY_EXTRACTION: `Extract identity information from the user input.

User input: {input}

Extract and respond with JSON:
{
  "name": "full name",
  "dob": "date of birth (YYYY-MM-DD)",
  "documentId": "ID number",
  "confidence": 0.0-1.0,
  "missingFields": ["field1", "field2"]
}`,

  API_CHAIN_PLANNING: `You are an API orchestrator. Plan a sequence of API calls to achieve the goal.

Goal: {goal}
Available APIs: {apis}
Context: {context}

Respond with JSON array of API calls:
[
  {
    "apiName": "api_name",
    "endpoint": "url",
    "method": "GET|POST",
    "params": {}
  }
]`,
};

// Static responses for fallback
export const STATIC_RESPONSES = {
  IDENTITY_VERIFICATION_PROMPT: {
    intent: 'verify_identity',
    confidence: 0.8,
    nextAction: 'Please provide your full name, date of birth, and document ID',
  },
  CLARIFICATION_PROMPT: {
    intent: 'clarify',
    confidence: 0.9,
    nextAction: 'Could you please provide more information?',
  },
};
