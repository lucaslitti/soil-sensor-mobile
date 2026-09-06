/* eslint-disable no-bitwise */
/**
 * 协议解析层 —— ★ 纯 TypeScript，禁止 import react-native 任何模块。
 * 只依赖 Uint8Array / DataView，单测即跑。
 * 出处：react-soil-sensor Web 端 decodeLive / decodeRecordPayload。
 */
import { CodecError } from '../../../core/errors';
import {
  RECORD_BYTES,
  RECORD_RECORD_INDEX_MASK,
  RECORD_SUB_INDEX_MASK,
  RECORD_SUB_INDEX_SHIFT,
  SCALE_EC_LIVE,
  SCALE_EC_RECORD,
  SCALE_MOISTURE,
  SCALE_TEMPERATURE,
  SUB_RECORDS_PER_RECORD,
  SUB_RECORD_BYTES,
} from '../../../core/constants/protocol';

export interface LiveReading {
  /** % */
  moisturePercent: number;
  /** ℃ */
  temperatureC: number;
  /** mS/cm（实时路径 /20） */
  soilEc: number;
  /** epoch ms（uint32 LE 秒 × 1000） */
  timestamp: number;
  source: 'gatt';
}

export interface SubRecord {
  /** 存储元数据，非业务值 */
  recordIndex: number;
  subIndex: number;
  /** moisture==0 && temp==0 && ec==0 视为空 */
  isEmpty: boolean;
  /** % */
  moisturePercent: number;
  /** ℃ */
  temperatureC: number;
  /** mS/cm（记录路径 /100） */
  soilEc: number;
}

function viewOf(bytes: Uint8Array, offset: number, len: number): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, len);
}

/** 解码一次实时读数（4 个特征各 1 字节 / 时间戳 4 字节 LE）。 */
export function decodeLive(
  moisture: Uint8Array,
  temperature: Uint8Array,
  ec: Uint8Array,
  timestamp: Uint8Array,
): LiveReading {
  if (moisture.length < 1 || temperature.length < 1 || ec.length < 1) {
    throw new CodecError('实时特征字节数不足');
  }
  if (timestamp.length < 4) {
    throw new CodecError('时间戳字节数不足');
  }
  const tsSeconds = viewOf(timestamp, 0, 4).getUint32(0, true);
  return {
    moisturePercent: viewOf(moisture, 0, 1).getUint8(0) * SCALE_MOISTURE,
    temperatureC: viewOf(temperature, 0, 1).getInt8(0) * SCALE_TEMPERATURE,
    soilEc: viewOf(ec, 0, 1).getUint8(0) * SCALE_EC_LIVE,
    timestamp: tsSeconds > 0 ? tsSeconds * 1000 : Date.now(),
    source: 'gatt',
  };
}

/** 解码一条 32 字节记录为 8 条子记录。 */
export function decodeRecord(b: Uint8Array): SubRecord[] {
  if (b.length !== RECORD_BYTES) {
    throw new CodecError(`record 长度必须为 ${RECORD_BYTES}，实际 ${b.length}`);
  }
  const out: SubRecord[] = [];
  for (let i = 0; i < SUB_RECORDS_PER_RECORD; i++) {
    const off = i * SUB_RECORD_BYTES;
    const byte0 = b[off];
    const moisture = b[off + 1] * SCALE_MOISTURE;
    // int8 符号扩展
    const temperature = ((b[off + 2] << 24) >> 24) * SCALE_TEMPERATURE;
    const ec = b[off + 3] * SCALE_EC_RECORD;
    out.push({
      recordIndex: byte0 & RECORD_RECORD_INDEX_MASK,
      subIndex: (byte0 >> RECORD_SUB_INDEX_SHIFT) & RECORD_SUB_INDEX_MASK,
      isEmpty: b[off + 1] === 0 && b[off + 2] === 0 && b[off + 3] === 0,
      moisturePercent: moisture,
      temperatureC: temperature,
      soilEc: ec,
    });
  }
  return out;
}
