import type { SubRecord } from './codec';

export interface RecordV1 {
  deviceId: string;
  /** 客户端读取时刻（子记录无传感器时间字段） */
  capturedAt: number;
  subRecords: SubRecord[];
}

export interface HistoryPoint {
  x: number;
  timeLabel: string;
  moisture: number;
  temperature: number;
  ec: number;
}
