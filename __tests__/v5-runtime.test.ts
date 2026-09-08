import { DeviceId } from '../src/domain/value-objects/deviceId';
import { DeviceActor } from '../src/application/runtime/deviceActor';
import { Session } from '../src/application/runtime/session';
import { GlobalConcurrencyPool } from '../src/infrastructure/concurrency/globalConcurrencyPool';
import { ConnectionPool } from '../src/infrastructure/pool/connectionPool';

const context = (operationId: string) => ({
  deviceId: DeviceId.create('sensor-1'),
  sessionId: 'session-1',
  operationId,
});

describe('V5 runtime invariants', () => {
  it('requires an explicit release for every global operation permit', async () => {
    const pool = new GlobalConcurrencyPool(1);
    const first = await pool.acquire(context('first'));
    let secondStarted = false;
    const second = pool.acquire(context('second')).then(release => {
      secondStarted = true;
      release();
    });

    await Promise.resolve();
    expect(secondStarted).toBe(false);
    first();
    await second;
    expect(secondStarted).toBe(true);
  });

  it('enforces the four-connection invariant', () => {
    const pool = new ConnectionPool(4);
    for (let index = 0; index < 4; index += 1) {
      const id = DeviceId.create(`sensor-${index}`);
      pool.acquire(id, { deviceId: id });
    }
    const fifth = DeviceId.create('sensor-5');
    expect(() => pool.acquire(fifth, { deviceId: fifth })).toThrow('Maximum 4');
  });

  it('marks a connection session invalid when it is replaced', () => {
    const session = new Session(DeviceId.create('sensor-1'), 'session-1');
    expect(session.isCurrent('session-1')).toBe(true);
    session.invalidate();
    expect(session.isCurrent('session-1')).toBe(false);
  });

  it('does not publish an operation result after cancellation', async () => {
    const actor = new DeviceActor(() => true);
    let markStarted!: () => void;
    let finish!: () => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const pending = actor.enqueue({
      context: context('operation-1'),
      run: () => {
        markStarted();
        return new Promise<void>(resolve => { finish = resolve; });
      },
    });
    await started;
    actor.cancel('operation-1');
    finish();
    await expect(pending).rejects.toThrow('Operation cancelled');
  });
});
