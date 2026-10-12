// services/StockService.js
// Stock "Received" entries. One AsyncStorage key ('stock_entries'). Read errors are thrown, never
// turned into an empty list that a later save could overwrite.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STOCK_KEY, receivedTotals } from './StockModel';

class StockService {

  async getAll() {
    const raw = await AsyncStorage.getItem(STOCK_KEY);
    if (raw === null) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('Stock data పాడైంది.');
    return list;
  }

  async _save(list) {
    await AsyncStorage.setItem(STOCK_KEY, JSON.stringify(list));   // throws on failure
  }

  /** data: { itemId, size, qty, date, note, academicYear } */
  async add(data) {
    const all  = await this.getAll();
    const used = new Set(all.map(e => e.id));
    let id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    while (used.has(id)) id += '1';
    const entry = { id, ...data, createdAt: new Date().toISOString() };
    await this._save([...all, entry]);
    return entry;
  }

  /** Bulk add: many entries with ONE read and ONE write. list: array of { itemId, size, qty, date, note, academicYear } */
  async addMany(list) {
    if (!Array.isArray(list) || list.length === 0) return [];
    const all  = await this.getAll();
    const used = new Set(all.map(e => e.id));
    const stamp = Date.now();
    const created = list.map((data, idx) => {
      let id = `${stamp}${idx}${Math.floor(Math.random() * 1000)}`;
      while (used.has(id)) id += '1';
      used.add(id);
      return { id, ...data, createdAt: new Date().toISOString() };
    });
    await this._save([...all, ...created]);   // throws on failure
    return created;
  }

  /** The item and academic year of an entry never change; qty, size, date, note can. */
  async update(id, data) {
    const all = await this.getAll();
    if (!all.some(e => e.id === id)) throw new Error('Entry కనబడలేదు.');
    await this._save(all.map(e => (e.id === id
      ? { ...e, size: data.size, qty: data.qty, date: data.date, note: data.note, updatedAt: new Date().toISOString() }
      : e)));
  }

  async delete(id) {
    const all = await this.getAll();
    await this._save(all.filter(e => e.id !== id));
  }

  async receivedTotals(academicYear) {
    return receivedTotals(await this.getAll(), academicYear);
  }
}

export default new StockService();