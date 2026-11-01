import { randomUUID } from 'node:crypto';
import { channelId, runtimeId, worldId, type JsonValue, type World } from '@vtl/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ChannelRepository } from '../channel-repository.js';
import { ChannelEngineMismatchError, EntityNotFoundError, requireJsonContentType } from '../http-errors.js';

const jsonSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonSchema),
  z.record(z.string(), jsonSchema),
]));
const vectorSchema = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
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
const createChannelSchema = z.object({ name: z.string().trim().min(1), engineId: z.string().trim().min(1).optional(), world: worldInputSchema });

export async function registerChannelRoutes(app: FastifyInstance, channels: ChannelRepository, adapterEngineId: string): Promise<void> {
  app.post('/channels', async (request, reply) => {
    requireJsonContentType(request.headers['content-type']);
    const input = createChannelSchema.parse(request.body);
    const engineId = input.engineId ?? adapterEngineId;
    if (engineId !== adapterEngineId) throw new ChannelEngineMismatchError();
    const id = channelId(randomUUID());
    const worldKey = worldId(randomUUID());
    const environment = input.world.environment ?? input.world.scene?.environment ?? {};
    const camera = input.world.camera ?? input.world.scene?.camera ?? {};
    const characters = input.world.characters ?? input.world.scene?.characters ?? [];
    const assetIds = input.world.assetIds ?? input.world.scene?.assetIds ?? [];
    const lighting = input.world.lighting ?? input.world.scene?.lighting ?? {};
    const audio = input.world.audio ?? input.world.scene?.audio ?? {};
    const effects = input.world.effects ?? input.world.scene?.effects ?? {};
    const sceneId = input.world.scene?.sceneId ?? randomUUID();
    const world: World = {
      worldId: worldKey, name: input.world.name,
      environment,
      scene: {
        sceneId, environment, assetIds, camera, characters, lighting, audio, effects,
      },
      assetIds, camera, characters, lighting, audio, effects,
    };
    const channel = { channelId: id, name: input.name, worldId: worldKey, engineId, destinations: [], scheduleReferences: [] };
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
