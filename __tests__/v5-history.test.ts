import { DeviceCoordinator } from '../src/application/services/deviceCoordinator';
import { DeviceManager } from '../src/application/runtime/deviceManager';
import { CancellationToken } from '../src/application/runtime/cancellationToken';
import { ConnectionPolicy } from '../src/domain/services/connectionPolicy';
import { DeviceId } from '../src/domain/value-objects/deviceId';
import type { SensorGateway } from '../src/domain/ports/sensorGateway';
import type { DomainEventPublisher } from '../src/domain/events/domainEvents';
import type { ReadingRepository } from '../src/domain/repositories/readingRepository';
import type { PollingSchedulerPort } from '../src/application/ports/pollingScheduler';
import type { ConcurrencyPool } from '../src/application/ports/concurrencyPool';
import type { ConnectionPoolPort } from '../src/application/ports/connectionPool';
import { PollingCoordinator } from '../src/application/coordinators/pollingCoordinator';

function createCoordinator(readHistory: SensorGateway['readHistory'], polling: { paused: number; resumed: number }) {
  const id = DeviceId.create('sensor-history');
  const gateway = { readHistory } as SensorGateway;
  const manager = new DeviceManager();
  manager.setConnection(id, { deviceId: id, protocol: 'soil-sensor' });
  const scheduler: PollingSchedulerPort = {
    register: () => undefined,
    unregister: () => undefined,
    pause: () => { polling.paused += 1; },
    resume: () => { polling.resumed += 1; },
    stop: () => undefined,
  };
  const connectionPool: ConnectionPoolPort = {
    acquire: () => undefined,
    release: () => undefined,
    has: () => true,
    size: () => 1,
  };
  const events: DomainEventPublisher = { publish: () => undefined };
  const reads: ConcurrencyPool = {
    acquire: async () => () => undefined,
    run: task => task(),
  };
  const repository: ReadingRepository = {
    save: async () => undefined,
    queryByDevice: async () => [],
  };
  const coordinator = new DeviceCoordinator(
    gateway,
    {} as never,
    new ConnectionPolicy(),
    connectionPool,
    events,
    new PollingCoordinator(scheduler),
    reads,
    manager,
    repository,
  );
  return { coordinator, id: id.value };
}

describe('history polling recovery', () => {
  it('resumes polling when history is cancelled after the read starts', async () => {
    const polling = { paused: 0, resumed: 0 };
    let finishRead!: (records: readonly never[]) => void;
    const readHistory = async () => new Promise<readonly never[]>(resolve => { finishRead = resolve; });
    const { coordinator, id } = createCoordinator(readHistory, polling);
    const token = new CancellationToken();
    const pending = coordinator.readHistory(id, 'all', token);

    await Promise.resolve();
    expect(polling.paused).toBe(1);
    token.cancel();
    finishRead([]);
    await expect(pending).rejects.toThrow('Operation cancelled');
    expect(polling.resumed).toBe(1);
  });

  it.each([
    ['success', async () => []],
    ['failure', async () => { throw new Error('history failed'); }],
  ])('resumes polling after history %s', async (_label, readHistory) => {
    const polling = { paused: 0, resumed: 0 };
    const { coordinator, id } = createCoordinator(readHistory, polling);
    const pending = coordinator.readHistory(id, 'latest');

    if (_label === 'failure') await expect(pending).rejects.toThrow('history failed');
    else await expect(pending).resolves.toEqual([]);
    expect(polling.paused).toBe(1);
    expect(polling.resumed).toBe(1);
  });
});
