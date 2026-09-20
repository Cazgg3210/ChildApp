/**
 * Error codes are part of the public API contract (docs/11-api-design.md).
 * Every code maps to an HTTP status and to a translatable, human-readable message.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 400,
  NOT_AUTHENTICATED: 401,
  ACCESS_DENIED: 403,
  ACCESS_EXPIRED: 403,
  ACCESS_NOT_STARTED: 403,
  ACCESS_REVOKED: 403,
  ACCESS_EXHAUSTED: 403,
  ACCESS_PENDING: 403,
  CATEGORY_NOT_SHARED: 403,
  CAPABILITY_MISSING: 403,
  PIN_REQUIRED: 401,
  PIN_INVALID: 401,
  PIN_LOCKED: 423,
  EMAIL_NOT_VERIFIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TOKEN: 400,
  TOKEN_EXPIRED: 410,
  RATE_LIMITED: 429,
  INVALID_STATE: 409,
  FEATURE_DISABLED: 404,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = ErrorCodes[code];
    this.details = details;
  }

  static is(err: unknown): err is AppError {
    return err instanceof AppError;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export function notFound(what = "Resource"): AppError {
  return new AppError("NOT_FOUND", `${what} not found`);
}

export function denied(reason: ErrorCode = "ACCESS_DENIED", message?: string): AppError {
  return new AppError(reason, message);
}
