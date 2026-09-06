import { useCallback, useState } from 'react';
import type { Device } from 'react-native-ble-plx';
import { gattRepository } from '../data/gattRepository';
import type { SubRecord } from '../domain/codec';
import type { RecordV1 } from '../domain/sensorRecord';

interface HistoryState {
  loading: boolean;
  error: string | null;
  latest: SubRecord[];
  l1: RecordV1 | null;
  l2: RecordV1 | null;
}

const INITIAL: HistoryState = {
  loading: false,
  error: null,
  latest: [],
  l1: null,
  l2: null,
};

/**
 * 分级读取历史：Latest（1 次）→ L1（8 次）→ L2（24 次，按需）。
 * L2 特征逻辑最新在前，读取后转正序（由 Data 层保证有序）。
 */
export function useHistory() {
  const [state, setState] = useState<HistoryState>(INITIAL);

  const readLatest = useCallback(async (device: Device, _deviceId: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const latest = await gattRepository.readLatest(device);
      setState((s) => ({ ...s, loading: false, latest }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : '读取最新记录失败',
      }));
    }
  }, []);

  const readL1 = useCallback(async (device: Device, _deviceId: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const subs = await gattRepository.readL1(device);
      setState((s) => ({
        ...s,
        loading: false,
        l1: { deviceId: _deviceId, capturedAt: Date.now(), subRecords: subs },
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : '读取 L1 失败',
      }));
    }
  }, []);

  const readL2 = useCallback(async (device: Device, _deviceId: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const subs = await gattRepository.readL2(device);
      setState((s) => ({
        ...s,
        loading: false,
        l2: { deviceId: _deviceId, capturedAt: Date.now(), subRecords: subs },
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : '读取 L2 失败',
      }));
    }
  }, []);

  return { ...state, readLatest, readL1, readL2 };
}
