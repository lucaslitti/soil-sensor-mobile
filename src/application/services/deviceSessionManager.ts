import { DeviceSession } from '../../domain/entities/deviceSession';
import type { DeviceId } from '../../domain/value-objects/deviceId';

export class DeviceSessionManager {
  private readonly sessions = new Map<string, DeviceSession>();

  get(id: DeviceId): DeviceSession | null {
    return this.sessions.get(id.value) ?? null;
  }

  create(id: DeviceId): DeviceSession {
    const existing = this.sessions.get(id.value);
    if (existing) return existing;
    const session = new DeviceSession(id, `${id.value}-${Date.now()}`);
    this.sessions.set(id.value, session);
    return session;
  }

  remove(id: DeviceId): void {
    this.sessions.delete(id.value);
  }
}
