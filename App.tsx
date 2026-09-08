import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { deviceLifecycleCoordinator } from './src/application/compositionRoot';
import { dashboardManager } from './src/interface/services/devicePresentationCoordinator';

function App() {
  React.useEffect(() => {
    dashboardManager.restore().catch(() => undefined);
    deviceLifecycleCoordinator.start();
    return () => deviceLifecycleCoordinator.stop();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;
