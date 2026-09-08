export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

export interface OperationLog {
  operationId: string;
  deviceId: string;
  sessionId: string;
  operationType: string;
  queueWaitMs?: number;
  executionMs?: number;
  result?: 'success' | 'failure' | 'cancelled';
  errorCode?: string;
  retryCount?: number;
  timestamp: number;
}

export interface Logger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
  operation(entry: OperationLog): void;
}

export class OperationLogger implements OperationObserver {
  constructor(private readonly logger: Logger = new ConsoleLogger()) {}

  completed(
    context: OperationContext,
    operationType: string,
    queueWaitMs: number,
    executionMs: number,
    result: 'success' | 'failure' | 'cancelled',
  ): void {
    this.logger.operation({
      operationId: context.operationId,
      deviceId: context.deviceId.value,
      sessionId: context.sessionId,
      operationType,
      queueWaitMs,
      executionMs,
      result,
      timestamp: Date.now(),
    });
  }
}

export class ConsoleLogger implements Logger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level === 'DEBUG' || level === 'TRACE') return;
    if (context) console.log(`[${level}] ${message}`, context);
    else console.log(`[${level}] ${message}`);
  }

  operation(entry: OperationLog): void {
    this.log(entry.result === 'failure' ? 'ERROR' : 'INFO', 'ble.operation', entry as unknown as Record<string, unknown>);
  }
}
import type { OperationObserver } from '../../application/ports/operationObserver';
import type { OperationContext } from '../../application/runtime/operationContext';
