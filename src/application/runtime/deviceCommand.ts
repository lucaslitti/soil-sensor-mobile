import type { OperationContext } from './operationContext';

export type DeviceCommandKind = 'connect' | 'disconnect' | 'poll' | 'history' | 'user-action';

export interface DeviceCommand<T> {
  readonly context: OperationContext;
  readonly kind?: DeviceCommandKind;
  readonly run: () => Promise<T>;
}
