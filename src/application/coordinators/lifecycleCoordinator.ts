import type { LifecyclePort, AppLifecycleState } from '../ports/lifecycle';

export interface LifecyclePolicy {
  onBackground: 'pause' | 'continue';
  bluetoothOff: 'pause' | 'disconnect';
}

export class LifecycleCoordinator {
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly lifecycle: LifecyclePort,
    private readonly policy: LifecyclePolicy,
    private readonly pause: () => void,
    private readonly resume: () => void,
    private readonly disconnect: () => void,
  ) {}

  start(): void {
    this.cleanups.push(this.lifecycle.subscribeAppState(this.onAppState));
    this.cleanups.push(this.lifecycle.subscribeBluetooth(this.onBluetoothState));
  }

  stop(): void {
    while (this.cleanups.length) this.cleanups.pop()!();
  }

  private readonly onAppState = (state: AppLifecycleState): void => {
    if (state === 'background' && this.policy.onBackground === 'pause') this.pause();
    if (state === 'active') this.resume();
  };

  private readonly onBluetoothState = (state: string): void => {
    if (state.toLowerCase() === 'off' && this.policy.bluetoothOff === 'pause') this.pause();
    if (state.toLowerCase() === 'off' && this.policy.bluetoothOff === 'disconnect') this.disconnect();
    if (state.toLowerCase() === 'on') this.resume();
  };
}
