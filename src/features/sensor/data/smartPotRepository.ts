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
import { bytesToHex, logBle } from '../../../infrastructure/ble/bleLogger';

const CONNECT_TIMEOUT_MS = 20_000;

function asciiEncode(value: string): Uint8Array {
  return Uint8Array.from(value, char => char.charCodeAt(0));
}

function asciiDecode(value: string): string {
  return String.fromCharCode(...base64ToBytes(value)).trim();
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AppError('connect-timeout', `${label} timeout`)), CONNECT_TIMEOUT_MS);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function readText(device: Device, characteristic: string): Promise<string> {
  const result = await device.readCharacteristicForService(SMART_POT_SERVICE, characteristic);
  const raw = result.value ?? '';
  const bytes = base64ToBytes(raw);
  const text = asciiDecode(raw);
  logBle('smartpot.read', {
    deviceId: device.id,
    service: SMART_POT_SERVICE,
    characteristic,
    bytes: bytes.length,
    hex: bytesToHex(bytes),
    base64: raw,
    text,
  });
  return text;
}

async function writeText(device: Device, characteristic: string, value: string): Promise<void> {
  const encoded = bytesToBase64(asciiEncode(value));
  logBle('smartpot.write.start', {
    deviceId: device.id,
    service: SMART_POT_SERVICE,
    characteristic,
    text: value,
    base64: encoded,
  });
  await device.writeCharacteristicWithResponseForService(
    SMART_POT_SERVICE,
    characteristic,
    encoded,
  );
  logBle('smartpot.write.success', { deviceId: device.id, characteristic });
}

export class SmartPotRepository {
  private readonly devices = new Map<string, Device>();
  private readonly references = new Map<string, number>();
  private readonly connecting = new Map<string, Promise<Device>>();

  async connect(deviceId: string): Promise<Device> {
    const existing = this.devices.get(deviceId);
    if (existing) {
      this.references.set(deviceId, (this.references.get(deviceId) ?? 1) + 1);
      return existing;
    }

    const pending = this.connecting.get(deviceId);
    if (pending) {
      const device = await pending;
      this.references.set(deviceId, (this.references.get(deviceId) ?? 1) + 1);
      return device;
    }

    const connection = this.connectFresh(deviceId);
    this.connecting.set(deviceId, connection);
    try {
      const device = await connection;
      this.devices.set(deviceId, device);
      this.references.set(deviceId, 1);
      return device;
    } finally {
      this.connecting.delete(deviceId);
    }
  }

  private async connectFresh(deviceId: string): Promise<Device> {
    logBle('smartpot.connect.start', { deviceId });
    const device = await withTimeout(bleManager.connectToDevice(deviceId), 'Connect SmartPot');
    logBle('smartpot.connect.transport.success', { deviceId: device.id, name: device.name ?? null });
    await device.discoverAllServicesAndCharacteristics();
    logBle('smartpot.services.discovered', { deviceId: device.id });
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = Uint8Array.of(timestamp & 0xff, (timestamp >>> 8) & 0xff, (timestamp >>> 16) & 0xff, (timestamp >>> 24) & 0xff);
    await device.writeCharacteristicWithResponseForService(SMART_POT_SERVICE, SMART_POT_CHAR_TIME, bytesToBase64(payload));
    logBle('smartpot.time.write', { deviceId: device.id, timestamp });
    const actual = base64ToBytes((await device.readCharacteristicForService(SMART_POT_SERVICE, SMART_POT_CHAR_TIME)).value ?? '');
    const confirmed = (actual[0] | (actual[1] << 8) | (actual[2] << 16) | (actual[3] << 24)) >>> 0;
    logBle('smartpot.time.read', { deviceId: device.id, bytes: actual.length, hex: bytesToHex(actual), confirmed, timestamp });
    if (actual.length < 4 || Math.abs(confirmed - timestamp) > 2) throw new AppError('read-failed', 'SmartPot time sync verification failed');
    return device;
  }

  async disconnect(device: Device): Promise<void> {
    const references = this.references.get(device.id) ?? 1;
    if (references > 1) {
      this.references.set(device.id, references - 1);
      logBle('smartpot.disconnect.released_reference', { deviceId: device.id, references: references - 1 });
      return;
    }
    this.devices.delete(device.id);
    this.references.delete(device.id);
    logBle('smartpot.disconnect.start', { deviceId: device.id });
    try { await device.cancelConnection(); logBle('smartpot.disconnect.success', { deviceId: device.id }); } catch { logBle('smartpot.disconnect.already_closed', { deviceId: device.id }); }
  }

  async readSnapshot(device: Device): Promise<SmartPotSnapshot> {
    logBle('smartpot.snapshot.start', { deviceId: device.id });
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
    const snapshot = { light, lightSensor, rgb, pump, moisture, ec, temperature, config, history: parseSmartPotHistory(historyRaw) };
    logBle('smartpot.snapshot.success', { deviceId: device.id, snapshot });
    return snapshot;
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
