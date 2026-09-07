import { applicationEvents, deviceCoordinator } from '../../../application/compositionRoot';
import { DeviceId } from '../../../domain/value-objects/deviceId';
import type { ScannedDevice } from '../../scanner/domain/scanState';
import { useDeviceStore } from '../../../interface/stores/deviceStore';

let subscribed = false;

function ensureEventProjection(): void {
  if (subscribed) return;
  subscribed = true;
  applicationEvents.subscribe(event => {
    if (event.type === 'ReadingUpdated') {
      useDeviceStore.getState().setReading(event.deviceId, event.reading);
    } else if (event.type === 'SmartPotSnapshotUpdated') {
      useDeviceStore.getState().setSnapshot(event.deviceId, event.snapshot);
    } else if (event.type === 'DeviceStateChanged') {
      const state = event.state === 'failed' ? 'error' : event.state === 'polling' ? 'reading' : 'connecting';
      useDeviceStore.getState().setConnection(event.deviceId, state, event.error ?? null);
    }
  });
}

/** V4 Application Coordinator 的 Dashboard 适配器。 */
export const dashboardManager = {
  add(device: ScannedDevice): void {
    ensureEventProjection();
    useDeviceStore.getState().upsert({
      id: device.id,
      name: device.name ?? device.id,
      protocol: device.protocol,
      rssi: device.rssi,
    });
    deviceCoordinator.connect({
      ...device,
      id: DeviceId.create(device.id),
    }).catch(() => undefined);
  },

  remove(id: string): void {
    deviceCoordinator.release(id).catch(() => undefined).finally(() => {
      useDeviceStore.getState().remove(id);
    });
  },

  reconnect(device: ScannedDevice): void {
    deviceCoordinator.release(device.id).catch(() => undefined).finally(() => this.add(device));
  },

  destroy(): void {
    deviceCoordinator.destroy();
  },
};
