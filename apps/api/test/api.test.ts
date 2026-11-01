import { describe, expect, it } from 'vitest';
import { EngineAdapter, InMemoryRuntimeRepository } from '@vtl/application';
import { channelId, worldId, type EngineCapability, type RuntimeId, type RuntimeStatus, type World } from '@vtl/domain';
import { buildApp } from '../src/app.js';
import { InMemoryChannelRepository } from '../src/channel-repository.js';
import { requireJsonContentType, UnsupportedMediaTypeError } from '../src/http-errors.js';

class TestAdapter extends EngineAdapter {
  readonly engineId = 'test';
  readonly version = '1';
  readonly adapterVersion = '1';
  readonly capabilities = new Set<EngineCapability>(['runtime.initialize', 'world.load', 'runtime.start', 'runtime.pause', 'runtime.resume', 'runtime.stop', 'runtime.status']);
  readonly initializedWorlds: string[] = [];
  readonly loadedWorlds: World[] = [];
  async getHealth() { return { healthy: true }; }
  async getPerformance() { return { runtimeCount: 0 }; }
  async initialize(_id: RuntimeId) {}
  async loadWorld(_id: RuntimeId, world: World) { this.initializedWorlds.push(world.worldId); this.loadedWorlds.push(world); }
  async start(_id: RuntimeId) {}
  async pause(_id: RuntimeId) {}
  async resume(_id: RuntimeId) {}
  async stop(_id: RuntimeId) {}
  async getRuntimeStatus(_id: RuntimeId): Promise<RuntimeStatus> { return 'READY'; }
}

const makeApp = (adapter = new TestAdapter()) => buildApp({ adapter, runtimeRepository: new InMemoryRuntimeRepository() });
const channelBody = (name: string) => ({ name, world: { name: `${name} world` } });

async function createChannel(app: Awaited<ReturnType<typeof makeApp>>, name: string) {
  const response = await app.inject({ method: 'POST', url: '/channels', payload: channelBody(name) });
  expect(response.statusCode).toBe(201);
  return response.json() as { channelId: string; worldId: string };
}

