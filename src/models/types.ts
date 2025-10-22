// Core type definitions for MetaIntent Agent

export type Modality = 'text' | 'voice' | 'document';
export type SessionStatus = 'initiated' | 'identity_pending' | 'identity_verified' | 'onboarding_in_progress' | 'completed' | 'failed';
export type Intent = 'verify_identity' | 'provide_info' | 'clarify' | 'complete';
export type LLMBackend = 'bedrock' | 'nim';
export type FallbackStrategy = 'cache' | 'alternative_backend' | 'static_flow' | 'manual';
export type LogLevel = 'info' | 'warn' | 'error';

// Request/Response interfaces for Lambda functions
export interface RouterRequest {
  sessionId?: string;
  userId?: string;
  input: string | Buffer;
  modality: Modality;
  metadata?: Record<string, any>;
}

export interface RouterResponse {
  sessionId: string;
  status: SessionStatus;
  nextStep?: string;
  message?: string;
}

export interface IntentRequest {
  sessionId: string;
  input: string;
  context: SessionContext;
}

export interface IntentResponse {
  intent: Intent;
  confidence: number;
  extractedData?: Record<string, any>;
  nextAction: string;
}

export interface IdentityRequest {
  sessionId: string;
  modality: Modality;
  data: string | Buffer;
}

export interface IdentityResponse {
  verified: boolean;
  confidence: number;
  extractedFields: {
    name?: string;
    dob?: string;
    documentId?: string;
    [key: string]: any;
  };
  missingFields?: string[];
}

export interface ChainRequest {
  sessionId: string;
  goal: string;
  availableAPIs: APIDefinition[];
  context: SessionContext;
}

export interface ChainResponse {
  executedCalls: APICall[];
  results: Record<string, any>;
  status: 'success' | 'partial' | 'failed';
  nextSteps?: string[];
}

export interface FallbackRequest {
  originalRequest: any;
  failureReason: string;
  attemptedBackends: string[];
  sessionId: string;
}

export interface FallbackResponse {
  strategy: FallbackStrategy;
  response?: any;
  requiresUserInput?: boolean;
}

// Data models
export interface SessionState {
  sessionId: string;
  userId?: string;
  createdAt: number;
  updatedAt: number;
  ttl: number;
  status: SessionStatus;
  currentStep: string;
  completedSteps: string[];
  identityData?: {
    name?: string;
    dob?: string;
    documentId?: string;
    verified: boolean;
    verificationMethod: Modality;
  };
  apiChainProgress?: {
    plannedCalls: APICall[];
    executedCalls: APICall[];
    currentIndex: number;
  };
  fallbackHistory: FallbackEvent[];
  metadata: SessionMetadata;
}

export interface SessionContext {
  sessionId: string;
  status: SessionStatus;
  currentStep: string;
  completedSteps: string[];
  identityData?: SessionState['identityData'];
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  inputModality: Modality;
  llmBackend: LLMBackend;
  totalCost: number;
  apiCallCount: number;
}

export interface FallbackEvent {
  timestamp: number;
  reason: string;
  strategy: FallbackStrategy;
}

export interface APICall {
  apiName: string;
  endpoint: string;
  method: string;
  params: Record<string, any>;
  response?: any;
  error?: string;
}

export interface APIDefinition {
  name: string;
  endpoint: string;
  method: string;
  description: string;
  requiredParams: string[];
  optionalParams?: string[];
}

export interface CacheEntry {
  cacheKey: string;
  request: {
    type: string;
    input: string;
    context?: any;
  };
  response: any;
  timestamp: number;
  ttl: number;
  hitCount: number;
  llmBackend: LLMBackend;
}

export interface LogEntry {
  timestamp: number;
  sessionId: string;
  component: string;
  level: LogLevel;
  message: string;
  data?: any;
  cost?: number;
  duration?: number;
}

// LLM Adapter interfaces
export interface LLMConfig {
  maxTokens: number;
  temperature: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface LLMAdapter {
  invoke(prompt: string, config: LLMConfig): Promise<LLMResponse>;
  invokeWithRetry(prompt: string, config: LLMConfig, retries: number): Promise<LLMResponse>;
  estimateCost(prompt: string, config: LLMConfig): number;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// Error types
export interface ErrorContext {
  sessionId?: string;
  component: string;
  operation: string;
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  retryable: boolean;
  fallbackStrategy?: FallbackStrategy;
}
