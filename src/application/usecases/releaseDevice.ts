import type { DeviceManager } from '../runtime/deviceManager';

export class ReleaseDeviceUseCase {
  constructor(private readonly manager: DeviceManager) {}
  execute(deviceId: string): Promise<void> {
    return this.manager.disconnect(deviceId);
  }
}
