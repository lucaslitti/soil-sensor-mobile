import type { Device } from 'react-native-ble-plx';
import { BleSmartPotProtocolAdapter } from './protocols/smartPotProtocolAdapter';
import type { DeviceConnection } from '../../domain/entities/deviceSession';
import type { SmartPotGateway } from '../../domain/ports/smartPotGateway';
import type { SmartPotSnapshot } from '../../domain/entities/smartPot';
import type { DeviceId } from '../../domain/value-objects/deviceId';

export class BleSmartPotGateway implements SmartPotGateway {
  private readonly devices = new Map<string, Device>();
  private readonly protocol = new BleSmartPotProtocolAdapter();

  async connect(id: DeviceId): Promise<DeviceConnection> {
    const device = await this.protocol.connect(id.value);
    this.devices.set(id.value, device);
    return { deviceId: id, protocol: 'smart-pot', native: device };
  }

  async disconnect(connection: DeviceConnection): Promise<void> {
    const device = this.deviceOf(connection);
    this.devices.delete(connection.deviceId.value);
    await this.protocol.disconnect(device);
  }

  async readSnapshot(connection: DeviceConnection): Promise<SmartPotSnapshot> {
    return this.protocol.readSnapshot(this.deviceOf(connection));
  }

  async writeLight(connection: DeviceConnection, value: 'on' | 'off'): Promise<void> {
    await this.protocol.writeLight(this.deviceOf(connection), value);
  }

  async writePump(connection: DeviceConnection, value: string): Promise<void> {
    await this.protocol.writePump(this.deviceOf(connection), value);
  }

  async writeRgb(connection: DeviceConnection, value: string): Promise<void> {
    await this.protocol.writeRgb(this.deviceOf(connection), value);
  }

  async writeConfig(connection: DeviceConnection, value: string): Promise<void> {
    await this.protocol.writeConfig(this.deviceOf(connection), value);
  }

  private deviceOf(connection: DeviceConnection): Device {
    const device = this.devices.get(connection.deviceId.value) ?? connection.native;
    if (!device || typeof device !== 'object') throw new Error('Device connection is missing');
    return device as Device;
  }
}
