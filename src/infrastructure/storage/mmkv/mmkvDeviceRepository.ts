import type { DeviceRepository } from '../../../domain/repositories/deviceRepository';
import { SensorDevice } from '../../../domain/entities/sensorDevice';
import { DeviceId } from '../../../domain/value-objects/deviceId';
import { MMKV } from 'react-native-mmkv';

type MetadataStore = { getString(key: string): string | undefined; set(key: string, value: string): void };
const INDEX_KEY = '@ryobi/device-metadata/index';

/** Device metadata repository boundary. The native MMKV adapter can replace this map. */
export class MmkvDeviceRepository implements DeviceRepository {
  private readonly devices = new Map<string, SensorDevice>();
  private readonly metadata: MetadataStore;

  constructor(metadata?: MetadataStore) {
    this.metadata = metadata ?? new MMKV({ id: 'ryobi-device-metadata' });
  }

  async get(id: DeviceId): Promise<SensorDevice | null> {
    const current = this.devices.get(id.value);
    if (current) return current;
    const metadata = this.readMetadata(id.value);
    if (!metadata) return null;
    const device = new SensorDevice(id, metadata.name);
    this.devices.set(id.value, device);
    return device;
  }

  async list(): Promise<readonly SensorDevice[]> {
    const devices = await Promise.all(this.readIndex().map(id => this.get(DeviceId.create(id))));
    return devices.filter((device): device is SensorDevice => device !== null);
  }

  save(device: SensorDevice): Promise<void> {
    this.devices.set(device.id.value, device);
    this.metadata.set(device.id.value, JSON.stringify({ id: device.id.value, name: device.name }));
    this.writeIndex([...new Set([...this.readIndex(), device.id.value])]);
    return Promise.resolve();
  }

  remove(id: DeviceId): Promise<void> {
    this.devices.delete(id.value);
    this.writeIndex(this.readIndex().filter(value => value !== id.value));
    return Promise.resolve();
  }

  private readIndex(): string[] {
    try {
      const value = this.metadata.getString(INDEX_KEY);
      const parsed: unknown = value ? JSON.parse(value) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private writeIndex(ids: readonly string[]): void {
    this.metadata.set(INDEX_KEY, JSON.stringify(ids));
  }

  private readMetadata(id: string): { name: string | null } | null {
    try {
      const value = this.metadata.getString(id);
      if (!value) return null;
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') return null;
      const name = (parsed as { name?: unknown }).name;
      return { name: name === null || typeof name === 'string' ? name : null };
    } catch {
      return null;
    }
  }
}
