import type { DeviceConnection } from '../../domain/entities/deviceSession';
import type { DeviceId } from '../../domain/value-objects/deviceId';
import { DeviceActor } from './deviceActor';
import type { OperationId, SessionId } from './operationContext';

export type RuntimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
export type RuntimeOperationState = 'idle' | 'polling' | 'history' | 'reconnecting' | 'suspended';

export class DeviceRuntime {
  readonly actor: DeviceActor;
  connection: RuntimeConnectionState = 'disconnected';
  operation: RuntimeOperationState = 'idle';
  connectionResource: DeviceConnection | null = null;

  constructor(
    readonly deviceId: DeviceId,
    readonly sessionId: SessionId,
    private readonly isCurrentSession: (sessionId: SessionId) => boolean,
  ) {
    this.actor = new DeviceActor(isCurrentSession);
  }

  operationId(prefix: string): OperationId {
    return `${this.sessionId}:${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }
}
