// services/BackupService.js
// Backup & Restore of all app data stored in AsyncStorage.
// Uses only already-installed packages: async-storage, expo-file-system, expo-sharing, expo-document-picker.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import MigrationService, { MIGRATION_FLAG, MIGRATION_3A_FLAG } from './MigrationService';

const APP_ID         = 'T-Print';
const BACKUP_VERSION = 1;

// Existing keys. Add future keys here (or a new prefix) so they are included automatically.
// 'receipt_history' = old single-key receipt list (kept for old backups); 'receipt_index' + 'receipt:<id>' = Step 3A storage
const EXACT_KEYS = ['shop_settings', 'schools_list', 'item_catalog', 'receipt_history', 'item_types',
                    'receipt_index', 'stock_entries', MIGRATION_FLAG, MIGRATION_3A_FLAG];
const PREFIXES   = ['invoice_serial_', 'receipt:'];

const isBackupKey = (k) => EXACT_KEYS.includes(k) || PREFIXES.some(p => k.startsWith(p));

const parseJSON = (raw) => { try { return JSON.parse(raw); } catch { return undefined; } };
const countArray = (raw) => {
  const v = raw ? parseJSON(raw) : [];
  return Array.isArray(v) ? v.length : 0;
};

function summarize(data) {
  return {
    settings: !!data.shop_settings,
    schools:  countArray(data.schools_list),
    items:    countArray(data.item_catalog),
    receipts: countArray(data.receipt_index) || countArray(data.receipt_history),
    stock:    countArray(data.stock_entries),
    serials:  Object.keys(data).filter(k => k.startsWith('invoice_serial_')).length,
  };
}

function validate(payload) {
  if (!payload || typeof payload !== 'object' || payload.app !== APP_ID) {
    throw new Error('ఇది T-Print backup file కాదు.');
  }
  if (typeof payload.version !== 'number' || payload.version > BACKUP_VERSION) {
    throw new Error('ఈ backup కొత్త versionది. యాప్ ను update చేయండి.');
  }
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('Backup file లో data లేదు.');
  }
  for (const [k, v] of Object.entries(payload.data)) {
    if (!isBackupKey(k))   throw new Error(`తెలియని key: ${k}`);
    if (typeof v !== 'string') throw new Error(`Data సరిగా లేదు: ${k}`);
  }
  // List keys must hold valid JSON arrays; settings must be an object
  for (const k of ['schools_list', 'item_catalog', 'receipt_history', 'receipt_index', 'stock_entries']) {
    if (payload.data[k] !== undefined && !Array.isArray(parseJSON(payload.data[k]))) {
      throw new Error(`File పాడైంది (${k}).`);
    }
  }
  if (payload.data.shop_settings !== undefined) {
    const s = parseJSON(payload.data.shop_settings);
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('File పాడైంది (shop_settings).');
  }
  const summary = summarize(payload.data);
  if (!summary.settings && !summary.schools && !summary.items && !summary.receipts && !summary.stock && !summary.serials) {
    throw new Error('Backup లో save చేయడానికి data ఏమీ లేదు.');
  }
  return summary;
}

const pad = (n) => String(n).padStart(2, '0');
function stamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

class BackupService {

  // Read raw values straight from storage (errors are thrown, never swallowed).
  async buildPayload() {
    const allKeys = await AsyncStorage.getAllKeys();
    const keys    = allKeys.filter(isBackupKey);
    const pairs   = keys.length ? await AsyncStorage.multiGet(keys) : [];
    const data    = {};
    pairs.forEach(([k, v]) => { if (v !== null) data[k] = v; });
    return { app: APP_ID, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
  }

  // Create backup file in cache and open the system share sheet.
  async exportAndShare() {
    const payload = await this.buildPayload();
    const summary = summarize(payload.data);
    if (Object.keys(payload.data).length === 0) {
      throw new Error('Backup చేయడానికి data ఏమీ లేదు.');
    }
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('ఈ device లో Share అందుబాటులో లేదు.');
    }
    const fileName = `tprint-backup-${stamp()}.json`;
    const uri      = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload));
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'T-Print Backup Save చేయండి',
      UTI: 'public.json',
    });
    return { fileName, summary };
  }

  // Let user pick a file, validate it. Returns null if cancelled.
  async pickBackup() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;

    const asset = result.assets[0];
    let text = await FileSystem.readAsStringAsync(asset.uri);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
    const payload = parseJSON(text);
    if (payload === undefined) throw new Error('File చదవలేకపోయాను (JSON కాదు).');

    const summary = validate(payload);
    return { payload, summary, fileName: asset.name, exportedAt: payload.exportedAt || null };
  }

  // Validate an already-loaded payload (e.g. downloaded from Drive). Same result shape as pickBackup().
  inspect(payload) {
    const summary = validate(payload);
    return { payload, summary, fileName: 'Google Drive', exportedAt: payload.exportedAt || null };
  }

  // Replace current app data with backup data. Rolls back if writing fails.
  async restore(payload) {
    validate(payload);
    const allKeys  = await AsyncStorage.getAllKeys();
    const existing = allKeys.filter(isBackupKey);
    const prevRaw  = existing.length ? await AsyncStorage.multiGet(existing) : [];
    const previous = prevRaw.filter(([, v]) => v !== null);

    try {
      if (existing.length) await AsyncStorage.multiRemove(existing);
      await AsyncStorage.multiSet(Object.entries(payload.data));
    } catch (err) {
      try {
        await AsyncStorage.multiRemove(Object.keys(payload.data));
        if (previous.length) await AsyncStorage.multiSet(previous);
      } catch { /* best effort rollback */ }
      throw new Error('Restore విఫలమైంది. పాత data తిరిగి ఉంచాను. ' + err.message);
    }
    MigrationService.reset(); // old backups (without the flag) get upgraded again
  }
}

export default new BackupService();