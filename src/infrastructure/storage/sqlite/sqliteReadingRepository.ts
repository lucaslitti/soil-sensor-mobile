import { open, type DB } from '@op-engineering/op-sqlite';
import type { ReadingRepository } from '../../../domain/repositories/readingRepository';
import type { SensorRecord } from '../../../domain/ports/sensorGateway';
import type { DeviceId } from '../../../domain/value-objects/deviceId';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS sensor_records (
    device_id TEXT NOT NULL,
    captured_at INTEGER NOT NULL,
    received_at INTEGER,
    session_id TEXT,
    operation_id TEXT,
    source TEXT,
    sub_records TEXT NOT NULL
  )
`;

const CREATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_sensor_records_device_time
  ON sensor_records(device_id, captured_at)
`;

/** SQLite adapter for historical sensor readings. */
export class SqliteReadingRepository implements ReadingRepository {
  private readonly database: DB;

  constructor(database?: DB) {
    this.database = database ?? open({ name: 'ryobi-readings.sqlite' });
    this.database.executeSync(CREATE_TABLE);
    this.database.executeSync(CREATE_INDEX);
  }

  async save(record: SensorRecord): Promise<void> {
    this.database.executeSync(
      `INSERT INTO sensor_records
        (device_id, captured_at, received_at, session_id, operation_id, source, sub_records)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.deviceId,
        record.capturedAt,
        record.receivedAt ?? null,
        record.sessionId ?? null,
        record.operationId ?? null,
        record.source ?? null,
        JSON.stringify(record.subRecords),
      ],
    );
  }

  async queryByDevice(id: DeviceId, from: number, to: number): Promise<readonly SensorRecord[]> {
    const result = this.database.executeSync(
      `SELECT device_id, captured_at, received_at, session_id, operation_id, source, sub_records
       FROM sensor_records
       WHERE device_id = ? AND captured_at >= ? AND captured_at <= ?
       ORDER BY captured_at ASC`,
      [id.value, from, to],
    );
    return result.rows.map(row => ({
      deviceId: String(row.device_id),
      capturedAt: Number(row.captured_at),
      receivedAt: row.received_at == null ? undefined : Number(row.received_at),
      sessionId: row.session_id == null ? undefined : String(row.session_id),
      operationId: row.operation_id == null ? undefined : String(row.operation_id),
      source: row.source == null ? undefined : String(row.source) as 'gatt',
      subRecords: JSON.parse(String(row.sub_records)),
    }));
  }
}
