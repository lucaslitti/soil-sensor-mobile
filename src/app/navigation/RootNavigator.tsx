import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScannerScreen } from '../../features/scanner/ui/ScannerScreen';
import { SensorDetailScreen } from '../../features/sensor/ui/SensorDetailScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Scanner" component={ScannerScreen} />
        <Stack.Screen name="SensorDetail" component={SensorDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
