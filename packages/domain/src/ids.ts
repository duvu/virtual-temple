export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type ChannelId = Brand<string, 'ChannelId'>;
export type WorldId = Brand<string, 'WorldId'>;
export type RuntimeId = Brand<string, 'RuntimeId'>;
export type PlatformId = Brand<string, 'PlatformId'>;
export type PlatformUserId = Brand<string, 'PlatformUserId'>;
export type EventId = Brand<string, 'EventId'>;
export type CommandId = Brand<string, 'CommandId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;

export const channelId = (value: string): ChannelId => value as ChannelId;
export const worldId = (value: string): WorldId => value as WorldId;
export const runtimeId = (value: string): RuntimeId => value as RuntimeId;
export const platformId = (value: string): PlatformId => value as PlatformId;
export const platformUserId = (value: string): PlatformUserId => value as PlatformUserId;
export const eventId = (value: string): EventId => value as EventId;
export const commandId = (value: string): CommandId => value as CommandId;
export const correlationId = (value: string): CorrelationId => value as CorrelationId;
