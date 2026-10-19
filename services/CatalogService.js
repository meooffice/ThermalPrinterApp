// services/CatalogService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import MigrationService from './MigrationService';
import { rowsToItems } from './ItemModel';
import { DEFAULT_ITEM_ROWS } from '../constants/DefaultItems';

const CATALOG_KEY = 'item_catalog';

// Same column order as the Items Excel template (constants/DefaultItems.js)
const DEFAULT_HEADERS = ['Code', 'Name', 'Type', 'SubType', 'ClassFrom', 'ClassTo', 'Semester', 'Sizes', 'Barcode',
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12'];

// Default Item Catalog = DEFAULT_ITEM_ROWS, converted by the same rules as an Excel import.
// Ids are fixed (def-<code>) so a later Excel import with the same Codes updates these items instead of duplicating them.
function buildDefaultCatalog() {
  const raw = DEFAULT_ITEM_ROWS.map(r => {
    const o = {};
    DEFAULT_HEADERS.forEach((h, i) => { o[h] = r[i] ?? ''; });
    return o;
  });
  const types = [...new Set(DEFAULT_ITEM_ROWS.map(r => r[2]))];
  return rowsToItems(raw, types, [])
    .filter(x => x.status === 'new')
    .map(x => ({
      id:         `def-${x.data.code}`,
      name:       x.data.name,
      category:   x.data.category,
      barcode:    x.data.barcode || null,
      code:       x.data.code,
      subType:    x.data.subType,
      classFrom:  x.data.classFrom ?? null,
      classTo:    x.data.classTo ?? null,
      semester:   x.data.semester ?? null,
      sizes:      x.data.sizes,
      perStudent: x.data.perStudent,
    }));
}

class CatalogService {

  async getAll() {
    try {
      await MigrationService.run();
      const json = await AsyncStorage.getItem(CATALOG_KEY);
      if (json === null) return await this._seedDefaults();     // first run only (an emptied catalog is stored as [], not null)
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  // First run: store the default catalog. Never overwrites an existing catalog.
  async _seedDefaults() {
    const again = await AsyncStorage.getItem(CATALOG_KEY);
    if (again !== null) return again ? JSON.parse(again) : [];
    const list = buildDefaultCatalog();
    try { await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(list)); } catch { /* shown anyway, retried next time */ }
    return list;
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
      id:         Date.now().toString(),
      name:       item.name,
      category:   item.category || 'General',
      barcode:    item.barcode || null,
      // Step 2B fields (defaults keep imports and old callers working)
      code:       item.code || '',
      subType:    item.subType || 'Common',
      classFrom:  item.classFrom ?? null,
      classTo:    item.classTo ?? null,
      semester:   item.semester ?? null,
      sizes:      Array.isArray(item.sizes) ? item.sizes : [],
      perStudent: item.perStudent && typeof item.perStudent === 'object' ? item.perStudent : {},
    };
    await this.save([...all, newItem]);
    return newItem;
  }

  /**
   * Import: apply many rows with ONE read and ONE write.
   * entries: [{ id?: existing item id (update), data: item fields }]
   * Reads storage directly so a read error aborts instead of overwriting the catalog.
   */
  async bulkUpsert(entries) {
    await MigrationService.run();
    const raw  = await AsyncStorage.getItem(CATALOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) throw new Error('Catalog data పాడైంది.');

    const updates = new Map();
    const created = [];
    const stamp   = Date.now();
    let added = 0, updated = 0;
    entries.forEach((e, idx) => {
      if (e.id && list.some(i => i.id === e.id)) {
        updates.set(e.id, e.data);
        updated++;
      } else {
        created.push({
          id:         `${stamp}${idx}`,
          name:       e.data.name,
          category:   e.data.category || 'Others',
          barcode:    e.data.barcode || null,
          code:       e.data.code || '',
          subType:    e.data.subType || 'Common',
          classFrom:  e.data.classFrom ?? null,
          classTo:    e.data.classTo ?? null,
          semester:   e.data.semester ?? null,
          sizes:      Array.isArray(e.data.sizes) ? e.data.sizes : [],
          perStudent: e.data.perStudent && typeof e.data.perStudent === 'object' ? e.data.perStudent : {},
        });
        added++;
      }
    });
    const merged = list.map(i => (updates.has(i.id) ? { ...i, ...updates.get(i.id) } : i));
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify([...merged, ...created]));   // throws on failure
    return { added, updated };
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