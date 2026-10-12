// services/ReceiptModel.js
// Pure helpers for the receipt (ledger) storage. No storage access here.
//
// Storage layout (Step 3A) — one entry per receipt, so the list can grow without limit:
//   'receipt_index'      -> [ { id, savedAt, invoiceNo, schoolId, schoolName, udise, spell,
//                               itemCount, totalQty, status, legacy, academicYear, channel } ]   newest first, small
//   'receipt:<id>'       -> full receipt { id, savedAt, invoiceNo, shopName, shopPhone,
//                               school: {id,name,udise,address}, spell,
//                               items: [{id,name,count,category,subType, sizes?: {size: n}}], footer,
//                               status: 'active'|'cancelled', cancelledAt?, legacy,
//                               academicYear, channel: 'thermal'|'pdf'|'system' }
export const INDEX_KEY      = 'receipt_index';
export const RECEIPT_PREFIX = 'receipt:';

export function snapshotSchool(s) {
  if (!s) return null;
  return { id: s.id ?? null, name: s.name || '', udise: s.udise || '', address: s.address || '' };
}

export function snapshotItems(items) {
  return (items || []).map(i => ({
    id:       i.id ?? null,
    name:     i.name || '',
    count:    i.count ?? 0,                 // keep the original type (the app stores counts as strings)
    category: i.category || '',
    subType:  i.subType || 'Common',
    // size-wise lines only (e.g. Shoes): { '20': 3, '21': -1 }; absent for normal items so old data stays identical
    ...(i.sizes && Object.keys(i.sizes).length > 0 ? { sizes: { ...i.sizes } } : {}),
  }));
}

export function totalQtyOf(items) {
  return (items || []).reduce((sum, i) => {
    const n = parseInt(i.count || 0, 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
}

export function toIndexEntry(full) {
  return {
    id:         full.id,
    savedAt:    full.savedAt,
    invoiceNo:  full.invoiceNo || '',
    schoolId:   full.school?.id ?? null,
    schoolName: full.school?.name || full.shopName || '',
    udise:      full.school?.udise || '',
    spell:      full.spell || 1,
    itemCount:  (full.items || []).length,
    totalQty:   totalQtyOf(full.items),
    status:     full.status || 'active',
    legacy:     !!full.legacy,
    academicYear: full.academicYear || '',
    channel:      full.channel || 'thermal',
  };
}

/** A record from the old single-key 'receipt_history' list -> full receipt (marked legacy). */
export function legacyToFull(r, fallbackId) {
  return {
    id:        String(r.id ?? fallbackId),
    savedAt:   r.savedAt || new Date(0).toISOString(),
    invoiceNo: r.invoiceNo || '',
    shopName:  r.shopName || '',
    shopPhone: r.shopPhone || '',
    school:    snapshotSchool(r.school),
    spell:     r.spell || 1,
    items:     snapshotItems(r.items),
    footer:    r.footer || '',
    status:    'active',
    legacy:    true,
  };
}