// services/LedgerService.js
// Reads the receipt ledger (Step 3A storage) and answers "how much has been given" and
// "is there enough stock for this receipt". Read-only: it never writes anything.
import AsyncStorage from '@react-native-async-storage/async-storage';
import MigrationService from './MigrationService';
import StockService from './StockService';
import { INDEX_KEY, RECEIPT_PREFIX } from './ReceiptModel';
import { aggregateGiven, findShortages } from './StockModel';

const BATCH = 200;

class LedgerService {

  /** Full receipts that count: active, not legacy, this academic year. */
  async _countedReceipts(academicYear) {
    await MigrationService.run();
    const raw   = await AsyncStorage.getItem(INDEX_KEY);
    const index = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(index)) throw new Error('Receipt index పాడైంది.');

    const keys = index
      .filter(e => e.status === 'active' && !e.legacy && e.academicYear === academicYear)
      .map(e => RECEIPT_PREFIX + e.id);

    const out = [];
    for (let i = 0; i < keys.length; i += BATCH) {
      const pairs = await AsyncStorage.multiGet(keys.slice(i, i + BATCH));
      pairs.forEach(([, v]) => { if (v) out.push(JSON.parse(v)); });
    }
    return out;
  }

  /** { byItem, bySchool, schoolNames } for the academic year */
  async givenTotals(academicYear) {
    return aggregateGiven(await this._countedReceipts(academicYear), academicYear);
  }

  /** One school, this academic year: { given: {itemId: n}, givenBySize: {itemId: {size: n}}, receiptCount }
   *  (receiptCount = receipts that gave something) */
  async schoolSummary(academicYear, schoolId) {
    const receipts = (await this._countedReceipts(academicYear)).filter(r => r.school?.id === schoolId);
    const given = {}, givenBySize = {};
    let receiptCount = 0;
    receipts.forEach(r => {
      let positive = false;
      (r.items || []).forEach(i => {
        const n = parseInt(i.count || 0, 10);
        if (isNaN(n) || n === 0 || i.id === null || i.id === undefined) return;
        given[i.id] = (given[i.id] || 0) + n;
        if (i.sizes && typeof i.sizes === 'object') {
          Object.keys(i.sizes).forEach(s => {
            const q = parseInt(i.sizes[s], 10);
            if (isNaN(q) || q === 0) return;
            givenBySize[i.id] = givenBySize[i.id] || {};
            givenBySize[i.id][s] = (givenBySize[i.id][s] || 0) + q;
          });
        }
        if (n > 0) positive = true;
      });
      if (positive) receiptCount++;          // return-only receipts do not count as a spell
    });
    return { given, givenBySize, receiptCount };
  }

  /** Stock still available per item (Received - Given) for the academic year: { [itemId]: n } (missing = 0) */
  async availableByItem(academicYear) {
    const [received, given] = await Promise.all([
      StockService.receivedTotals(academicYear),
      this.givenTotals(academicYear),
    ]);
    const out = {};
    Object.keys(received.byItem).forEach(id => { out[id] = (received.byItem[id] || 0) - (given.byItem[id] || 0); });
    return out;
  }

  /** Stock still available per item AND size (only items whose stock was entered with sizes):
   *  { [itemId]: { [size]: n } } (a missing size = 0) */
  async availableBySize(academicYear) {
    const [received, given] = await Promise.all([
      StockService.receivedTotals(academicYear),
      this.givenTotals(academicYear),
    ]);
    const out = {};
    Object.keys(received.bySize || {}).forEach(id => {
      out[id] = {};
      Object.keys(received.bySize[id]).forEach(s => {
        out[id][s] = (received.bySize[id][s] || 0) - (((given.bySize || {})[id] || {})[s] || 0);
      });
    });
    return out;
  }

  /** [] when stock is enough, otherwise [{ itemId, name, requested, available }] */
  async checkAvailability(requestedItems, academicYear) {
    const [received, given] = await Promise.all([
      StockService.receivedTotals(academicYear),
      this.givenTotals(academicYear),
    ]);
    return findShortages(requestedItems, received, given);
  }
}

export default new LedgerService();