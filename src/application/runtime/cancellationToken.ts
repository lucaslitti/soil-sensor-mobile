export class CancellationToken {
  private cancelled = false;

  get isCancelled(): boolean {
    return this.cancelled;
  }

  cancel(): void {
    this.cancelled = true;
  }

  throwIfCancelled(): void {
    if (this.cancelled) throw new Error('Operation cancelled');
  }
}
