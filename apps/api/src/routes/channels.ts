import { randomUUID } from 'node:crypto';
import { channelId, runtimeId, worldId, type JsonValue, type World } from '@vtl/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ChannelRepository } from '../channel-repository.js';
import { EntityNotFoundError } from '../http-errors.js';

const jsonSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonSchema),
  z.record(z.string(), jsonSchema),
]));
const vectorSchema = z.object({ x: z.number(), y: z.number(), z: z.number() });
const characterSchema = z.object({
  characterId: z.string().min(1), assetId: z.string().min(1), position: vectorSchema.optional(),
  rotation: vectorSchema.optional(), scale: vectorSchema.optional(), initialAnimationId: z.string().optional(),
});
const worldInputSchema = z.object({
  name: z.string().min(1), environment: jsonSchema.optional(),
  scene: z.object({ sceneId: z.string().min(1).optional(), environment: jsonSchema.optional(), assetIds: z.array(z.string()).optional(), camera: jsonSchema.optional(), characters: z.array(characterSchema).optional(), lighting: jsonSchema.optional(), audio: jsonSchema.optional(), effects: jsonSchema.optional() }).optional(),
  assetIds: z.array(z.string()).optional(), camera: jsonSchema.optional(), characters: z.array(characterSchema).optional(),
  lighting: jsonSchema.optional(), audio: jsonSchema.optional(), effects: jsonSchema.optional(),
});
const createChannelSchema = z.object({ name: z.string().trim().min(1), engineId: z.string().trim().min(1).default('threejs'), world: worldInputSchema });

export async function registerChannelRoutes(app: FastifyInstance, channels: ChannelRepository): Promise<void> {
  app.post('/channels', async (request, reply) => {
    const input = createChannelSchema.parse(request.body);
    const id = channelId(randomUUID());
    const worldKey = worldId(randomUUID());
    const characters = input.world.characters ?? input.world.scene?.characters ?? [];
    const assetIds = input.world.assetIds ?? input.world.scene?.assetIds ?? [];
    const sceneId = input.world.scene?.sceneId ?? randomUUID();
    const world: World = {
      worldId: worldKey, name: input.world.name,
      environment: input.world.environment ?? {},
      scene: {
        sceneId, environment: input.world.scene?.environment, assetIds,
        camera: input.world.scene?.camera, characters,
        lighting: input.world.scene?.lighting, audio: input.world.scene?.audio, effects: input.world.scene?.effects,
      },
      assetIds, camera: input.world.camera ?? {}, characters,
      lighting: input.world.lighting ?? {}, audio: input.world.audio ?? {}, effects: input.world.effects ?? {},
    };
    const channel = { channelId: id, name: input.name, worldId: worldKey, engineId: input.engineId, destinations: [], scheduleReferences: [] };
    await channels.save({ channel, world });
    return reply.code(201).send(channel);
  });

  app.get('/channels', async () => channels.list());

  app.post('/channels/:channelId/runtimes', async (request, reply) => {
    const params = z.object({ channelId: z.string().min(1) }).parse(request.params);
    const record = await channels.get(channelId(params.channelId));
    if (!record) throw new EntityNotFoundError('Channel');
    const runtimeUuid = randomUUID();
    const runtime = await app.runtimeService.create({ runtimeId: runtimeId(runtimeUuid), channelId: record.channel.channelId, worldId: record.world.worldId });
    return reply.code(201).send(runtime);
  });
}
