// services/ItemModel.js
// Pure helper functions for the catalog item model (no storage access here).
//
// Item shape (all new fields are additive; `category` stays the Item Type name):
// { id, name, category, barcode,
//   code, subType: 'Common'|'Boys'|'Girls',
//   classFrom, classTo,            // numbers 1..12 or null (null = all classes of the school)
//   semester,                      // number or null
//   sizes: [],                     // e.g. ['S','M','L'] or ['15','16',...,'32']
//   perStudent: { '6': 3, ... } }  // per-student count by class; missing class = 1, 0 = not given

export const SUBTYPES = ['Common', 'Boys', 'Girls'];
export const SUBTYPE_LABEL = {
  Common: 'Common (అందరికీ)',
  Boys:   'Boys only',
  Girls:  'Girls only',
};
export const MAX_CLASS = 12;

const toInt = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? parseInt(String(v).trim(), 10) : NaN);

/** "S, M, L" or "15-32" → { list: [...] } | { error } */
export function parseSizes(text) {
  const t = String(text ?? '').trim();
  if (!t) return { list: [] };
  const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (a > b)           return { error: 'Sizes range లో మొదటి సంఖ్య చిన్నదిగా ఉండాలి (ఉదా: 15-32).' };
    if (b - a + 1 > 100) return { error: 'Sizes range చాలా పెద్దది (గరిష్టం 100).' };
    const list = [];
    for (let n = a; n <= b; n++) list.push(String(n));
    return { list };
  }
  const list = t.split(',').map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  for (const s of list) {
    if (s.length > 12)  return { error: `Size పేరు చాలా పెద్దది: ${s}` };
    const k = s.toLowerCase();
    if (seen.has(k))    return { error: `Size రెండుసార్లు ఉంది: ${s}` };
    seen.add(k);
  }
  return { list };
}

/** ['15','16',...,'32'] → "15-32" ; otherwise "S,M,L" */
export function formatSizes(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const nums = list.map(s => (/^\d+$/.test(s) ? parseInt(s, 10) : NaN));
  if (list.length > 2 && nums.every((n, i) => !isNaN(n) && (i === 0 || n === nums[i - 1] + 1))) {
    return `${list[0]}-${list[list.length - 1]}`;
  }
  return list.join(',');
}

/** Classes this item applies to (blank range = 1..12). */
export function effectiveClasses(classFrom, classTo) {
  const a = classFrom ? Number(classFrom) : 1;
  const b = classTo   ? Number(classTo)   : MAX_CLASS;
  const out = [];
  for (let c = a; c <= b; c++) out.push(c);
  return out;
}

/**
 * Validate the Add/Edit form and build the data object to store.
 * form: { name, category, barcode, code, subType, classFrom, classTo, semester, sizesText, useNorms, norms }
 * Returns { error } or { data }.
 */
export function buildItemData(form, allItems, editId) {
  const name = (form.name || '').trim();
  if (!name) return { error: 'Item name required.' };

  const code = (form.code || '').trim();
  if (code) {
    const dup = allItems.find(i => i.id !== editId && (i.code || '').toLowerCase() === code.toLowerCase());
    if (dup) return { error: `Code "${code}" ఇప్పటికే "${dup.name}" కి ఉంది.` };
  }

  if (!SUBTYPES.includes(form.subType)) return { error: 'ఎవరికి (Common / Boys / Girls) ఎంచుకోండి.' };

  const fromStr = String(form.classFrom ?? '').trim();
  const toStr   = String(form.classTo ?? '').trim();
  let classFrom = null, classTo = null;
  if (fromStr || toStr) {
    if (!fromStr || !toStr) return { error: 'తరగతి From, To రెండూ ఇవ్వండి (లేదా రెండూ ఖాళీ).' };
    classFrom = toInt(fromStr); classTo = toInt(toStr);
    if (isNaN(classFrom) || isNaN(classTo) || classFrom < 1 || classTo > MAX_CLASS) {
      return { error: `తరగతి 1 నుండి ${MAX_CLASS} మధ్య ఉండాలి.` };
    }
    if (classFrom > classTo) return { error: 'తరగతి From, To కంటే ఎక్కువ ఉండకూడదు.' };
  }

  let semester = null;
  const semStr = String(form.semester ?? '').trim();
  if (semStr) {
    semester = toInt(semStr);
    if (isNaN(semester) || semester < 1 || semester > 4) return { error: 'Semester 1 నుండి 4 మధ్య ఉండాలి.' };
  }

  const sz = parseSizes(form.sizesText);
  if (sz.error) return { error: sz.error };

  const perStudent = {};
  if (form.useNorms) {
    for (const c of effectiveClasses(classFrom, classTo)) {
      const raw = String((form.norms || {})[c] ?? '').trim();
      if (raw === '') continue;                       // blank = 1
      const n = toInt(raw);
      if (isNaN(n) || n > 50) return { error: `తరగతి ${c}: సంఖ్య 0 నుండి 50 మధ్య ఉండాలి.` };
      perStudent[String(c)] = n;
    }
  }

  return {
    data: {
      name,
      category: form.category || 'Others',
      barcode:  (form.barcode || '').trim(),
      code, subType: form.subType, classFrom, classTo, semester,
      sizes: sz.list, perStudent,
    },
  };
}

