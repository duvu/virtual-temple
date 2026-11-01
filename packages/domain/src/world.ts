import type { WorldId } from './ids.js';
import type { JsonValue } from './json.js';

export interface CharacterPlacement {
  readonly characterId: string;
  readonly assetId: string;
  readonly position?: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotation?: { readonly x: number; readonly y: number; readonly z: number };
  readonly scale?: { readonly x: number; readonly y: number; readonly z: number };
  readonly initialAnimationId?: string;
}

export interface SceneConfiguration {
  readonly sceneId: string;
  readonly environment?: JsonValue;
  readonly assetIds: readonly string[];
  readonly camera?: JsonValue;
  readonly characters: readonly CharacterPlacement[];
  readonly lighting?: JsonValue;
  readonly audio?: JsonValue;
  readonly effects?: JsonValue;
}

export interface World {
  readonly worldId: WorldId;
  readonly name: string;
  readonly environment: JsonValue;
  readonly scene: SceneConfiguration;
  readonly assetIds: readonly string[];
  readonly camera: JsonValue;
  readonly characters: readonly CharacterPlacement[];
  readonly lighting: JsonValue;
  readonly audio: JsonValue;
  readonly effects: JsonValue;
}
