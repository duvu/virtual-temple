export const DOMAIN_ERROR_CODES = [
  'INVALID_RUNTIME_TRANSITION', 'UNSUPPORTED_CAPABILITY', 'ADAPTER_FAILURE', 'RUNTIME_NOT_FOUND',
] as const;
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export interface SerializableDomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>> | undefined;
}

export class DomainError extends Error implements SerializableDomainError {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = 'DomainError';
  }

  toJSON(): SerializableDomainError {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

export class InvalidRuntimeTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_RUNTIME_TRANSITION', `Cannot transition runtime from ${from} to ${to}`, { from, to });
  }
}

export class UnsupportedCapabilityError extends DomainError {
  constructor(capability: string) {
    super('UNSUPPORTED_CAPABILITY', `Capability is not supported: ${capability}`, { capability });
  }
}

export class AdapterFailureError extends DomainError {
  constructor(message: string, details?: Readonly<Record<string, string>>) {
    super('ADAPTER_FAILURE', message, details);
  }
}

export class RuntimeNotFoundError extends DomainError {
  constructor(runtimeId: string) {
    super('RUNTIME_NOT_FOUND', `Runtime not found: ${runtimeId}`, { runtimeId });
  }
}
