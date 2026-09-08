export interface Scheduler {
  schedule(task: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}
