import type { DeviceCoordinator } from '../services/deviceCoordinator';

/** Reads are exposed through an application use case, never from a View. */
export class ReadLiveUseCase {
  constructor(private readonly coordinator: DeviceCoordinator) {}

  execute(deviceId: string): Promise<void> {
    return this.coordinator.refresh(deviceId);
  }
}
