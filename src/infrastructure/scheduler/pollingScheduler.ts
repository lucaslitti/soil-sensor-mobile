export interface PollingSchedulerPort {
  register(id: string, task: () => Promise<void>): void;
  unregister(id: string): void;
  pause(id: string): void;
  resume(id: string): void;
  stop(): void;
}

/** 只负责时间，不包含设备业务。 */
export class PollingScheduler implements PollingSchedulerPort {
  private readonly jobs = new Map<string, {
    timer: ReturnType<typeof setTimeout> | null;
    task: () => Promise<void>;
    paused: boolean;
    stopped: boolean;
    running: boolean;
  }>();

  constructor(
    private readonly intervalMs = 3_000,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  register(id: string, task: () => Promise<void>): void {
    this.unregister(id);
    const job: {
      timer: ReturnType<typeof setTimeout> | null;
      task: () => Promise<void>;
      paused: boolean;
      stopped: boolean;
      running: boolean;
    } = {
      timer: null,
      paused: false,
      stopped: false,
      running: false,
      task,
    };
    this.jobs.set(id, job);
    this.runJob(id);
  }

  unregister(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.stopped = true;
      if (job.timer !== null) clearTimeout(job.timer);
      job.timer = null;
    }
    this.jobs.delete(id);
  }

  pause(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.paused = true;
    if (job.timer !== null) clearTimeout(job.timer);
    job.timer = null;
  }

  resume(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.paused = false;
    if (!job.running && job.timer === null) {
      job.timer = setTimeout(() => {
        job.timer = null;
        this.runJob(id);
      }, this.intervalMs);
    }
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

  private runJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.stopped || job.paused || job.running) return;
    job.running = true;
    job.task()
      .catch(error => this.onError(error))
      .finally(() => {
        job.running = false;
        if (!job.stopped && !job.paused && job.timer === null) {
          job.timer = setTimeout(() => {
            job.timer = null;
            this.runJob(id);
          }, this.intervalMs);
        }
      });
  }
}
