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
deviceManager.bind({
  connect: device => deviceCoordinator.connect(device),
  disconnect: id => deviceCoordinator.release(id),
  refresh: id => deviceCoordinator.refresh(id),
  readHistory: (id, level, token) => deviceCoordinator.readHistory(id, level, token),
  writeSmartPot: (id, command) => deviceCoordinator.writeSmartPot(id, command),
  startPolling: id => deviceCoordinator.startPolling(id),
  stopPolling: id => deviceCoordinator.stopPolling(id),
});
export const connectDeviceUseCase = new ConnectDeviceUseCase(deviceManager);
export const disconnectDeviceUseCase = new DisconnectDeviceUseCase(deviceManager);
export const readHistoryUseCase = new ReadHistoryUseCase(deviceManager);
export const readLiveUseCase = new ReadLiveUseCase(deviceManager);
export const controlSmartPotUseCase = new ControlSmartPotUseCase(deviceManager);
export const startPollingUseCase = new StartPollingUseCase(id => deviceManager.startPolling(id));
export const stopPollingUseCase = new StopPollingUseCase(id => deviceManager.stopPolling(id));
export const releaseDeviceUseCase = new ReleaseDeviceUseCase(deviceManager);
export const scanDevicesUseCase = new ScanDevicesUseCase(sensorGateway, new ReactNativePermissionGateway());
export const deviceLifecycleCoordinator = new LifecycleCoordinator(
  new ReactNativeLifecycle(),
  { onBackground: 'pause', bluetoothOff: 'pause' },
  () => deviceCoordinator.pausePolling(),
  () => deviceCoordinator.resumePolling(),
  () => deviceCoordinator.destroy(),
);
