import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../../interface/screens/DashboardScreen';
import { ScannerScreen } from '../../interface/screens/ScannerScreen';
import { SensorDetailScreen } from '../../interface/screens/SensorDetailScreen';
import { SmartPotDetailScreen } from '../../interface/screens/SmartPotDetailScreen';
import { SettingsScreen } from '../../interface/screens/SettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Scanner" component={ScannerScreen} />
        <Stack.Screen name="SensorDetail" component={SensorDetailScreen} />
        <Stack.Screen name="SmartPotDetail" component={SmartPotDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
