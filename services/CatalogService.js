// services/CatalogService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const CATALOG_KEY = 'item_catalog';

class CatalogService {

  async getAll() {
    try {
      const json = await AsyncStorage.getItem(CATALOG_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  async save(items) {
    try {
      await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save catalog:', error);
    }
  }

  async addItem(item) {
    const all = await this.getAll();
    const newItem = {
      id:       Date.now().toString(),
      name:     item.name,
      category: item.category || 'General',
      barcode:  item.barcode || null,
    };
    await this.save([...all, newItem]);
    return newItem;
  }

  async updateItem(id, updates) {
    const all     = await this.getAll();
    const updated = all.map(i => i.id === id ? { ...i, ...updates } : i);
    await this.save(updated);
  }

  async deleteItem(id) {
    const all     = await this.getAll();
    const updated = all.filter(i => i.id !== id);
    await this.save(updated);
  }

  async findByBarcode(barcode) {
    const all = await this.getAll();
    return all.find(i => i.barcode === barcode) || null;
  }
}

export default new CatalogService();