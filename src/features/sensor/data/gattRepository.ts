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
  SUB_RECORDS_PER_RECORD,
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
import { bytesToHex, logBle, logBleError } from '../../../infrastructure/ble/bleLogger';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new AppError('connect-timeout', `${label} timeout`)), ms);
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
      logBle('gatt.read.start', {
        deviceId: device.id,
        service: serviceUuid,
        characteristic: charUuid,
        candidate,
      });
      const char = await device.readCharacteristicForService(serviceUuid, candidate);
      const bytes = base64ToBytes(char.value ?? '');
      logBle('gatt.read.success', {
        deviceId: device.id,
        service: serviceUuid,
        characteristic: charUuid,
        candidate,
        bytes: bytes.length,
        hex: bytesToHex(bytes),
        base64: char.value ?? '',
      });
      return bytes;
    } catch (e) {
      errors.push(String(e));
      logBleError('gatt.read.candidate.error', e, {
        deviceId: device.id,
        service: serviceUuid,
        characteristic: charUuid,
        candidate,
      });
    }
  }
  throw new AppError('read-failed', `Failed to read characteristic, candidates: ${buildUuidVariants(charUuid).join(', ')}`);
}

async function writeCharByte(
  device: Device,
  serviceUuid: string,
  charUuid: string,
  byte: number,
): Promise<void> {
  for (const candidate of buildUuidVariants(charUuid)) {
    try {
      const value = bytesToBase64(Uint8Array.of(byte));
      logBle('gatt.write.start', {
        deviceId: device.id,
        service: serviceUuid,
        characteristic: charUuid,
        candidate,
        bytes: 1,
        hex: byte.toString(16).padStart(2, '0'),
        base64: value,
      });
      await device.writeCharacteristicWithResponseForService(
        serviceUuid,
        candidate,
        value,
      );
      logBle('gatt.write.success', { deviceId: device.id, service: serviceUuid, characteristic: charUuid, candidate });
      return;
    } catch (error) {
      logBleError('gatt.write.candidate.error', error, { deviceId: device.id, service: serviceUuid, characteristic: charUuid, candidate });
      // 尝试下一个候选形式
    }
  }
  throw new AppError('read-failed', `Failed to write characteristic, candidates: ${buildUuidVariants(charUuid).join(', ')}`);
}

export interface GattRepository {
  connect(deviceId: string): Promise<Device>;
  disconnect(device: Device): Promise<void>;
  readLive(device: Device): Promise<LiveReading>;
  setReadingEnabled(device: Device, enabled: boolean): Promise<void>;
  readLatest(device: Device): Promise<SubRecord[]>;
  readL1(device: Device): Promise<SubRecord[]>;
  readL2(device: Device): Promise<SubRecord[]>;
  /** 合并读取全部保留记录（L1 + L2），按存储槽位正序返回。 */
  readAll(device: Device): Promise<SubRecord[]>;
}

export class BleGattRepository implements GattRepository {
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
    logBle('gatt.connect.start', { deviceId });
    const device = await withTimeout(
      bleManager.connectToDevice(deviceId),
      CONNECT_TIMEOUT_MS,
      'Connect',
    );
    logBle('gatt.connect.transport.success', { deviceId: device.id, name: device.name ?? null });
    await device.discoverAllServicesAndCharacteristics();
    logBle('gatt.services.discovered', { deviceId: device.id });
    return device;
  }

  async disconnect(device: Device): Promise<void> {
    logBle('gatt.disconnect.start', { deviceId: device.id });
    const references = this.references.get(device.id) ?? 1;
    if (references > 1) {
      this.references.set(device.id, references - 1);
      logBle('gatt.disconnect.released_reference', { deviceId: device.id, references: references - 1 });
      return;
    }
    this.devices.delete(device.id);
    this.references.delete(device.id);
    try {
      await device.cancelConnection();
      logBle('gatt.disconnect.success', { deviceId: device.id });
    } catch {
      logBle('gatt.disconnect.already_closed', { deviceId: device.id });
      // 忽略断开失败
    }
  }

  async readLive(device: Device): Promise<LiveReading> {
    logBle('gatt.live.read.start', { deviceId: device.id });
    const [moisture, temperature, ec, timestamp] = await Promise.all([
      readCharBytes(device, SERVICE_INSTANCE_READING, CHAR_MOISTURE),
      readCharBytes(device, SERVICE_INSTANCE_READING, CHAR_TEMPERATURE),
      readCharBytes(device, SERVICE_INSTANCE_READING, CHAR_EC),
      readCharBytes(device, SERVICE_INSTANCE_READING, CHAR_TIMESTAMP),
    ]);
    const reading = decodeLive(moisture, temperature, ec, timestamp);
    logBle('gatt.live.read.decoded', { deviceId: device.id, reading });
    return reading;
  }

  async setReadingEnabled(device: Device, enabled: boolean): Promise<void> {
    logBle('gatt.reading_toggle', { deviceId: device.id, enabled, value: enabled ? TOGGLE_ON : TOGGLE_OFF });
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
    logBle('gatt.history.family.start', { deviceId: device.id, family, startIndex, count });
    for (let i = 0; i < count; i++) {
      const idxHex = i.toString(16).padStart(2, '0');
      // 特征 UUID：XXYY0000-0000-726f-736e-65536c696f53
      const charUuid = `${idxHex}${familyHex}0000-0000-726f-736e-65536c696f53`;
      const bytes = await withTimeout(
        readCharBytes(device, SERVICE_RECORD, charUuid),
        READ_TIMEOUT_MS,
        `Record ${startIndex + i}`,
      );
      const subs = decodeRecord(bytes);
      for (const s of subs) if (!s.isEmpty) out.push(s);
    }
    logBle('gatt.history.family.success', { deviceId: device.id, family, records: out.length });
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

  async readAll(device: Device): Promise<SubRecord[]> {
    const [l2, l1] = await Promise.all([this.readL2(device), this.readL1(device)]);
    // 存储槽位 = recordIndex * 子记录数 + subIndex，按槽位正序合并为连续时间线
    return [...l2, ...l1].sort(
      (a, b) =>
        a.recordIndex * SUB_RECORDS_PER_RECORD +
        a.subIndex -
        (b.recordIndex * SUB_RECORDS_PER_RECORD + b.subIndex),
    );
  }
}

export const gattRepository: GattRepository = new BleGattRepository();
