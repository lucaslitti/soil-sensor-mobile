import type { Device } from 'react-native-ble-plx';
import { AppError } from '../errors';
import { base64ToBytes, bytesToBase64 } from '../base64';
import {
  SMART_POT_CHAR_HISTORY,
  SMART_POT_CHAR_LIGHT,
  SMART_POT_CHAR_LIGHT_RGB,
  SMART_POT_CHAR_LIGHT_SENSOR,
  SMART_POT_CHAR_PLANT_CONFIG,
  SMART_POT_CHAR_PUMP,
  SMART_POT_CHAR_SOIL_EC,
  SMART_POT_CHAR_SOIL_MOISTURE,
  SMART_POT_CHAR_SOIL_TEMPERATURE,
  SMART_POT_SERVICE,
} from '../protocol';
import { parseSmartPotHistory } from '../../../domain/entities/smartPot';
import type { SmartPotSnapshot } from '../../../domain/entities/smartPot';
import { bleManager } from '../bleTransport';

const CONNECT_TIMEOUT_MS = 20_000;
const encode = (value: string) => Uint8Array.from(value, character => character.charCodeAt(0));
const decode = (value: string) => String.fromCharCode(...base64ToBytes(value)).trim();

function timeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AppError('connect-timeout', `${label} timeout`)), CONNECT_TIMEOUT_MS);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

export class BleSmartPotProtocolAdapter {
  async connect(deviceId: string): Promise<Device> {
    const device = await timeout(bleManager.connectToDevice(deviceId), 'Connect SmartPot');
    await device.discoverAllServicesAndCharacteristics();
    return device;
  }

  disconnect(device: Device): Promise<void> {
    return device.cancelConnection().then(() => undefined).catch(() => undefined);
  }

  private async read(device: Device, characteristic: string): Promise<string> {
    const result = await device.readCharacteristicForService(SMART_POT_SERVICE, characteristic);
    return decode(result.value ?? '');
  }

  private write(device: Device, characteristic: string, value: string): Promise<void> {
    return device.writeCharacteristicWithResponseForService(SMART_POT_SERVICE, characteristic, bytesToBase64(encode(value))).then(() => undefined);
  }

  async readSnapshot(device: Device): Promise<SmartPotSnapshot> {
    const light = await this.read(device, SMART_POT_CHAR_LIGHT);
    const lightSensor = await this.read(device, SMART_POT_CHAR_LIGHT_SENSOR);
    const rgb = await this.read(device, SMART_POT_CHAR_LIGHT_RGB);
    const pump = await this.read(device, SMART_POT_CHAR_PUMP);
    const moisture = await this.read(device, SMART_POT_CHAR_SOIL_MOISTURE);
    const ec = await this.read(device, SMART_POT_CHAR_SOIL_EC);
    const temperature = await this.read(device, SMART_POT_CHAR_SOIL_TEMPERATURE);
    const config = await this.read(device, SMART_POT_CHAR_PLANT_CONFIG);
    const records: string[] = [];
    for (let offset = 0; offset < 24; offset += 1) {
      await this.write(device, SMART_POT_CHAR_HISTORY, `offset=${offset}`);
      const chunk = await this.read(device, SMART_POT_CHAR_HISTORY);
      if (!chunk || chunk === 'end') break;
      records.push(...chunk.split(';').filter(part => part.trim().split(':').length === 4));
      if (/(?:^|;)more=0(?:;|$)/.test(chunk)) break;
    }
    return { light, lightSensor, rgb, pump, moisture, ec, temperature, config, history: parseSmartPotHistory(`n=${records.length};${records.join(';')}`) };
  }

  writeLight(device: Device, value: 'on' | 'off'): Promise<void> { return this.write(device, SMART_POT_CHAR_LIGHT, value); }
  writePump(device: Device, value: string): Promise<void> { return this.write(device, SMART_POT_CHAR_PUMP, value); }
  writeRgb(device: Device, value: string): Promise<void> { return this.write(device, SMART_POT_CHAR_LIGHT_RGB, value); }
  writeConfig(device: Device, value: string): Promise<void> { return this.write(device, SMART_POT_CHAR_PLANT_CONFIG, value); }
}
