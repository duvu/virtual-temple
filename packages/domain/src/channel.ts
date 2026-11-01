import type { ChannelId, PlatformId, WorldId } from './ids.js';

export interface ChannelDestination {
  readonly platformId: PlatformId;
  readonly destinationId: string;
}

export interface Channel {
  readonly channelId: ChannelId;
  readonly name: string;
  readonly worldId: WorldId;
  /** Logical adapter selection, for example "threejs". */
  readonly engineId: string;
  readonly destinations: readonly ChannelDestination[];
  readonly scheduleReferences: readonly string[];
}
