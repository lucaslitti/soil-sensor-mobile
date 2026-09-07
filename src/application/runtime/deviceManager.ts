import type { DeviceId } from '../../domain/value-objects/deviceId';
import type { DeviceConnection } from '../../domain/entities/deviceSession';
import { DeviceRuntime } from './deviceRuntime';
import type { DeviceCommand } from './deviceCommand';

/** Runtime 所有权唯一入口；UseCase 不自行维护 runtime Map。 */
export class DeviceManager {
  private readonly runtimes = new Map<string, DeviceRuntime>();
  private sessionCounter = 0;

  get(id: DeviceId): DeviceRuntime | undefined {
    return this.runtimes.get(id.value);
  }

  create(id: DeviceId): DeviceRuntime {
    const old = this.runtimes.get(id.value);
    if (old) return old;
    const sessionId = `session-${++this.sessionCounter}`;
    const runtime = new DeviceRuntime(id, sessionId, current => this.runtimes.get(id.value)?.sessionId === current);
    this.runtimes.set(id.value, runtime);
    return runtime;
  }

  async execute<T>(id: DeviceId, command: DeviceCommand<T>): Promise<T> {
    return this.create(id).actor.enqueue(command);
  }

  setConnection(id: DeviceId, connection: DeviceConnection): void {
    const runtime = this.create(id);
    runtime.connectionResource = connection;
    runtime.connection = 'connected';
  }

  getConnection(id: DeviceId): DeviceConnection | null {
    return this.runtimes.get(id.value)?.connectionResource ?? null;
  }

  hasConnection(id: DeviceId): boolean {
    return this.runtimes.get(id.value)?.connectionResource != null;
  }

  remove(id: DeviceId): void {
    const runtime = this.runtimes.get(id.value);
    if (runtime) runtime.actor.stop().catch(() => undefined);
    this.runtimes.delete(id.value);
  }
}
