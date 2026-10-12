// services/MigrationService.js
// One-time data upgrades (run in order, each has its own flag):
//  2B: catalog fields + Shoes merge
//  3A: receipts move from one big 'receipt_history' value to one key per receipt (+ index)
// --- 2B details ---
// One-time data upgrade for Step 2B. Touches AsyncStorage only (no service imports -> no import cycles).
//  - catalog items get the new fields with defaults
//  - 'Boys Shoes' / 'Girls Shoes' items become type 'Shoes' + subType 'Boys' / 'Girls'
//  - the stored Item Types list is merged the same way
// Safe to re-run (idempotent). The flag is set only after everything succeeded.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INDEX_KEY, RECEIPT_PREFIX, legacyToFull, toIndexEntry } from './ReceiptModel';

export const MIGRATION_FLAG = 'migration_2b_done';
export const MIGRATION_3A_FLAG = 'migration_3a_done';
const CATALOG_KEY = 'item_catalog';
const TYPES_KEY   = 'item_types';
const SHOE_MAP    = { 'Boys Shoes': 'Boys', 'Girls Shoes': 'Girls' };

let running = null;

async function migrate2B() {
  if (await AsyncStorage.getItem(MIGRATION_FLAG)) return;

  const rawCat = await AsyncStorage.getItem(CATALOG_KEY);
  if (rawCat !== null) {
    const list = JSON.parse(rawCat);                      // corrupt data -> throws -> nothing written, flag not set
    if (!Array.isArray(list)) throw new Error('item_catalog is not a list');
    const upgraded = list.map(i => {
      const shoe = SHOE_MAP[i.category];
      return {
        ...i,
        category:   shoe ? 'Shoes' : i.category,
        code:       i.code ?? '',
        subType:    i.subType ?? (shoe || 'Common'),
        classFrom:  i.classFrom ?? null,
        classTo:    i.classTo ?? null,
        semester:   i.semester ?? null,
        sizes:      Array.isArray(i.sizes) ? i.sizes : [],
        perStudent: i.perStudent && typeof i.perStudent === 'object' ? i.perStudent : {},
      };
    });
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(upgraded));
  }

  const rawTypes = await AsyncStorage.getItem(TYPES_KEY);
  if (rawTypes !== null) {
    const types = JSON.parse(rawTypes);
    if (Array.isArray(types) && types.some(t => SHOE_MAP[t] !== undefined)) {
      const out = [];
      types.forEach(t => {
        const name = SHOE_MAP[t] !== undefined ? 'Shoes' : t;
        if (!out.includes(name)) out.push(name);
      });
      await AsyncStorage.setItem(TYPES_KEY, JSON.stringify(out));
    }
  }

  await AsyncStorage.setItem(MIGRATION_FLAG, '1');
}

// 3A: old 'receipt_history' (one big list) -> 'receipt:<id>' + 'receipt_index'. Old records are marked legacy.
// The old key is left untouched. Idempotent: records already in the index are skipped.
async function migrate3A() {
  if (await AsyncStorage.getItem(MIGRATION_3A_FLAG)) return;

  const raw = await AsyncStorage.getItem('receipt_history');
  if (raw !== null) {
    const list = JSON.parse(raw);                         // corrupt -> throws -> nothing written, flag not set
    if (!Array.isArray(list)) throw new Error('receipt_history is not a list');

    const rawIdx = await AsyncStorage.getItem(INDEX_KEY);
    const index  = rawIdx ? JSON.parse(rawIdx) : [];
    if (!Array.isArray(index)) throw new Error('receipt_index is not a list');
    const have = new Set(index.map(e => e.id));

    const pairs = [], entries = [];
    list.forEach((r, i) => {
      const full = legacyToFull(r, `legacy-${i}`);
      if (have.has(full.id)) return;
      have.add(full.id);
      pairs.push([RECEIPT_PREFIX + full.id, JSON.stringify(full)]);
      entries.push(toIndexEntry(full));
    });
    if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
    const merged = [...index, ...entries].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(merged));
  }
  await AsyncStorage.setItem(MIGRATION_3A_FLAG, '1');
}

async function migrateAll() {
  await migrate2B();
  await migrate3A();
}

const MigrationService = {
  /** Awaited by CatalogService.getAll and ItemTypeService.getAll. Runs once per app session. */
  run() {
    if (!running) {
      running = migrateAll().catch(e => {
        console.warn('[Migration] failed, will retry later:', e.message);
        running = null;
      });
    }
    return running;
  },
  /** Call after Restore, so an old backup gets upgraded too. */
  reset() { running = null; },
};

export default MigrationService;