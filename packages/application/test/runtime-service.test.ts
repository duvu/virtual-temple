import { describe, expect, it } from 'vitest';
import {
  channelId, runtimeId, worldId, UnsupportedCapabilityError,
} from '@vtl/domain';
import { InMemoryRuntimeRepository } from '../src/ports/runtime-repository.js';
import type { EngineAdapter } from '../src/ports/engine-adapter.js';
import { RuntimeService } from '../src/runtime/runtime-service.js';

function adapter(overrides: Partial<EngineAdapter> = {}): EngineAdapter {
  const noop = async () => undefined;
  return {
    engineId: 'test-engine', version: '1', adapterVersion: '1',
    capabilities: new Set(['runtime.initialize', 'world.load', 'runtime.start', 'runtime.stop', 'runtime.pause', 'runtime.resume']),
    getHealth: async () => ({ healthy: true }),
    getPerformance: async () => ({ }),
    initialize: noop, loadWorld: noop, start: noop, stop: noop, pause: noop, resume: noop,
    setCamera: noop, spawnCharacter: noop, despawnCharacter: noop, moveCharacter: noop,
    playAnimation: noop, stopAnimation: noop, showEffect: noop, setEnvironment: noop,
    getRuntimeStatus: async () => 'READY', captureOutput: async () => ({ }),
    ...overrides,
  } as EngineAdapter;
}

const world = {
  worldId: worldId('world-1'), name: 'Test', environment: {},
  scene: { sceneId: 'scene-1', assetIds: [], characters: [] },
  assetIds: [], camera: {}, characters: [], lighting: {}, audio: {}, effects: {},
};

function makeService(engine: EngineAdapter = adapter()) {
  const repository = new InMemoryRuntimeRepository();
  return { repository, service: new RuntimeService(engine, repository, () => '2026-01-01T00:00:00.000Z') };
}

describe('RuntimeService', () => {
  it('persists the legal create, initialize, start, pause, resume and stop progression', async () => {
    const { repository, service } = makeService();
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    expect((await repository.get(runtimeId('r1')))?.status).toBe('CREATED');
    await service.initialize(runtimeId('r1'), world);
    expect((await repository.get(runtimeId('r1')))?.status).toBe('READY');
    await service.start(runtimeId('r1'));
    await service.pause(runtimeId('r1'));
    await service.resume(runtimeId('r1'));
    await service.stop(runtimeId('r1'));
    expect((await repository.get(runtimeId('r1')))?.status).toBe('STOPPED');
  });

  it('rejects illegal transitions before calling the adapter', async () => {
    const engine = adapter();
    const { service } = makeService(engine);
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    await expect(service.pause(runtimeId('r1'))).rejects.toMatchObject({ code: 'INVALID_RUNTIME_TRANSITION' });
  });

  it('rejects a missing capability before invoking its adapter method', async () => {
    let called = false;
    const engine = adapter({ capabilities: new Set(['runtime.initialize', 'world.load']), start: async () => { called = true; } });
    const { service } = makeService(engine);
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    await service.initialize(runtimeId('r1'), world);
    await expect(service.start(runtimeId('r1'))).rejects.toBeInstanceOf(UnsupportedCapabilityError);
    expect(called).toBe(false);
  });

  it('stores an error summary on adapter failure for only the affected runtime', async () => {
    const engine = adapter({ start: async () => { throw new Error('engine offline'); } });
    const { repository, service } = makeService(engine);
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    await service.create({ runtimeId: runtimeId('r2'), channelId: channelId('c2'), worldId: worldId('world-1') });
    await service.initialize(runtimeId('r1'), world);
    await service.initialize(runtimeId('r2'), world);
    await expect(service.start(runtimeId('r1'))).rejects.toMatchObject({ code: 'ADAPTER_FAILURE' });
    expect(await repository.get(runtimeId('r1'))).toMatchObject({ status: 'ERROR', error: { code: 'ADAPTER_FAILURE', message: 'engine offline' } });
    expect((await repository.get(runtimeId('r2')))?.status).toBe('READY');
  });

  it('rejects duplicate runtime IDs without replacing existing state', async () => {
    const { repository, service } = makeService();
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    await service.initialize(runtimeId('r1'), world);
    await expect(service.create({ runtimeId: runtimeId('r1'), channelId: channelId('other'), worldId: worldId('world-1') }))
      .rejects.toMatchObject({ code: 'RUNTIME_ALREADY_EXISTS' });
    expect(await repository.get(runtimeId('r1'))).toMatchObject({ status: 'READY', channelId: 'c1' });
  });

  it('rejects initialization when the world ID does not match before adapter calls', async () => {
    let calls = 0;
    const engine = adapter({ initialize: async () => { calls += 1; }, loadWorld: async () => { calls += 1; } });
    const { repository, service } = makeService(engine);
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    await expect(service.initialize(runtimeId('r1'), { ...world, worldId: worldId('other') }))
      .rejects.toMatchObject({ code: 'RUNTIME_WORLD_MISMATCH' });
    expect(calls).toBe(0);
    expect((await repository.get(runtimeId('r1')))?.status).toBe('CREATED');
  });

  it('serializes concurrent duplicate starts for one runtime', async () => {
    let startCalls = 0;
    const engine = adapter({ start: async () => { startCalls += 1; } });
    const { repository, service } = makeService(engine);
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    await service.initialize(runtimeId('r1'), world);
    const results = await Promise.allSettled([service.start(runtimeId('r1')), service.start(runtimeId('r1'))]);
    expect(startCalls).toBe(1);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await repository.get(runtimeId('r1')))?.status).toBe('RUNNING');
  });

  it('serializes start and stop while allowing a different runtime to proceed', async () => {
    let releaseStart!: () => void;
    let markStarted!: () => void;
    const startGate = new Promise<void>((resolve) => { releaseStart = resolve; });
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    let stopCalls = 0;
    const engine = adapter({
      start: async (id) => { if (id === runtimeId('r1')) { markStarted(); await startGate; } },
      stop: async () => { stopCalls += 1; },
    });
    const { repository, service } = makeService(engine);
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    await service.create({ runtimeId: runtimeId('r2'), channelId: channelId('c2'), worldId: worldId('world-1') });
    await service.initialize(runtimeId('r1'), world);
    await service.initialize(runtimeId('r2'), world);
    const starting = service.start(runtimeId('r1'));
    await started;
    const stopping = service.stop(runtimeId('r1'));
    await service.start(runtimeId('r2'));
    await Promise.resolve();
    expect(stopCalls).toBe(0);
    releaseStart();
    await Promise.all([starting, stopping]);
    expect(stopCalls).toBe(1);
    expect((await repository.get(runtimeId('r1')))?.status).toBe('STOPPED');
    expect((await repository.get(runtimeId('r2')))?.status).toBe('RUNNING');
  });

  it('does not expose mutable repository state before save', async () => {
    const { repository, service } = makeService();
    await service.create({ runtimeId: runtimeId('r1'), channelId: channelId('c1'), worldId: worldId('world-1') });
    const runtime = await repository.get(runtimeId('r1'));
    if (!runtime) throw new Error('missing runtime');
    try { (runtime as { status: string }).status = 'RUNNING'; } catch { /* immutable copy */ }
    expect((await repository.get(runtimeId('r1')))?.status).toBe('CREATED');
  });
});
