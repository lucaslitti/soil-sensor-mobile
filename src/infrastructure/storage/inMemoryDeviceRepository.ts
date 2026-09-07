import type { DeviceRepository } from '../../domain/repositories/deviceRepository';
import type { SensorDevice } from '../../domain/entities/sensorDevice';
import type { DeviceId } from '../../domain/value-objects/deviceId';

/** MMKV 依赖接入前的端口实现；替换实现不会影响 Application/Presentation。 */
export class InMemoryDeviceRepository implements DeviceRepository {
  private readonly devices = new Map<string, SensorDevice>();

  async get(id: DeviceId): Promise<SensorDevice | null> {
    return this.devices.get(id.value) ?? null;
  }

  async list(): Promise<readonly SensorDevice[]> {
    return [...this.devices.values()];
  }

  async save(device: SensorDevice): Promise<void> {
    this.devices.set(device.id.value, device);
  }

  async remove(id: DeviceId): Promise<void> {
    this.devices.delete(id.value);
  }
}
