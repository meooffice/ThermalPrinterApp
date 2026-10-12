// components/Hero.js
// Rounded coloured header (same look as Home / Settings). Fixed at the top of a screen:
// put it OUTSIDE the ScrollView/FlatList. The screen's SafeAreaView must not use the 'top' edge
// (the hero paints behind the status bar and applies the top inset itself).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../constants/Theme';

export default function Hero({ title, subtitle, info }) {
  return (
    <SafeAreaView style={styles.hero} edges={['top']}>
      <View style={styles.blob} />
      {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      <Text style={styles.title}>{title}</Text>
      {!!info && <Text style={styles.info}>{info}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero:  { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  blob:  { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)', top: -70, right: -50 },
  sub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2 },
  info:  { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
});