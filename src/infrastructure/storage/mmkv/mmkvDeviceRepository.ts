import type { DeviceRepository } from '../../../domain/repositories/deviceRepository';
import type { SensorDevice } from '../../../domain/entities/sensorDevice';
import type { DeviceId } from '../../../domain/value-objects/deviceId';

type MetadataStore = { getString(key: string): string | undefined; set(key: string, value: string): void };

/** Device metadata repository boundary. The native MMKV adapter can replace this map. */
export class MmkvDeviceRepository implements DeviceRepository {
  private readonly devices = new Map<string, SensorDevice>();
  private readonly metadata: MetadataStore;

  constructor() {
    try {
      const { MMKV } = require('react-native-mmkv') as { MMKV: new (options: { id: string }) => MetadataStore };
      this.metadata = new MMKV({ id: 'ryobi-device-metadata' });
    } catch {
      const values = new Map<string, string>();
      this.metadata = { getString: key => values.get(key), set: (key, value) => values.set(key, value) };
    }
  }

  get(id: DeviceId): Promise<SensorDevice | null> { return Promise.resolve(this.devices.get(id.value) ?? null); }
  list(): Promise<readonly SensorDevice[]> { return Promise.resolve([...this.devices.values()]); }
  save(device: SensorDevice): Promise<void> {
    this.devices.set(device.id.value, device);
    this.metadata.set(device.id.value, JSON.stringify({ id: device.id.value, name: device.name }));
    return Promise.resolve();
  }
  remove(id: DeviceId): Promise<void> { this.devices.delete(id.value); return Promise.resolve(); }
}
