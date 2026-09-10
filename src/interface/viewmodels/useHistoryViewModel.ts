import { useCallback, useEffect, useRef, useState } from 'react';
import { readHistoryUseCase } from '../../application/compositionRoot';
import { CancellationToken } from '../../application/runtime/cancellationToken';
import type { SensorSubRecord } from '../../domain/ports/sensorGateway';

interface HistoryState {
  loading: boolean;
  error: string | null;
  latest: SensorSubRecord[];
  l1: { deviceId: string; capturedAt: number; subRecords: readonly SensorSubRecord[] } | null;
  l2: { deviceId: string; capturedAt: number; subRecords: readonly SensorSubRecord[] } | null;
  all: SensorSubRecord[] | null;
}

const INITIAL: HistoryState = { loading: false, error: null, latest: [], l1: null, l2: null, all: null };

export function useHistoryViewModel() {
  const [state, setState] = useState<HistoryState>(INITIAL);
  const tokenRef = useRef<CancellationToken | null>(null);
  const read = useCallback(async (deviceId: string, level: 'latest' | 'l1' | 'l2' | 'all') => {
    tokenRef.current?.cancel();
    const token = new CancellationToken();
    tokenRef.current = token;
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const records = await readHistoryUseCase.execute(deviceId, level, token);
      const subs = records.flatMap(record => [...record.subRecords]);
      setState(current => ({
        ...current,
        loading: false,
        latest: level === 'latest' ? subs : current.latest,
        l1: level === 'l1' ? { deviceId, capturedAt: Date.now(), subRecords: subs } : current.l1,
        l2: level === 'l2' ? { deviceId, capturedAt: Date.now(), subRecords: subs } : current.l2,
        all: level === 'all' ? subs : current.all,
      }));
    } catch (error) {
      setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'History read failed' }));
    }
  }, []);
  const cancelHistory = useCallback(() => tokenRef.current?.cancel(), []);
  useEffect(() => cancelHistory, [cancelHistory]);
  return {
    ...state,
    readLatest: (deviceId: string) => read(deviceId, 'latest'),
    readL1: (deviceId: string) => read(deviceId, 'l1'),
    readL2: (deviceId: string) => read(deviceId, 'l2'),
    readAll: (deviceId: string) => read(deviceId, 'all'),
    cancelHistory,
  };
}
