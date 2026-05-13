// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';


import HomeScreen     from './screens/HomeScreen';
import ScanScreen     from './screens/ScanScreen';
import ReceiptScreen  from './screens/ReceiptScreen';
import HistoryScreen  from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import CatalogScreen  from './screens/CatalogScreen';
import SchoolScreen   from './screens/SchoolScreen';
import FloatingTabBar from './components/FloatingTabBar';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
      sceneContainerStyle={{ paddingBottom: 80 }}
    >
      <Tab.Screen name="Home"     component={HomeStack}    />
      <Tab.Screen name="Receipt"  component={ReceiptScreen} />
      <Tab.Screen name="History"  component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsStack} />
    </Tab.Navigator>
  );
}

// Home Stack — ScanScreen navigate చేయడానికి
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen}  />
      <Stack.Screen name="Scan"     component={ScanScreen}  />
    </Stack.Navigator>
  );
}

// Settings Stack — Schools & Catalog navigate చేయడానికి
function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="Schools"      component={SchoolScreen}   />
      <Stack.Screen name="Catalog"      component={CatalogScreen}  />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <TabNavigator />
    </NavigationContainer>
  );
}