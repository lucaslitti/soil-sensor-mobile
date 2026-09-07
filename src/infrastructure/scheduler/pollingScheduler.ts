export interface PollingSchedulerPort {
  register(id: string, task: () => Promise<void>): void;
  unregister(id: string): void;
  pause(id: string): void;
  resume(id: string): void;
  stop(): void;
}

/** 只负责时间，不包含设备业务。 */
export class PollingScheduler implements PollingSchedulerPort {
  private readonly jobs = new Map<string, { timer: ReturnType<typeof setTimeout> | null; task: () => Promise<void>; paused: boolean; stopped: boolean }>();

  constructor(
    private readonly intervalMs = 3_000,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  register(id: string, task: () => Promise<void>): void {
    this.unregister(id);
    const job: { timer: ReturnType<typeof setTimeout> | null; task: () => Promise<void>; paused: boolean; stopped: boolean } = {
      timer: null,
      paused: false,
      stopped: false,
      task,
    };
    this.jobs.set(id, job);
    const run = async () => {
      if (job.stopped) return;
      if (!job.paused) {
        try {
          await job.task();
        } catch (error) {
          this.onError(error);
        }
      }
      if (!job.stopped) job.timer = setTimeout(run, this.intervalMs);
    };
    run();
  }

  unregister(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.stopped = true;
      if (job.timer) clearTimeout(job.timer);
    }
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
