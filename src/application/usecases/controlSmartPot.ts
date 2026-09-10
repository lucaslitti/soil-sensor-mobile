import type { DeviceCoordinator } from '../services/deviceCoordinator';

export type SmartPotCommand =
  | { type: 'light'; value: 'on' | 'off' }
  | { type: 'pump' | 'rgb' | 'config'; value: string };

export class ControlSmartPotUseCase {
  constructor(private readonly coordinator: DeviceCoordinator) {}

  execute(deviceId: string, command: SmartPotCommand): Promise<void> {
    return this.coordinator.writeSmartPot(deviceId, command);
  }
}
