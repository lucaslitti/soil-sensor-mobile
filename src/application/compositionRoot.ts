import { ConnectionPolicy } from '../domain/services/connectionPolicy';
import { BleSensorGateway } from '../infrastructure/ble/bleSensorGateway';
import { BleSmartPotGateway } from '../infrastructure/ble/bleSmartPotGateway';
import { ConnectionPool } from '../infrastructure/pool/connectionPool';
import { DeviceCoordinator } from './services/deviceCoordinator';
import { ApplicationEventBus } from './services/domainEventBus';
import { ScanDevicesUseCase } from './usecases/scanDevices';
import { LifecycleCoordinator } from './coordinators/lifecycleCoordinator';
import { ReactNativeLifecycle } from '../infrastructure/ble/reactNativeLifecycle';
import { RecoveryCoordinator } from './coordinators/recoveryCoordinator';
import { PollingCoordinator } from './coordinators/pollingCoordinator';
import { PollingScheduler } from '../infrastructure/scheduler/pollingScheduler';
import { GlobalConcurrencyPool } from '../infrastructure/concurrency/globalConcurrencyPool';
import { ConnectDeviceUseCase } from './usecases/connectDevice';
import { DisconnectDeviceUseCase } from './usecases/disconnectDevice';
import { ReadHistoryUseCase } from './usecases/readHistory';
import { ReadLiveUseCase } from './usecases/readLive';
import { ControlSmartPotUseCase } from './usecases/controlSmartPot';
import { DeviceManager } from './runtime/deviceManager';
import { SqliteReadingRepository } from '../infrastructure/storage/sqlite/sqliteReadingRepository';
import { StartPollingUseCase } from './usecases/startPolling';
import { StopPollingUseCase } from './usecases/stopPolling';
import { ReleaseDeviceUseCase } from './usecases/releaseDevice';
import { OperationLogger } from '../infrastructure/observability/logger';
import { ReactNativePermissionGateway } from '../infrastructure/ble/permissions';
import {
  loadDashboardDevices,
  saveDashboardDevices,
} from '../infrastructure/storage/dashboardDeviceStorage';

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
export const deviceManager = new DeviceManager(new OperationLogger());
export const readingRepository = new SqliteReadingRepository();
export const dashboardDeviceStorage = {
  load: loadDashboardDevices,
  save: saveDashboardDevices,
};
export const deviceCoordinator = new DeviceCoordinator(
  sensorGateway,
  smartPotGateway,
  connectionPolicy,
  connectionPool,
  applicationEvents,
  pollingCoordinator,
  globalConcurrencyPool,
  deviceManager,
  readingRepository,
  recoveryCoordinator,
);
export const connectDeviceUseCase = new ConnectDeviceUseCase(deviceCoordinator);
export const disconnectDeviceUseCase = new DisconnectDeviceUseCase(deviceCoordinator);
export const readHistoryUseCase = new ReadHistoryUseCase(deviceCoordinator);
export const readLiveUseCase = new ReadLiveUseCase(deviceCoordinator);
export const controlSmartPotUseCase = new ControlSmartPotUseCase(deviceCoordinator);
export const startPollingUseCase = new StartPollingUseCase(id => deviceCoordinator.startPolling(id));
export const stopPollingUseCase = new StopPollingUseCase(id => deviceCoordinator.stopPolling(id));
export const releaseDeviceUseCase = new ReleaseDeviceUseCase(deviceCoordinator);
export const scanDevicesUseCase = new ScanDevicesUseCase(sensorGateway, new ReactNativePermissionGateway());
export const deviceLifecycleCoordinator = new LifecycleCoordinator(
  new ReactNativeLifecycle(),
  { onBackground: 'pause', bluetoothOff: 'pause' },
  () => deviceCoordinator.pausePolling(),
  () => deviceCoordinator.resumePolling(),
  () => deviceCoordinator.destroy(),
);
