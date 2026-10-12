// components/FloatingTabBar.js
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// root = first screen of the tab's own stack (App.js: HomeStack, SettingsStack)
const TABS = [
  { name: 'Home',    icon: '🏠', label: 'Home',     root: 'HomeMain'     },
  { name: 'Receipt', icon: '🧾', label: 'Receipt'  },
  { name: 'History', icon: '📋', label: 'History'  },
  { name: 'Settings',icon: '⚙️', label: 'Settings', root: 'SettingsMain' },
];

export default function FloatingTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets(); // keeps the bar above the Android navigation bar / gesture area
  const handlePress = (tab, index) => {
    const nested = state.routes[index]?.state;      // the tab's stack state (exists once the tab has been opened)
    navigation.navigate(tab.name);
    // Tapping a tab always shows that tab's FIRST screen. Without this, e.g. opening Schools from Home
    // left the Settings tab stuck on Schools, so Settings (Backup, Academic Year...) could not be reached.
    if (tab.root && nested && nested.key && (nested.routes.length > 1 || nested.routes[0]?.name !== tab.root)) {
      navigation.dispatch({
        ...CommonActions.reset({ index: 0, routes: [{ name: tab.root }] }),
        target: nested.key,
      });
    }
  };

  return (
    <View style={[styles.wrapper, { bottom: 16 + insets.bottom }]}>
      <View style={styles.container}>
        {TABS.map((tab, index) => {
          const isFocused = state.index === index;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, isFocused && styles.tabActive]}
              onPress={() => handlePress(tab, index)}
              activeOpacity={0.8}
            >
              <Text style={styles.icon}>{tab.icon}</Text>
              <Text style={[
                styles.label,
                isFocused ? styles.labelActive : styles.labelInactive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position:        'absolute',
    bottom:          16,
    left:            16,
    right:           16,
    alignItems:      'center',
  },
  container: {
    flexDirection:   'row',
    backgroundColor: '#1e1b4b',
    borderRadius:    28,
    paddingVertical: 10,
    paddingHorizontal: 8,
    width:           '100%',
    justifyContent:  'space-around',
    alignItems:      'center',
    elevation:       8,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.3,
    shadowRadius:    8,
  },
  tab: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical:  6,
    paddingHorizontal: 14,
    borderRadius:    20,
    gap:              2,
  },
  tabActive: {
    backgroundColor: '#4f46e5',
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize:   9,
    fontWeight: '600',
  },
  labelActive: {
    color: '#ffffff',
  },
  labelInactive: {
    color: '#a5b4fc',
  },
});