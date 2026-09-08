import type { DeviceConnection } from '../../domain/entities/deviceSession';
import type { DeviceId } from '../../domain/value-objects/deviceId';

/** 仅管理连接资源，不决定谁应被驱逐。 */
export class ConnectionPool {
  private readonly connections = new Map<string, DeviceConnection>();

  constructor(private readonly maxConnections = 4) {}

  acquire(id: DeviceId, connection: DeviceConnection): void {
    if (!this.connections.has(id.value) && this.connections.size >= this.maxConnections) {
      throw new Error(`Maximum ${this.maxConnections} connections reached`);
    }
    this.connections.set(id.value, connection);
  }

  get(id: DeviceId): DeviceConnection | undefined {
    return this.connections.get(id.value);
  }

  release(id: DeviceId): void {
    this.connections.delete(id.value);
  }

  has(id: DeviceId): boolean {
    return this.connections.has(id.value);
  }

  size(): number {
    return this.connections.size;
  }
}
