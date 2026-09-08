import type { ConcurrencyPool, Release } from '../../application/ports/concurrencyPool';
import type { OperationContext } from '../../application/runtime/operationContext';
import { DeviceId } from '../../domain/value-objects/deviceId';

/** 全局 BLE operation semaphore. Every permit is released in finally. */
export class GlobalConcurrencyPool implements ConcurrencyPool {
  private active = 0;
  private readonly queue: Array<{ resolve: (release: Release) => void; context: OperationContext }> = [];

  constructor(private readonly maxConcurrent = 2) {}

  acquire(context: OperationContext): Promise<Release> {
    return new Promise(resolve => {
      this.queue.push({ resolve, context });
      this.flush();
    });
  }

  async run<T>(task: () => Promise<T>, context?: OperationContext): Promise<T> {
    const release = await this.acquire(context ?? {
      deviceId: DeviceId.create('unknown'),
      sessionId: 'unknown',
      operationId: 'unknown',
    });
    try {
      return await task();
    } finally {
      release();
    }
  }

  private flush(): void {
    while (this.active < this.maxConcurrent && this.queue.length) {
      const waiter = this.queue.shift()!;
      this.active += 1;
      let released = false;
      waiter.resolve(() => {
        if (released) return;
        released = true;
        this.active -= 1;
        this.flush();
      });
    }
  }
}
