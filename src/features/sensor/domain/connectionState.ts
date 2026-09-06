/** 连接状态机。 */
export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'discovering'
  | 'ready'
  | 'reading'
  | 'error';

export interface ConnectionInfo {
  state: ConnectionState;
  deviceId: string | null;
  deviceName: string | null;
  error: string | null;
}

export const INITIAL_CONNECTION: ConnectionInfo = {
  state: 'idle',
  deviceId: null,
  deviceName: null,
  error: null,
};
