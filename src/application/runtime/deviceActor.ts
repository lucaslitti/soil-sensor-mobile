import type { DeviceCommand } from './deviceCommand';

/** 单设备 Actor：所有 BLE 操作按入队顺序串行执行。 */
export class DeviceActor {
  private tail: Promise<unknown> = Promise.resolve();
  private stopped = false;
  private readonly cancelled = new Set<string>();

  constructor(private readonly isCurrentSession: (sessionId: string) => boolean) {}

  enqueue<T>(command: DeviceCommand<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      if (this.stopped || this.cancelled.has(command.context.operationId)) {
        throw new Error('Operation cancelled');
      }
      if (!this.isCurrentSession(command.context.sessionId)) {
        throw new Error('Stale device session');
      }
      const result = await command.run();
      if (!this.isCurrentSession(command.context.sessionId)) {
        throw new Error('Stale device session');
      }
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
