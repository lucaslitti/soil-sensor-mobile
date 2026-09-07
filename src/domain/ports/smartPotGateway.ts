import type { DeviceConnection } from '../entities/deviceSession';
import type { SmartPotSnapshot } from '../entities/smartPot';
import type { DeviceId } from '../value-objects/deviceId';

export interface SmartPotGateway {
  connect(id: DeviceId): Promise<DeviceConnection>;
  disconnect(connection: DeviceConnection): Promise<void>;
  readSnapshot(connection: DeviceConnection): Promise<SmartPotSnapshot>;
  writeLight(connection: DeviceConnection, value: 'on' | 'off'): Promise<void>;
  writePump(connection: DeviceConnection, value: string): Promise<void>;
  writeRgb(connection: DeviceConnection, value: string): Promise<void>;
  writeConfig(connection: DeviceConnection, value: string): Promise<void>;
}
