import type { ChannelId, CommandId, CorrelationId, RuntimeId } from './ids.js';
import type { JsonValue } from './world.js';

export interface RuntimeCommand {
  readonly commandId: CommandId;
  readonly channelId: ChannelId;
  readonly runtimeId: RuntimeId;
  readonly commandType: string;
  readonly payload: JsonValue;
  readonly timestamp: string;
  readonly correlationId: CorrelationId;
}

/** Logical animation/action names carried by commands; never engine object IDs. */
export interface CharacterAction {
  readonly characterId: string;
  readonly actionId: string;
  readonly animationId?: string;
}
