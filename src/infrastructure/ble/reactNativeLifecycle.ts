import { AppState } from 'react-native';
import type { AppLifecycleState, LifecyclePort } from '../../application/ports/lifecycle';

/** Native 生命周期适配器；BLE 状态由具体 BleManager 适配器注入。 */
export class ReactNativeLifecycle implements LifecyclePort {
  subscribeAppState(listener: (state: AppLifecycleState) => void): () => void {
    const subscription = AppState.addEventListener('change', state => {
      listener(state === 'active' ? 'active' : 'background');
    });
    return () => subscription.remove();
  }

  subscribeBluetooth(_listener: (state: string) => void): () => void {
    return () => undefined;
  }
}
