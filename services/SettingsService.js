// services/SettingsService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentAcademicYear, isValidAcademicYear } from './AcademicYear';

const SETTINGS_KEY = 'shop_settings';

const DEFAULT_SETTINGS = {
  shopName:    'Kotananduru',
  shopPhone:   '9999999999',
  shopAddress: 'Kakinada, AP',
  shopTagline: 'Check your items now',
  logoUri:     null,
  paperWidth:  32, // characters per line for 58mm
  academicYear: currentAcademicYear(),   // April–March, e.g. '2026-27'
};

class SettingsService {

  async get() {
    try {
      const json   = await AsyncStorage.getItem(SETTINGS_KEY);
      const stored = json ? JSON.parse(json) : null;
      if (!stored || !isValidAcademicYear(stored.academicYear)) {
        // Save the academic year ONCE, so it never changes silently when April comes.
        const academicYear = currentAcademicYear();
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...(stored || {}), academicYear }));
        return { ...DEFAULT_SETTINGS, ...(stored || {}), academicYear };
      }
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async save(settings) {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  async reset() {
    await AsyncStorage.removeItem(SETTINGS_KEY);
  }
}

export default new SettingsService();