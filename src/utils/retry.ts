// Retry utility with exponential backoff

import { RetryConfig } from '../models/types';
import { DEFAULT_RETRY_CONFIG } from '../models/constants';

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Add jitter to delay to prevent thundering herd
 */
function addJitter(delay: number): number {
  return delay * (0.5 + Math.random() * 0.5);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if error is not retryable
      if (error.retryable === false) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt >= config.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const backoffDelay = Math.min(
        delay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      );
      const jitteredDelay = addJitter(backoffDelay);

      // Wait before next attempt
      await sleep(jitteredDelay);
    }
  }

  throw lastError!;
}

/**
 * Retry with custom retry condition
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: Error, attempt: number) => boolean,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      if (!shouldRetry(error, attempt)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt >= config.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const backoffDelay = Math.min(
        delay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      );
      const jitteredDelay = addJitter(backoffDelay);

      // Wait before next attempt
      await sleep(jitteredDelay);
    }
  }

  throw lastError!;
}

/**
 * Retry with timeout
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
  });

  return Promise.race([
    retryWithBackoff(fn, config),
    timeoutPromise,
  ]);
}
