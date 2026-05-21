/**
 * Domain error types — thrown from `lib/` and `plugins/`, caught by route
 * handlers, mapped to HTTP responses via @fastify/sensible's httpErrors.
 *
 * Keeping these as named subclasses (rather than ad-hoc objects) lets us
 * `instanceof` check them and attach a structured `code` for client consumers.
 */

export class DomainError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends DomainError {
  readonly details?: unknown;
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class RateLimitError extends DomainError {
  readonly retryAfterSeconds?: number;
  constructor(message = 'Rate limit exceeded', retryAfterSeconds?: number) {
    super(message, 'RATE_LIMITED');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ExportTooLargeError extends DomainError {
  readonly count: number;
  constructor(count: number) {
    super(`Export would return ${count} rows (cap is 10,000)`, 'EXPORT_TOO_LARGE');
    this.count = count;
  }
}

export class UpstreamError extends DomainError {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message, 'UPSTREAM_ERROR');
    this.status = status;
  }
}
