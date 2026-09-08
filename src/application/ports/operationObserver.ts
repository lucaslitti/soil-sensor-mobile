import type { OperationContext } from '../runtime/operationContext';

export interface OperationObserver {
  completed(context: OperationContext, operationType: string, queueWaitMs: number, executionMs: number, result: 'success' | 'failure' | 'cancelled'): void;
}
