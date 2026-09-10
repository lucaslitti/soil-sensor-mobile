import { DeviceId } from '../src/domain/value-objects/deviceId';
import { DeviceActor } from '../src/application/runtime/deviceActor';
import { Session } from '../src/application/runtime/session';
import { GlobalConcurrencyPool } from '../src/infrastructure/concurrency/globalConcurrencyPool';
import { ConnectionPool } from '../src/infrastructure/pool/connectionPool';
import { LifecycleCoordinator } from '../src/application/coordinators/lifecycleCoordinator';
import { RetryPolicy } from '../src/application/policies/retryPolicy';
import { RecoveryCoordinator } from '../src/application/coordinators/recoveryCoordinator';
import { CancellationToken } from '../src/application/runtime/cancellationToken';

const context = (operationId: string) => ({
  deviceId: DeviceId.create('sensor-1'),
  sessionId: 'session-1',
  operationId,
});

describe('V5 runtime invariants', () => {
  it('does not retry or report permanent failure after cancellation', async () => {
    jest.useFakeTimers();
    try {
      const token = new CancellationToken();
      const task = jest.fn(async () => { throw new Error('temporary timeout'); });
      const permanentFailure = jest.fn(async () => undefined);
      const recovery = new RecoveryCoordinator(new RetryPolicy([10], 3));
      const pending = recovery.recover(task, permanentFailure, token);
      await Promise.resolve();
      token.cancel();
      jest.advanceTimersByTime(10);
      await expect(pending).rejects.toThrow('Operation cancelled');
      expect(task).toHaveBeenCalledTimes(1);
      expect(permanentFailure).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps lifecycle subscriptions idempotent', () => {
    let appListener: ((state: 'active' | 'background') => void) | undefined;
    let bluetoothListener: ((state: string) => void) | undefined;
    let appSubscriptions = 0;
    let bluetoothSubscriptions = 0;
    let cleanups = 0;
    let pauses = 0;
    const lifecycle = {
      subscribeAppState: (listener: (state: 'active' | 'background') => void) => {
        appSubscriptions += 1;
        appListener = listener;
        return () => { cleanups += 1; };
      },
      subscribeBluetooth: (listener: (state: string) => void) => {
        bluetoothSubscriptions += 1;
        bluetoothListener = listener;
        return () => { cleanups += 1; };
      },
    };
    const coordinator = new LifecycleCoordinator(
      lifecycle,
      { onBackground: 'pause', bluetoothOff: 'pause' },
      () => { pauses += 1; },
      () => undefined,
      () => undefined,
    );

    coordinator.start();
    coordinator.start();
    expect(appSubscriptions).toBe(1);
    expect(bluetoothSubscriptions).toBe(1);
    appListener?.('background');
    bluetoothListener?.('off');
    expect(pauses).toBe(2);

    coordinator.stop();
    coordinator.stop();
    expect(cleanups).toBe(2);
    coordinator.start();
    expect(appSubscriptions).toBe(2);
    expect(bluetoothSubscriptions).toBe(2);
  });

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

  it('rejects a command result when its session becomes stale', async () => {
    let current = true;
    const actor = new DeviceActor(() => current);
    const pending = actor.enqueue({
      context: context('stale-operation'),
      run: async () => {
        current = false;
      },
    });

    await expect(pending).rejects.toThrow('Stale device session');
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

  it('prioritizes disconnect over queued polling', async () => {
    const actor = new DeviceActor(() => true);
    let releaseFirst!: () => void;
    const first = actor.enqueue({
      context: context('user-action-1'),
      kind: 'user-action',
      run: () => new Promise<void>(resolve => { releaseFirst = resolve; }),
    });
    const order: string[] = [];
    const poll = actor.enqueue({
      context: context('poll-2'),
      kind: 'poll',
      run: async () => { order.push('poll'); },
    });
    const disconnect = actor.enqueue({
      context: context('disconnect-1'),
      kind: 'disconnect',
      run: async () => { order.push('disconnect'); },
    });

    releaseFirst();
    await Promise.all([first, poll, disconnect]);
    expect(order).toEqual(['disconnect', 'poll']);
  });

  it('merges polling requests while one is active', async () => {
    const actor = new DeviceActor(() => true);
    let calls = 0;
    let release!: () => void;
    const first = actor.enqueue({
      context: context('poll-1'),
      kind: 'poll',
      run: () => {
        calls += 1;
        return new Promise<void>(resolve => { release = resolve; });
      },
    });
    const second = actor.enqueue({
      context: context('poll-2'),
      kind: 'poll',
      run: async () => { calls += 1; },
    });

    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });
});
