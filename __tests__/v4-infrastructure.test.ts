import { DeviceCommandQueue } from '../src/infrastructure/concurrency/deviceCommandQueue';
import { GlobalConcurrencyPool } from '../src/infrastructure/concurrency/globalConcurrencyPool';
import { ConnectionPool } from '../src/infrastructure/pool/connectionPool';
import { ConnectionPolicy } from '../src/domain/services/connectionPolicy';
import { DeviceId } from '../src/domain/value-objects/deviceId';

describe('V4 infrastructure primitives', () => {
  it('serializes commands for one device', async () => {
    const queue = new DeviceCommandQueue();
    const order: string[] = [];
    const first = queue.run('a', async () => {
      order.push('start-a');
      await Promise.resolve();
      order.push('end-a');
    });
    const second = queue.run('a', async () => {
      order.push('start-b');
      order.push('end-b');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['start-a', 'end-a', 'start-b', 'end-b']);
  });

  it('limits global read concurrency', async () => {
    const pool = new GlobalConcurrencyPool(2);
    let active = 0;
    let max = 0;
    const task = () => pool.run(async () => {
      active += 1;
      max = Math.max(max, active);
      await new Promise<void>(resolve => setTimeout(resolve, 1));
      active -= 1;
    });
    await Promise.all([task(), task(), task(), task()]);
    expect(max).toBeLessThanOrEqual(2);
  });

  it('keeps connection resources separate from policy decisions', () => {
    const pool = new ConnectionPool();
    const id = DeviceId.create('a');
    pool.acquire(id, { deviceId: id });
    expect(pool.has(id)).toBe(true);
    pool.release(id);
    expect(pool.size()).toBe(0);
    expect(new ConnectionPolicy(4).maxConnections()).toBe(4);
  });
});
