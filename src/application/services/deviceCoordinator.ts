import type { ScannedDevice } from '../../domain/ports/sensorGateway';
import type { DomainEventPublisher } from '../../domain/events/domainEvents';
import { SensorDevice } from '../../domain/entities/sensorDevice';
import { DeviceId } from '../../domain/value-objects/deviceId';
import { DeviceSessionManager } from './deviceSessionManager';
import type { SensorGateway } from '../../domain/ports/sensorGateway';
import type { SmartPotGateway } from '../../domain/ports/smartPotGateway';
import { ConnectionPolicy } from '../../domain/services/connectionPolicy';
import { ConnectionPool } from '../../infrastructure/pool/connectionPool';
import { DeviceCommandQueue } from '../../infrastructure/concurrency/deviceCommandQueue';
import { GlobalConcurrencyPool } from '../../infrastructure/concurrency/globalConcurrencyPool';
import { PollingScheduler } from '../../infrastructure/scheduler/pollingScheduler';
import type { DeviceConnection } from '../../domain/entities/deviceSession';

export class DeviceCoordinator {
  private readonly devices = new Map<string, SensorDevice>();
  private readonly connections = new Map<string, DeviceConnection>();
  private readonly sessions = new DeviceSessionManager();
  private readonly queue = new DeviceCommandQueue();
  private readonly reads = new GlobalConcurrencyPool(2);
  private readonly scheduler: PollingScheduler;

  constructor(
    private readonly sensorGateway: SensorGateway,
    private readonly smartPotGateway: SmartPotGateway,
    private readonly policy: ConnectionPolicy = new ConnectionPolicy(),
    private readonly pool: ConnectionPool = new ConnectionPool(),
    private readonly events: DomainEventPublisher,
  ) {
    this.scheduler = new PollingScheduler(3_000, error => {
      this.events.publish({ type: 'DeviceStateChanged', deviceId: 'scheduler', state: 'failed', error: String(error) });
    });
  }

  async connect(device: ScannedDevice): Promise<void> {
    const id = device.id.value;
    const current = this.devices.get(id);
    if (current && this.connections.has(id)) {
      this.scheduler.resume(id);
      return;
    }
    if (this.pool.size() >= this.policy.maxConnections()) {
      const candidate = this.policy.selectEvictionCandidate([...this.devices.values()], device.id);
      if (!candidate) {
        this.events.publish({
          type: 'DeviceStateChanged',
          deviceId: id,
          state: 'failed',
          error: `Maximum ${this.policy.maxConnections()} connected devices reached`,
        });
        return;
      }
      await this.release(candidate.value);
    }

    const domainDevice = current ?? new SensorDevice(device.id, device.name);
    this.devices.set(id, domainDevice);
    const session = this.sessions.create(device.id);
    session.beginConnect();
    domainDevice.markConnecting();
    this.events.publish({ type: 'DeviceStateChanged', deviceId: id, state: 'connecting' });

    try {
      const connection = await this.queue.run(id, () => device.protocol === 'smart-pot'
        ? this.smartPotGateway.connect(device.id)
        : this.sensorGateway.connect(device.id, device.protocol));
      this.connections.set(id, connection);
      this.pool.acquire(device.id, connection);
      session.attach(connection);
      domainDevice.markReady();
      domainDevice.startPolling();
      session.startPolling();
      this.events.publish({ type: 'DeviceStateChanged', deviceId: id, state: 'polling' });
      this.scheduler.register(id, () => this.poll(device));
    } catch (error) {
      session.fail();
      domainDevice.markFailed(error instanceof Error ? error.message : 'Connection failed');
      this.events.publish({ type: 'DeviceStateChanged', deviceId: id, state: 'failed', error: domainDevice.error ?? undefined });
    }
  }

  async release(id: string): Promise<void> {
    const connection = this.connections.get(id);
    this.scheduler.unregister(id);
    await this.queue.run(id, async () => {
      if (connection) {
        const protocol = connection.protocol === 'smart-pot' ? 'smart-pot' : 'soil-sensor';
        if (protocol === 'smart-pot') await this.smartPotGateway.disconnect(connection);
        else await this.sensorGateway.disconnect(connection);
      }
    });
    this.connections.delete(id);
    this.pool.release(DeviceId.create(id));
    this.sessions.remove(DeviceId.create(id));
    this.queue.remove(id);
    this.devices.delete(id);
    this.events.publish({ type: 'DeviceDisconnected', deviceId: id });
  }

  async readHistory(id: string, level: 'latest' | 'l1' | 'l2' | 'all'): Promise<readonly unknown[]> {
    const connection = this.connections.get(id);
    if (!connection) throw new Error('Device is not connected');
    return this.queue.run(id, async () => {
      const session = this.sessions.get(DeviceId.create(id));
      session?.startHistoryReading();
      this.scheduler.pause(id);
      try {
        return await this.reads.run(() => this.sensorGateway.readHistory(connection, level));
      } finally {
        session?.finishHistoryReading();
        this.scheduler.resume(id);
      }
    });
  }

  destroy(): void {
    this.scheduler.stop();
    for (const id of [...this.connections.keys()]) this.release(id).catch(() => undefined);
  }

  pausePolling(): void {
    this.scheduler.pauseAll();
  }

  resumePolling(): void {
    this.scheduler.resumeAll();
  }

  private async poll(device: ScannedDevice): Promise<void> {
    const connection = this.connections.get(device.id.value);
    if (!connection) return;
    await this.queue.run(device.id.value, () => this.reads.run(async () => {
      if (device.protocol === 'smart-pot') {
        const snapshot = await this.smartPotGateway.readSnapshot(connection);
        this.events.publish({ type: 'SmartPotSnapshotUpdated', deviceId: device.id.value, snapshot });
      } else {
        const reading = await this.sensorGateway.readLive(connection);
        this.devices.get(device.id.value)?.applyReading(reading);
        this.events.publish({ type: 'ReadingUpdated', deviceId: device.id.value, reading });
      }
    }));
  }
}
