/* eslint-disable no-bitwise */
import type { Device } from 'react-native-ble-plx';
import { AppError } from '../../../core/errors';
import { base64ToBytes, bytesToBase64 } from '../../../core/utils/base64';
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
  SMART_POT_CHAR_TIME,
  SMART_POT_SERVICE,
} from '../../../core/constants/protocol';
import { bleManager } from '../../scanner/data/bleTransport';
import { parseSmartPotHistory, type SmartPotSnapshot } from '../domain/smartPot';

const CONNECT_TIMEOUT_MS = 20_000;

function asciiEncode(value: string): Uint8Array {
  return Uint8Array.from(value, char => char.charCodeAt(0));
}

function asciiDecode(value: string): string {
  return String.fromCharCode(...base64ToBytes(value)).trim();
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AppError('connect-timeout', `${label} 超时`)), CONNECT_TIMEOUT_MS);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function readText(device: Device, characteristic: string): Promise<string> {
  const result = await device.readCharacteristicForService(SMART_POT_SERVICE, characteristic);
  return asciiDecode(result.value ?? '');
}

async function writeText(device: Device, characteristic: string, value: string): Promise<void> {
  await device.writeCharacteristicWithResponseForService(
    SMART_POT_SERVICE,
    characteristic,
    bytesToBase64(asciiEncode(value)),
  );
}

export class SmartPotRepository {
  async connect(deviceId: string): Promise<Device> {
    const device = await withTimeout(bleManager.connectToDevice(deviceId), '连接 SmartPot');
    await device.discoverAllServicesAndCharacteristics();
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = Uint8Array.of(timestamp & 0xff, (timestamp >>> 8) & 0xff, (timestamp >>> 16) & 0xff, (timestamp >>> 24) & 0xff);
    await device.writeCharacteristicWithResponseForService(SMART_POT_SERVICE, SMART_POT_CHAR_TIME, bytesToBase64(payload));
    const actual = base64ToBytes((await device.readCharacteristicForService(SMART_POT_SERVICE, SMART_POT_CHAR_TIME)).value ?? '');
    const confirmed = (actual[0] | (actual[1] << 8) | (actual[2] << 16) | (actual[3] << 24)) >>> 0;
    if (actual.length < 4 || Math.abs(confirmed - timestamp) > 2) throw new AppError('read-failed', 'SmartPot 时间同步校验失败');
    return device;
  }

  async disconnect(device: Device): Promise<void> {
    try { await device.cancelConnection(); } catch { /* Device may already be disconnected. */ }
  }

  async readSnapshot(device: Device): Promise<SmartPotSnapshot> {
    const read = async (characteristic: string) => {
      try { return await readText(device, characteristic); } catch (error) { return `ERR: ${String(error)}`; }
    };
    const light = await read(SMART_POT_CHAR_LIGHT);
    const lightSensor = await read(SMART_POT_CHAR_LIGHT_SENSOR);
    const rgb = await read(SMART_POT_CHAR_LIGHT_RGB);
    const pump = await read(SMART_POT_CHAR_PUMP);
    const moisture = await read(SMART_POT_CHAR_SOIL_MOISTURE);
    const ec = await read(SMART_POT_CHAR_SOIL_EC);
    const temperature = await read(SMART_POT_CHAR_SOIL_TEMPERATURE);
    const config = await read(SMART_POT_CHAR_PLANT_CONFIG);
    const historyRaw = await this.readHistory(device);
    return { light, lightSensor, rgb, pump, moisture, ec, temperature, config, history: parseSmartPotHistory(historyRaw) };
  }

  async readHistory(device: Device): Promise<string> {
    const records: string[] = [];
    for (let offset = 0; offset < 24; offset++) {
      await writeText(device, SMART_POT_CHAR_HISTORY, `offset=${offset}`);
      const chunk = await readText(device, SMART_POT_CHAR_HISTORY);
      if (!chunk || chunk === 'end') break;
      records.push(...chunk.split(';').filter(part => part.trim().split(':').length === 4));
      if (/(?:^|;)more=0(?:;|$)/.test(chunk)) break;
    }
    return `n=${records.length};${records.join(';')}`;
  }

  writeLight(device: Device, value: 'on' | 'off') { return writeText(device, SMART_POT_CHAR_LIGHT, value); }
  writePump(device: Device, value: string) { return writeText(device, SMART_POT_CHAR_PUMP, value); }
  writeRgb(device: Device, value: string) { return writeText(device, SMART_POT_CHAR_LIGHT_RGB, value); }
  writeConfig(device: Device, value: string) { return writeText(device, SMART_POT_CHAR_PLANT_CONFIG, value); }
}

export const smartPotRepository = new SmartPotRepository();
