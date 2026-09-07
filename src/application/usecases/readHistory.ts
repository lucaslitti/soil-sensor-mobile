import type { DeviceCoordinator } from '../services/deviceCoordinator';
import type { CancellationToken } from '../runtime/cancellationToken';
import type { SensorRecord } from '../../domain/ports/sensorGateway';

export class ReadHistoryUseCase {
  constructor(private readonly coordinator: DeviceCoordinator) {}
  execute(deviceId: string, level: 'latest' | 'l1' | 'l2' | 'all', token?: CancellationToken): Promise<readonly SensorRecord[]> {
    return this.coordinator.readHistory(deviceId, level, token);
  }
}
