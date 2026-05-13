// components/ui.js — Shared T-Print UI Components
// Install: expo-status-bar, @react-navigation/bottom-tabs (or use Expo Router)

import React from 'react';
import {
  View,
  Text,
  TouchableNativeFeedback,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../Themes';

// ─── StatusBar color helper ───────────────────────────────────────────────────
// In your App.tsx or layout, set:
//   <StatusBar backgroundColor={Colors.statusBar} barStyle="light-content" />

// ─── Screen Header ────────────────────────────────────────────────────────────
export function ScreenHeader({ title, subtitle }) {
  return (
    <View style={styles.header}>
      {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

// ─── Primary Button ───────────────────────────────────────────────────────────
export function AppButton({ label, onPress, variant = 'primary' }) {
  const btnStyle =
    variant === 'primary'
      ? styles.btnPrimary
      : variant === 'outline'
      ? styles.btnOutline
      : styles.btnGhost;
  const txtStyle =
    variant === 'primary'
      ? styles.btnPrimaryText
      : variant === 'outline'
      ? styles.btnOutlineText
      : styles.btnGhostText;

  return (
    <TouchableNativeFeedback onPress={onPress} background={TouchableNativeFeedback.Ripple('#c7d2fe', false)}>
      <View style={[styles.btnBase, btnStyle]}>
        <Text style={txtStyle}>{label}</Text>
      </View>
    </TouchableNativeFeedback>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Settings Row ─────────────────────────────────────────────────────────────
export function SettingsRow({ label, icon, onPress, isLast }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingsRow, !isLast && styles.settingsRowBorder]}>
        <View style={styles.settingsLeft}>
          {icon && <View style={styles.settingsIconBox}>{icon}</View>}
          <Text style={styles.settingsLabel}>{label}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
export function Stepper({ value, onChange, min = 1 }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={() => onChange(Math.max(min, value - 1))}
        activeOpacity={0.7}
      >
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepVal}>{value}</Text>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={() => onChange(value + 1)}
        activeOpacity={0.7}
      >
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Connected Chip ───────────────────────────────────────────────────────────
export function ConnectedChip({ label }) {
  return (
    <View style={styles.connectedChip}>
      <View style={styles.connectedDot} />
      <Text style={styles.connectedText}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? Spacing.lg : Spacing.xl,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  headerSub: { ...Typography.headerSub, marginBottom: 2 },
  headerTitle: { ...Typography.headerTitle },

  // Buttons
  btnBase: {
    borderRadius: Radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnOutline: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#c7d2fe' },
  btnGhost: { backgroundColor: '#f9fafb' },
  btnPrimaryText: { color: Colors.primaryText, fontSize: 13, fontWeight: '600' },
  btnOutlineText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },
  btnGhostText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },

  // Settings
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  settingsRowBorder: { borderBottomWidth: 0.5, borderColor: '#f3f4f6' },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingsIconBox: {
    width: 28,
    height: 28,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chevron: { fontSize: 18, color: Colors.textMuted },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: {
    width: 26,
    height: 26,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '700', lineHeight: 20 },
  stepVal: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, minWidth: 20, textAlign: 'center' },

  // Connected chip
  connectedChip: {
    backgroundColor: Colors.successBg,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
  },
  connectedDot: { width: 8, height: 8, backgroundColor: Colors.success, borderRadius: 4 },
  connectedText: { fontSize: 12, color: Colors.successText, fontWeight: '500' },
});