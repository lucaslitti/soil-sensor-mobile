export class StartPollingUseCase {
  constructor(private readonly start: (id: string) => Promise<void>) {}
  execute(id: string): Promise<void> {
    return this.start(id);
  }
}
