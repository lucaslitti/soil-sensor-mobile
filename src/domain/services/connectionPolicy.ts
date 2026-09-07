import type { SensorDevice } from '../entities/sensorDevice';
import type { DeviceId } from '../value-objects/deviceId';

export class ConnectionPolicy {
  constructor(
    private readonly max = 4,
    private readonly idleMs = 60_000,
  ) {}

  maxConnections(): number {
    return this.max;
  }

  selectEvictionCandidate(
    devices: readonly SensorDevice[],
    currentDevice?: DeviceId,
    now = Date.now(),
  ): DeviceId | null {
    const candidates = devices
      .filter(device => !currentDevice || !device.id.equals(currentDevice))
      .filter(device => device.isIdleForEviction(now, this.idleMs))
      .sort((a, b) => (a.lastActiveAt ?? 0) - (b.lastActiveAt ?? 0));
    return candidates[0]?.id ?? null;
  }
}
