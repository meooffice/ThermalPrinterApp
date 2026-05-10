// services/SchoolService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHOOLS_KEY = 'schools_list';

class SchoolService {

  async getAll() {
    try {
      const json = await AsyncStorage.getItem(SCHOOLS_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  async add(school) {
    const all = await this.getAll();
    const newSchool = {
      id:        Date.now().toString(),
      name:      school.name,
      udise:     school.udise || '',
      address:   school.address || '',
      items:     [], // each school has its own item list
    };
    await this._save([...all, newSchool]);
    return newSchool;
  }

  async update(id, updates) {
    const all     = await this.getAll();
    const updated = all.map(s => s.id === id ? { ...s, ...updates } : s);
    await this._save(updated);
  }

  async updateItems(id, items) {
    const all     = await this.getAll();
    const updated = all.map(s => s.id === id ? { ...s, items } : s);
    await this._save(updated);
  }

  async delete(id) {
    const all     = await this.getAll();
    const updated = all.filter(s => s.id !== id);
    await this._save(updated);
  }

  async _save(data) {
    await AsyncStorage.setItem(SCHOOLS_KEY, JSON.stringify(data));
  }
}

export default new SchoolService();