import { AdapterFailureError, InvalidRuntimeTransitionError, RuntimeNotFoundError, UnsupportedCapabilityError } from '@vtl/domain';

export { AdapterFailureError, InvalidRuntimeTransitionError, RuntimeNotFoundError, UnsupportedCapabilityError };

export class RuntimeAlreadyExistsError extends Error {
  readonly code = 'RUNTIME_ALREADY_EXISTS';

  constructor(readonly runtimeId: string) {
    super(`Runtime already exists: ${runtimeId}`);
    this.name = 'RuntimeAlreadyExistsError';
  }

  toJSON(): { readonly code: string; readonly message: string; readonly runtimeId: string } {
    return { code: this.code, message: this.message, runtimeId: this.runtimeId };
  }
}

export class RuntimeWorldMismatchError extends Error {
  readonly code = 'RUNTIME_WORLD_MISMATCH';

  constructor(readonly runtimeId: string, readonly expectedWorldId: string, readonly actualWorldId: string) {
    super(`World ${actualWorldId} does not match runtime world ${expectedWorldId}`);
    this.name = 'RuntimeWorldMismatchError';
  }

  toJSON(): { readonly code: string; readonly message: string; readonly runtimeId: string; readonly expectedWorldId: string; readonly actualWorldId: string } {
    return {
      code: this.code, message: this.message, runtimeId: this.runtimeId,
      expectedWorldId: this.expectedWorldId, actualWorldId: this.actualWorldId,
    };
  }
}

export function asAdapterFailure(error: unknown): AdapterFailureError {
  if (error instanceof AdapterFailureError) return error;
  return new AdapterFailureError(error instanceof Error ? error.message : String(error));
}
