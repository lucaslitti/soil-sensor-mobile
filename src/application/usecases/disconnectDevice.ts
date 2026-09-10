import type { DeviceCoordinator } from '../services/deviceCoordinator';

export class DisconnectDeviceUseCase {
  constructor(private readonly coordinator: DeviceCoordinator) {}
  execute(deviceId: string): Promise<void> {
    return this.coordinator.release(deviceId);
  }
}
