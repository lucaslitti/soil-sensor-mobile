import { ConnectionPolicy } from '../domain/services/connectionPolicy';
import { BleSensorGateway } from '../infrastructure/ble/bleSensorGateway';
import { BleSmartPotGateway } from '../infrastructure/ble/bleSmartPotGateway';
import { ConnectionPool } from '../infrastructure/pool/connectionPool';
import { DeviceCoordinator } from './services/deviceCoordinator';
import { ApplicationEventBus } from './services/domainEventBus';
import { ScanDevicesUseCase } from './usecases/scanDevices';
import { DeviceLifecycleCoordinator } from './services/deviceLifecycleCoordinator';
import { ReactNativeLifecycle } from '../infrastructure/ble/reactNativeLifecycle';
import { RecoveryCoordinator } from './coordinators/recoveryCoordinator';
import { PollingCoordinator } from './coordinators/pollingCoordinator';
import { PollingScheduler } from '../infrastructure/scheduler/pollingScheduler';
import { GlobalConcurrencyPool } from '../infrastructure/concurrency/globalConcurrencyPool';

export const applicationEvents = new ApplicationEventBus();
export const sensorGateway = new BleSensorGateway();
export const smartPotGateway = new BleSmartPotGateway();
export const connectionPolicy = new ConnectionPolicy(4, 60_000);
export const connectionPool = new ConnectionPool();
export const recoveryCoordinator = new RecoveryCoordinator();
export const pollingCoordinator = new PollingCoordinator(
  new PollingScheduler(3_000, error => {
    applicationEvents.publish({ type: 'DeviceStateChanged', deviceId: 'scheduler', state: 'failed', error: String(error) });
  }),
);
export const globalConcurrencyPool = new GlobalConcurrencyPool(2);
export const deviceCoordinator = new DeviceCoordinator(
  sensorGateway,
  smartPotGateway,
  connectionPolicy,
  connectionPool,
  applicationEvents,
  pollingCoordinator,
  globalConcurrencyPool,
  recoveryCoordinator,
);
export const scanDevicesUseCase = new ScanDevicesUseCase(sensorGateway);
export const deviceLifecycleCoordinator = new DeviceLifecycleCoordinator(
  new ReactNativeLifecycle(),
  { onBackground: 'pause', bluetoothOff: 'pause' },
  () => deviceCoordinator.pausePolling(),
  () => deviceCoordinator.resumePolling(),
  () => deviceCoordinator.destroy(),
);
