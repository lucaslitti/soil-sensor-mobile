import type { DeviceId } from '../value-objects/deviceId';

/** Opaque connection resource owned by Infrastructure and referenced by Application. */
export interface DeviceConnection {
  readonly deviceId: DeviceId;
  readonly protocol?: 'soil-sensor' | 'smart-pot';
  readonly native?: unknown;
}
