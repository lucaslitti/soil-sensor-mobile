import type { Device } from 'react-native-ble-plx';

export interface ServiceDiscovery {
  discover(device: Device): Promise<Device>;
}

export class BleServiceDiscovery implements ServiceDiscovery {
  discover(device: Device): Promise<Device> {
    return device.discoverAllServicesAndCharacteristics();
  }
}
