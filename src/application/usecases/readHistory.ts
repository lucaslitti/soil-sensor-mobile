import type { DeviceCoordinator } from '../services/deviceCoordinator';

export class ReadHistoryUseCase {
  constructor(private readonly coordinator: DeviceCoordinator) {}
  execute(deviceId: string, level: 'latest' | 'l1' | 'l2' | 'all'): Promise<readonly unknown[]> {
    return this.coordinator.readHistory(deviceId, level);
  }
}
