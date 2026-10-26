import { ZodError } from 'zod';

/** An error that is safe to show to the client. */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Validates `data` with a zod schema and returns the parsed value, or throws a 400. */
export function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new HttpError(400, 'validation_error', 'Some details need fixing', formatIssues(result.error));
}

function formatIssues(error) {
  return error.issues.slice(0, 10).map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

/** Wraps an async route so rejected promises reach the error middleware (Express 4). */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Final error middleware. Unexpected errors are logged server-side and never leaked. */
export function errorMiddleware(logger) {
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) => {
    if (error instanceof HttpError) return send(res, error.status, error.code, error.message, error.details);
    if (error instanceof ZodError) return send(res, 400, 'validation_error', 'Some details need fixing', formatIssues(error));
    if (error?.type === 'entity.too.large') return send(res, 413, 'payload_too_large', 'The request is too large');
    if (error?.type === 'entity.parse.failed') return send(res, 400, 'invalid_json', 'The request body is not valid JSON');

    logger.error(`Unhandled error: ${error?.name ?? 'Error'}: ${error?.message ?? 'unknown'}`);
    return send(res, 500, 'internal_error', 'Something went wrong. Please try again.');
  };
}

function send(res, status, code, message, details) {
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}
