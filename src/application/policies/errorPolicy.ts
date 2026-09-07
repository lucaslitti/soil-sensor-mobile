export type RecoveryAction = 'retry' | 'disconnect' | 'wait' | 'ignore' | 'notify';

export function recoveryAction(error: unknown): RecoveryAction {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('timeout') || message.includes('tempor')) return 'retry';
  if (message.includes('bluetooth') && message.includes('off')) return 'wait';
  if (message.includes('service') || message.includes('protocol')) return 'notify';
  return 'disconnect';
}
