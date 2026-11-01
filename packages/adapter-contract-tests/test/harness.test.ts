import { describe, expect, it } from 'vitest';
import { EngineAdapter, type EngineHealthStatus, type EnginePerformanceStatus } from '@vtl/application';
import {
  ENGINE_CAPABILITIES, runtimeId, UnsupportedCapabilityError,
  type CharacterPlacement, type JsonValue, type RuntimeId, type RuntimeStatus,
} from '@vtl/domain';
import { assertEngineAdapterCapabilityPrerequisites, defineEngineAdapterContract } from '../src/engine-adapter-contract.js';

class MinimalAdapter extends EngineAdapter {
  readonly engineId = 'minimal';
  readonly version = '1';
  readonly adapterVersion = '1';
  readonly capabilities = new Set<never>();
  async getHealth(): Promise<EngineHealthStatus> { return { healthy: true }; }
  async getPerformance(): Promise<EnginePerformanceStatus> { return { checks: 1 }; }
}

class AllOperationsAdapter extends MinimalAdapter {
  readonly engineId = 'all-operations';
  readonly capabilities = new Set(ENGINE_CAPABILITIES);
  private readonly statuses = new Map<RuntimeId, RuntimeStatus>();

  override async initialize(id: RuntimeId): Promise<void> { this.statuses.set(id, 'READY'); }
  override async loadWorld(_id: RuntimeId, _world: Parameters<EngineAdapter['loadWorld']>[1]): Promise<void> {}
  override async start(id: RuntimeId): Promise<void> {
    this.requireStatus(id, 'READY');
    this.statuses.set(id, 'RUNNING');
  }
  override async stop(id: RuntimeId): Promise<void> {
    this.requireStatus(id, 'READY', 'RUNNING', 'PAUSED');
    this.statuses.set(id, 'STOPPED');
  }
  override async pause(id: RuntimeId): Promise<void> {
    this.requireStatus(id, 'RUNNING');
    this.statuses.set(id, 'PAUSED');
  }
  override async resume(id: RuntimeId): Promise<void> {
    this.requireStatus(id, 'PAUSED');
    this.statuses.set(id, 'RUNNING');
  }
  override async setCamera(_id: RuntimeId, _camera: JsonValue): Promise<void> {}
  override async spawnCharacter(_id: RuntimeId, _character: CharacterPlacement): Promise<void> {}
  override async despawnCharacter(_id: RuntimeId, _characterId: string): Promise<void> {}
  override async moveCharacter(_id: RuntimeId, _characterId: string, _position: CharacterPlacement['position']): Promise<void> {}
  override async playAnimation(_id: RuntimeId, _characterId: string, _animationId: string): Promise<void> {}
  override async stopAnimation(_id: RuntimeId, _characterId: string): Promise<void> {}
  override async showEffect(_id: RuntimeId, _effect: JsonValue): Promise<void> {}
  override async setEnvironment(_id: RuntimeId, _environment: JsonValue): Promise<void> {}
  override async getRuntimeStatus(id: RuntimeId): Promise<RuntimeStatus> { return this.statuses.get(id) ?? 'CREATED'; }
  private requireStatus(id: RuntimeId, ...allowed: RuntimeStatus[]): void {
    if (!allowed.includes(this.statuses.get(id) ?? 'CREATED')) throw new Error('Illegal lifecycle operation order');
  }
  override async captureOutput(_id: RuntimeId): Promise<JsonValue> { return {}; }
}

describe('defineEngineAdapterContract', () => {
  defineEngineAdapterContract('minimal test adapter', () => new MinimalAdapter());
  defineEngineAdapterContract('all-operations test adapter', () => new AllOperationsAdapter());

  it('rejects declared capabilities whose prerequisites are absent', () => {
    expect(() => assertEngineAdapterCapabilityPrerequisites(new Set(['runtime.pause'])))
      .toThrow(/runtime.pause.*runtime.initialize.*runtime.start/);
    expect(() => assertEngineAdapterCapabilityPrerequisites(new Set(['runtime.initialize', 'runtime.start', 'runtime.resume'])))
      .toThrow(/runtime.resume.*runtime.pause/);
    expect(() => assertEngineAdapterCapabilityPrerequisites(new Set(['runtime.status'])))
      .toThrow(/runtime.status.*runtime.initialize/);
  });

  it('runs reusable checks for its factory', () => {
    expect(new MinimalAdapter()).toBeInstanceOf(EngineAdapter);
  });

  it('checks stopAnimation as an unsupported character.animate operation', async () => {
    await expect(new MinimalAdapter().stopAnimation(runtimeId('animation-runtime'), 'character'))
      .rejects.toBeInstanceOf(UnsupportedCapabilityError);
  });
});
