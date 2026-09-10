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
import type { ReadingRepository } from '../../domain/repositories/readingRepository';
import type { OperationContext } from '../runtime/operationContext';
import type { DeviceCommandKind } from '../runtime/deviceCommand';

export class DeviceCoordinator {
  private readonly devices = new Map<string, SensorDevice>();
  private readonly scannedDevices = new Map<string, ScannedDevice>();
  private readonly runtimeManager: DeviceManager;
  private readonly reads: ConcurrencyPool;

  constructor(
    private readonly sensorGateway: SensorGateway,
    private readonly smartPotGateway: SmartPotGateway,
    private readonly policy: ConnectionPolicy,
    private readonly pool: ConnectionPoolPort,
    private readonly events: DomainEventPublisher,
    private readonly polling: PollingCoordinator,
    reads: ConcurrencyPool,
    runtimeManager: DeviceManager,
    private readonly readingRepository: ReadingRepository,
    private readonly recovery = new RecoveryCoordinator(),
  ) {
    this.reads = reads;
    this.runtimeManager = runtimeManager;
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
    this.scannedDevices.set(id, device);
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
      domainDevice.markConnected();
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
    this.scannedDevices.delete(id);
    this.events.publish({ type: 'DeviceDisconnected', deviceId: id });
  }

  async refresh(id: string): Promise<void> {
    const device = this.scannedDevices.get(id);
    if (!device) return;
    await this.poll(device);
  }

  pause(id: string): void {
    this.polling.pause(id);
  }

  startPolling(id: string): Promise<void> {
    this.polling.resume(id);
    return Promise.resolve();
  }

  stopPolling(id: string): Promise<void> {
    this.polling.pause(id);
    return Promise.resolve();
  }

  resume(id: string): void {
    this.polling.resume(id);
  }

  writeSmartPot(
    id: string,
    command: { type: 'light'; value: 'on' | 'off' } | { type: 'pump' | 'rgb' | 'config'; value: string },
  ): Promise<void> {
    const connection = this.runtimeManager.getConnection(DeviceId.create(id));
    if (!connection || connection.protocol !== 'smart-pot') throw new Error('SmartPot is not connected');
    return this.execute(id, 'user-action', async () => {
      if (command.type === 'light') await this.smartPotGateway.writeLight(connection, command.value);
      if (command.type === 'pump') await this.smartPotGateway.writePump(connection, command.value);
      if (command.type === 'rgb') await this.smartPotGateway.writeRgb(connection, command.value);
      if (command.type === 'config') await this.smartPotGateway.writeConfig(connection, command.value);
    });
  }

  async readHistory(id: string, level: 'latest' | 'l1' | 'l2' | 'all', token?: CancellationToken): Promise<readonly import('../../domain/ports/sensorGateway').SensorRecord[]> {
    const connection = this.runtimeManager.getConnection(DeviceId.create(id));
    if (!connection) throw new Error('Device is not connected');
    return this.execute(id, 'history', async context => {
      token?.throwIfCancelled();
      const runtime = this.runtimeManager.get(DeviceId.create(id));
      if (runtime) runtime.operation = 'history';
      this.polling.pause(id);
      try {
        const records = await this.sensorGateway.readHistory(connection, level);
        if (!this.isCurrent(context)) return [];
        token?.throwIfCancelled();
        for (const record of records) await this.readingRepository.save({ ...record, receivedAt: Date.now(), sessionId: context.sessionId, operationId: context.operationId, source: 'gatt' });
        this.events.publish({ type: 'HistorySynced', deviceId: id, count: records.length });
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
    await this.execute(device.id.value, 'poll', async context => {
      if (device.protocol === 'smart-pot') {
        const snapshot = await this.smartPotGateway.readSnapshot(connection);
        if (!this.isCurrent(context)) return;
        this.events.publish({ type: 'SmartPotSnapshotUpdated', deviceId: device.id.value, snapshot });
      } else {
        const decoded = await this.sensorGateway.readLive(connection);
        if (!this.isCurrent(context)) return;
        const reading = { ...decoded, receivedAt: Date.now(), sessionId: context.sessionId, operationId: context.operationId };
        this.devices.get(device.id.value)?.applyReading(reading);
        this.events.publish({ type: 'ReadingUpdated', deviceId: device.id.value, reading });
      }
    });
  }

  private execute<T>(id: string, prefix: string, run: (context: OperationContext) => Promise<T>): Promise<T> {
    const deviceId = DeviceId.create(id);
    const runtime = this.runtimeManager.create(deviceId);
    const context = {
      deviceId,
      sessionId: runtime.sessionId,
      operationId: runtime.operationId(prefix),
    };
    return this.runtimeManager.execute(deviceId, {
      context,
      kind: prefix as DeviceCommandKind,
      run: () => this.reads.run(() => run(context), context),
    });
  }

  private isCurrent(context: OperationContext): boolean {
    return this.runtimeManager.get(context.deviceId)?.sessionId === context.sessionId;
  }
}
