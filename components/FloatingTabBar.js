// components/FloatingTabBar.js
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform
} from 'react-native';

const TABS = [
  { name: 'Home',    icon: '🏠', label: 'Home'    },
  { name: 'Receipt', icon: '🧾', label: 'Receipt' },
  { name: 'History', icon: '📋', label: 'History' },
  { name: 'Settings',icon: '⚙️', label: 'Settings'},
];

export default function FloatingTabBar({ state, navigation }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {TABS.map((tab, index) => {
          const isFocused = state.index === index;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, isFocused && styles.tabActive]}
              onPress={() => navigation.navigate(tab.name)}
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