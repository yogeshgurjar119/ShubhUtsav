/**
 * Failure of an AI service call. The message is safe to log and show; it never contains keys.
 * `kind` lets callers pick a useful message: 'unavailable' | 'timeout' | 'blocked'.
 */
export class LlmError extends Error {
  constructor(message, { retryable = false, status, kind = 'unavailable' } = {}) {
    super(message);
    this.name = 'LlmError';
    this.retryable = retryable;
    this.status = status;
    this.kind = kind;
  }
}
