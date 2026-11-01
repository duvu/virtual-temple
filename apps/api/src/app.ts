import Fastify, { type FastifyInstance } from 'fastify';
import { RuntimeService, InMemoryRuntimeRepository, type RuntimeRepository, type EngineAdapter } from '@vtl/application';
import { InMemoryChannelRepository, type ChannelRepository } from './channel-repository.js';
import { registerErrorHandler } from './http-errors.js';
import { registerChannelRoutes } from './routes/channels.js';
import { registerRuntimeRoutes } from './routes/runtimes.js';

declare module 'fastify' {
  interface FastifyInstance { runtimeService: RuntimeService; runtimeRepository: RuntimeRepository }
}

export interface AppDependencies {
  readonly adapter: EngineAdapter;
  readonly runtimeRepository?: RuntimeRepository;
  readonly channelRepository?: ChannelRepository;
  readonly runtimeService?: RuntimeService;
}

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  const channels = dependencies.channelRepository ?? new InMemoryChannelRepository();
  const runtimeRepository = dependencies.runtimeRepository ?? new InMemoryRuntimeRepository();
  const runtimeService = dependencies.runtimeService ?? new RuntimeService(dependencies.adapter, runtimeRepository);
  app.decorate('runtimeService', runtimeService);
  app.decorate('runtimeRepository', runtimeRepository);
  registerErrorHandler(app);
  app.get('/healthz', async () => ({ status: 'ok' }));
  void app.register(async (instance) => {
    await registerChannelRoutes(instance, channels, dependencies.adapter.engineId);
    await registerRuntimeRoutes(instance, channels);
  });
  return app;
}
