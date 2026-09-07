import type { Device } from 'react-native-ble-plx';
import { smartPotRepository } from '../../features/sensor/data/smartPotRepository';
import type { DeviceConnection } from '../../domain/entities/deviceSession';
import type { SmartPotGateway } from '../../domain/ports/smartPotGateway';
import type { SmartPotSnapshot } from '../../domain/entities/smartPot';
import type { DeviceId } from '../../domain/value-objects/deviceId';

export class BleSmartPotGateway implements SmartPotGateway {
  private readonly devices = new Map<string, Device>();

  async connect(id: DeviceId): Promise<DeviceConnection> {
    const device = await smartPotRepository.connect(id.value);
    this.devices.set(id.value, device);
    return { deviceId: id, protocol: 'smart-pot', native: device };
  }

  async disconnect(connection: DeviceConnection): Promise<void> {
    const device = this.deviceOf(connection);
    this.devices.delete(connection.deviceId.value);
    await smartPotRepository.disconnect(device);
  }

  async readSnapshot(connection: DeviceConnection): Promise<SmartPotSnapshot> {
    return smartPotRepository.readSnapshot(this.deviceOf(connection));
  }

  async writeLight(connection: DeviceConnection, value: 'on' | 'off'): Promise<void> {
    await smartPotRepository.writeLight(this.deviceOf(connection), value);
  }

  async writePump(connection: DeviceConnection, value: string): Promise<void> {
    await smartPotRepository.writePump(this.deviceOf(connection), value);
  }

  async writeRgb(connection: DeviceConnection, value: string): Promise<void> {
    await smartPotRepository.writeRgb(this.deviceOf(connection), value);
  }

  async writeConfig(connection: DeviceConnection, value: string): Promise<void> {
    await smartPotRepository.writeConfig(this.deviceOf(connection), value);
  }

  private deviceOf(connection: DeviceConnection): Device {
    const device = this.devices.get(connection.deviceId.value) ?? connection.native;
    if (!device || typeof device !== 'object') throw new Error('Device connection is missing');
    return device as Device;
  }
}
