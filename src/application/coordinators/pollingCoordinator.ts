import type { PollingSchedulerPort } from '../ports/pollingScheduler';

/** Application 轮询协调层：Scheduler 只管时间，业务注册由此处编排。 */
export class PollingCoordinator {
  constructor(private readonly scheduler: PollingSchedulerPort) {}

  register(id: string, task: () => Promise<void>): void {
    this.scheduler.register(id, task);
  }

  unregister(id: string): void {
    this.scheduler.unregister(id);
  }

  pause(id: string): void {
    this.scheduler.pause(id);
  }

  resume(id: string): void {
    this.scheduler.resume(id);
  }

  pauseAll(): void {
    this.scheduler.pauseAll?.();
  }

  resumeAll(): void {
    this.scheduler.resumeAll?.();
  }

  stop(): void {
    this.scheduler.stop();
  }
}
