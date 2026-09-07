export interface PollingSchedulerPort {
  register(id: string, task: () => Promise<void>): void;
  unregister(id: string): void;
  pause(id: string): void;
  resume(id: string): void;
  stop(): void;
}

/** 只负责时间，不包含设备业务。 */
export class PollingScheduler implements PollingSchedulerPort {
  private readonly jobs = new Map<string, { timer: ReturnType<typeof setInterval>; task: () => Promise<void>; paused: boolean }>();

  constructor(
    private readonly intervalMs = 3_000,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  register(id: string, task: () => Promise<void>): void {
    this.unregister(id);
    const job = {
      paused: false,
      task,
      timer: setInterval(() => {
        if (!job.paused) task().catch(this.onError);
      }, this.intervalMs),
    };
    this.jobs.set(id, job);
    task().catch(this.onError);
  }

  unregister(id: string): void {
    const job = this.jobs.get(id);
    if (job) clearInterval(job.timer);
    this.jobs.delete(id);
  }

  pause(id: string): void {
    const job = this.jobs.get(id);
    if (job) job.paused = true;
  }

  resume(id: string): void {
    const job = this.jobs.get(id);
    if (job) job.paused = false;
  }

  pauseAll(): void {
    for (const id of this.jobs.keys()) this.pause(id);
  }

  resumeAll(): void {
    for (const id of this.jobs.keys()) this.resume(id);
  }

  stop(): void {
    for (const id of this.jobs.keys()) this.unregister(id);
  }
}
