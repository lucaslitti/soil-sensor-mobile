export interface ConcurrencyPool {
  run<T>(task: () => Promise<T>): Promise<T>;
}
