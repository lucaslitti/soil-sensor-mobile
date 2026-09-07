export type DomainErrorCode = 'protocol' | 'invalid-state' | 'cancelled';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class ProtocolError extends DomainError {
  constructor(message: string) {
    super('protocol', message);
    this.name = 'ProtocolError';
  }
}
