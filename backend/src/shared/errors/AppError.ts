/**
 * Application error with an HTTP status and a stable machine-readable code.
 * Thrown from any layer; translated to a response by the presentation layer.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(400, message, code, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED'): AppError {
    return new AppError(401, message, code);
  }

  static forbidden(message = 'Insufficient permissions', code = 'FORBIDDEN'): AppError {
    return new AppError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND'): AppError {
    return new AppError(404, message, code);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(409, message, code);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR'): AppError {
    return new AppError(500, message, code);
  }
}
