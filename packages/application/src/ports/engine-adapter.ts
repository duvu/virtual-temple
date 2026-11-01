import {
  UnsupportedCapabilityError,
  type CharacterPlacement,
  type EngineCapability,
  type JsonValue,
  type RuntimeId,
  type RuntimeStatus,
  type World,
} from '@vtl/domain';

export interface EngineHealthStatus {
  readonly healthy: boolean;
  readonly message?: string;
}

export interface EnginePerformanceStatus {
  readonly [metric: string]: number | string | boolean | null;
}

/** Engine boundary. Implementations declare support and override only supported operations. */
export abstract class EngineAdapter {
  abstract readonly engineId: string;
  abstract readonly version: string;
  abstract readonly adapterVersion: string;
  abstract readonly capabilities: ReadonlySet<EngineCapability>;

  abstract getHealth(): Promise<EngineHealthStatus>;
  abstract getPerformance(): Promise<EnginePerformanceStatus>;

  initialize(_runtimeId: RuntimeId): Promise<void> { return this.unsupported('runtime.initialize'); }
  loadWorld(_runtimeId: RuntimeId, _world: World): Promise<void> { return this.unsupported('world.load'); }
  start(_runtimeId: RuntimeId): Promise<void> { return this.unsupported('runtime.start'); }
  stop(_runtimeId: RuntimeId): Promise<void> { return this.unsupported('runtime.stop'); }
  pause(_runtimeId: RuntimeId): Promise<void> { return this.unsupported('runtime.pause'); }
  resume(_runtimeId: RuntimeId): Promise<void> { return this.unsupported('runtime.resume'); }
  setCamera(_runtimeId: RuntimeId, _camera: JsonValue): Promise<void> { return this.unsupported('camera.control'); }
  spawnCharacter(_runtimeId: RuntimeId, _character: CharacterPlacement): Promise<void> { return this.unsupported('character.create'); }
  despawnCharacter(_runtimeId: RuntimeId, _characterId: string): Promise<void> { return this.unsupported('character.remove'); }
  moveCharacter(_runtimeId: RuntimeId, _characterId: string, _position: CharacterPlacement['position']): Promise<void> { return this.unsupported('character.move'); }
  playAnimation(_runtimeId: RuntimeId, _characterId: string, _animationId: string): Promise<void> { return this.unsupported('character.animate'); }
  stopAnimation(_runtimeId: RuntimeId, _characterId: string): Promise<void> { return this.unsupported('character.animate'); }
  showEffect(_runtimeId: RuntimeId, _effect: JsonValue): Promise<void> { return this.unsupported('effects.play'); }
  setEnvironment(_runtimeId: RuntimeId, _environment: JsonValue): Promise<void> { return this.unsupported('environment.update'); }
  getRuntimeStatus(_runtimeId: RuntimeId): Promise<RuntimeStatus> { return this.unsupported('runtime.status'); }
  captureOutput(_runtimeId: RuntimeId): Promise<JsonValue> { return this.unsupported('output.capture'); }

  private unsupported(capability: EngineCapability): Promise<never> {
    return Promise.reject(new UnsupportedCapabilityError(capability));
  }
}
