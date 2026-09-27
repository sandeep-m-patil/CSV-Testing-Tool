export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function toHttpError(value: unknown): { status: number; code: string; message: string } {
  if (isAppError(value)) {
    return { status: value.status, code: value.code, message: value.message };
  }
  if (value instanceof Error) {
    return { status: 500, code: "INTERNAL_ERROR", message: value.message };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Unknown error" };
}