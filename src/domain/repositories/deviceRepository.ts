import type { DeviceId } from '../value-objects/deviceId';
import type { SensorDevice } from '../entities/sensorDevice';

export interface DeviceRepository {
  get(id: DeviceId): Promise<SensorDevice | null>;
  list(): Promise<readonly SensorDevice[]>;
  save(device: SensorDevice): Promise<void>;
  remove(id: DeviceId): Promise<void>;
}
