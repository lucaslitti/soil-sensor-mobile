import type { DeviceId } from '../../domain/value-objects/deviceId';

export type SessionId = string;
export type OperationId = string;

export interface OperationContext {
  readonly deviceId: DeviceId;
  readonly sessionId: SessionId;
  readonly operationId: OperationId;
}
