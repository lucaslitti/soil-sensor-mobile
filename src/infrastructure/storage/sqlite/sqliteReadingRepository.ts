import type { ReadingRepository } from '../../../domain/repositories/readingRepository';
import type { SensorRecord } from '../../../domain/ports/sensorGateway';
import type { DeviceId } from '../../../domain/value-objects/deviceId';

/** Storage port implementation; replace the backing table with SQLite native bindings. */
export class SqliteReadingRepository implements ReadingRepository {
  private readonly records: SensorRecord[] = [];

  async save(record: SensorRecord): Promise<void> {
    this.records.push(record);
  }

  async queryByDevice(id: DeviceId, from: number, to: number): Promise<readonly SensorRecord[]> {
    return this.records.filter(record => record.deviceId === id.value && record.capturedAt >= from && record.capturedAt <= to);
  }
}
