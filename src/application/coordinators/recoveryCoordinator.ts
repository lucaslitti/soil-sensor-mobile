import { recoveryAction } from '../policies/errorPolicy';
import { RetryPolicy } from '../policies/retryPolicy';

/** 连接恢复策略：重试由 Application 决定，Screen 不参与。 */
export class RecoveryCoordinator {
  constructor(
    private readonly retryPolicy = new RetryPolicy(),
  ) {}

  recover<T>(task: () => Promise<T>, onPermanentFailure: (error: unknown) => Promise<void>): Promise<T> {
    return this.retryPolicy.execute(task, error => recoveryAction(error) === 'retry').catch(async error => {
      await onPermanentFailure(error);
      throw error;
    });
  }
}
