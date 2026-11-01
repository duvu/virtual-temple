import { InMemoryRuntimeRepository } from '@vtl/application';
import { ThreeJsEngineAdapter } from '@vtl/engine-threejs';
import { buildApp } from './app.js';

const app = buildApp({ adapter: new ThreeJsEngineAdapter(), runtimeRepository: new InMemoryRuntimeRepository() });
const port = Number(process.env.PORT ?? 3000);
try {
  await app.listen({ host: '0.0.0.0', port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
