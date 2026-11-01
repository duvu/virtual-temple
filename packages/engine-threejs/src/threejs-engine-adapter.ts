import { EngineAdapter, type EngineHealthStatus, type EnginePerformanceStatus } from '@vtl/application';
import { RuntimeNotFoundError, type RuntimeId, type RuntimeStatus, type World } from '@vtl/domain';
import { Group, Scene } from 'three';

interface RuntimeInstance {
  readonly scene: Scene;
  status: RuntimeStatus;
  world?: World;
}

/** Minimal headless Three.js adapter: owns one real Scene graph per runtime. */
export class ThreeJsEngineAdapter extends EngineAdapter {
  readonly engineId = 'threejs';
  readonly version = '0.180.0';
  readonly adapterVersion = '0.1.0';
  readonly capabilities = new Set([
    'runtime.initialize', 'world.load', 'runtime.start', 'runtime.stop',
    'runtime.pause', 'runtime.resume', 'runtime.status',
  ] as const);

  private readonly runtimes = new Map<RuntimeId, RuntimeInstance>();

  async getHealth(): Promise<EngineHealthStatus> {
    return { healthy: true };
  }

  async getPerformance(): Promise<EnginePerformanceStatus> {
    return { runtimeCount: this.runtimes.size, sceneCount: this.runtimes.size };
  }

  async initialize(id: RuntimeId): Promise<void> {
    this.runtimes.set(id, { scene: new Scene(), status: 'READY' });
  }

  async loadWorld(id: RuntimeId, world: World): Promise<void> {
    const runtime = this.getRuntime(id);
    const priorGroup = runtime.scene.getObjectByName(world.scene.sceneId);
    if (priorGroup) runtime.scene.remove(priorGroup);
    const worldRoot = new Group();
    worldRoot.name = world.scene.sceneId;
    runtime.scene.add(worldRoot);
    runtime.world = world;
  }

  async start(id: RuntimeId): Promise<void> { this.getRuntime(id).status = 'RUNNING'; }
  async stop(id: RuntimeId): Promise<void> { this.getRuntime(id).status = 'STOPPED'; }
  async pause(id: RuntimeId): Promise<void> { this.getRuntime(id).status = 'PAUSED'; }
  async resume(id: RuntimeId): Promise<void> { this.getRuntime(id).status = 'RUNNING'; }

  async getRuntimeStatus(id: RuntimeId): Promise<RuntimeStatus> {
    return this.getRuntime(id).status;
  }

  /** Exposes the owned scene graph for host integration and adapter-level inspection. */
  getScene(id: RuntimeId): Scene | undefined {
    return this.runtimes.get(id)?.scene;
  }

  private getRuntime(id: RuntimeId): RuntimeInstance {
    const runtime = this.runtimes.get(id);
    if (!runtime) throw new RuntimeNotFoundError(id);
    return runtime;
  }
}
