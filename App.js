// App.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Text } from "react-native";
import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { setupNotifications, silentPrint } from './services/PrintService';

import HomeScreen from "./screens/HomeScreen";
import ScanScreen from "./screens/ScanScreen";
import ReceiptScreen from "./screens/ReceiptScreen";
import HistoryScreen from "./screens/HistoryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import CatalogScreen from "./screens/CatalogScreen";
import SchoolScreen from "./screens/SchoolScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Bottom Tab Navigator ───────────────────────────────
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4f46e5",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e5e7eb",
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarLabel: "Connect",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🔍</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Receipt"
        component={ReceiptScreen}
        options={{
          tabBarLabel: "Receipt",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🧾</Text>
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: "History",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📋</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⚙️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{
          tabBarLabel: "Catalog",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Schools"
        component={SchoolScreen}
        options={{
          tabBarLabel: "Schools",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏫</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root Stack (allows HomeScreen to push to Scan/Receipt) ─
export default function App() {
  useEffect(() => {
    // Setup notifications
    setupNotifications();

    // Request notification permissions
    Notifications.requestPermissionsAsync();

    // Handle incoming intents
    const handleURL = async (event) => {
      const url = event.url;
      if (url && url.startsWith('tprint://print')) {
        const jsonStr = decodeURIComponent(url.replace('tprint://print?data=', ''));
        await silentPrint(jsonStr);
      }
    };

    // Handle intent when app is open
    const subscription = Linking.addEventListener('url', handleURL);

    // Handle intent when app starts from intent
    Linking.getInitialURL().then(async (url) => {
      if (url && url.startsWith('tprint://print')) {
        const jsonStr = decodeURIComponent(url.replace('tprint://print?data=', ''));
        await silentPrint(jsonStr);
      }
    });

    return () => subscription?.remove();
  }, []);
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
