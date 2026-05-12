// screens/SettingsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Image, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import SettingsService from '../services/SettingsService';

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving]     = useState(false);

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

  if (!settings) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Manage your app</Text>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 26 }}>⚙️</Text>
          </View>
        </View>

        {/* Logo */}
        <Text style={styles.sectionTitle}>Mandal Logo</Text>
        <View style={styles.card}>
          {settings.logoUri ? (
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: settings.logoUri }}
                style={styles.logoPreview}
                resizeMode="contain"
              />
              <View style={styles.logoActions}>
                <TouchableOpacity
                  style={styles.logoBtn}
                  onPress={handlePickLogo}
                >
                  <Text style={styles.logoBtnText}>✏️ Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoBtn, styles.logoBtnDanger]}
                  onPress={() => update('logoUri', null)}
                >
                  <Text style={[styles.logoBtnText, { color: '#ef4444' }]}>🗑️ Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.logoPlaceholder}
              onPress={handlePickLogo}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🖼️</Text>
              <Text style={styles.logoPlaceholderText}>Tap to add logo</Text>
              <Text style={styles.logoPlaceholderHint}>Square image recommended</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Shop Info */}
        <Text style={styles.sectionTitle}>Mandal Information</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Mandal Name</Text>
          <TextInput
            style={styles.input}
            value={settings.shopName}
            onChangeText={v => update('shopName', v)}
            placeholder="e.g. Rajanagaram"
          />
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={settings.shopPhone}
            onChangeText={v => update('shopPhone', v)}
            placeholder="9999999999"
            keyboardType="phone-pad"
          />
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
            value={settings.shopAddress}
            onChangeText={v => update('shopAddress', v)}
            placeholder="Mandal, District"
            multiline
          />
          <Text style={styles.label}>Receipt Footer</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            value={settings.shopTagline}
            onChangeText={v => update('shopTagline', v)}
            placeholder="Thank you! Visit Again."
          />
        </View>

        {/* Paper Width */}
        <Text style={styles.sectionTitle}>Printer Settings</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Paper Width</Text>
          <View style={styles.pillRow}>
            {[
              { value: 32, label: '58mm · 32 chars' },
              { value: 42, label: '80mm · 42 chars' },
            ].map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.pill,
                  settings.paperWidth === item.value && styles.pillActive,
                ]}
                onPress={() => update('paperWidth', item.value)}
              >
                <Text style={[
                  styles.pillText,
                  settings.paperWidth === item.value && styles.pillTextActive,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Manage Section */}
        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Schools')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#ede9fe' }]}>
                <Text style={{ fontSize: 18 }}>🏫</Text>
              </View>
              <View>
                <Text style={styles.menuTitle}>Schools</Text>
                <Text style={styles.menuSub}>Add & manage school list</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Catalog')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
                <Text style={{ fontSize: 18 }}>📦</Text>
              </View>
              <View>
                <Text style={styles.menuTitle}>Item Catalog</Text>
                <Text style={styles.menuSub}>Kit items manage చేయండి</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>💾  Save Settings</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    height: 'auto',
    backgroundColor: '#f5f5f5',
  },
  container: { flex: 1 },
  content: {
    padding:     20,
    paddingTop:  52,
    paddingBottom: 20,
  },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   24,
  },
  headerSub: {
    fontSize: 12, color: '#6b7280', marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28, fontWeight: '800', color: '#1e1b4b',
  },
  headerIcon: {
    width: 52, height: 52,
    backgroundColor: '#ede9fe',
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#6b7280',
    marginTop: 16, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
    borderWidth: 0.5,
    borderColor: '#f0f0f0',
  },
  label: {
    fontSize: 12, fontWeight: '600', color: '#6b7280',
    marginBottom: 6, marginTop: 4,
  },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, padding: 10,
    fontSize: 14, color: '#111827',
    marginBottom: 12, backgroundColor: '#f9fafb',
  },
  logoContainer: { alignItems: 'center' },
  logoPreview: {
    width: 100, height: 100,
    borderRadius: 12, marginBottom: 12,
    backgroundColor: '#f3f4f6',
  },
  logoActions: { flexDirection: 'row', gap: 8, width: '100%' },
  logoBtn: {
    flex: 1, backgroundColor: '#f3f4f6',
    padding: 10, borderRadius: 10, alignItems: 'center',
  },
  logoBtnDanger: { backgroundColor: '#fee2e2' },
  logoBtnText: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  logoPlaceholder: {
    borderWidth: 2, borderColor: '#e5e7eb',
    borderStyle: 'dashed', borderRadius: 12,
    padding: 24, alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: 14, fontWeight: '600', color: '#4f46e5', marginBottom: 4,
  },
  logoPlaceholderHint: { fontSize: 11, color: '#9ca3af' },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1, padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
    alignItems: 'center', backgroundColor: '#f9fafb',
  },
  pillActive: { backgroundColor: '#ede9fe', borderColor: '#4f46e5' },
  pillText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  pillTextActive: { color: '#4f46e5' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 8,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  menuTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  menuSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  menuArrow: { fontSize: 22, color: '#d1d5db' },
  menuDivider: {
    height: 0.5, backgroundColor: '#f3f4f6', marginVertical: 4,
  },
  saveBtn: {
    backgroundColor: '#4f46e5', padding: 16,
    borderRadius: 16, alignItems: 'center', marginTop: 16,
    elevation: 2,
  },
  saveBtnDisabled: { backgroundColor: '#a5b4fc' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});