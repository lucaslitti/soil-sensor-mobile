/* eslint-disable no-bitwise */
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
  SMART_POT_CHAR_TIME,
  SMART_POT_HISTORY_MAX_CHUNKS,
  SMART_POT_SERVICE,
} from '../protocol';
import { parseHistoryChunk } from '../../../domain/entities/smartPot';
import type { SmartPotHistoryPoint, SmartPotSnapshot } from '../../../domain/entities/smartPot';
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

function toLittleEndian32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function fromLittleEndian32(bytes: Uint8Array): number {
  if (bytes.length < 4) return 0;
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
}

export class BleSmartPotProtocolAdapter {
  async connect(deviceId: string): Promise<Device> {
    const device = await timeout(bleManager.connectToDevice(deviceId), 'Connect SmartPot');
    await device.discoverAllServicesAndCharacteristics();
    await this.syncTime(device);
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
    return device
      .writeCharacteristicWithResponseForService(SMART_POT_SERVICE, characteristic, bytesToBase64(encode(value)))
      .then(() => undefined);
  }

  private async readBytes(device: Device, characteristic: string): Promise<Uint8Array> {
    const result = await device.readCharacteristicForService(SMART_POT_SERVICE, characteristic);
    return base64ToBytes(result.value ?? '');
  }

  private async writeBytes(device: Device, characteristic: string, bytes: Uint8Array): Promise<void> {
    await device.writeCharacteristicWithResponseForService(SMART_POT_SERVICE, characteristic, bytesToBase64(bytes));
  }

  /** 连接后写入当前 Unix 秒到 Time 特征并读回校验（偏差 ≤2s）。失败不阻断连接。 */
  private async syncTime(device: Device): Promise<void> {
    try {
      const unix = Math.floor(Date.now() / 1000);
      await this.writeBytes(device, SMART_POT_CHAR_TIME, toLittleEndian32(unix));
      await new Promise(resolve => setTimeout(() => resolve(undefined), 150));
      const read = fromLittleEndian32(await this.readBytes(device, SMART_POT_CHAR_TIME));
      if (Math.abs(read - unix) > 2) {
        // 时间同步偏差过大时保持连接，仅让历史时间戳落回设备自身时钟。
        return;
      }
    } catch {
      // Time 特征缺失或同步失败时保持连接，避免阻断已有 SmartPot 使用。
    }
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

    let history: SmartPotHistoryPoint[] = [];
    try {
      history = await this.readHistory(device);
    } catch {
      history = [];
    }

    return { light, lightSensor, rgb, pump, moisture, ec, temperature, config, history };
  }

  /** 分页读取 24h 历史，直到 `end` 或 `more=0`（最多 8 块）。 */
  async readHistory(device: Device): Promise<SmartPotHistoryPoint[]> {
    const records: SmartPotHistoryPoint[] = [];
    for (let offset = 0; offset < SMART_POT_HISTORY_MAX_CHUNKS; offset += 1) {
      await this.write(device, SMART_POT_CHAR_HISTORY, `offset=${offset}`);
      const raw = await this.read(device, SMART_POT_CHAR_HISTORY);
      const chunk = parseHistoryChunk(raw);
      records.push(...chunk.records);
      if (chunk.more === 0 || chunk.records.length === 0) break;
    }
    return records;
  }

  writeLight(device: Device, value: 'on' | 'off'): Promise<void> { return this.write(device, SMART_POT_CHAR_LIGHT, value); }
  writePump(device: Device, value: string): Promise<void> { return this.write(device, SMART_POT_CHAR_PUMP, value); }
  writeRgb(device: Device, value: string): Promise<void> { return this.write(device, SMART_POT_CHAR_LIGHT_RGB, value); }
  writeConfig(device: Device, value: string): Promise<void> { return this.write(device, SMART_POT_CHAR_PLANT_CONFIG, value); }
}