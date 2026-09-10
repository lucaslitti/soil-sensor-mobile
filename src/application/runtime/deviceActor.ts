import type { DeviceCommand, DeviceCommandKind } from './deviceCommand';
import type { OperationObserver } from '../ports/operationObserver';

interface QueueEntry<T> {
  command: DeviceCommand<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  sequence: number;
  queuedAt: number;
}

const priority: Record<DeviceCommandKind, number> = {
  poll: 0,
  connect: 1,
  history: 2,
  'user-action': 2,
  disconnect: 3,
};

/** 单设备 Actor：串行执行，并优先处理释放/用户操作，合并轮询。 */
export class DeviceActor {
  private readonly pending: QueueEntry<unknown>[] = [];
  private active: QueueEntry<unknown> | null = null;
  private sequence = 0;
  private stopped = false;
  private readonly cancelled = new Set<string>();
  private draining = false;

  constructor(
    private readonly isCurrentSession: (sessionId: string) => boolean,
    private readonly observer?: OperationObserver,
  ) {}

  enqueue<T>(command: DeviceCommand<T>): Promise<T> {
    if (command.kind === 'poll') {
      const existing = this.active?.command.kind === 'poll'
        ? this.active
        : this.pending.find(entry => entry.command.kind === 'poll');
      if (existing) return new Promise<T>((resolve, reject) => {
        const originalResolve = existing.resolve;
        const originalReject = existing.reject;
        existing.resolve = value => { originalResolve(value); resolve(value as T); };
        existing.reject = error => { originalReject(error); reject(error); };
      });
    }

    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        command,
        resolve: resolve as (value: unknown) => void,
        reject,
        sequence: this.sequence++,
        queuedAt: Date.now(),
      });
      this.drain().catch(() => undefined);
    });
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (!this.stopped && this.pending.length > 0) {
        this.pending.sort((a, b) => {
          const byPriority = priority[b.command.kind ?? 'user-action'] - priority[a.command.kind ?? 'user-action'];
          return byPriority || a.sequence - b.sequence;
        });
        const entry = this.pending.shift()!;
        this.active = entry;
        await this.execute(entry);
        this.active = null;
      }
    } finally {
      this.active = null;
      this.draining = false;
    }
  }

  private async execute<T>(entry: QueueEntry<T>): Promise<void> {
    const { command } = entry;
    const startedAt = Date.now();
    const finish = (result: 'success' | 'failure' | 'cancelled') => this.observer?.completed(
      command.context,
      command.kind ?? command.context.operationId.split(':')[1] ?? 'unknown',
      startedAt - entry.queuedAt,
      Date.now() - startedAt,
      result,
    );
    const reject = (error: unknown) => { finish(error instanceof Error && error.message === 'Operation cancelled' ? 'cancelled' : 'failure'); entry.reject(error); };
    if (this.stopped || this.cancelled.has(command.context.operationId)) {
      reject(new Error('Operation cancelled'));
      return;
    }
    if (!this.isCurrentSession(command.context.sessionId)) {
      reject(new Error('Stale device session'));
      return;
    }
    try {
      const result = await command.run();
      if (this.cancelled.has(command.context.operationId)) {
        reject(new Error('Operation cancelled'));
        return;
      }
      if (!this.isCurrentSession(command.context.sessionId)) {
        reject(new Error('Stale device session'));
        return;
      }
      finish('success');
      entry.resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  cancel(operationId: string): void {
    this.cancelled.add(operationId);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const entry of this.pending.splice(0)) entry.reject(new Error('Operation cancelled'));
    while (this.draining) await Promise.resolve();
  }
}
