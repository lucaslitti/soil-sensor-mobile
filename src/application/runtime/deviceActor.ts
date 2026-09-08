import type { DeviceCommand } from './deviceCommand';
import type { OperationObserver } from '../ports/operationObserver';

/** 单设备 Actor：所有 BLE 操作按入队顺序串行执行。 */
export class DeviceActor {
  private tail: Promise<unknown> = Promise.resolve();
  private stopped = false;
  private readonly cancelled = new Set<string>();

  constructor(
    private readonly isCurrentSession: (sessionId: string) => boolean,
    private readonly observer?: OperationObserver,
  ) {}

  enqueue<T>(command: DeviceCommand<T>): Promise<T> {
    const queuedAt = Date.now();
    const execute = async (): Promise<T> => {
      const startedAt = Date.now();
      const finish = (result: 'success' | 'failure' | 'cancelled') => this.observer?.completed(
        command.context,
        command.context.operationId.split(':')[1] ?? 'unknown',
        startedAt - queuedAt,
        Date.now() - startedAt,
        result,
      );
      if (this.stopped || this.cancelled.has(command.context.operationId)) {
        finish('cancelled');
        throw new Error('Operation cancelled');
      }
      if (!this.isCurrentSession(command.context.sessionId)) {
        finish('failure');
        throw new Error('Stale device session');
      }
      let result: T;
      try {
        result = await command.run();
      } catch (error) {
        finish(this.cancelled.has(command.context.operationId) ? 'cancelled' : 'failure');
        throw error;
      }
      if (this.cancelled.has(command.context.operationId)) {
        finish('cancelled');
        throw new Error('Operation cancelled');
      }
      if (!this.isCurrentSession(command.context.sessionId)) {
        finish('failure');
        throw new Error('Stale device session');
      }
      finish('success');
      return result;
    };
    const result = this.tail.then(execute);
    this.tail = result.catch(() => undefined);
    return result;
  }

  cancel(operationId: string): void {
    this.cancelled.add(operationId);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.tail.catch(() => undefined);
  }
}
