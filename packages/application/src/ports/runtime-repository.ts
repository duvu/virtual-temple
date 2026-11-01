import type { RuntimeDescriptor, RuntimeId } from '@vtl/domain';

export interface RuntimeErrorSummary {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
}

export interface RuntimeRecord extends RuntimeDescriptor {
  readonly error?: RuntimeErrorSummary;
}

export interface RuntimeRepository {
  get(runtimeId: RuntimeId): Promise<RuntimeRecord | undefined>;
  save(runtime: RuntimeRecord): Promise<void>;
  delete(runtimeId: RuntimeId): Promise<void>;
}

function snapshot(runtime: RuntimeRecord): RuntimeRecord {
  const error = runtime.error === undefined ? undefined : Object.freeze({
    ...runtime.error,
    ...(runtime.error.details === undefined ? {} : { details: Object.freeze({ ...runtime.error.details }) }),
  });
  return Object.freeze({ ...runtime, ...(error === undefined ? {} : { error }) });
}

export class InMemoryRuntimeRepository implements RuntimeRepository {
  private readonly records = new Map<RuntimeId, RuntimeRecord>();

  async get(id: RuntimeId): Promise<RuntimeRecord | undefined> {
    const record = this.records.get(id);
    return record === undefined ? undefined : snapshot(record);
  }

  async save(runtime: RuntimeRecord): Promise<void> {
    this.records.set(runtime.runtimeId, snapshot(runtime));
  }

  async delete(id: RuntimeId): Promise<void> {
    this.records.delete(id);
  }
}
