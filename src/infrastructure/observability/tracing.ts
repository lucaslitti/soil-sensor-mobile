export interface TraceSpan {
  readonly operationId: string;
  readonly startedAt: number;
  finish(result: 'success' | 'failure' | 'cancelled'): { executionMs: number; result: string };
}

export class Tracer {
  start(operationId: string): TraceSpan {
    const startedAt = Date.now();
    return {
      operationId,
      startedAt,
      finish: result => ({ executionMs: Date.now() - startedAt, result }),
    };
  }
}
