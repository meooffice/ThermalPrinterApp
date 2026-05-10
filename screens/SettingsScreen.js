// screens/SettingsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import SettingsService from '../services/SettingsService';

export default function SettingsScreen() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
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
        aspect: [1, 1],      // Square crop
        quality: 0.8,
      });
      if (!result.canceled) {
        update('logoUri', result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not pick image: ' + error.message);
    }
  };

  const handleRemoveLogo = () => {
    update('logoUri', null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await SettingsService.save(settings);
      Alert.alert('Saved', 'Shop settings saved successfully!');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await SettingsService.reset();
            loadSettings();
          },
        },
      ]
    );
  };

  if (!settings) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚙️ Settings</Text>
        <Text style={styles.headerSub}>Shop info used on every receipt</Text>
      </View>

      {/* Logo */}
      <Text style={styles.sectionTitle}>Shop Logo</Text>
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
                <Text style={styles.logoBtnText}>Change Logo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoBtn, styles.logoBtnDanger]}
                onPress={handleRemoveLogo}
              >
                <Text style={[styles.logoBtnText, styles.logoBtnTextDanger]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.logoPlaceholder}
            onPress={handlePickLogo}
          >
            <Text style={styles.logoPlaceholderIcon}>🖼️</Text>
            <Text style={styles.logoPlaceholderText}>Tap to add shop logo</Text>
            <Text style={styles.logoPlaceholderHint}>
              Recommended: 3:1 ratio (e.g. 300×100px)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Shop Info */}
      <Text style={styles.sectionTitle}>Shop Information</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Mandal Name</Text>
        <TextInput
          style={styles.input}
          value={settings.shopName}
          onChangeText={v => update('shopName', v)}
          placeholder="Enter mandal name"
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={settings.shopPhone}
          onChangeText={v => update('shopPhone', v)}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={settings.shopAddress}
          onChangeText={v => update('shopAddress', v)}
          placeholder="Enter shop address"
          multiline
          numberOfLines={2}
        />

        <Text style={styles.label}>Receipt Footer Message</Text>
        <TextInput
          style={styles.input}
          value={settings.shopTagline}
          onChangeText={v => update('shopTagline', v)}
          placeholder="e.g. Thank you! Visit Again."
        />
      </View>

      {/* Paper Width */}
      <Text style={styles.sectionTitle}>Printer Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Paper Width</Text>
        <View style={styles.paperWidthRow}>
          {[32, 42].map(w => (
            <TouchableOpacity
              key={w}
              style={[
                styles.paperWidthBtn,
                settings.paperWidth === w && styles.paperWidthBtnActive,
              ]}
              onPress={() => update('paperWidth', w)}
            >
              <Text style={[
                styles.paperWidthText,
                settings.paperWidth === w && styles.paperWidthTextActive,
              ]}>
                {w === 32 ? '58mm (32 chars)' : '80mm (42 chars)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Buttons */}
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

      <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
        <Text style={styles.resetBtnText}>Reset to Default</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1f2937',
  },
  headerSub: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  inputMultiline: {
    height: 64,
    textAlignVertical: 'top',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,       // Rounded square
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    alignSelf: 'center',
  },
  logoActions: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  logoBtn: {
    flex: 1,
    backgroundColor: '#ede9fe',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoBtnDanger: {
    backgroundColor: '#fee2e2',
  },
  logoBtnText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 13,
  },
  logoBtnTextDanger: {
    color: '#ef4444',
  },
  logoPlaceholder: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
  },
  logoPlaceholderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  logoPlaceholderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4f46e5',
    marginBottom: 4,
  },
  logoPlaceholderHint: {
    fontSize: 12,
    color: '#9ca3af',
  },
  paperWidthRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paperWidthBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  paperWidthBtnActive: {
    backgroundColor: '#ede9fe',
    borderColor: '#4f46e5',
  },
  paperWidthText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  paperWidthTextActive: {
    color: '#4f46e5',
  },
  saveBtn: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: {
    backgroundColor: '#a5b4fc',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  resetBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  resetBtnText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
});