// components/SecondaryButton.js
import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, View,
} from 'react-native';
import { Colors, Radius } from '../constants/Theme';

export default function SecondaryButton({
  onPress, title, subtitle, icon, style,
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.bgCard,
    borderRadius:    Radius.lg,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     Colors.borderLight,
    elevation:       1,
  },
  icon:  { fontSize: 24 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  subtitle: { fontSize: 11, color: Colors.textHint, marginTop: 2 },
});