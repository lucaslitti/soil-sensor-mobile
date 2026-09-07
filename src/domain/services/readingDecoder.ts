/* eslint-disable no-bitwise */
import { ProtocolError } from '../errors';
import type { LiveReading } from '../entities/sensorDevice';
import type { SensorSubRecord } from '../ports/sensorGateway';
import { SoilEc } from '../value-objects/soilEc';
import { SoilMoisturePercent } from '../value-objects/soilMoisture';
import { TemperatureC } from '../value-objects/temperatureC';
import { ReadingTimestamp } from '../value-objects/readingTimestamp';

const RECORD_BYTES = 32;

export const ReadingDecoder = {
  decodeLive(moisture: Uint8Array, temperature: Uint8Array, ec: Uint8Array, timestamp: Uint8Array): LiveReading {
    if (moisture.length < 1 || temperature.length < 1 || ec.length < 1) {
      throw new ProtocolError('Live characteristic has too few bytes');
    }
    return {
      moisturePercent: SoilMoisturePercent.fromUint8HalfStep(moisture[0]).value,
      temperatureC: TemperatureC.fromInt8(temperature[0]).value,
      soilEc: SoilEc.fromLiveRaw(ec[0]).value,
      timestamp: ReadingTimestamp.fromUint32LeSeconds(timestamp).epochMs,
      source: 'gatt',
    };
  },

  decodeRecord(bytes: Uint8Array): SensorSubRecord[] {
    if (bytes.length !== RECORD_BYTES) throw new ProtocolError(`record length must be ${RECORD_BYTES}, got ${bytes.length}`);
    const result: SensorSubRecord[] = [];
    for (let offset = 0; offset < bytes.length; offset += 4) {
      const byte0 = bytes[offset];
      result.push({
        recordIndex: byte0 & 0x1f,
        subIndex: (byte0 >> 5) & 0x07,
        isEmpty: bytes[offset + 1] === 0 && bytes[offset + 2] === 0 && bytes[offset + 3] === 0,
        moisturePercent: SoilMoisturePercent.fromUint8HalfStep(bytes[offset + 1]).value,
        temperatureC: TemperatureC.fromInt8(bytes[offset + 2]).value,
        soilEc: SoilEc.fromRecordRaw(bytes[offset + 3]).value,
      });
    }
    return result;
  },
};
