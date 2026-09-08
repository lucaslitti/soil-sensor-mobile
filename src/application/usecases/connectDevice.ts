import type { DeviceManager } from '../runtime/deviceManager';
import type { ScannedDevice } from '../../domain/ports/sensorGateway';

export class ConnectDeviceUseCase {
  constructor(private readonly manager: DeviceManager) {}
  execute(device: ScannedDevice): Promise<void> {
    return this.manager.connect(device);
  }
}
