import type { EventId, PlatformId, PlatformUserId, ChannelId } from './ids.js';
import type { JsonValue } from './json.js';

export interface NormalizedEvent {
  readonly eventId: EventId;
  readonly eventType: string;
  readonly channelId: ChannelId;
  readonly platformId: PlatformId;
  readonly platformUserId?: PlatformUserId;
  readonly timestamp: string;
  /** Must pass assertJsonValue before serialization. */
  readonly payload: JsonValue;
  /** Values must pass assertJsonValue before serialization. */
  readonly metadata: Readonly<Record<string, JsonValue>>;
}