// ───────────────────────── Import helpers (Step 2D: Items) ─────────────────────────

/** CSV text → array of row objects keyed by header. Quote-aware ("a, b"), BOM-safe. */
export function parseCsvRows(text) {
  const src  = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      row.push(cur); cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); cur = ''; rows.push(row); row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] ?? ''; });
    return o;
  });
}

const normKey = (k) => String(k).toLowerCase().replace(/[\s_\-]/g, '');
const HEADER_ALIASES = {
  code: 'code', name: 'name', itemname: 'name',
  type: 'type', category: 'type',
  subtype: 'subType', classfrom: 'classFrom', classto: 'classTo',
  semester: 'semester', sem: 'semester', sizes: 'sizes', barcode: 'barcode',
};

/**
 * Raw rows (from CSV or Excel, keyed by header) → one result per non-empty row:
 *   { rowNo, status: 'new'|'update'|'error', name, code, category, data?, id?, error? }
 * - Template format (has a Code column): Code is required; same Code as an existing item = update.
 * - Legacy format (Name, Category, Barcode; no Code column): add-only, unknown Type → 'Others' (as before).
 * - On update, only fields whose columns exist in the file are changed.
 */
export function rowsToItems(rawRows, types, existing) {
  const results = [];
  if (!rawRows || rawRows.length === 0) return results;

  const headerMap = {};                                   // raw header -> field name
  Object.keys(rawRows[0]).forEach(k => {
    const nk = normKey(k);
    if (HEADER_ALIASES[nk]) headerMap[k] = HEADER_ALIASES[nk];
    else if (/^n\d{1,2}$/.test(nk)) headerMap[k] = nk;    // n1 … n12
  });
  const fields  = new Set(Object.values(headerMap));
  const hasCode = fields.has('code');
  const hasNorm = [...fields].some(f => /^n\d+$/.test(f));

  const typeLookup = new Map(types.map(t => [t.toLowerCase(), t]));
  const byCode = new Map();
  (existing || []).forEach(i => { if (i.code) byCode.set(String(i.code).toLowerCase(), i); });
  const seen = new Set();

  rawRows.forEach((raw, idx) => {
    const v = {};
    Object.keys(headerMap).forEach(k => { v[headerMap[k]] = String(raw[k] ?? '').trim(); });
    if (Object.values(v).every(x => x === '')) return;    // blank row (template has pre-formatted empty rows)

    const res  = { rowNo: idx + 2, name: v.name || '', code: v.code || '', status: 'error', error: '' };
    const fail = (msg) => { res.error = msg; results.push(res); };

    if (!v.name) return fail('Name ఖాళీగా ఉంది');

    let category;
    if (!v.type) {
      if (hasCode) return fail('Type ఖాళీగా ఉంది');
      category = 'Others';
    } else {
      category = typeLookup.get(v.type.toLowerCase());
      if (!category) {
        if (hasCode) return fail(`Type "${v.type}" తెలియదు (Item Types లో add చేయండి)`);
        category = 'Others';
      }
    }
    res.category = category;

    let subType = 'Common';
    if (v.subType) {
      const s = SUBTYPES.find(x => x.toLowerCase() === v.subType.toLowerCase());
      if (!s) return fail(`SubType "${v.subType}" సరికాదు (Common / Boys / Girls)`);
      subType = s;
    }

    let match = null;
    if (hasCode) {
      if (!v.code) return fail('Code ఖాళీగా ఉంది');
      const ck = v.code.toLowerCase();
      if (seen.has(ck)) return fail('ఈ Code ఫైల్ లో ఇప్పటికే ఉంది');
      seen.add(ck);
      match = byCode.get(ck) || null;
    }

    const norms = {};
    let anyNorm = false;
    for (let n = 1; n <= MAX_CLASS; n++) {
      const x = v['n' + n];
      if (x !== undefined && x !== '') { norms[n] = x; anyNorm = true; }
    }

    const built = buildItemData({
      name: v.name, category, barcode: v.barcode || '', code: v.code || '', subType,
      classFrom: v.classFrom || '', classTo: v.classTo || '', semester: v.semester || '',
      sizesText: v.sizes || '', useNorms: anyNorm, norms,
    }, [], null);
    if (built.error) return fail(built.error);

    const data = built.data;
    if (match) {                                          // keep existing values for columns that are not in the file
      if (!fields.has('barcode'))  delete data.barcode;
      if (!fields.has('subType'))  delete data.subType;
      if (!fields.has('classFrom') && !fields.has('classTo')) { delete data.classFrom; delete data.classTo; }
      if (!fields.has('semester')) delete data.semester;
      if (!fields.has('sizes'))    delete data.sizes;
      if (!hasNorm)                delete data.perStudent;
    }
    results.push({ ...res, status: match ? 'update' : 'new', id: match ? match.id : undefined, data, error: '' });
  });
  return results;
}

