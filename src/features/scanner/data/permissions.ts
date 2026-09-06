/**
 * Android 蓝牙运行时权限：
 * - API 31+ 需 BLUETOOTH_SCAN / BLUETOOTH_CONNECT；
 * - API 30- 需定位权限用于扫描（BLE 扫描附带位置信息）。
 */
import { PermissionsAndroid, Platform } from 'react-native';

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (Number(Platform.Version) >= 31) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(granted).every(
      (status) => status === PermissionsAndroid.RESULTS.GRANTED,
    );
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}