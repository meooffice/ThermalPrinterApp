// services/ReceiptHistory.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'receipt_history';
const MAX_HISTORY = 50;

class ReceiptHistory {

  async getAll() {
    try {
      const json = await AsyncStorage.getItem(HISTORY_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  async save(receipt) {
    try {
      const all = await this.getAll();
      const entry = {
        id:        Date.now().toString(),
        savedAt:   new Date().toISOString(),
        ...receipt,
      };
      const updated = [entry, ...all].slice(0, MAX_HISTORY);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return entry;
    } catch (error) {
      console.error('Failed to save receipt:', error);
    }
  }

  async delete(id) {
    try {
      const all     = await this.getAll();
      const updated = all.filter(r => r.id !== id);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to delete receipt:', error);
    }
  }

  async clear() {
    await AsyncStorage.removeItem(HISTORY_KEY);
  }
}

export default new ReceiptHistory();