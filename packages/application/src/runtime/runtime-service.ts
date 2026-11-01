import {
  RuntimeNotFoundError,
  UnsupportedCapabilityError,
  type ChannelId,
  type EngineCapability,
  type RuntimeId,
  type RuntimeStatus,
  type World,
} from '@vtl/domain';
import { asAdapterFailure } from '../errors.js';
import type { EngineAdapter } from '../ports/engine-adapter.js';
import type { RuntimeRecord, RuntimeRepository } from '../ports/runtime-repository.js';
import { assertRuntimeTransition } from './transitions.js';

export interface CreateRuntimeInput {
  readonly runtimeId: RuntimeId;
  readonly channelId: ChannelId;
  readonly worldId: World['worldId'];
}

export class RuntimeService {
  constructor(
    private readonly adapter: EngineAdapter,
    private readonly repository: RuntimeRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async create(input: CreateRuntimeInput): Promise<RuntimeRecord> {
    const timestamp = this.now();
    const record: RuntimeRecord = {
      runtimeId: input.runtimeId, channelId: input.channelId, worldId: input.worldId,
      status: 'CREATED', createdAt: timestamp, updatedAt: timestamp,
    };
    await this.repository.save(record);
    return this.requireRuntime(input.runtimeId);
  }

  async initialize(id: RuntimeId, world: World): Promise<RuntimeRecord> {
    const runtime = await this.requireRuntime(id);
    this.assertTransition(runtime.status, 'INITIALIZING');
    this.assertCapability('runtime.initialize');
    this.assertCapability('world.load');
    const initializing = { ...runtime, status: 'INITIALIZING' as const, updatedAt: this.now() };
    await this.persist(initializing);
    try {
      await this.adapter.initialize(id);
      await this.adapter.loadWorld(id, world);
    } catch (error) {
      return this.fail(initializing, error);
    }
    return this.transition(initializing, 'READY');
  }

  async start(id: RuntimeId): Promise<RuntimeRecord> {
    return this.runOperation(id, 'RUNNING', 'runtime.start', (runtimeId) => this.adapter.start(runtimeId));
  }

  async pause(id: RuntimeId): Promise<RuntimeRecord> {
    return this.runOperation(id, 'PAUSED', 'runtime.pause', (runtimeId) => this.adapter.pause(runtimeId));
  }

  async resume(id: RuntimeId): Promise<RuntimeRecord> {
    return this.runOperation(id, 'RUNNING', 'runtime.resume', (runtimeId) => this.adapter.resume(runtimeId));
  }

  async stop(id: RuntimeId): Promise<RuntimeRecord> {
    return this.runOperation(id, 'STOPPED', 'runtime.stop', (runtimeId) => this.adapter.stop(runtimeId));
  }

  private async runOperation(
    id: RuntimeId,
    next: RuntimeStatus,
    capability: EngineCapability,
    operation: (runtimeId: RuntimeId) => Promise<void>,
  ): Promise<RuntimeRecord> {
    const runtime = await this.requireRuntime(id);
    this.assertTransition(runtime.status, next);
    this.assertCapability(capability);
    try {
      await operation(id);
    } catch (error) {
      return this.fail(runtime, error);
    }
    return this.transition(runtime, next);
  }

  private assertTransition(from: RuntimeStatus, to: RuntimeStatus): void {
    assertRuntimeTransition(from, to);
  }

  private assertCapability(capability: EngineCapability): void {
    if (!this.adapter.capabilities.has(capability)) throw new UnsupportedCapabilityError(capability);
  }

  private async transition(runtime: RuntimeRecord, status: RuntimeStatus): Promise<RuntimeRecord> {
    this.assertTransition(runtime.status, status);
    const { error: _error, ...withoutError } = runtime;
    const updated = { ...withoutError, status, updatedAt: this.now() };
    await this.repository.save(updated);
    return this.requireRuntime(runtime.runtimeId);
  }

  private async fail(runtime: RuntimeRecord, cause: unknown): Promise<never> {
    const error = asAdapterFailure(cause);
    const summary = error.toJSON();
    await this.repository.save({
      ...runtime, status: 'ERROR', updatedAt: this.now(),
      error: { code: summary.code, message: summary.message, ...(summary.details === undefined ? {} : { details: summary.details }) },
    });
    throw error;
  }

  private async persist(runtime: RuntimeRecord): Promise<void> {
    await this.repository.save(runtime);
  }

  private async requireRuntime(id: RuntimeId): Promise<RuntimeRecord> {
    const runtime = await this.repository.get(id);
    if (runtime === undefined) throw new RuntimeNotFoundError(id);
    return runtime;
  }
}
