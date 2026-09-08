export interface ConnectionInfo {
  state: 'idle' | 'connecting' | 'ready' | 'reading' | 'error';
  deviceId: string | null;
  deviceName: string | null;
  error: string | null;
}

export interface HistoryPoint {
  x: number;
  timeLabel: string;
  moisture: number;
  temperature: number;
  ec: number;
}
