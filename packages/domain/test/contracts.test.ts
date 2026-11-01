import { describe, expect, it } from 'vitest';
import {
  AdapterFailureError, Channel, ChannelId, CharacterPlacement, CommandId, CorrelationId,
  DomainError, ENGINE_CAPABILITIES, EventId, NormalizedEvent, PlatformId, PlatformUserId,
  RuntimeCommand, RuntimeId, RuntimeNotFoundError, RUNTIME_STATUSES, SceneConfiguration,
  UnsupportedCapabilityError, World, WorldId, channelId, commandId, correlationId, eventId,
  platformId, platformUserId, runtimeId, worldId,
} from '../src/index.js';

describe('engine-independent domain contracts', () => {
  it('constructs channel and world models using logical asset and animation identifiers', () => {
    const placement: CharacterPlacement = { characterId: 'host', assetId: 'asset-host', initialAnimationId: 'greet' };
    const scene: SceneConfiguration = {
      sceneId: 'main', assetIds: ['stage'], characters: [placement], environment: { theme: 'temple' },
      camera: { presetId: 'wide' }, lighting: { profileId: 'warm' }, audio: { trackId: 'intro' }, effects: { presetId: 'sparkle' },
    };
    const world: World = {
      worldId: worldId('world-1'), name: 'Temple', environment: { theme: 'temple' }, scene,
      assetIds: ['stage', 'asset-host'], camera: { presetId: 'wide' }, characters: [placement],
      lighting: { profileId: 'warm' }, audio: { trackId: 'intro' }, effects: { presetId: 'sparkle' },
    };
    const channel: Channel = {
      channelId: channelId('channel-1'), name: 'Main', worldId: world.worldId, engineId: 'threejs',
      destinations: [{ platformId: platformId('youtube'), destinationId: 'live-1' }], scheduleReferences: ['schedule-1'],
    };
    expect(channel.worldId).toBe(world.worldId);
    expect(world.scene.characters[0]?.initialAnimationId).toBe('greet');
  });

  it('constructs normalized event and runtime command envelopes', () => {
    const e: NormalizedEvent = {
      eventId: eventId('event-1'), eventType: 'chat.message', channelId: channelId('channel-1'),
      platformId: platformId('youtube'), platformUserId: platformUserId('user-1'), timestamp: new Date(0).toISOString(),
      payload: { text: 'hello' }, metadata: { source: 'chat' },
    };
    const c: RuntimeCommand = {
      commandId: commandId('command-1'), channelId: e.channelId, runtimeId: runtimeId('runtime-1'),
      commandType: 'character.action', payload: { characterId: 'host', actionId: 'wave', animationId: 'greet' },
      timestamp: e.timestamp, correlationId: correlationId('correlation-1'),
    };
    expect(e.payload).toEqual({ text: 'hello' });
    expect(c.correlationId).toBe('correlation-1');
  });

  it('exposes lifecycle, capabilities and serializable error codes', () => {
    expect(RUNTIME_STATUSES).toEqual(['CREATED', 'INITIALIZING', 'READY', 'RUNNING', 'PAUSED', 'STOPPING', 'STOPPED', 'ERROR']);
    expect(ENGINE_CAPABILITIES).toContain('character.animate');
    const errors: DomainError[] = [
      new DomainError('INVALID_RUNTIME_TRANSITION', 'invalid'),
      new UnsupportedCapabilityError('output.capture'), new AdapterFailureError('failed'), new RuntimeNotFoundError('runtime-1'),
    ];
    expect(errors.map((error) => error.toJSON().code)).toEqual([
      'INVALID_RUNTIME_TRANSITION', 'UNSUPPORTED_CAPABILITY', 'ADAPTER_FAILURE', 'RUNTIME_NOT_FOUND',
    ]);
    expect(JSON.parse(JSON.stringify(errors[1]))).toEqual(errors[1]?.toJSON());
  });
});
