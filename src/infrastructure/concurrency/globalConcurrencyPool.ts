/** 全局读取并发限制。 */
export class GlobalConcurrencyPool {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent = 2) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active += 1;
        task().then(resolve, reject).finally(() => {
          this.active -= 1;
          this.flush();
        });
      };
      this.queue.push(start);
      this.flush();
    });
  }

  private flush(): void {
    while (this.active < this.maxConcurrent && this.queue.length) {
      this.queue.shift()!();
    }
  }
}
