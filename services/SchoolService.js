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
    const newSchool = this._newSchool(school, Date.now().toString());
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

  /**
   * Import: apply many rows with ONE read and ONE write.
   * entries: [{ id?: existing school id (update), data: school fields }]
   * Reads storage directly so a read error aborts instead of overwriting the list.
   */
  async bulkUpsert(entries) {
    const raw  = await AsyncStorage.getItem(SCHOOLS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) throw new Error('Schools data పాడైంది.');

    const updates = new Map();
    const created = [];
    const stamp   = Date.now();
    let added = 0, updated = 0;
    entries.forEach((e, idx) => {
      if (e.id && list.some(s => s.id === e.id)) {
        updates.set(e.id, e.data);
        updated++;
      } else {
        created.push(this._newSchool(e.data, `${stamp}${idx}`));
        added++;
      }
    });
    const merged = list.map(s => (updates.has(s.id) ? { ...s, ...updates.get(s.id) } : s));
    await AsyncStorage.setItem(SCHOOLS_KEY, JSON.stringify([...merged, ...created]));   // throws on failure
    return { added, updated };
  }

  _newSchool(school, id) {
    return {
      id,
      name:     school.name,
      udise:    school.udise || '',
      address:  school.address || '',
      items:    [], // each school has its own item list
      // Step 2C fields
      type:     school.type || '',
      minClass: school.minClass ?? null,
      maxClass: school.maxClass ?? null,
      roll:     school.roll && typeof school.roll === 'object' ? school.roll : {},
    };
  }

  async _save(data) {
    await AsyncStorage.setItem(SCHOOLS_KEY, JSON.stringify(data));
  }
}

export default new SchoolService();