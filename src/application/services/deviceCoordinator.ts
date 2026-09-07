import type { ScannedDevice } from '../../domain/ports/sensorGateway';
import type { DomainEventPublisher } from '../../domain/events/domainEvents';
import { SensorDevice } from '../../domain/entities/sensorDevice';
import { DeviceId } from '../../domain/value-objects/deviceId';
import type { SensorGateway } from '../../domain/ports/sensorGateway';
import type { SmartPotGateway } from '../../domain/ports/smartPotGateway';
import { ConnectionPolicy } from '../../domain/services/connectionPolicy';
import { DeviceManager } from '../runtime/deviceManager';
import { RecoveryCoordinator } from '../coordinators/recoveryCoordinator';
import type { PollingCoordinator } from '../coordinators/pollingCoordinator';
import type { ConnectionPoolPort } from '../ports/connectionPool';
import type { ConcurrencyPool } from '../ports/concurrencyPool';
import type { CancellationToken } from '../runtime/cancellationToken';

export class DeviceCoordinator {
  private readonly devices = new Map<string, SensorDevice>();
  private readonly runtimeManager = new DeviceManager();
  private readonly reads: ConcurrencyPool;

  constructor(
    private readonly sensorGateway: SensorGateway,
    private readonly smartPotGateway: SmartPotGateway,
    private readonly policy: ConnectionPolicy,
    private readonly pool: ConnectionPoolPort,
    private readonly events: DomainEventPublisher,
    private readonly polling: PollingCoordinator,
    reads: ConcurrencyPool,
    private readonly recovery = new RecoveryCoordinator(),
  ) {
    this.reads = reads;
  }

  async connect(device: ScannedDevice): Promise<void> {
    const id = device.id.value;
    const current = this.devices.get(id);
    if (current && this.runtimeManager.hasConnection(device.id)) {
      this.polling.resume(id);
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
    domainDevice.markConnecting();
    this.events.publish({ type: 'DeviceStateChanged', deviceId: id, state: 'connecting' });

    try {
      const connection = await this.recovery.recover(
        () => this.execute(id, 'connect', () => device.protocol === 'smart-pot'
          ? this.smartPotGateway.connect(device.id)
          : this.sensorGateway.connect(device.id, device.protocol)),
        async () => undefined,
      );
      this.pool.acquire(device.id, connection);
      this.runtimeManager.setConnection(device.id, connection);
      const runtime = this.runtimeManager.get(device.id);
      if (runtime) {
        runtime.connection = 'connected';
        runtime.operation = 'polling';
      }
      domainDevice.markReady();
      domainDevice.startPolling();
      this.events.publish({ type: 'DeviceStateChanged', deviceId: id, state: 'polling' });
      this.polling.register(id, () => this.poll(device));
    } catch (error) {
      domainDevice.markFailed(error instanceof Error ? error.message : 'Connection failed');
      this.events.publish({ type: 'DeviceStateChanged', deviceId: id, state: 'failed', error: domainDevice.error ?? undefined });
    }
  }

  async release(id: string): Promise<void> {
    const connection = this.runtimeManager.getConnection(DeviceId.create(id));
    this.polling.unregister(id);
    const runtime = this.runtimeManager.get(DeviceId.create(id));
    if (runtime) runtime.connection = 'disconnecting';
    await this.execute(id, 'disconnect', async () => {
      if (connection) {
        const protocol = connection.protocol === 'smart-pot' ? 'smart-pot' : 'soil-sensor';
        if (protocol === 'smart-pot') await this.smartPotGateway.disconnect(connection);
        else await this.sensorGateway.disconnect(connection);
      }
    });
    this.pool.release(DeviceId.create(id));
    this.runtimeManager.remove(DeviceId.create(id));
    this.devices.delete(id);
    this.events.publish({ type: 'DeviceDisconnected', deviceId: id });
  }

  async readHistory(id: string, level: 'latest' | 'l1' | 'l2' | 'all', token?: CancellationToken): Promise<readonly import('../../domain/ports/sensorGateway').SensorRecord[]> {
    const connection = this.runtimeManager.getConnection(DeviceId.create(id));
    if (!connection) throw new Error('Device is not connected');
    return this.execute(id, 'history', async () => {
      token?.throwIfCancelled();
      const runtime = this.runtimeManager.get(DeviceId.create(id));
      if (runtime) runtime.operation = 'history';
      this.polling.pause(id);
      try {
        const records = await this.reads.run(() => this.sensorGateway.readHistory(connection, level));
        token?.throwIfCancelled();
        return records;
      } finally {
        const activeRuntime = this.runtimeManager.get(DeviceId.create(id));
        if (activeRuntime) activeRuntime.operation = 'polling';
        this.polling.resume(id);
      }
    });
  }

  destroy(): void {
    this.polling.stop();
    for (const device of [...this.devices.values()]) this.release(device.id.value).catch(() => undefined);
  }

  pausePolling(): void {
    this.polling.pauseAll();
  }

  resumePolling(): void {
    this.polling.resumeAll();
  }

  private async poll(device: ScannedDevice): Promise<void> {
    const connection = this.runtimeManager.getConnection(device.id);
    if (!connection) return;
    await this.execute(device.id.value, 'poll', () => this.reads.run(async () => {
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

  private execute<T>(id: string, prefix: string, run: () => Promise<T>): Promise<T> {
    const deviceId = DeviceId.create(id);
    const runtime = this.runtimeManager.create(deviceId);
    return this.runtimeManager.execute(deviceId, {
      context: {
        deviceId,
        sessionId: runtime.sessionId,
        operationId: runtime.operationId(prefix),
      },
      run,
    });
  }
}
