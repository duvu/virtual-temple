import type { RuntimeId, WorldId, ChannelId } from './ids.js';

export const RUNTIME_STATUSES = [
  'CREATED', 'INITIALIZING', 'READY', 'RUNNING', 'PAUSED', 'STOPPING', 'STOPPED', 'ERROR',
] as const;
export type RuntimeStatus = (typeof RUNTIME_STATUSES)[number];

export const ENGINE_CAPABILITIES = [
  'runtime.initialize', 'world.load', 'runtime.start', 'runtime.stop', 'runtime.pause', 'runtime.resume',
  'camera.control', 'character.create', 'character.remove', 'character.move', 'character.animate',
  'effects.play', 'environment.update', 'runtime.status', 'output.capture',
] as const;
export type EngineCapability = (typeof ENGINE_CAPABILITIES)[number];

export interface RuntimeDescriptor {
  readonly runtimeId: RuntimeId;
  readonly channelId: ChannelId;
  readonly worldId: WorldId;
  readonly status: RuntimeStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
