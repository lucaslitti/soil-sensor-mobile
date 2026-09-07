export type RootStackParamList = {
  Dashboard: undefined;
  Scanner: undefined;
  SensorDetail: { deviceId: string; deviceName: string | null };
  SmartPotDetail: { deviceId: string; deviceName: string | null };
  Settings: undefined;
};