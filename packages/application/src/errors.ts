import { AdapterFailureError, InvalidRuntimeTransitionError, RuntimeNotFoundError, UnsupportedCapabilityError } from '@vtl/domain';

export { AdapterFailureError, InvalidRuntimeTransitionError, RuntimeNotFoundError, UnsupportedCapabilityError };

export function asAdapterFailure(error: unknown): AdapterFailureError {
  if (error instanceof AdapterFailureError) return error;
  return new AdapterFailureError(error instanceof Error ? error.message : String(error));
}
