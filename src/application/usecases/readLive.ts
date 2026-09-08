import type { DeviceManager } from '../runtime/deviceManager';

/** Reads are exposed through an application use case, never from a View. */
export class ReadLiveUseCase {
  constructor(private readonly manager: DeviceManager) {}

  execute(deviceId: string): Promise<void> {
    return this.manager.refresh(deviceId);
  }
}
