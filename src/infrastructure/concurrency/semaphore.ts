import type { OperationContext } from '../../application/runtime/operationContext';
import type { Release } from '../../application/ports/concurrencyPool';

export class Semaphore {
  private active = 0;
  private readonly waiters: Array<{ context: OperationContext; resolve: (release: Release) => void }> = [];

  constructor(private readonly limit: number) {}

  acquire(context: OperationContext): Promise<Release> {
    return new Promise(resolve => {
      this.waiters.push({ context, resolve });
      this.flush();
    });
  }

  private flush(): void {
    while (this.active < this.limit && this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
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
