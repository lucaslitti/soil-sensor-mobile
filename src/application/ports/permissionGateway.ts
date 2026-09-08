export interface PermissionGateway {
  requestBluetooth(): Promise<boolean>;
}
