export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown): ApiError {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED'): ApiError {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'Insufficient permissions', code = 'FORBIDDEN'): ApiError {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND'): ApiError {
    return new ApiError(404, message, code);
  }

  static conflict(message: string, code = 'CONFLICT'): ApiError {
    return new ApiError(409, message, code);
  }

  static tooMany(message = 'Too many requests', code = 'RATE_LIMITED'): ApiError {
    return new ApiError(429, message, code);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR'): ApiError {
    return new ApiError(500, message, code);
  }
}

/**
 * Business-rule errors raised inside stored procedures (via THROW 50xxx)
 * mapped to HTTP responses.
 */
const SQL_ERROR_MAP: Record<string, { status: number; message: string }> = {
  PHONE_ALREADY_EXISTS: { status: 409, message: 'Phone number is already registered' },
  EMAIL_ALREADY_EXISTS: { status: 409, message: 'Email is already registered' },
  ROLE_NOT_FOUND: { status: 400, message: 'Unknown role' },
  INVALID_REFRESH_TOKEN: { status: 401, message: 'Invalid or expired refresh token' },
  APARTMENT_NUMBER_EXISTS: { status: 409, message: 'Apartment number already exists in this building' },
  APARTMENT_HAS_ACTIVE_CONTRACT: { status: 409, message: 'Apartment has an active contract' },
  APARTMENT_HAS_ACTIVE_RESIDENTS: { status: 409, message: 'Apartment has active residents' },
  RESIDENT_ALREADY_ACTIVE: { status: 409, message: 'Resident is already registered in this apartment' },
  CONTRACT_NOT_PENDING: { status: 409, message: 'Contract is not in pending state' },
  CONTRACT_NOT_ACTIVE: { status: 409, message: 'Contract is not active' },
  INVOICE_HAS_PAYMENTS: { status: 409, message: 'Invoice already has confirmed payments' },
  INVOICE_NOT_FOUND: { status: 404, message: 'Invoice not found' },
  INVOICE_CANCELLED: { status: 409, message: 'Invoice is cancelled' },
  AMOUNT_EXCEEDS_BALANCE: { status: 400, message: 'Payment amount exceeds the remaining balance' },
  NOT_ASSIGNED_TO_REQUEST: { status: 403, message: 'You are not assigned to this request' },
  CANNOT_RATE_REQUEST: { status: 400, message: 'Only the requester can rate a completed request' },
  INVALID_QR_CODE: { status: 404, message: 'Invalid QR code' },
  VISITOR_NOT_APPROVED: { status: 409, message: 'Visitor is not approved' },
  VISITOR_PASS_EXPIRED: { status: 409, message: 'Visitor pass has expired' },
  VISITOR_NOT_CHECKED_IN: { status: 409, message: 'Visitor is not checked in' },
};

export const fromSqlError = (error: unknown): ApiError | null => {
  const message = (error as Error)?.message ?? '';
  const mapped = SQL_ERROR_MAP[message];
  if (mapped) return new ApiError(mapped.status, mapped.message, message);
  return null;
};
