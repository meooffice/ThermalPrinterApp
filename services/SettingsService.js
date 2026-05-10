// services/SettingsService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'shop_settings';

const DEFAULT_SETTINGS = {
  shopName:    'Kotananduru',
  shopPhone:   '9999999999',
  shopAddress: 'Kakinada, AP',
  shopTagline: 'Check your items now',
  logoUri:     null,
  paperWidth:  32, // characters per line for 58mm
};

class SettingsService {

  async get() {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      return json ? { ...DEFAULT_SETTINGS, ...JSON.parse(json) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
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