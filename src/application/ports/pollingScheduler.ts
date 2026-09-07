export interface PollingSchedulerPort {
  register(id: string, task: () => Promise<void>): void;
  unregister(id: string): void;
  pause(id: string): void;
  resume(id: string): void;
  stop(): void;
}
