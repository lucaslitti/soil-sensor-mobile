import type { DeviceConnection } from '../entities/deviceSession';
import type { LiveReading } from '../entities/sensorDevice';
import type { DeviceId } from '../value-objects/deviceId';

export type HistoryLevel = 'latest' | 'l1' | 'l2' | 'all';

export interface ScannedDevice {
  id: DeviceId;
  name: string | null;
  rssi: number;
  isConnectable: boolean;
  protocol: 'soil-sensor' | 'smart-pot';
}

export interface SensorRecord {
  deviceId: string;
  capturedAt: number;
  subRecords: readonly SensorSubRecord[];
}

export interface SensorSubRecord {
  recordIndex: number;
  subIndex: number;
  isEmpty: boolean;
  moisturePercent: number;
  temperatureC: number;
  soilEc: number;
}

export interface SensorGateway {
  scan(): AsyncGenerator<ScannedDevice>;
  connect(id: DeviceId, protocol?: 'soil-sensor' | 'smart-pot'): Promise<DeviceConnection>;
  disconnect(connection: DeviceConnection): Promise<void>;
  readLive(connection: DeviceConnection): Promise<LiveReading>;
  readHistory(connection: DeviceConnection, level: HistoryLevel): Promise<readonly SensorRecord[]>;
}
