import type { DeviceManager } from '../runtime/deviceManager';
import type { CancellationToken } from '../runtime/cancellationToken';
import type { SensorRecord } from '../../domain/ports/sensorGateway';

export class ReadHistoryUseCase {
  constructor(private readonly manager: DeviceManager) {}
  execute(deviceId: string, level: 'latest' | 'l1' | 'l2' | 'all', token?: CancellationToken): Promise<readonly SensorRecord[]> {
    return this.manager.readHistory(deviceId, level, token);
  }
}
