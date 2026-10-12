// services/ItemTypeService.js
// Dynamic Item Types. Stored under a NEW key 'item_types' (existing keys untouched).
import AsyncStorage from '@react-native-async-storage/async-storage';
import CatalogService from './CatalogService';
import MigrationService from './MigrationService';

const TYPES_KEY     = 'item_types';
const FALLBACK_TYPE = 'Others';   // cannot be deleted; used when an import row has an unknown type

// First-run list. (Boys/Girls Shoes are merged into "Shoes" + SubType by MigrationService, Step 2B.)
export const DEFAULT_TYPES = [
  'Prime Textbook', 'HS Text Books', 'Notebooks', 'Kits',
  'Shoes', 'Others',
];

class ItemTypeService {

  async getAll() {
    let raw = null;
    try {
      await MigrationService.run();
      raw = await AsyncStorage.getItem(TYPES_KEY);
    } catch {
      return [...DEFAULT_TYPES];                       // read error: do NOT write anything
    }
    if (raw === null) {                                // first run: seed defaults
      try { await this._save([...DEFAULT_TYPES]); } catch { /* ignore, retry next time */ }
      return [...DEFAULT_TYPES];
    }
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0 && list.every(t => typeof t === 'string')) return list;
    } catch { /* fall through */ }
    return [...DEFAULT_TYPES];                         // corrupted value: show defaults, don't overwrite
  }

  isProtected(name) {
    return name === FALLBACK_TYPE;
  }

  // Returns the updated list. Throws Error (Telugu message) on invalid input.
  async add(name) {
    const trimmed = (name || '').trim();
    if (!trimmed)            throw new Error('Type పేరు ఇవ్వండి.');
    if (trimmed.length > 30) throw new Error('పేరు 30 అక్షరాల లోపు ఉండాలి.');
    const list = await this.getAll();
    if (list.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('ఈ Type ఇప్పటికే ఉంది.');
    }
    const updated = [...list, trimmed];
    await this._save(updated);
    return updated;
  }

  // Returns the updated list. Refuses if any catalog item still uses the type.
  async remove(name) {
    if (this.isProtected(name)) throw new Error(`"${FALLBACK_TYPE}" delete చేయలేరు (default).`);
    const items = await CatalogService.getAll();
    const used  = items.filter(i => (i.category || FALLBACK_TYPE) === name).length;
    if (used > 0) {
      throw new Error(`ఈ Type ను ${used} items వాడుతున్నాయి. ముందు వాటిని వేరే Type కి మార్చండి లేదా delete చేయండి.`);
    }
    const list    = await this.getAll();
    const updated = list.filter(t => t !== name);
    await this._save(updated);
    return updated;
  }

  async _save(list) {
    await AsyncStorage.setItem(TYPES_KEY, JSON.stringify(list));
  }
}

export default new ItemTypeService();