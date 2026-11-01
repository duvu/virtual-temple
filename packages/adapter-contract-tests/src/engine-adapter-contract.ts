import { describe, expect, it } from 'vitest';
import { ENGINE_CAPABILITIES, RUNTIME_STATUSES, runtimeId, worldId, type EngineCapability, type World } from '@vtl/domain';
import { EngineAdapter } from '@vtl/application';

const sampleWorld: World = {
  worldId: worldId('contract-world'), name: 'Contract world', environment: {},
  scene: { sceneId: 'contract-scene', assetIds: [], characters: [] },
  assetIds: [], camera: {}, characters: [], lighting: {}, audio: {}, effects: {},
};

function operations(adapter: EngineAdapter, id: ReturnType<typeof runtimeId>): readonly [EngineCapability, () => Promise<unknown>][] {
  return [
    ['runtime.initialize', () => adapter.initialize(id)], ['world.load', () => adapter.loadWorld(id, sampleWorld)],
    ['runtime.start', () => adapter.start(id)], ['runtime.pause', () => adapter.pause(id)],
    ['runtime.resume', () => adapter.resume(id)], ['runtime.stop', () => adapter.stop(id)],
    ['camera.control', () => adapter.setCamera(id, { preset: 'wide' })],
    ['character.create', () => adapter.spawnCharacter(id, { characterId: 'c', assetId: 'a', position: { x: 0, y: 0, z: 0 } })],
    ['character.remove', () => adapter.despawnCharacter(id, 'c')],
    ['character.move', () => adapter.moveCharacter(id, 'c', { x: 1, y: 0, z: 0 })],
    ['character.animate', () => adapter.playAnimation(id, 'c', 'idle')],
    ['character.animate', () => adapter.stopAnimation(id, 'c')],
    ['effects.play', () => adapter.showEffect(id, { effect: 'sparkle' })],
    ['environment.update', () => adapter.setEnvironment(id, { lighting: 'warm' })],
    ['runtime.status', () => adapter.getRuntimeStatus(id)],
    ['output.capture', () => adapter.captureOutput(id)],
  ];
}

const CAPABILITY_PREREQUISITES: Partial<Record<EngineCapability, readonly EngineCapability[]>> = {
  'world.load': ['runtime.initialize'],
  'runtime.start': ['runtime.initialize'],
  'runtime.pause': ['runtime.initialize', 'runtime.start'],
  'runtime.resume': ['runtime.initialize', 'runtime.start', 'runtime.pause'],
  'runtime.stop': ['runtime.initialize'],
  'camera.control': ['runtime.initialize'],
  'character.create': ['runtime.initialize'],
  'character.remove': ['runtime.initialize'],
  'character.move': ['runtime.initialize'],
  'character.animate': ['runtime.initialize'],
  'effects.play': ['runtime.initialize'],
  'environment.update': ['runtime.initialize'],
  'runtime.status': ['runtime.initialize'],
  'output.capture': ['runtime.initialize'],
};

/** Fail contract registration when a declared capability cannot be exercised after initialization. */
export function assertEngineAdapterCapabilityPrerequisites(capabilities: ReadonlySet<EngineCapability>): void {
  for (const capability of capabilities) {
    const missing = (CAPABILITY_PREREQUISITES[capability] ?? []).filter((required) => !capabilities.has(required));
    if (missing.length > 0) {
      throw new Error(`Capability ${capability} requires declared capabilities: ${missing.join(', ')}`);
    }
  }
}

/** Register reusable behavioral checks for a concrete EngineAdapter factory. */
export function defineEngineAdapterContract(name: string, createAdapter: () => EngineAdapter): void {
  describe(`${name} EngineAdapter contract`, () => {
    it('exposes non-empty engine metadata and a valid capability set', () => {
      const adapter = createAdapter();
      expect(adapter.engineId.trim()).not.toBe('');
      expect(adapter.version.trim()).not.toBe('');
      expect(adapter.adapterVersion.trim()).not.toBe('');
      for (const capability of adapter.capabilities) expect(ENGINE_CAPABILITIES).toContain(capability);
      expect(() => assertEngineAdapterCapabilityPrerequisites(adapter.capabilities)).not.toThrow();
    });

    it('reports health and numeric or scalar performance metrics', async () => {
      const adapter = createAdapter();
      const health = await adapter.getHealth();
      expect(typeof health.healthy).toBe('boolean');
      const performance = await adapter.getPerformance();
      expect(performance).not.toBeNull();
      expect(typeof performance).toBe('object');
      for (const value of Object.values(performance)) {
        expect(['number', 'string', 'boolean', 'object']).toContain(typeof value);
      }
    });

    it('successfully invokes every operation whose capability is declared', async () => {
      const adapter = createAdapter();
      const id = runtimeId('contract-runtime');
      const actions = operations(adapter, id);
      assertEngineAdapterCapabilityPrerequisites(adapter.capabilities);
      if (adapter.capabilities.has('runtime.initialize')) {
        const initialize = actions.find(([capability]) => capability === 'runtime.initialize');
        await initialize?.[1]();
      }
      for (const [capability, action] of actions) {
        if (!adapter.capabilities.has(capability) || capability === 'runtime.initialize') continue;
        await action();
      }
      if (adapter.capabilities.has('runtime.status')) {
        expect(RUNTIME_STATUSES).toContain(await adapter.getRuntimeStatus(id));
      }
    });

    it('throws UnsupportedCapabilityError for every undeclared operation', async () => {
      const adapter = createAdapter();
      const id = runtimeId('unsupported-runtime');
      for (const [capability, action] of operations(adapter, id)) {
        if (!adapter.capabilities.has(capability)) {
          await expect(action()).rejects.toMatchObject({ code: 'UNSUPPORTED_CAPABILITY', details: { capability } });
        }
      }
    });

    it('isolates runtime state by RuntimeId', async () => {
      const adapter = createAdapter();
      if (!adapter.capabilities.has('runtime.initialize') || !adapter.capabilities.has('runtime.start') || !adapter.capabilities.has('runtime.status')) return;
      const first = runtimeId('isolation-one');
      const second = runtimeId('isolation-two');
      await adapter.initialize(first);
      await adapter.start(first);
      await adapter.initialize(second);
      const firstStatus = await adapter.getRuntimeStatus(first);
      const secondStatus = await adapter.getRuntimeStatus(second);
      expect(RUNTIME_STATUSES).toContain(firstStatus);
      expect(RUNTIME_STATUSES).toContain(secondStatus);
      expect(firstStatus).not.toBe(secondStatus);
    });
  });
}
