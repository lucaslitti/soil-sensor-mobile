import type { OperationContext } from './operationContext';

export interface DeviceCommand<T> {
  readonly context: OperationContext;
  readonly run: () => Promise<T>;
}
