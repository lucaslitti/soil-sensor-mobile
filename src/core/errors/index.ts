/**
 * 统一异常类型：Repository 层把原生/库错误包装为业务异常，上层永不见原始字节错误。
 */

export type ErrorCode =
  | 'bluetooth-unavailable'
  | 'permission-denied'
  | 'scan-timeout'
  | 'connect-timeout'
  | 'characteristic-not-found'
  | 'read-failed'
  | 'codec-error'
  | 'unknown';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export class CodecError extends AppError {
  constructor(message: string, cause?: unknown) {
    super('codec-error', message, cause);
    this.name = 'CodecError';
  }
}
