// components/PrimaryButton.js
import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, View,
} from 'react-native';
import { Colors, Radius, Shadow } from '../constants/Theme';

export default function PrimaryButton({
  onPress, title, subtitle, icon,
  loading, disabled, style,
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.primary,
    borderRadius:    Radius.lg,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    marginBottom:    10,
    ...Shadow.card,
  },
  disabled: {
    backgroundColor: Colors.primaryMid,
  },
  icon:  { fontSize: 24 },
  title: { fontSize: 15, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 11, color: '#c7d2fe', marginTop: 2 },
});