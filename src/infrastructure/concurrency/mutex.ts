export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => {
      release = resolve;
    });
    return previous.then(task).finally(release);
  }
}
