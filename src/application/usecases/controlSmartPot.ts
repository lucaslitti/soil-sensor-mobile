import type { DeviceManager } from '../runtime/deviceManager';

export type SmartPotCommand =
  | { type: 'light'; value: 'on' | 'off' }
  | { type: 'pump' | 'rgb' | 'config'; value: string };

export class ControlSmartPotUseCase {
  constructor(private readonly manager: DeviceManager) {}

  execute(deviceId: string, command: SmartPotCommand): Promise<void> {
    return this.manager.writeSmartPot(deviceId, command);
  }
}