describe('API', () => {
  it('accepts JSON with charset parameters and rejects other JSON media types', () => {
    expect(() => requireJsonContentType('application/json; charset=utf-8')).not.toThrow();
    expect(() => requireJsonContentType('application/problem+json')).toThrow(UnsupportedMediaTypeError);
  });

  it('reports health', async () => {
    const app = makeApp();
    const response = await app.inject('/healthz');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('creates and lists channels', async () => {
    const app = makeApp();
    const created = await createChannel(app, 'Temple');
    const listed = await app.inject('/channels');
    expect(listed.json()).toHaveLength(1);
    expect(listed.json()[0]).toMatchObject({ channelId: created.channelId, worldId: created.worldId, name: 'Temple' });
    await app.close();
  });

  it('rejects non-finite character coordinates from raw JSON', async () => {
    const app = makeApp();
    const response = await app.inject({
      method: 'POST', url: '/channels', headers: { 'content-type': 'application/json' },
      payload: '{"name":"Bad coordinate","world":{"name":"Bad world","characters":[{"characterId":"c1","assetId":"a1","position":{"x":1e400,"y":0,"z":0}}]}}',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
    await app.close();
  });

  it('normalizes duplicate world fields with top-level values taking precedence', async () => {
    const adapter = new TestAdapter();
    const app = makeApp(adapter);
    const response = await app.inject({
      method: 'POST', url: '/channels',
      payload: {
        name: 'Normalized',
        world: {
          name: 'Normalized world', environment: { source: 'top' }, camera: { source: 'top' },
          scene: { environment: { source: 'scene' }, camera: { source: 'scene' } },
        },
      },
    });
    expect(response.statusCode).toBe(201);
    const runtime = await app.inject({ method: 'POST', url: `/channels/${response.json().channelId}/runtimes` });
    const runtimeId = runtime.json().runtimeId;
    const initialized = await app.inject({ method: 'POST', url: `/runtimes/${runtimeId}/actions`, payload: { action: 'initialize' } });
    expect(initialized.statusCode).toBe(200);
    expect(adapter.loadedWorlds[0]).toMatchObject({
      environment: { source: 'top' }, camera: { source: 'top' },
      scene: { environment: { source: 'top' }, camera: { source: 'top' } },
    });
    await app.close();
  });

  it('runs initialize and the lifecycle actions', async () => {
    const app = makeApp();
    const channel = await createChannel(app, 'One');
    const runtime = await app.inject({ method: 'POST', url: `/channels/${channel.channelId}/runtimes` });
    expect(runtime.statusCode).toBe(201);
    const id = runtime.json().runtimeId;
    for (const action of ['initialize', 'start', 'pause', 'resume', 'stop']) {
      const response = await app.inject({ method: 'POST', url: `/runtimes/${id}/actions`, payload: { action } });
      expect(response.statusCode).toBe(200);
    }
    expect((await app.inject(`/runtimes/${id}`)).json().status).toBe('STOPPED');
    await app.close();
  });

  it('loads each channel world and keeps runtimes independent', async () => {
    const adapter = new TestAdapter();
    const app = makeApp(adapter);
    const a = await createChannel(app, 'A');
    const b = await createChannel(app, 'B');
    const ra = (await app.inject({ method: 'POST', url: `/channels/${a.channelId}/runtimes` })).json().runtimeId;
    const rb = (await app.inject({ method: 'POST', url: `/channels/${b.channelId}/runtimes` })).json().runtimeId;
    await app.inject({ method: 'POST', url: `/runtimes/${ra}/actions`, payload: { action: 'initialize' } });
    await app.inject({ method: 'POST', url: `/runtimes/${rb}/actions`, payload: { action: 'initialize' } });
    await app.inject({ method: 'POST', url: `/runtimes/${ra}/actions`, payload: { action: 'start' } });
    expect((await app.inject(`/runtimes/${ra}`)).json().status).toBe('RUNNING');
    expect((await app.inject(`/runtimes/${rb}`)).json().status).toBe('READY');
    expect(adapter.initializedWorlds).toEqual([a.worldId, b.worldId]);
    await app.close();
  });

  it('returns stable 404 for unknown runtime', async () => {
    const app = makeApp();
    const response = await app.inject('/runtimes/missing');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Runtime not found' } });
    await app.close();
  });

  it('returns stable 400 for invalid input', async () => {
    const app = makeApp();
    const response = await app.inject({ method: 'POST', url: '/channels', payload: { name: '' } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
    await app.close();
  });

  it('returns stable 400 for malformed JSON and 415 for unsupported content type', async () => {
    const app = makeApp();
    const malformed = await app.inject({ method: 'POST', url: '/channels', headers: { 'content-type': 'application/json' }, payload: '{broken' });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({ error: { code: 'INVALID_JSON', message: 'Malformed JSON request' } });
    expect(malformed.body).not.toContain('Unexpected token');

    const unsupported = await app.inject({ method: 'POST', url: '/channels', headers: { 'content-type': 'text/plain' }, payload: 'secret body' });
    expect(unsupported.statusCode).toBe(415);
    expect(unsupported.json()).toEqual({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported content type' } });
    expect(unsupported.body).not.toContain('secret body');

    const customJson = await app.inject({ method: 'POST', url: '/channels', headers: { 'content-type': 'application/problem+json' }, payload: '{"detail":"private"}' });
    expect(customJson.statusCode).toBe(415);
    expect(customJson.json()).toEqual({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported content type' } });

    const oversized = await app.inject({ method: 'POST', url: '/channels', headers: { 'content-type': 'application/json' }, payload: ' '.repeat(1_048_577) });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload too large' } });
    await app.close();
  });

  it('rejects channel engine ids that do not match the configured adapter', async () => {
    const channels = new InMemoryChannelRepository();
    const app = buildApp({ adapter: new TestAdapter(), runtimeRepository: new InMemoryRuntimeRepository(), channelRepository: channels });
    const response = await app.inject({ method: 'POST', url: '/channels', payload: { ...channelBody('Mismatch'), engineId: 'another-engine' } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'ENGINE_MISMATCH', message: 'Channel engine does not match configured adapter' } });
    expect(await channels.list()).toEqual([]);
    await app.close();
  });

  it('returns isolated copies of nested world state from the channel repository', async () => {
    const channels = new InMemoryChannelRepository();
    const app = buildApp({ adapter: new TestAdapter(), runtimeRepository: new InMemoryRuntimeRepository(), channelRepository: channels });
    const created = await createChannel(app, 'Nested');
    const first = await channels.get(channelId(created.channelId));
    expect(first).toBeDefined();
    (first!.world.environment as { marker?: string }).marker = 'mutated';
    (first!.world.scene.assetIds as string[]).push('mutated-asset');
    const second = await channels.get(channelId(created.channelId));
    expect(second!.world.environment).toEqual({});
    expect(second!.world.scene.assetIds).toEqual([]);
    await app.close();
  });

  it('returns stable 409 for invalid transitions and unsupported capabilities', async () => {
    const app = makeApp();
    const channel = await createChannel(app, 'One');
    const runtime = (await app.inject({ method: 'POST', url: `/channels/${channel.channelId}/runtimes` })).json().runtimeId;
    const response = await app.inject({ method: 'POST', url: `/runtimes/${runtime}/actions`, payload: { action: 'pause' } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('INVALID_RUNTIME_TRANSITION');
    await app.close();

    const restricted = new TestAdapter();
    (restricted as { capabilities: ReadonlySet<EngineCapability> }).capabilities = new Set();
    const other = makeApp(restricted);
    const ch = await createChannel(other, 'Restricted');
    const run = (await other.inject({ method: 'POST', url: `/channels/${ch.channelId}/runtimes` })).json().runtimeId;
    const unsupported = await other.inject({ method: 'POST', url: `/runtimes/${run}/actions`, payload: { action: 'initialize' } });
    expect(unsupported.statusCode).toBe(409);
    expect(unsupported.json().error.code).toBe('UNSUPPORTED_CAPABILITY');
    await other.close();
  });

  it('returns a stable 502 without adapter internals', async () => {
    const adapter = new TestAdapter();
    (adapter.initialize as () => Promise<void>) = async () => { throw new Error('secret stack detail'); };
    const app = makeApp(adapter);
    const channel = await createChannel(app, 'One');
    const id = (await app.inject({ method: 'POST', url: `/channels/${channel.channelId}/runtimes` })).json().runtimeId;
    const response = await app.inject({ method: 'POST', url: `/runtimes/${id}/actions`, payload: { action: 'initialize' } });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: { code: 'ADAPTER_FAILURE', message: 'Adapter operation failed' } });
    expect(response.body).not.toContain('secret stack detail');
    const persisted = await app.inject(`/runtimes/${id}`);
    expect(persisted.statusCode).toBe(200);
    expect(persisted.json().status).toBe('ERROR');
    expect(persisted.json().error).toEqual({ code: 'ADAPTER_FAILURE', message: 'Adapter operation failed' });
    expect(persisted.body).not.toContain('secret stack detail');
    expect(persisted.body).not.toContain('stack');
    await app.close();
  });
});
