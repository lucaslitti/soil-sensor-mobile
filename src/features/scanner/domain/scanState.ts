/** 扫描域模型。 */
export interface ScannedDevice {
  /** 原生唯一键（id），非名称 */
  id: string;
  /** 名称可能延迟到达（scan response） */
  name: string | null;
  rssi: number;
  /** 是否可连接 */
  isConnectable: boolean;
}

export type ScanState = 'idle' | 'scanning' | 'stopped' | 'error';
