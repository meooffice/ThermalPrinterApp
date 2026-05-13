// screens/SettingsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Image, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import SettingsService from '../services/SettingsService';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { ScreenHeader, Card, SettingsRow } from '../components/Ui';

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => { loadSettings(); }, [])
  );

  const loadSettings = async () => {
    const s = await SettingsService.get();
    setSettings(s);
  };

  const update = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handlePickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) {
        update('logoUri', result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await SettingsService.save(settings);
      Alert.alert('✅ Saved', 'Settings saved successfully!');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (!settings) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Settings" subtitle="Manage your app" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── ui.js → ScreenHeader ── */}
      <ScreenHeader title="Settings" subtitle="Manage your app" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Mandal Logo ── ui.js → Card ── */}
        <Text style={styles.sectionTitle}>🖼️  Mandal Logo</Text>
        <Card>
          {settings.logoUri ? (
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: settings.logoUri }}
                style={styles.logoPreview}
                resizeMode="contain"
              />
              <View style={styles.logoActions}>
                <TouchableOpacity style={styles.logoBtn} onPress={handlePickLogo}>
                  <Text style={styles.logoBtnIcon}>✏️</Text>
                  <Text style={styles.logoBtnText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoBtn, styles.logoBtnDanger]}
                  onPress={() => update('logoUri', null)}
                >
                  <Text style={styles.logoBtnIcon}>🗑️</Text>
                  <Text style={[styles.logoBtnText, { color: Colors.danger }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.logoPlaceholder} onPress={handlePickLogo}>
              <Text style={styles.logoPlaceholderEmoji}>🖼️</Text>
              <Text style={styles.logoPlaceholderText}>Tap to add logo</Text>
              <Text style={styles.logoPlaceholderHint}>Square image recommended</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* ── Mandal Info ── ui.js → Card ── */}
        <Text style={styles.sectionTitle}>🏢  Mandal Information</Text>
        <Card>
          <Text style={styles.inputLabel}>Mandal Name</Text>
          <TextInput
            style={styles.input}
            value={settings.shopName}
            onChangeText={v => update('shopName', v)}
            placeholder="e.g. Rajanagaram"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={settings.shopPhone}
            onChangeText={v => update('shopPhone', v)}
            placeholder="9999999999"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
          />
          <Text style={styles.inputLabel}>Address</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={settings.shopAddress}
            onChangeText={v => update('shopAddress', v)}
            placeholder="Mandal, District"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <Text style={styles.inputLabel}>Receipt Footer</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            value={settings.shopTagline}
            onChangeText={v => update('shopTagline', v)}
            placeholder="Thank you! Visit Again."
            placeholderTextColor={Colors.textMuted}
          />
        </Card>

        {/* ── Printer Settings ── ui.js → Card ── */}
        <Text style={styles.sectionTitle}>🖨️  Printer Settings</Text>
        <Card>
          <Text style={styles.inputLabel}>Paper Width</Text>
          <View style={styles.pillRow}>
            {[
              { value: 32, label: '58mm', sub: '32 chars' },
              { value: 42, label: '80mm', sub: '42 chars' },
            ].map(item => (
              <TouchableOpacity
                key={item.value}
                style={[styles.pill, settings.paperWidth === item.value && styles.pillActive]}
                onPress={() => update('paperWidth', item.value)}
              >
                <Text style={[styles.pillLabel, settings.paperWidth === item.value && styles.pillLabelActive]}>
                  {item.label}
                </Text>
                <Text style={[styles.pillSub, settings.paperWidth === item.value && styles.pillSubActive]}>
                  {item.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* ── Manage ── ui.js → Card + SettingsRow ── */}
        <Text style={styles.sectionTitle}>⚙️  Manage</Text>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            label="Schools"
            icon={<Text style={{ fontSize: 16 }}>🏫</Text>}
            onPress={() => navigation.navigate('Schools')}
          />
          <SettingsRow
            label="Item Catalog"
            icon={<Text style={{ fontSize: 16 }}>📦</Text>}
            onPress={() => navigation.navigate('Catalog')}
            isLast
          />
        </Card>

        {/* ── Save Button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.primaryText} />
          ) : (
            <>
              <Text style={styles.saveBtnIcon}>💾</Text>
              <Text style={styles.saveBtnText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: { flex: 1 },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Section title — theme → Typography.label
  sectionTitle: {
    ...Typography.label,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },

  // Logo
  logoContainer: { alignItems: 'center', gap: Spacing.md },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
  },
  logoActions: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  logoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  logoBtnDanger: { backgroundColor: Colors.dangerBg, borderColor: '#fca5a5' },
  logoBtnIcon: { fontSize: 14 },
  logoBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  logoPlaceholder: {
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logoPlaceholderEmoji: { fontSize: 32 },
  logoPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  logoPlaceholderHint: {
    ...Typography.bodySm,
  },

  // Input — theme → Colors
  inputLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  inputMultiline: {
    height: 64,
    textAlignVertical: 'top',
  },

  // Pills
  pillRow: { flexDirection: 'row', gap: Spacing.sm },
  pill: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  pillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  pillLabelActive: { color: Colors.primary },
  pillSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pillSubActive: { color: Colors.primary },

  // Save button
  saveBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    marginTop: Spacing.sm,
    elevation: 2,
  },
  saveBtnDisabled: { backgroundColor: '#a5b4fc' },
  saveBtnIcon: { fontSize: 16 },
  saveBtnText: {
    color: Colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
});