// Emoji for an item (display only, nothing is stored). Looks at the item name first, then its type.
const EMOJI_RULES = [
  [/shoe|sandal|chappal|boot/i, '👟'],
  [/sock/i, '🧦'],
  [/bag|kit\b/i, '🎒'],
  [/note\s*book|notebook|long\s*book|exercise|copy|ruled/i, '📓'],
  [/dictionar/i, '📖'],
  [/atlas|map/i, '🗺️'],
  [/geometry|compass|scale|ruler/i, '📐'],
  [/pencil|pen\b|crayon|color|colour/i, '🖍️'],
  [/uniform|shirt|dress/i, '👕'],
  [/pant|trouser|short/i, '👖'],
  [/skirt|frock|pinafore/i, '👗'],
  [/tie\b|belt/i, '👔'],
  [/sweater|jacket/i, '🧥'],
  [/cap\b|hat/i, '🧢'],
  [/bottle|tiffin|lunch/i, '🍱'],
  [/hs\s*text|high\s*school/i, '📚'],
  [/text\s*book|textbook|\btb\b|prime|workbook|guide/i, '📘'],
];
const EMOJI_BY_TYPE = {
  'prime textbook': '📘', 'hs text books': '📚', 'notebooks': '📓', 'kits': '🎒', 'shoes': '👟',
};
export function itemEmoji(item) {
  const name = String(item?.name || '');
  for (const [re, em] of EMOJI_RULES) if (re.test(name)) return em;
  const byType = EMOJI_BY_TYPE[String(item?.category || '').trim().toLowerCase()];
  if (byType) return byType;
  for (const [re, em] of EMOJI_RULES) if (re.test(String(item?.category || ''))) return em;
  return '📦';
}

// ───────────────────────── Semester filter helpers (Stock / Requirement / Reports) ─────────────────────────
/** Semester of an item as a number (1, 2 ...), or null when the item has none (Kits, Notebooks, Shoes ...) */
export function itemSemester(item) {
  const n = parseInt(item && item.semester, 10);
  return isNaN(n) ? null : n;
}
/** Sorted list of the Semesters used by the catalog, e.g. [1, 2] */
export function semesterList(items) {
  return [...new Set((items || []).map(itemSemester).filter(n => n !== null))].sort((a, b) => a - b);
}
/** sem = null -> everything. Otherwise: items of that Semester, plus items without a Semester (same rule as the Receipt screen). */
export function semesterMatches(item, sem) {
  if (sem === null || sem === undefined) return true;
  const s = itemSemester(item);
  return s === null || s === sem;
}