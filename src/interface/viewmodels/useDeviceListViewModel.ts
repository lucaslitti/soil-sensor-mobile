import { useCallback } from 'react';
import { useDeviceStore } from '../stores/deviceStore';
import { dashboardManager } from './devicePresentationCoordinator';
import type { ScannedDevice } from '../../domain/ports/sensorGateway';

/** V4 MVVM 适配器：只暴露 UI DTO 与命令，不暴露 Domain Entity。 */
export function useDeviceListViewModel() {
  const deviceMap = useDeviceStore(state => state.devices);
  const devices = Object.values(deviceMap);
  const add = useCallback((device: ScannedDevice) => dashboardManager.add(device), []);
  const remove = useCallback((id: string) => dashboardManager.remove(id), []);
  const refresh = useCallback((ids: readonly string[]) => dashboardManager.refresh(ids), []);
  return { devices, add, remove, refresh };
}
