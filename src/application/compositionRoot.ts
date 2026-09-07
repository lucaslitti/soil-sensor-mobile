import { ConnectionPolicy } from '../domain/services/connectionPolicy';
import { BleSensorGateway } from '../infrastructure/ble/bleSensorGateway';
import { BleSmartPotGateway } from '../infrastructure/ble/bleSmartPotGateway';
import { ConnectionPool } from '../infrastructure/pool/connectionPool';
import { DeviceCoordinator } from './services/deviceCoordinator';
import { ApplicationEventBus } from './services/domainEventBus';
import { ScanDevicesUseCase } from './usecases/scanDevices';
import { DeviceLifecycleCoordinator } from './services/deviceLifecycleCoordinator';
import { ReactNativeLifecycle } from '../infrastructure/ble/reactNativeLifecycle';

export const applicationEvents = new ApplicationEventBus();
export const sensorGateway = new BleSensorGateway();
export const smartPotGateway = new BleSmartPotGateway();
export const connectionPolicy = new ConnectionPolicy(4, 60_000);
export const connectionPool = new ConnectionPool();
export const deviceCoordinator = new DeviceCoordinator(
  sensorGateway,
  smartPotGateway,
  connectionPolicy,
  connectionPool,
  applicationEvents,
);
export const scanDevicesUseCase = new ScanDevicesUseCase(sensorGateway);
export const deviceLifecycleCoordinator = new DeviceLifecycleCoordinator(
  new ReactNativeLifecycle(),
  { onBackground: 'pause', bluetoothOff: 'pause' },
  () => deviceCoordinator.pausePolling(),
  () => deviceCoordinator.resumePolling(),
  () => deviceCoordinator.destroy(),
);
