import { DeviceId } from '../src/domain/value-objects/deviceId';
import { loadDashboardDevices, saveDashboardDevices } from '../src/infrastructure/storage/dashboardDeviceStorage';
import { MmkvDeviceRepository } from '../src/infrastructure/storage/mmkv/mmkvDeviceRepository';
import { SqliteReadingRepository } from '../src/infrastructure/storage/sqlite/sqliteReadingRepository';
import type { DB } from '@op-engineering/op-sqlite';
import { SensorDevice } from '../src/domain/entities/sensorDevice';

function metadataStore() {
  const values = new Map<string, string>();
  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('dashboard device persistence', () => {
  it('round-trips device metadata across application restart boundaries', async () => {
    await saveDashboardDevices([{
      id: DeviceId.create('sensor-persisted'),
      name: 'Persisted sensor',
      protocol: 'soil-sensor',
      rssi: -42,
      isConnectable: true,
    }]);

    await expect(loadDashboardDevices()).resolves.toEqual([{
      id: 'sensor-persisted',
      name: 'Persisted sensor',
      protocol: 'soil-sensor',
      rssi: -42,
      isConnectable: true,
    }]);
  });

  it('reloads MMKV device metadata after repository recreation', async () => {
    const storage = metadataStore();
    const first = new MmkvDeviceRepository(storage);
    await first.save(new SensorDevice(DeviceId.create('sensor-mmkv'), 'Stored sensor'));

    const second = new MmkvDeviceRepository(storage);
    await expect(second.get(DeviceId.create('sensor-mmkv'))).resolves.toMatchObject({
      id: DeviceId.create('sensor-mmkv'),
      name: 'Stored sensor',
    });
    await expect(second.list()).resolves.toHaveLength(1);
  });

  it('persists and queries SQLite history by device and time range', async () => {
    const rows: Record<string, unknown>[] = [];
    const database = {
      executeSync: jest.fn((sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT')) {
          rows.push({
            device_id: params?.[0],
            captured_at: params?.[1],
            received_at: params?.[2],
            session_id: params?.[3],
            operation_id: params?.[4],
            source: params?.[5],
            sub_records: params?.[6],
          });
        }
        if (sql.includes('SELECT')) {
          const [deviceId, from, to] = params ?? [];
          return {
            rows: rows
              .filter(row => row.device_id === deviceId && Number(row.captured_at) >= Number(from) && Number(row.captured_at) <= Number(to))
              .sort((a, b) => Number(a.captured_at) - Number(b.captured_at)),
            rowsAffected: 0,
          };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    } as unknown as DB;
    const first = new SqliteReadingRepository(database);
    const record = (capturedAt: number, deviceId = 'sensor-history') => ({
      deviceId,
      capturedAt,
      subRecords: [{
        recordIndex: 0,
        subIndex: 0,
        isEmpty: false,
        moisturePercent: 40,
        temperatureC: 22,
        soilEc: 1,
      }],
    });
    await first.save(record(200));
    await first.save(record(100));
    await first.save(record(150, 'other-device'));

    const second = new SqliteReadingRepository(database);
    await expect(second.queryByDevice(DeviceId.create('sensor-history'), 100, 200)).resolves.toEqual([
      record(100),
      record(200),
    ]);
  });
});
