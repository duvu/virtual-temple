import type { Channel, ChannelId, World } from '@vtl/domain';

export interface ChannelRecord {
  readonly channel: Channel;
  readonly world: World;
}

export interface ChannelRepository {
  get(channelId: ChannelId): Promise<ChannelRecord | undefined>;
  list(): Promise<readonly Channel[]>;
  save(record: ChannelRecord): Promise<void>;
}

export class InMemoryChannelRepository implements ChannelRepository {
  private readonly records = new Map<ChannelId, ChannelRecord>();

  async get(id: ChannelId): Promise<ChannelRecord | undefined> {
    const record = this.records.get(id);
    return record === undefined ? undefined : { channel: { ...record.channel }, world: record.world };
  }

  async list(): Promise<readonly Channel[]> {
    return [...this.records.values()].map(({ channel }) => ({ ...channel }));
  }

  async save(record: ChannelRecord): Promise<void> {
    this.records.set(record.channel.channelId, { channel: { ...record.channel }, world: record.world });
  }
}
