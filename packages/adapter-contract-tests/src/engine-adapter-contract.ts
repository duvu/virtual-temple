import { describe, expect, it } from 'vitest';
import { ENGINE_CAPABILITIES, runtimeId, worldId, type EngineCapability, type World } from '@vtl/domain';
import { EngineAdapter } from '@vtl/application';

const sampleWorld: World = {
  worldId: worldId('contract-world'), name: 'Contract world', environment: {},
  scene: { sceneId: 'contract-scene', assetIds: [], characters: [] },
  assetIds: [], camera: {}, characters: [], lighting: {}, audio: {}, effects: {},
};

/** Register reusable behavioral checks for a concrete EngineAdapter factory. */
export function defineEngineAdapterContract(name: string, createAdapter: () => EngineAdapter): void {
  describe(`${name} EngineAdapter contract`, () => {
    it('exposes non-empty engine metadata and a valid capability set', () => {
      const adapter = createAdapter();
      expect(adapter.engineId.trim()).not.toBe('');
      expect(adapter.version.trim()).not.toBe('');
      expect(adapter.adapterVersion.trim()).not.toBe('');
      for (const capability of adapter.capabilities) expect(ENGINE_CAPABILITIES).toContain(capability);
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

    it('supports initialize, load world, and lifecycle status when declared', async () => {
      const adapter = createAdapter();
      const id = runtimeId('contract-runtime');
      if (adapter.capabilities.has('runtime.initialize')) await adapter.initialize(id);
      if (adapter.capabilities.has('world.load')) await adapter.loadWorld(id, sampleWorld);
      if (adapter.capabilities.has('runtime.status')) {
        const status = await adapter.getRuntimeStatus(id);
        expect(status).toBe('READY');
      }
      for (const [capability, action] of [
        ['runtime.start', () => adapter.start(id)], ['runtime.pause', () => adapter.pause(id)],
        ['runtime.resume', () => adapter.resume(id)], ['runtime.stop', () => adapter.stop(id)],
      ] as const) {
        if (adapter.capabilities.has(capability)) await action();
      }
    });

    it('throws UnsupportedCapabilityError for every undeclared operation', async () => {
      const adapter = createAdapter();
      const id = runtimeId('unsupported-runtime');
      const actions: readonly [EngineCapability, () => Promise<unknown>][] = [
        ['runtime.initialize', () => adapter.initialize(id)], ['world.load', () => adapter.loadWorld(id, sampleWorld)],
        ['runtime.start', () => adapter.start(id)], ['runtime.stop', () => adapter.stop(id)],
        ['runtime.pause', () => adapter.pause(id)], ['runtime.resume', () => adapter.resume(id)],
        ['camera.control', () => adapter.setCamera(id, {})], ['character.create', () => adapter.spawnCharacter(id, { characterId: 'c', assetId: 'a' })],
        ['character.remove', () => adapter.despawnCharacter(id, 'c')], ['character.move', () => adapter.moveCharacter(id, 'c', { x: 0, y: 0, z: 0 })],
        ['character.animate', () => adapter.playAnimation(id, 'c', 'a')], ['character.animate', () => adapter.stopAnimation(id, 'c')],
        ['effects.play', () => adapter.showEffect(id, {})], ['environment.update', () => adapter.setEnvironment(id, {})],
        ['runtime.status', () => adapter.getRuntimeStatus(id)], ['output.capture', () => adapter.captureOutput(id)],
      ];
      for (const [capability, action] of actions) {
        if (!adapter.capabilities.has(capability)) {
          await expect(action()).rejects.toMatchObject({ code: 'UNSUPPORTED_CAPABILITY', details: { capability } });
        }
      }
    });

    it('isolates runtime state by RuntimeId', async () => {
      const adapter = createAdapter();
      if (!adapter.capabilities.has('runtime.initialize') || !adapter.capabilities.has('runtime.status')) return;
      const first = runtimeId('isolation-one');
      const second = runtimeId('isolation-two');
      await adapter.initialize(first);
      await adapter.start(first);
      await adapter.initialize(second);
      expect(await adapter.getRuntimeStatus(first)).toBe('RUNNING');
      expect(await adapter.getRuntimeStatus(second)).toBe('READY');
    });
  });
}
