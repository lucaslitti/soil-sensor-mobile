import { useCallback } from 'react';
import { useDeviceStore } from '../stores/deviceStore';
import { dashboardManager } from '../../features/dashboard/data/dashboardManager';
import type { ScannedDevice } from '../../features/scanner/domain/scanState';

/** V4 MVVM 适配器：只暴露 UI DTO 与命令，不暴露 Domain Entity。 */
export function useDeviceListViewModel() {
  const devices = useDeviceStore(state => Object.values(state.devices));
  const add = useCallback((device: ScannedDevice) => dashboardManager.add(device), []);
  const remove = useCallback((id: string) => dashboardManager.remove(id), []);
  return { devices, add, remove };
}
