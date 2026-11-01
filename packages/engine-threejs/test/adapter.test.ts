import { describe, expect, it } from 'vitest';
import { defineEngineAdapterContract } from '@vtl/adapter-contract-tests';
import { runtimeId, worldId, type World } from '@vtl/domain';
import { ThreeJsEngineAdapter } from '../src/index.js';

defineEngineAdapterContract('Three.js', () => new ThreeJsEngineAdapter());

describe('ThreeJsEngineAdapter scene registry', () => {
  it('creates an isolated Three.js scene per runtime and attaches the loaded world scene', async () => {
    const adapter = new ThreeJsEngineAdapter();
    const first = runtimeId('scene-one');
    const second = runtimeId('scene-two');
    const world: World = {
      worldId: worldId('w'), name: 'World', environment: {},
      scene: { sceneId: 'scene', assetIds: [], characters: [] },
      assetIds: [], camera: {}, characters: [], lighting: {}, audio: {}, effects: {},
    };
    await adapter.initialize(first);
    await adapter.initialize(second);
    await adapter.loadWorld(first, world);
    expect(adapter.getScene(first)).not.toBe(adapter.getScene(second));
    expect(adapter.getScene(first)?.children).toHaveLength(1);
    expect(adapter.getScene(first)?.children[0]?.name).toBe('scene');
    expect(adapter.getScene(second)?.children).toHaveLength(0);
  });
});
