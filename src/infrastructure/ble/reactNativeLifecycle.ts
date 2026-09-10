import { AppState } from 'react-native';
import { bleManager } from './bleTransport';
import type { AppLifecycleState, LifecyclePort } from '../../application/ports/lifecycle';

/** Native lifecycle adapter for AppState and react-native-ble-plx state changes. */
export class ReactNativeLifecycle implements LifecyclePort {
  subscribeAppState(listener: (state: AppLifecycleState) => void): () => void {
    const subscription = AppState.addEventListener('change', state => {
      listener(state === 'active' ? 'active' : 'background');
    });
    return () => subscription.remove();
  }

  subscribeBluetooth(listener: (state: string) => void): () => void {
    const subscription = bleManager.onStateChange(state => {
      listener(state === 'PoweredOn' ? 'on' : 'off');
    }, true);
    return () => subscription.remove();
  }
}
