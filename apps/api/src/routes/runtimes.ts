import { runtimeId } from '@vtl/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ChannelRepository } from '../channel-repository.js';
import { EntityNotFoundError } from '../http-errors.js';

const paramsSchema = z.object({ runtimeId: z.string().min(1) });
const actionSchema = z.object({ action: z.enum(['initialize', 'start', 'pause', 'resume', 'stop']) });

export async function registerRuntimeRoutes(app: FastifyInstance, channels: ChannelRepository): Promise<void> {
  app.get('/runtimes/:runtimeId', async (request) => {
    const params = paramsSchema.parse(request.params);
    const record = await app.runtimeRepository.get(runtimeId(params.runtimeId));
    if (!record) throw new EntityNotFoundError('Runtime');
    if (record.error === undefined) return record;
    return { ...record, error: { code: 'ADAPTER_FAILURE', message: 'Adapter operation failed' } };
  });
  app.post('/runtimes/:runtimeId/actions', async (request) => {
    const params = paramsSchema.parse(request.params);
    const { action } = actionSchema.parse(request.body);
    const id = runtimeId(params.runtimeId);
    if (action === 'initialize') {
      const current = await app.runtimeRepository.get(id);
      if (!current) throw new EntityNotFoundError('Runtime');
      const channel = await channels.get(current.channelId);
      if (!channel) throw new EntityNotFoundError('Channel');
      return app.runtimeService.initialize(id, channel.world);
    }
    return app.runtimeService[action](id);
  });
}
