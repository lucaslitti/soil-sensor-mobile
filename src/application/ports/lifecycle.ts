export type AppLifecycleState = 'active' | 'background';

export interface LifecyclePort {
  subscribeAppState(listener: (state: AppLifecycleState) => void): () => void;
  subscribeBluetooth(listener: (state: string) => void): () => void;
}
