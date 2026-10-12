// services/StockModel.js
// Pure helpers for stock (Received) entries and the Received / Given / Balance maths. No storage here.
//
// Stock entry: { id, itemId, size: '' | 'S' | '15' ..., qty (whole number >= 1), date 'YYYY-MM-DD',
//                note, academicYear, createdAt }
//
// Rules:
//  - Received  = sum of the stock entries of the academic year
//  - Given     = sum of the counts in receipts that are ACTIVE (not cancelled), not legacy, and belong
//                to the same academic year (a Return, entered as a negative count, will subtract)
//  - Balance   = Received - Given
export const STOCK_KEY = 'stock_entries';
export const MAX_QTY   = 1000000;

const toInt = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? parseInt(String(v).trim(), 10) : NaN);
const pad2  = (n) => String(n).padStart(2, '0');

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isValidDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  return y >= 2000 && y <= 2100 && dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** form: { qty, size, date, note } -> { error } | { data } */
export function buildStockEntry(form, item, academicYear) {
  const qty = toInt(form.qty);
  if (isNaN(qty) || qty < 1 || qty > MAX_QTY) return { error: `సంఖ్య 1 నుండి ${MAX_QTY} మధ్య ఉండాలి.` };

  const date = String(form.date ?? '').trim();
  if (!isValidDate(date)) return { error: 'తేదీ ఇలా రాయండి: 2026-10-05' };

  const sizes = Array.isArray(item?.sizes) ? item.sizes : [];
  let size = '';
  if (sizes.length > 0) {
    size = String(form.size ?? '').trim();
    if (!sizes.includes(size)) return { error: 'Size ఎంచుకోండి.' };
  }

  const note = String(form.note ?? '').trim();
  if (note.length > 80) return { error: 'గమనిక 80 అక్షరాల లోపు ఉండాలి.' };

  return { data: { itemId: item.id, size, qty, date, note, academicYear } };
}

/** Received totals of one academic year: { byItem: {itemId: n}, bySize: {itemId: {size: n}} } */
export function receivedTotals(entries, academicYear) {
  const byItem = {}, bySize = {};
  (entries || []).forEach(e => {
    if (e.academicYear !== academicYear) return;
    const q = Number(e.qty) || 0;
    byItem[e.itemId] = (byItem[e.itemId] || 0) + q;
    if (e.size) {
      bySize[e.itemId] = bySize[e.itemId] || {};
      bySize[e.itemId][e.size] = (bySize[e.itemId][e.size] || 0) + q;
    }
  });
  return { byItem, bySize };
}

/**
 * Given totals from FULL receipts. Counts only active, non-legacy receipts of the academic year.
 * -> { byItem: {itemId: n}, bySchool: {schoolId: {itemId: n}}, schoolNames: {schoolId: name},
 *      bySize: {itemId: {size: n}}, bySchoolSize: {schoolId: {itemId: {size: n}}} }   (only from receipt lines that carry a `sizes` map)
 */
export function aggregateGiven(fullReceipts, academicYear) {
  const byItem = {}, bySchool = {}, schoolNames = {}, bySize = {}, bySchoolSize = {};
  (fullReceipts || []).forEach(r => {
    if (!r || r.status !== 'active' || r.legacy || r.academicYear !== academicYear) return;
    const sid = r.school?.id ?? 'unknown';
    schoolNames[sid] = r.school?.name || schoolNames[sid] || '';
    (r.items || []).forEach(i => {
      if (i.id === null || i.id === undefined) return;
      const n = parseInt(i.count || 0, 10);
      if (isNaN(n) || n === 0) return;
      byItem[i.id] = (byItem[i.id] || 0) + n;
      bySchool[sid] = bySchool[sid] || {};
      bySchool[sid][i.id] = (bySchool[sid][i.id] || 0) + n;
      if (i.sizes && typeof i.sizes === 'object') {
        Object.keys(i.sizes).forEach(s => {
          const q = parseInt(i.sizes[s], 10);
          if (isNaN(q) || q === 0) return;
          bySize[i.id] = bySize[i.id] || {};
          bySize[i.id][s] = (bySize[i.id][s] || 0) + q;
          bySchoolSize[sid] = bySchoolSize[sid] || {};
          bySchoolSize[sid][i.id] = bySchoolSize[sid][i.id] || {};
          bySchoolSize[sid][i.id][s] = (bySchoolSize[sid][i.id][s] || 0) + q;
        });
      }
    });
  });
  return { byItem, bySchool, schoolNames, bySize, bySchoolSize };
}

/** Items whose requested quantity is more than Received - Given. Duplicate item lines are added up. */
export function findShortages(requestedItems, received, given) {
  const want = {}, names = {};
  (requestedItems || []).forEach(i => {
    const n = parseInt(i.count || 0, 10);
    if (isNaN(n) || n <= 0 || i.id === null || i.id === undefined) return;
    want[i.id] = (want[i.id] || 0) + n;
    names[i.id] = i.name || '';
  });
  const out = [];
  Object.keys(want).forEach(id => {
    const available = (received.byItem[id] || 0) - (given.byItem[id] || 0);
    if (want[id] > available) out.push({ itemId: id, name: names[id], requested: want[id], available });
  });

  // Size-wise check (items given with a `sizes` map, e.g. Shoes). Only when the stock itself has size entries;
  // old stock entered without a size is covered by the total check above.
  const wantSize = {};
  (requestedItems || []).forEach(i => {
    if (!i.sizes || i.id === null || i.id === undefined) return;
    Object.keys(i.sizes).forEach(s => {
      const n = parseInt(i.sizes[s], 10);
      if (isNaN(n) || n <= 0) return;
      wantSize[i.id] = wantSize[i.id] || {};
      wantSize[i.id][s] = (wantSize[i.id][s] || 0) + n;
      names[i.id] = i.name || names[i.id] || '';
    });
  });
  Object.keys(wantSize).forEach(id => {
    const recSizes = received.bySize ? received.bySize[id] : null;
    if (!recSizes) return;
    Object.keys(wantSize[id]).forEach(s => {
      const available = (recSizes[s] || 0) - (((given.bySize || {})[id] || {})[s] || 0);
      if (wantSize[id][s] > available) {
        out.push({ itemId: id, name: `${names[id]} (size ${s})`, requested: wantSize[id][s], available });
      }
    });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}