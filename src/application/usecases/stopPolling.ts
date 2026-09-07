export class StopPollingUseCase {
  constructor(private readonly stop: (id: string) => Promise<void>) {}
  execute(id: string): Promise<void> {
    return this.stop(id);
  }
}
