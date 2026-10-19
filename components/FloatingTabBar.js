// components/FloatingTabBar.js
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Theme';

// root = first screen of the tab's own stack (App.js: HomeStack, SettingsStack)
const TABS = [
  { name: 'Home',    icon: 'home-variant',          label: 'Home',     root: 'HomeMain'     },
  { name: 'Receipt', icon: 'receipt-text',          label: 'Receipt'  },
  { name: 'History', icon: 'clipboard-text-clock',  label: 'History'  },
  { name: 'Settings',icon: 'cog',                   label: 'Settings', root: 'SettingsMain' },
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
              <MaterialCommunityIcons
                name={isFocused ? tab.icon : `${tab.icon}-outline`}
                size={22}
                color={isFocused ? '#ffffff' : Colors.navInactive}
              />
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
    backgroundColor: Colors.surface,
    borderRadius:    30,
    paddingVertical: 8,
    paddingHorizontal: 8,
    width:           '100%',
    justifyContent:  'space-around',
    alignItems:      'center',
    borderWidth:     0.5,
    borderColor:     Colors.cardBorder,
    elevation:       10,
    shadowColor:     Colors.primaryDark,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.18,
    shadowRadius:    14,
  },
  tab: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical:  7,
    paddingHorizontal: 16,
    borderRadius:    22,
    gap:              2,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize:   10,
    fontWeight: '700',
  },
  labelActive: {
    color: '#ffffff',
  },
  labelInactive: {
    color: Colors.navInactive,
  },
});