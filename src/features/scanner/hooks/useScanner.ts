import { useCallback, useEffect, useRef } from 'react';
import { startScan } from '../data/bleTransport';
import { requestBluetoothPermissions } from '../data/permissions';
import { useScannerStore } from './scannerStore';

/**
 * 扫描生命周期：挂载自动开始、卸载停止；内置 30s 超时。
 * 开始前请求 Android 蓝牙运行时权限。
 */
export function useScanner() {
  const { state, devices, error, setState, upsert, reset } = useScannerStore();
  const stopRef = useRef<(() => void) | null>(null);

  const start = useCallback(async () => {
    reset();
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      setState('error', '未获得蓝牙权限，请在系统设置中允许后重试');
      return;
    }
    setState('scanning');
    stopRef.current = startScan({
      onFound: (device) => upsert(device),
      onError: () => setState('error'),
      onTimeout: () => setState('stopped'),
    });
  }, [reset, setState, upsert]);

  useEffect(() => {
    start();
    return () => stopRef.current?.();
  }, [start]);

  return { state, devices, error, start };
}
