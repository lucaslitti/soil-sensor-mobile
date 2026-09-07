import type { SensorRecord } from '../ports/sensorGateway';
import type { DeviceId } from '../value-objects/deviceId';

export interface ReadingRepository {
  save(record: SensorRecord): Promise<void>;
  queryByDevice(id: DeviceId, from: number, to: number): Promise<readonly SensorRecord[]>;
}
