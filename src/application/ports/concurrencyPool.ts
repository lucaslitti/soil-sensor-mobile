import type { OperationContext } from '../runtime/operationContext';

export type Release = () => void;

export interface ConcurrencyPool {
  acquire(context: OperationContext): Promise<Release>;
  run<T>(task: () => Promise<T>, context?: OperationContext): Promise<T>;
}
