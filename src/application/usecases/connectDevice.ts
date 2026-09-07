import type { DeviceCoordinator } from '../services/deviceCoordinator';
import type { ScannedDevice } from '../../domain/ports/sensorGateway';

export class ConnectDeviceUseCase {
  constructor(private readonly coordinator: DeviceCoordinator) {}
  execute(device: ScannedDevice): Promise<void> {
    return this.coordinator.connect(device);
  }
}
