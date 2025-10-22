// Custom error classes for MetaIntent Agent

export class MetaIntentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'MetaIntentError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class LLMTimeoutError extends MetaIntentError {
  constructor(message: string = 'LLM request timed out') {
    super(message, 'LLM_TIMEOUT', 504, true);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends MetaIntentError {
  constructor(message: string = 'LLM rate limit exceeded') {
    super(message, 'LLM_RATE_LIMIT', 429, true);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMServiceUnavailableError extends MetaIntentError {
  constructor(message: string = 'LLM service unavailable') {
    super(message, 'LLM_SERVICE_UNAVAILABLE', 503, true);
    this.name = 'LLMServiceUnavailableError';
  }
}

export class APIError extends MetaIntentError {
  constructor(
    message: string,
    public readonly apiName: string,
    statusCode: number = 500
  ) {
    super(message, 'API_ERROR', statusCode, true);
    this.name = 'APIError';
  }
}

export class ValidationError extends MetaIntentError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR', 400, false);
    this.name = 'ValidationError';
  }
}

export class SessionNotFoundError extends MetaIntentError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', 404, false);
    this.name = 'SessionNotFoundError';
  }
}

export class DynamoDBError extends MetaIntentError {
  constructor(message: string) {
    super(message, 'DYNAMODB_ERROR', 500, true);
    this.name = 'DynamoDBError';
  }
}

export class S3Error extends MetaIntentError {
  constructor(message: string) {
    super(message, 'S3_ERROR', 500, true);
    this.name = 'S3Error';
  }
}

export class CacheError extends MetaIntentError {
  constructor(message: string) {
    super(message, 'CACHE_ERROR', 500, false);
    this.name = 'CacheError';
  }
}
