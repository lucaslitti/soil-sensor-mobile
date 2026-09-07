export interface BleLogPayload {
  deviceId?: string;
  protocol?: string;
  service?: string;
  characteristic?: string;
  candidate?: string;
  bytes?: number;
  hex?: string;
  base64?: string;
  error?: string;
  [key: string]: unknown;
}

function isEnabled(): boolean {
  return typeof __DEV__ === 'undefined' || __DEV__;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(' ');
}

export function logBle(event: string, payload?: BleLogPayload): void {
  if (!isEnabled()) return;
  const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
  console.log(`[BLE] ${new Date().toISOString()} ${event}${suffix}`);
}

export function logBleError(event: string, error: unknown, payload?: BleLogPayload): void {
  logBle(event, {
    ...payload,
    error: error instanceof Error ? error.message : String(error),
  });
}
