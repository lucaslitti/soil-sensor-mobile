import type { DeviceId } from '../../domain/value-objects/deviceId';
import type { DeviceConnection } from '../../domain/entities/deviceSession';
import { DeviceRuntime } from './deviceRuntime';
import type { DeviceCommand } from './deviceCommand';
import type { ScannedDevice, HistoryLevel, SensorRecord } from '../../domain/ports/sensorGateway';
import type { CancellationToken } from './cancellationToken';
import type { SmartPotCommand } from '../usecases/controlSmartPot';
import type { OperationObserver } from '../ports/operationObserver';

interface DeviceOperations {
  connect(device: ScannedDevice): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  refresh(deviceId: string): Promise<void>;
  readHistory(deviceId: string, level: HistoryLevel, token?: CancellationToken): Promise<readonly SensorRecord[]>;
  writeSmartPot(deviceId: string, command: SmartPotCommand): Promise<void>;
  startPolling(deviceId: string): Promise<void>;
  stopPolling(deviceId: string): Promise<void>;
}

/** Runtime 所有权唯一入口；UseCase 不自行维护 runtime Map。 */
export class DeviceManager {
  private readonly runtimes = new Map<string, DeviceRuntime>();
  private sessionCounter = 0;
  private operations: DeviceOperations | null = null;

  constructor(private readonly observer?: OperationObserver) {}

  bind(operations: DeviceOperations): void {
    this.operations = operations;
  }

  connect(device: ScannedDevice): Promise<void> { return this.requireOperations().connect(device); }
  disconnect(deviceId: string): Promise<void> { return this.requireOperations().disconnect(deviceId); }
  refresh(deviceId: string): Promise<void> { return this.requireOperations().refresh(deviceId); }
  readHistory(deviceId: string, level: HistoryLevel, token?: CancellationToken): Promise<readonly SensorRecord[]> { return this.requireOperations().readHistory(deviceId, level, token); }
  writeSmartPot(deviceId: string, command: SmartPotCommand): Promise<void> { return this.requireOperations().writeSmartPot(deviceId, command); }
  startPolling(deviceId: string): Promise<void> { return this.requireOperations().startPolling(deviceId); }
  stopPolling(deviceId: string): Promise<void> { return this.requireOperations().stopPolling(deviceId); }

  get(id: DeviceId): DeviceRuntime | undefined {
    return this.runtimes.get(id.value);
  }

  create(id: DeviceId): DeviceRuntime {
    const old = this.runtimes.get(id.value);
    if (old) return old;
    const sessionId = `session-${++this.sessionCounter}`;
    const runtime = new DeviceRuntime(id, sessionId, current => this.runtimes.get(id.value)?.sessionId === current, this.observer);
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

  private requireOperations(): DeviceOperations {
    if (!this.operations) throw new Error('DeviceManager has not been configured');
    return this.operations;
  }
}
