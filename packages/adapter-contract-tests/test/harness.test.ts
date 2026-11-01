import { describe, expect, it } from 'vitest';
import { EngineAdapter, type EngineHealthStatus, type EnginePerformanceStatus } from '@vtl/application';
import { runtimeId, UnsupportedCapabilityError } from '@vtl/domain';
import { defineEngineAdapterContract } from '../src/index.js';

class MinimalAdapter extends EngineAdapter {
  readonly engineId = 'minimal';
  readonly version = '1';
  readonly adapterVersion = '1';
  readonly capabilities = new Set<never>();
  async getHealth(): Promise<EngineHealthStatus> { return { healthy: true }; }
  async getPerformance(): Promise<EnginePerformanceStatus> { return { checks: 1 }; }
}

describe('defineEngineAdapterContract', () => {
  defineEngineAdapterContract('minimal test adapter', () => new MinimalAdapter());
  it('runs reusable checks for its factory', () => {
    expect(new MinimalAdapter()).toBeInstanceOf(EngineAdapter);
  });

  it('checks stopAnimation as an unsupported character.animate operation', async () => {
    await expect(new MinimalAdapter().stopAnimation(runtimeId('animation-runtime'), 'character'))
      .rejects.toBeInstanceOf(UnsupportedCapabilityError);
  });
});
