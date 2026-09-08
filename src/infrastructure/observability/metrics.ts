export class Metrics {
  private readonly counters = new Map<string, number>();

  increment(name: string): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + 1);
  }

  count(name: string): number {
    return this.counters.get(name) ?? 0;
  }
}
