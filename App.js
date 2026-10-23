// App.js
import React, { useState, useEffect } from "react";
import { AppState, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import HomeScreen from "./screens/HomeScreen";
import ScanScreen from "./screens/ScanScreen";
import StockScreen from "./screens/StockScreen";
import RequirementScreen from "./screens/RequirementScreen";
import ReportsScreen from "./screens/ReportsScreen";
import YearCloseScreen from "./screens/YearCloseScreen";
import ReceiptScreen from "./screens/ReceiptScreen";
import HistoryScreen from "./screens/HistoryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import CatalogScreen from "./screens/CatalogScreen";
import SchoolScreen from "./screens/SchoolScreen";
import HelpScreen from "./screens/HelpScreen";
import FloatingTabBar from "./components/FloatingTabBar";
import WelcomeSplash from "./components/WelcomeSplash";
import DriveBackupService from "./services/DriveBackupService";
import BackupReminder from "./services/BackupReminder";
import AppLockService from "./services/AppLockService";
import LockScreen from "./components/LockScreen";
import { Colors } from "./constants/Theme";

const LOCK_AFTER_MS = 60 * 1000; // coming back from the background within this time does not ask for the PIN again (permission dialogs, share sheets, pickers)

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { paddingBottom: 80 },
      }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Receipt" component={ReceiptScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsStack} />
    </Tab.Navigator>
  );
}

// Home Stack — ScanScreen navigate చేయడానికి
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Scan" component={ScanScreen} />
      <Stack.Screen name="Stock" component={StockScreen} />
      <Stack.Screen name="Requirement" component={RequirementScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="YearClose" component={YearCloseScreen} />
      <Stack.Screen name="Schools" component={SchoolScreen} />
      <Stack.Screen name="Catalog" component={CatalogScreen} />
    </Stack.Navigator>
  );
}

// Settings Stack — App Guide (Schools & Catalog are in the Home stack, so Back returns to Home)
function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [welcome, setWelcome] = useState(true); // welcome overlay on app start (app loads behind it)
  const [lockState, setLockState] = useState("checking"); // checking | locked | open  (PIN lock)

  // PIN lock: locked at app start (if a PIN is set) and after the app was in the background for more than LOCK_AFTER_MS.
  // Backup / reminder logic below keeps running while locked. If the lock cannot be read, the app stays open (never locks the user out).
  useEffect(() => {
    AppLockService.isEnabled().then((on) => setLockState(on ? "locked" : "open")).catch(() => setLockState("open"));
    let bgAt = null;
    const sub = AppState.addEventListener("change", async (st) => {
      if (st === "background") { bgAt = Date.now(); return; }
      if (st === "active") {
        const away = bgAt ? Date.now() - bgAt : 0;
        bgAt = null;
        if (away > LOCK_AFTER_MS) {
          try { if (await AppLockService.isEnabled()) setLockState("locked"); } catch { /* stay open */ }
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Daily Drive auto-backup (after 7 PM): check on start, when app returns to foreground, and every 5 min while open
  useEffect(() => {
    DriveBackupService.getMeta().then((m) => BackupReminder.sync(m.enabled, m.lastBackupAt)); // keep the 7 PM reminder in step with the switch
    DriveBackupService.runIfDue();
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") DriveBackupService.runIfDue(); });
    const timer = setInterval(() => DriveBackupService.runIfDue(), 5 * 60 * 1000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);
  return (
    <>
      <NavigationContainer>
        <StatusBar style="light" />
        <TabNavigator />
      </NavigationContainer>
      {lockState === "locked" && <LockScreen onUnlock={() => setLockState("open")} />}
      {lockState === "checking" && <View style={styles.cover} />}
      {welcome && <WelcomeSplash onDone={() => setWelcome(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.surface, zIndex: 900, elevation: 900 },
});