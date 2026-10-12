// services/ReceiptHistory.js
// Receipt ledger storage (Step 3A). Same class name / methods as before (getAll, save, delete),
// plus get(id) and cancel(id). One AsyncStorage key per receipt + a small index, so the list
// can grow without limit (no 50 cap, no single huge value).
import AsyncStorage from '@react-native-async-storage/async-storage';
import MigrationService from './MigrationService';
import {
  INDEX_KEY, RECEIPT_PREFIX, snapshotSchool, snapshotItems, toIndexEntry,
} from './ReceiptModel';

class ReceiptHistory {

  // Read errors are THROWN (never turned into an empty list that a later save could overwrite).
  async _readIndex() {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (raw === null) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('Receipt index పాడైంది.');
    return list;
  }

  /** Light list (newest first) for the History screen. */
  async getAll() {
    await MigrationService.run();
    return this._readIndex();
  }

  /** Full receipt (for reprint). null if missing. */
  async get(id) {
    const raw = await AsyncStorage.getItem(RECEIPT_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Same input as before: { invoiceNo, shopName, shopPhone, school, spell, items, footer }
   * plus { academicYear, channel }. extraPairs = [[key, value], ...] written in the SAME atomic
   * write (used for the invoice counter, so a receipt and its number can never get out of step).
   */
  async save(receipt, extraPairs = []) {
    await MigrationService.run();
    const index = await this._readIndex();

    const used = new Set(index.map(e => e.id));
    let id = Date.now().toString();
    while (used.has(id)) id = String(Number(id) + 1);

    const full = {
      id,
      savedAt:   new Date().toISOString(),
      invoiceNo: receipt.invoiceNo || '',
      shopName:  receipt.shopName || '',
      shopPhone: receipt.shopPhone || '',
      school:    snapshotSchool(receipt.school),
      spell:     receipt.spell || 1,
      items:     snapshotItems(receipt.items),
      footer:    receipt.footer || '',
      status:    'active',
      legacy:    false,
      academicYear: receipt.academicYear || '',
      channel:      receipt.channel || 'thermal',
    };
    await AsyncStorage.multiSet([
      [RECEIPT_PREFIX + id, JSON.stringify(full)],
      [INDEX_KEY, JSON.stringify([toIndexEntry(full), ...index])],
      ...extraPairs,
    ]);
    return full;
  }

  /** New receipts are never deleted, they are cancelled (invoice number stays accounted for). */
  async cancel(id) {
    await MigrationService.run();
    const index = await this._readIndex();
    const entry = index.find(e => e.id === id);
    if (!entry)        throw new Error('రశీదు కనబడలేదు.');
    if (entry.legacy)  throw new Error('పాత రశీదులను Cancel కాదు, delete చేయండి.');
    if (entry.status === 'cancelled') return;

    const full = await this.get(id);
    if (!full) throw new Error('రశీదు data కనబడలేదు.');
    full.status      = 'cancelled';
    full.cancelledAt = new Date().toISOString();
    const updatedIndex = index.map(e => (e.id === id ? { ...e, status: 'cancelled' } : e));
    await AsyncStorage.multiSet([
      [RECEIPT_PREFIX + id, JSON.stringify(full)],
      [INDEX_KEY, JSON.stringify(updatedIndex)],
    ]);
  }

  /** Permanent delete: ONLY for legacy (old test) receipts. */
  async delete(id) {
    await MigrationService.run();
    const index = await this._readIndex();
    const entry = index.find(e => e.id === id);
    if (!entry) return;
    if (!entry.legacy) throw new Error('కొత్త రశీదులను delete చేయలేరు, Cancel చేయండి.');
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index.filter(e => e.id !== id)));
    await AsyncStorage.removeItem(RECEIPT_PREFIX + id);
  }
}

export default new ReceiptHistory();