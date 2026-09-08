import type { Device } from 'react-native-ble-plx';
import { AppError } from '../../../core/errors';
import { base64ToBytes, bytesToBase64 } from '../../../core/utils/base64';
import { buildUuidVariants } from '../uuidVariants';
import {
  CHAR_EC,
  CHAR_MOISTURE,
  CHAR_READING_TOGGLE,
  CHAR_TEMPERATURE,
  CHAR_TIMESTAMP,
  CONNECT_TIMEOUT_MS,
  RECORD_FAMILY_L1,
  RECORD_FAMILY_L2,
  RECORD_L1_COUNT,
  READ_TIMEOUT_MS,
  SERVICE_INSTANCE_READING,
  SERVICE_RECORD,
  SUB_RECORDS_PER_RECORD,
  TOGGLE_OFF,
  TOGGLE_ON,
} from '../../../core/constants/protocol';
import { ReadingDecoder } from '../../../domain/services/readingDecoder';
import type { LiveReading } from '../../../domain/entities/sensorDevice';
import type { SensorSubRecord } from '../../../domain/ports/sensorGateway';
import { bleManager } from '../bleTransport';

function timeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AppError('connect-timeout', `${label} timeout`)), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function readBytes(device: Device, service: string, characteristic: string): Promise<Uint8Array> {
  for (const candidate of buildUuidVariants(characteristic)) {
    try {
      const result = await device.readCharacteristicForService(service, candidate);
      return base64ToBytes(result.value ?? '');
    } catch {
      // UUID byte-order variants are tried in order.
    }
  }
  throw new AppError('read-failed', `Unable to read ${characteristic}`);
}

async function writeByte(device: Device, service: string, characteristic: string, value: number): Promise<void> {
  for (const candidate of buildUuidVariants(characteristic)) {
    try {
      await device.writeCharacteristicWithResponseForService(service, candidate, bytesToBase64(Uint8Array.of(value)));
      return;
    } catch {
      // UUID byte-order variants are tried in order.
    }
  }
  throw new AppError('read-failed', `Unable to write ${characteristic}`);
}

export interface SoilSensorProtocolAdapter {
  connect(deviceId: string): Promise<Device>;
  disconnect(device: Device): Promise<void>;
  setReadingEnabled(device: Device, enabled: boolean): Promise<void>;
  readLive(device: Device): Promise<LiveReading>;
  readLatest(device: Device): Promise<SensorSubRecord[]>;
  readL1(device: Device): Promise<SensorSubRecord[]>;
  readL2(device: Device): Promise<SensorSubRecord[]>;
  readAll(device: Device): Promise<SensorSubRecord[]>;
}

export class BleSoilSensorProtocolAdapter implements SoilSensorProtocolAdapter {
  async connect(deviceId: string): Promise<Device> {
    const device = await timeout(bleManager.connectToDevice(deviceId), CONNECT_TIMEOUT_MS, 'Connect');
    return device.discoverAllServicesAndCharacteristics();
  }

  async disconnect(device: Device): Promise<void> {
    await device.cancelConnection().catch(() => undefined);
  }

  async setReadingEnabled(device: Device, enabled: boolean): Promise<void> {
    await writeByte(device, SERVICE_INSTANCE_READING, CHAR_READING_TOGGLE, enabled ? TOGGLE_ON : TOGGLE_OFF);
  }

  async readLive(device: Device): Promise<LiveReading> {
    // A DeviceActor serializes commands; keep native characteristic operations serial too.
    const moisture = await readBytes(device, SERVICE_INSTANCE_READING, CHAR_MOISTURE);
    const temperature = await readBytes(device, SERVICE_INSTANCE_READING, CHAR_TEMPERATURE);
    const ec = await readBytes(device, SERVICE_INSTANCE_READING, CHAR_EC);
    const timestamp = await readBytes(device, SERVICE_INSTANCE_READING, CHAR_TIMESTAMP);
    return ReadingDecoder.decodeLive(moisture, temperature, ec, timestamp);
  }

  async readLatest(device: Device): Promise<SensorSubRecord[]> {
    const bytes = await readBytes(device, SERVICE_RECORD, '00020000-0000-726f-736e-65536c696f53');
    return ReadingDecoder.decodeRecord(bytes).filter(record => !record.isEmpty);
  }

  readL1(device: Device): Promise<SensorSubRecord[]> {
    return this.readRecords(device, RECORD_FAMILY_L1, RECORD_L1_COUNT);
  }

  readL2(device: Device): Promise<SensorSubRecord[]> {
    return this.readRecords(device, RECORD_FAMILY_L2, 24);
  }

  async readAll(device: Device): Promise<SensorSubRecord[]> {
    const [l2, l1] = await Promise.all([this.readL2(device), this.readL1(device)]);
    return [...l2, ...l1].sort((a, b) =>
      a.recordIndex * SUB_RECORDS_PER_RECORD + a.subIndex - b.recordIndex * SUB_RECORDS_PER_RECORD - b.subIndex,
    );
  }

  private async readRecords(device: Device, family: number, count: number): Promise<SensorSubRecord[]> {
    const result: SensorSubRecord[] = [];
    const familyHex = family.toString(16).padStart(2, '0');
    for (let index = 0; index < count; index += 1) {
      const uuid = `${index.toString(16).padStart(2, '0')}${familyHex}0000-0000-726f-736e-65536c696f53`;
      const records = ReadingDecoder.decodeRecord(await timeout(readBytes(device, SERVICE_RECORD, uuid), READ_TIMEOUT_MS, 'Record'));
      result.push(...records.filter(record => !record.isEmpty));
    }
    return result;
  }
}
