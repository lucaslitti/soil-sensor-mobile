/**
 * GATT 仓储：封装连接、服务发现、实时读、记录读。
 * 上层只见业务语义接口，永不见原始字节。
 */
import { Device } from 'react-native-ble-plx';
import { AppError } from '../../../core/errors';
import { buildUuidVariants } from '../../../core/utils/uuid';
import { base64ToBytes, bytesToBase64 } from '../../../core/utils/base64';
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
  TOGGLE_OFF,
  TOGGLE_ON,
} from '../../../core/constants/protocol';
import {
  decodeLive,
  decodeRecord,
  type LiveReading,
  type SubRecord,
} from '../domain/codec';
import { bleManager } from '../../scanner/data/bleTransport';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new AppError('connect-timeout', `${label} 超时`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function readCharBytes(
  device: Device,
  serviceUuid: string,
  charUuid: string,
): Promise<Uint8Array> {
  const errors: string[] = [];
  for (const candidate of buildUuidVariants(charUuid)) {
    try {
      const char = await device.readCharacteristicForService(serviceUuid, candidate);
      return base64ToBytes(char.value ?? '');
    } catch (e) {
      errors.push(String(e));
    }
  }
  throw new AppError('read-failed', `读取特征失败，候选: ${buildUuidVariants(charUuid).join(', ')}`);
}

async function writeCharByte(
  device: Device,
  serviceUuid: string,
  charUuid: string,
  byte: number,
): Promise<void> {
  for (const candidate of buildUuidVariants(charUuid)) {
    try {
      await device.writeCharacteristicWithResponseForService(
        serviceUuid,
        candidate,
        bytesToBase64(Uint8Array.of(byte)),
      );
      return;
    } catch {
      // 尝试下一个候选形式
    }
  }
  throw new AppError('read-failed', `写入特征失败，候选: ${buildUuidVariants(charUuid).join(', ')}`);
}

export interface GattRepository {
  connect(deviceId: string): Promise<Device>;
  disconnect(device: Device): Promise<void>;
  readLive(device: Device): Promise<LiveReading>;
  setReadingEnabled(device: Device, enabled: boolean): Promise<void>;
  readLatest(device: Device): Promise<SubRecord[]>;
  readL1(device: Device): Promise<SubRecord[]>;
  readL2(device: Device): Promise<SubRecord[]>;
}

export class BleGattRepository implements GattRepository {
  async connect(deviceId: string): Promise<Device> {
    const device = await withTimeout(
      bleManager.connectToDevice(deviceId),
      CONNECT_TIMEOUT_MS,
      '连接',
    );
    await device.discoverAllServicesAndCharacteristics();
    return device;
  }

  async disconnect(device: Device): Promise<void> {
    try {
      await device.cancelConnection();
    } catch {
      // 忽略断开失败
    }
  }

  async readLive(device: Device): Promise<LiveReading> {
    const [moisture, temperature, ec, timestamp] = await Promise.all([
      readCharBytes(device, SERVICE_INSTANCE_READING, CHAR_MOISTURE),
      readCharBytes(device, SERVICE_INSTANCE_READING, CHAR_TEMPERATURE),
      readCharBytes(device, SERVICE_INSTANCE_READING, CHAR_EC),
      readCharBytes(device, SERVICE_INSTANCE_READING, CHAR_TIMESTAMP),
    ]);
    return decodeLive(moisture, temperature, ec, timestamp);
  }

  async setReadingEnabled(device: Device, enabled: boolean): Promise<void> {
    await writeCharByte(
      device,
      SERVICE_INSTANCE_READING,
      CHAR_READING_TOGGLE,
      enabled ? TOGGLE_ON : TOGGLE_OFF,
    );
  }

  /** 读取某族记录特征序列，返回有序子记录（按特征顺序 + subIndex）。 */
  private async readRecords(
    device: Device,
    family: number,
    startIndex: number,
    count: number,
  ): Promise<SubRecord[]> {
    const familyHex = family.toString(16).padStart(2, '0');
    const out: SubRecord[] = [];
    for (let i = 0; i < count; i++) {
      const idxHex = i.toString(16).padStart(2, '0');
      // 特征 UUID：XXYY0000-0000-726f-736e-65536c696f53
      const charUuid = `${idxHex}${familyHex}0000-0000-726f-736e-65536c696f53`;
      const bytes = await withTimeout(
        readCharBytes(device, SERVICE_RECORD, charUuid),
        READ_TIMEOUT_MS,
        `记录 ${startIndex + i}`,
      );
      const subs = decodeRecord(bytes);
      for (const s of subs) if (!s.isEmpty) out.push(s);
    }
    return out;
  }

  async readLatest(device: Device): Promise<SubRecord[]> {
    // Latest 特征：族码 02、索引 00 -> 00020000-0000-726f-736e-65536c696f53
    const charUuid = `0002${'0000'}-0000-726f-736e-65536c696f53`;
    const bytes = await readCharBytes(device, SERVICE_RECORD, charUuid);
    return decodeRecord(bytes).filter((s) => !s.isEmpty);
  }

  async readL1(device: Device): Promise<SubRecord[]> {
    return this.readRecords(device, RECORD_FAMILY_L1, 0, RECORD_L1_COUNT);
  }

  async readL2(device: Device): Promise<SubRecord[]> {
    return this.readRecords(device, RECORD_FAMILY_L2, 0, 24);
  }
}

export const gattRepository: GattRepository = new BleGattRepository();
