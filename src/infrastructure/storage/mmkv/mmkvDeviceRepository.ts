import type { DeviceRepository } from '../../../domain/repositories/deviceRepository';
import type { SensorDevice } from '../../../domain/entities/sensorDevice';
import type { DeviceId } from '../../../domain/value-objects/deviceId';
import { MMKV } from 'react-native-mmkv';

type MetadataStore = { getString(key: string): string | undefined; set(key: string, value: string): void };

/** Device metadata repository boundary. The native MMKV adapter can replace this map. */
export class MmkvDeviceRepository implements DeviceRepository {
  private readonly devices = new Map<string, SensorDevice>();
  private readonly metadata: MetadataStore;

  constructor() {
    this.metadata = new MMKV({ id: 'ryobi-device-metadata' });
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
