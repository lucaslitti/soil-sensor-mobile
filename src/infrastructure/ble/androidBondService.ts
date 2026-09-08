import type { DeviceId } from '../../domain/value-objects/deviceId';
import type { BondState } from '../../domain/value-objects/bondState';
import { bleManager } from './bleTransport';
import type { Device } from 'react-native-ble-plx';

export interface AndroidBondService {
  getState(deviceId: DeviceId): Promise<BondState>;
  ensureBonded(deviceId: DeviceId): Promise<BondState>;
}

/** iOS has no application-managed bond flow; Android integration is injected here. */
export class PlatformBondService implements AndroidBondService {
  async getState(deviceId: DeviceId): Promise<BondState> {
    const device = await this.device(deviceId);
    const bonded = (device as Device & { isBonded?: boolean }).isBonded;
    return bonded === true ? 'bonded' : 'none';
  }

  async ensureBonded(deviceId: DeviceId): Promise<BondState> {
    const device = await this.device(deviceId);
    const bond = (device as Device & { createBond?: () => Promise<Device> }).createBond;
    if (bond) {
      await bond.call(device);
      return 'bonded';
    }
    return this.getState(deviceId);
  }

  private async device(deviceId: DeviceId): Promise<Device> {
    const devices = await bleManager.devices([deviceId.value]);
    const device = devices[0];
    if (!device) throw new Error(`Device ${deviceId.value} is not connected`);
    return device;
  }
}
