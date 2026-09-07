import type { DeviceConnection } from '../../domain/entities/deviceSession';
export type { DeviceConnection } from '../../domain/entities/deviceSession';

export interface ConnectionPoolPort {
  acquire(id: import('../../domain/value-objects/deviceId').DeviceId, connection: DeviceConnection): void;
  release(id: import('../../domain/value-objects/deviceId').DeviceId): void;
  has(id: import('../../domain/value-objects/deviceId').DeviceId): boolean;
  size(): number;
}
