export class RetryPolicy {
  constructor(
    private readonly delaysMs = [1_000, 2_000, 4_000, 8_000, 15_000],
    private readonly maxAttempts = 5,
  ) {}

  async execute<T>(task: () => Promise<T>, shouldRetry: (error: unknown) => boolean): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await task();
      } catch (error) {
        attempt += 1;
        if (attempt >= this.maxAttempts || !shouldRetry(error)) throw error;
        const delay = this.delaysMs[Math.min(attempt - 1, this.delaysMs.length - 1)] ?? 15_000;
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
