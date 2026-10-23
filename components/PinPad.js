// components/PinPad.js
// 6-dot PIN entry with an on-screen keypad (no system keyboard). Calls onComplete(pin) on the 6th digit and then clears itself.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/Theme';

const LEN = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function PinPad({ title, subtitle, error, disabled, onComplete }) {
  const [pin, setPin] = useState('');

  const press = (k) => {
    if (disabled) return;
    if (k === 'del') { setPin(p => p.slice(0, -1)); return; }
    const next = pin + k;
    if (next.length < LEN) { setPin(next); return; }
    setPin('');                         // clear first; the parent decides what comes next
    onComplete(next);
  };

  return (
    <View style={styles.wrap}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      <View style={styles.dots}>
        {Array.from({ length: LEN }).map((_, i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotOn, !!error && styles.dotErr]} />
        ))}
      </View>
      <Text style={styles.error}>{error || ' '}</Text>
      <View style={styles.pad}>
        {KEYS.map((k, i) => (
          k === '' ? <View key={i} style={styles.key} /> : (
            <TouchableOpacity key={i} style={[styles.key, styles.keyBtn, disabled && { opacity: 0.4 }]} onPress={() => press(k)} activeOpacity={0.6} disabled={disabled}>
              {k === 'del'
                ? <MaterialCommunityIcons name="backspace-outline" size={26} color={Colors.textSecondary} />
                : <Text style={styles.keyText}>{k}</Text>}
            </TouchableOpacity>
          )
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center', alignSelf: 'stretch' },
  title:  { fontSize: 18, fontWeight: '800', color: Colors.primaryDark, textAlign: 'center' },
  sub:    { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  dots:   { flexDirection: 'row', gap: 14, marginTop: Spacing.lg },
  dot:    { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.primary, backgroundColor: 'transparent' },
  dotOn:  { backgroundColor: Colors.primary },
  dotErr: { borderColor: Colors.danger },
  error:  { fontSize: 12, color: Colors.danger, marginTop: Spacing.sm, minHeight: 18, textAlign: 'center' },
  pad:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 260, marginTop: Spacing.sm },
  key:    { width: 80, height: 70, alignItems: 'center', justifyContent: 'center' },
  keyBtn: { borderRadius: 40 },
  keyText:{ fontSize: 28, fontWeight: '600', color: Colors.textPrimary },
});