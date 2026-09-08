import { useCallback, useEffect, useRef } from 'react';
import { useScannerStore } from '../stores/scannerStore';
import { scanDevicesUseCase } from '../../application/compositionRoot';

/**
 * 扫描生命周期：挂载自动开始、卸载停止；内置 30s 超时。
 * 开始前请求 Android 蓝牙运行时权限。
 */
export function useScanner() {
  const { state, devices, error, setState, upsert, reset } = useScannerStore();
  const iteratorRef = useRef<AsyncIterator<import('../../domain/ports/sensorGateway').ScannedDevice> | null>(null);

  const start = useCallback(async () => {
    reset();
    setState('scanning');
    const iterator = scanDevicesUseCase.scan()[Symbol.asyncIterator]();
    iteratorRef.current = iterator;
    try {
      while (true) {
        const result = await iterator.next();
        if (result.done) break;
           upsert({
           id: result.value.id,
          name: result.value.name,
          rssi: result.value.rssi,
          isConnectable: result.value.isConnectable,
          protocol: result.value.protocol,
        });
      }
      setState('stopped');
    } catch (e) {
      setState('error', e instanceof Error ? e.message : 'Scan error');
    } finally {
      iteratorRef.current = null;
    }
  }, [reset, setState, upsert]);

  useEffect(() => {
    start();
    return () => {
      iteratorRef.current?.return?.();
      iteratorRef.current = null;
    };
  }, [start]);

  return { state, devices, error, start };
}
