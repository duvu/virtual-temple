import type { EventId, PlatformId, PlatformUserId, ChannelId } from './ids.js';
import type { JsonValue } from './world.js';

export interface NormalizedEvent {
  readonly eventId: EventId;
  readonly eventType: string;
  readonly channelId: ChannelId;
  readonly platformId: PlatformId;
  readonly platformUserId?: PlatformUserId;
  readonly timestamp: string;
  readonly payload: JsonValue;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}
