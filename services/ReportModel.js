// services/ReportModel.js
// Pure builders for the 4 reports. Each returns:
//   { key, title, columns: [{ key, label, align?: 'right'|'center', width?: number }], rows: [{...}], totals?: {...} }
// No storage, no UI here.
import { requiredForSchool } from './RequirementModel';
import { rollSummary, classRange } from './SchoolModel';

const nameSort = (a, b) => String(a || '').localeCompare(String(b || ''));

function orderedItems(items, types) {
  const rank = (cat) => { const i = types.indexOf(cat || 'Others'); return i === -1 ? types.length : i; };
  return [...items].sort((a, b) =>
    rank(a.category) - rank(b.category) || nameSort(a.category, b.category) || nameSort(a.name, b.name));
}

const itemLabel = (i) => i.name + (i.subType && i.subType !== 'Common' && !i.name.toLowerCase().includes(i.subType.toLowerCase()) ? ` (${i.subType})` : '');
const sum = (rows, k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

// Sizes of a sized item (e.g. Shoes) in the item's own order, plus any other size found in the data
const sizeOrder = (item, ...maps) => {
  const out = Array.isArray(item.sizes) ? [...item.sizes] : [];
  maps.forEach(m => Object.keys(m || {}).forEach(s => { if (!out.includes(s)) out.push(s); }));
  return out;
};

/** A: Received / Given / Balance per item */
export function buildStockReport({ items, types, received, given }) {
  const main = [];
  const rows = [];       // main rows + size sub-rows (sub rows are not added into the totals)
  orderedItems(items, types).forEach(i => {
    const rec = received.byItem[i.id] || 0, giv = given.byItem[i.id] || 0;
    const row = { type: i.category || 'Others', code: i.code || '', item: itemLabel(i), received: rec, given: giv, balance: rec - giv };
    main.push(row);
    rows.push(row);
    const rs = (received.bySize || {})[i.id], gs = (given.bySize || {})[i.id];
    if (rs || gs) {
      sizeOrder(i, rs, gs).forEach(s => {
        const r2 = (rs && rs[s]) || 0, g2 = (gs && gs[s]) || 0;
        if (r2 === 0 && g2 === 0) return;
        rows.push({ type: row.type, code: '', item: `    Size ${s}`, received: r2, given: g2, balance: r2 - g2, sub: true });
      });
    }
  });
  return {
    key: 'stock', title: 'Stock Report (Received · Given · Balance)',
    columns: [
      { key: 'type', label: 'Type', width: 16 }, { key: 'code', label: 'Code', width: 14 },
      { key: 'item', label: 'Item', width: 32 },
      { key: 'received', label: 'Received', align: 'right', width: 10 },
      { key: 'given', label: 'Given', align: 'right', width: 10 },
      { key: 'balance', label: 'Balance', align: 'right', width: 10 },
    ],
    rows,
    totals: { item: 'Total', received: sum(main, 'received'), given: sum(main, 'given'), balance: sum(main, 'balance') },
  };
}

/** B: Required (from school rolls) vs Received per item. Deficit > 0 = short, negative = surplus */
export function buildRequirementReport({ items, types, schools, received }) {
  const rolled = schools.filter(s => requiredForSchool({ subType: 'Common' }, s) > 0);
  const rows = orderedItems(items, types).map(i => {
    const required = rolled.reduce((s, sc) => s + requiredForSchool(i, sc), 0);
    const rec = received.byItem[i.id] || 0;
    return { type: i.category || 'Others', code: i.code || '', item: itemLabel(i), required, received: rec, deficit: required - rec };
  });
  return {
    key: 'requirement', title: 'Requirement & Deficit Report',
    columns: [
      { key: 'type', label: 'Type', width: 16 }, { key: 'code', label: 'Code', width: 14 },
      { key: 'item', label: 'Item', width: 32 },
      { key: 'required', label: 'Required', align: 'right', width: 10 },
      { key: 'received', label: 'Received', align: 'right', width: 10 },
      { key: 'deficit', label: 'Deficit (+) / Surplus (-)', align: 'right', width: 14 },
    ],
    rows,
    totals: { item: 'Total', required: sum(rows, 'required'), received: sum(rows, 'received'), deficit: sum(rows, 'deficit') },
    note: `Schools without roll (not counted): ${schools.length - rolled.length}`,
  };
}

/** C: school-wise items given (one row per school + item, net of returns) */
export function buildSchoolReport({ items, types, schools, given }) {
  const byId = {};
  items.forEach(i => { byId[i.id] = i; });
  const rows = [];
  const main = [];       // main rows only (size sub-rows are not added into the total)
  const sids = Object.keys(given.bySchool);
  const schoolInfo = (sid) => {
    const s = schools.find(x => String(x.id) === String(sid));
    return { name: s?.name || given.schoolNames[sid] || '—', udise: s?.udise || '' };
  };
  sids.map(sid => ({ sid, ...schoolInfo(sid) })).sort((a, b) => nameSort(a.name, b.name)).forEach(({ sid, name, udise }) => {
    const ordered = orderedItems(Object.keys(given.bySchool[sid]).map(id => byId[id]).filter(Boolean), types);
    ordered.forEach(i => {
      const qty = given.bySchool[sid][i.id] || 0;
      if (qty === 0) return;
      const row = { school: name, udise, item: itemLabel(i), type: i.category || 'Others', qty };
      rows.push(row); main.push(row);
      const szs = ((given.bySchoolSize || {})[sid] || {})[i.id];
      if (szs) {
        sizeOrder(i, szs).forEach(s => {
          if (szs[s]) rows.push({ school: name, udise, item: `    Size ${s}`, type: row.type, qty: szs[s], sub: true });
        });
      }
    });
  });
  return {
    key: 'school', title: 'School-wise Distribution Report',
    columns: [
      { key: 'school', label: 'School', width: 30 }, { key: 'udise', label: 'UDISE', width: 14 },
      { key: 'type', label: 'Type', width: 16 }, { key: 'item', label: 'Item', width: 30 },
      { key: 'qty', label: 'Given', align: 'right', width: 10 },
    ],
    rows,
    totals: { item: 'Total', qty: sum(main, 'qty') },
  };
}

/** E: one selected school: Required (from its roll) / Given / Remaining per item, with size-wise Given for sized items */
export function buildSelectedSchoolReport({ items, types, school, given }) {
  const sid = school.id;
  const gItems = (given.bySchool || {})[sid] || {};
  const gSizes = (given.bySchoolSize || {})[sid] || {};
  const rows = [];
  const main = [];
  orderedItems(items, types).forEach(i => {
    const required = requiredForSchool(i, school);
    const giv = gItems[i.id] || 0;
    if (required <= 0 && giv === 0) return;
    const row = { type: i.category || 'Others', code: i.code || '', item: itemLabel(i), required, given: giv, remaining: required - giv };
    rows.push(row); main.push(row);
    const szs = gSizes[i.id];
    if (szs) {
      sizeOrder(i, szs).forEach(s => {
        if (szs[s]) rows.push({ type: row.type, code: '', item: `    Size ${s}`, required: '', given: szs[s], remaining: '', sub: true });
      });
    }
  });
  const rs = rollSummary(school);
  const classes = classRange(school.minClass, school.maxClass);
  const rollNote = rs.hasRange
    ? `Roll: ${classes[0]}–${classes[classes.length - 1]} తరగతులు · Boys ${rs.boys} · Girls ${rs.girls} · మొత్తం ${rs.total}`
    : 'Roll నమోదు కాలేదు (Required చూపడం లేదు)';
  return {
    key: 'selschool',
    title: `School Report — ${school.name}${school.udise ? ` (UDISE ${school.udise})` : ''}`,
    columns: [
      { key: 'type', label: 'Type', width: 16 }, { key: 'code', label: 'Code', width: 14 },
      { key: 'item', label: 'Item', width: 32 },
      { key: 'required', label: 'Required', align: 'right', width: 10 },
      { key: 'given', label: 'Given', align: 'right', width: 10 },
      { key: 'remaining', label: 'Remaining', align: 'right', width: 10 },
    ],
    rows,
    totals: { item: 'Total', required: sum(main, 'required'), given: sum(main, 'given'), remaining: sum(main, 'remaining') },
    note: `${rollNote} · Remaining = Required − Given (− అంటే ఎక్కువ ఇచ్చాం)`,
  };
}

const dateOf = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** D: receipts list of the academic year (new receipts only; cancelled ones are shown but not totalled) */
export function buildReceiptsReport({ index, academicYear }) {
  const list = (index || [])
    .filter(e => !e.legacy && e.academicYear === academicYear)
    .sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
  const rows = list.map(e => ({
    date: dateOf(e.savedAt), invoice: e.invoiceNo || '', school: e.schoolName || '', udise: e.udise || '',
    spell: e.spell || 1, items: e.itemCount || 0, qty: e.totalQty || 0,
    status: e.status === 'active' ? 'Active' : 'Cancelled',
  }));
  const active = rows.filter(r => r.status === 'Active');
  return {
    key: 'receipts', title: 'Receipts List',
    columns: [
      { key: 'date', label: 'Date', width: 12 }, { key: 'invoice', label: 'Invoice', width: 14 },
      { key: 'school', label: 'School', width: 30 }, { key: 'udise', label: 'UDISE', width: 13 },
      { key: 'spell', label: 'Spell', align: 'center', width: 7 },
      { key: 'items', label: 'Items', align: 'right', width: 7 },
      { key: 'qty', label: 'Qty', align: 'right', width: 8 },
      { key: 'status', label: 'Status', width: 11 },
    ],
    rows,
    totals: { school: `Total (active: ${active.length})`, items: sum(active, 'items'), qty: sum(active, 'qty') },
  };
}