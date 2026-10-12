// services/SchoolModel.js
// Pure helpers for the school model (no storage access).
//
// School shape (new fields are additive; old schools simply have them empty):
// { id, name, udise, address, items: [],
//   type: 'FS'|'PS'|'UPS'|'HS'|'HS+'|'',      // label only
//   minClass, maxClass,                        // numbers 1..12 or null
//   roll: { '6': { b: 22, g: 20 }, ... } }     // Boys / Girls count per class, only for minClass..maxClass

export const SCHOOL_TYPES = ['FS', 'PS', 'UPS', 'HS', 'HS+'];
export const MAX_CLASS = 12;
const MAX_ROLL = 999;

const toInt = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? parseInt(String(v).trim(), 10) : NaN);

/** Classes minClass..maxClass (empty array if the range is not set). */
export function classRange(minClass, maxClass) {
  const a = Number(minClass), b = Number(maxClass);
  if (!(a >= 1 && b <= MAX_CLASS && a <= b)) return [];
  const out = [];
  for (let c = a; c <= b; c++) out.push(c);
  return out;
}

/** Roll summary of a stored school: { hasRange, boys, girls, total } */
export function rollSummary(school) {
  const classes = classRange(school?.minClass, school?.maxClass);
  let boys = 0, girls = 0;
  classes.forEach(c => {
    const r = school.roll?.[c];
    if (r) { boys += Number(r.b) || 0; girls += Number(r.g) || 0; }
  });
  return { hasRange: classes.length > 0, boys, girls, total: boys + girls };
}

function parseRange(minRaw, maxRaw) {
  const a = String(minRaw ?? '').trim(), b = String(maxRaw ?? '').trim();
  if (!a && !b) return { min: null, max: null };
  if (!a || !b) return { error: 'Min, Max తరగతి రెండూ ఇవ్వండి (లేదా రెండూ ఖాళీ).' };
  const min = toInt(a), max = toInt(b);
  if (isNaN(min) || isNaN(max) || min < 1 || max > MAX_CLASS) return { error: `తరగతి 1 నుండి ${MAX_CLASS} మధ్య ఉండాలి.` };
  if (min > max) return { error: 'Min తరగతి, Max కంటే ఎక్కువ ఉండకూడదు.' };
  return { min, max };
}

/**
 * Validate the Add/Edit form and build the data to store.
 * form: { name, udise, address, type, minClass, maxClass, roll: { [class]: { b, g } } (strings) }
 * Returns { error } or { data, dropped } — dropped = classes (outside Min–Max) whose non-zero roll will be removed.
 */
export function buildSchoolData(form, allSchools, editId) {
  const name = (form.name || '').trim();
  if (!name) return { error: 'School name required.' };

  const udise = (form.udise || '').trim();
  if (udise) {
    const dup = allSchools.find(s => s.id !== editId && (s.udise || '') === udise);
    if (dup) return { error: `UDISE ${udise} ఇప్పటికే "${dup.name}" కి ఉంది.` };
  }

  const type = form.type || '';
  if (type && !SCHOOL_TYPES.includes(type)) return { error: 'School Type సరికాదు.' };

  const range = parseRange(form.minClass, form.maxClass);
  if (range.error) return { error: range.error };

  const roll = {};
  const dropped = [];
  const inRange = classRange(range.min, range.max);
  const entries = form.roll || {};
  for (const [cl, v] of Object.entries(entries)) {
    const bStr = String(v?.b ?? '').trim(), gStr = String(v?.g ?? '').trim();
    const b = bStr === '' ? 0 : toInt(bStr), g = gStr === '' ? 0 : toInt(gStr);
    if (isNaN(b) || isNaN(g) || b > MAX_ROLL || g > MAX_ROLL) return { error: `తరగతి ${cl}: సంఖ్య 0 నుండి ${MAX_ROLL} మధ్య ఉండాలి.` };
    if (!inRange.includes(Number(cl)) && (b > 0 || g > 0)) dropped.push(Number(cl));
  }
  inRange.forEach(c => {
    const v = entries[c] || {};
    const bStr = String(v.b ?? '').trim(), gStr = String(v.g ?? '').trim();
    roll[c] = { b: bStr === '' ? 0 : toInt(bStr), g: gStr === '' ? 0 : toInt(gStr) };
  });
  dropped.sort((x, y) => x - y);

  return {
    data: { name, udise, address: (form.address || '').trim(), type, minClass: range.min, maxClass: range.max, roll },
    dropped,
  };
}

// ───────────────────────── Import (Excel / CSV rows) ─────────────────────────

const normKey = (k) => String(k).toLowerCase().replace(/[\s_\-]/g, '');
const ALIASES = {
  udise: 'udise', udisecode: 'udise',
  name: 'name', schoolname: 'name',
  type: 'type', schooltype: 'type',
  address: 'address',
  minclass: 'minClass', min: 'minClass', maxclass: 'maxClass', max: 'maxClass',
};

/**
 * Raw rows (keyed by header) → one result per non-empty row:
 *   { rowNo, status: 'new'|'update'|'error', name, udise, data?, id?, error? }
 * Template format (has Type / MinClass / MaxClass columns): UDISE required; same UDISE = update.
 * Legacy format (Name, UDISE, Address only): add-only, as before.
 */
export function rowsToSchools(rawRows, existing) {
  const results = [];
  if (!rawRows || rawRows.length === 0) return results;

  const headerMap = {};
  Object.keys(rawRows[0]).forEach(k => {
    const nk = normKey(k);
    if (ALIASES[nk]) headerMap[k] = ALIASES[nk];
    else if (/^c\d{1,2}[bg]$/.test(nk)) headerMap[k] = nk;           // c6b, c6g
  });
  const fields  = new Set(Object.values(headerMap));
  const isTemplate = fields.has('type') || fields.has('minClass') || fields.has('maxClass');
  const hasRoll    = [...fields].some(f => /^c\d+[bg]$/.test(f));

  const byUdise = new Map();
  (existing || []).forEach(s => { if (s.udise) byUdise.set(String(s.udise), s); });
  const seen = new Set();

  rawRows.forEach((raw, idx) => {
    const v = {};
    Object.keys(headerMap).forEach(k => { v[headerMap[k]] = String(raw[k] ?? '').trim(); });
    if (Object.values(v).every(x => x === '')) return;

    const res  = { rowNo: idx + 2, name: v.name || '', udise: v.udise || '', status: 'error', error: '' };
    const fail = (msg) => { res.error = msg; results.push(res); };

    if (!v.name) return fail('School Name ఖాళీగా ఉంది');

    if (!isTemplate) {                                               // legacy: Name, UDISE, Address
      results.push({ ...res, status: 'new', data: { name: v.name, udise: v.udise || '', address: v.address || '' }, error: '' });
      return;
    }

    if (!v.udise) return fail('UDISE ఖాళీగా ఉంది');
    if (seen.has(v.udise)) return fail('ఈ UDISE ఫైల్ లో ఇప్పటికే ఉంది');
    seen.add(v.udise);

    if (!v.type) return fail('Type ఖాళీగా ఉంది');
    const type = SCHOOL_TYPES.find(t => t.toLowerCase() === v.type.toLowerCase());
    if (!type) return fail(`Type "${v.type}" సరికాదు (FS / PS / UPS / HS / HS+)`);

    const range = parseRange(v.minClass, v.maxClass);
    if (range.error) return fail(range.error);
    if (range.min === null) return fail('MinClass, MaxClass ఇవ్వండి');
    const inRange = classRange(range.min, range.max);

    const roll = {};
    for (let c = 1; c <= MAX_CLASS; c++) {
      const bRaw = v[`c${c}b`] ?? '', gRaw = v[`c${c}g`] ?? '';
      const b = bRaw === '' ? 0 : toInt(bRaw), g = gRaw === '' ? 0 : toInt(gRaw);
      if (isNaN(b) || isNaN(g) || b > MAX_ROLL || g > MAX_ROLL) return fail(`తరగతి ${c}: Roll సంఖ్య సరికాదు`);
      if (inRange.includes(c)) roll[c] = { b, g };
      else if (b > 0 || g > 0) return fail(`తరగతి ${c} కి Roll ఉంది కానీ MinClass–MaxClass (${range.min}–${range.max}) బయట ఉంది`);
    }

    const match = byUdise.get(v.udise) || null;
    const data = { name: v.name, udise: v.udise, address: v.address || '', type, minClass: range.min, maxClass: range.max, roll };
    if (match) {                                                     // keep existing values for columns not in the file
      if (!fields.has('address')) delete data.address;
      if (!hasRoll) delete data.roll;
    }
    results.push({ ...res, status: match ? 'update' : 'new', id: match ? match.id : undefined, data, error: '' });
  });
  return results;
}

// ───────────────────────── UDISE+ "Enrolment Details" import ─────────────────────────
// File: 3 title rows, then a header row: S.NO, UDISE Code, School Name, PP3(Boys) … Class 1(Boys), Class 1(Girls),
// Class 1(Trans), Class 1(Total) … Only Class 1–12 are used (PP ignored); Trans is added to Boys.

const normHdr = (h) => String(h ?? '').toLowerCase().replace(/\s+/g, '');

/** Parse array-of-arrays of the sheet. Returns null if it is not a UDISE+ enrolment sheet. */
export function parseUdiseEnrolment(aoa) {
  if (!Array.isArray(aoa)) return null;
  let hIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 12); i++) {
    const cells = (aoa[i] || []).map(normHdr);
    if (cells.includes('udisecode') && cells.includes('schoolname') && cells.some(c => /^class\d+\(boys\)$/.test(c))) { hIdx = i; break; }
  }
  if (hIdx < 0) return null;

  const hdr = aoa[hIdx].map(normHdr);
  const col = { udise: hdr.indexOf('udisecode'), name: hdr.indexOf('schoolname'), b: {}, g: {}, t: {} };
  for (let c = 1; c <= MAX_CLASS; c++) {
    col.b[c] = hdr.indexOf(`class${c}(boys)`);
    col.g[c] = hdr.indexOf(`class${c}(girls)`);
    col.t[c] = hdr.indexOf(`class${c}(trans)`);
  }
  const ayMatch = String((aoa[0] || [])[0] ?? '').match(/AY\s*:\s*(\d{4}-\d{2})/i);

  const num = (row, i) => {
    if (i < 0) return 0;
    const v = String(row[i] ?? '').trim();
    return /^\d+$/.test(v) ? parseInt(v, 10) : (v === '' ? 0 : NaN);
  };

  const rows = [];
  for (let r = hIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const udise = String(row[col.udise] ?? '').trim();
    const name  = String(row[col.name] ?? '').trim();
    if (!udise && !name) continue;
    const item = { rowNo: r + 1, udise, name, roll: {}, trans: 0, bad: '' };
    for (let c = 1; c <= MAX_CLASS; c++) {
      const b = num(row, col.b[c]), g = num(row, col.g[c]), t = num(row, col.t[c]);
      if (isNaN(b) || isNaN(g) || isNaN(t) || b + t > MAX_ROLL || g > MAX_ROLL) { item.bad = `తరగతి ${c}: సంఖ్య సరికాదు`; break; }
      item.roll[c] = { b: b + t, g };           // Trans students are counted with Boys
      item.trans += t;
    }
    rows.push(item);
  }
  return { ay: ayMatch ? ayMatch[1] : null, rows };
}

/** School type label guessed from the classes that have students (label only – can be edited later). */
export function guessType(min, max) {
  if (max <= 5) return 'PS';
  if (max <= 8) return 'UPS';
  return min >= 6 ? 'HS' : 'HS+';
}

const sumRoll = (roll, classes) => classes.reduce((t, c) => {
  const r = roll?.[c]; return { b: t.b + (Number(r?.b) || 0), g: t.g + (Number(r?.g) || 0) };
}, { b: 0, g: 0 });

/**
 * Parsed UDISE rows + stored schools → { rows, unchanged, missing }
 *   rows      : changed / new schools, same shape as rowsToSchools results plus
 *               { oldTotal, newTotal, warnings: [] } (preview shows old → new)
 *   unchanged : schools whose roll already matches
 *   missing   : stored schools (with a UDISE) that are not in the file – left untouched
 * Matching: UDISE code only (found = update, not found = new school). Trans students are added to Boys.
 * Existing school: only Roll of classes inside its Min–Max is replaced (name, address, type, items are kept).
 * Existing school without a class range: range (and type, if empty) is taken from the classes that have students.
 * New school: added with name, UDISE, guessed type, range from students, roll.
 */
export function udiseToSchools(parsed, existing) {
  const rows = [];
  let unchanged = 0;
  const list = existing || [];
  const byUdise = new Map();
  list.forEach(s => { if (s.udise) byUdise.set(String(s.udise), s); });
  const seen = new Set();
  const matchedIds = new Set();

  parsed.rows.forEach(r => {
    const res = { rowNo: r.rowNo, name: r.name, udise: r.udise, status: 'error', error: '', warnings: [] };
    const fail = (m) => { res.error = m; rows.push(res); };
    if (!r.udise) return fail('UDISE ఖాళీగా ఉంది');
    if (!r.name)  return fail('School Name ఖాళీగా ఉంది');
    if (r.bad)    return fail(r.bad);
    if (seen.has(r.udise)) return fail('ఈ UDISE ఫైల్ లో ఇప్పటికే ఉంది');
    seen.add(r.udise);

    const match = byUdise.get(r.udise) || null;     // match by UDISE only: not found = new school
    if (r.trans > 0) res.warnings.push(`Trans ${r.trans} → Boys లో కలిపాను`);

    const withStudents = [];
    for (let c = 1; c <= MAX_CLASS; c++) if ((r.roll[c].b + r.roll[c].g) > 0) withStudents.push(c);

    if (!match) {                                              // ── NEW school
      if (withStudents.length === 0) return fail('Class 1–12 లో విద్యార్థులు లేరు (skip)');
      const min = withStudents[0], max = withStudents[withStudents.length - 1];
      const roll = {};
      classRange(min, max).forEach(c => { roll[c] = { b: r.roll[c].b, g: r.roll[c].g }; });
      const t = sumRoll(roll, classRange(min, max));
      rows.push({ ...res, status: 'new', oldTotal: null, newTotal: t.b + t.g,
        data: { name: r.name, udise: r.udise, address: '', type: guessType(min, max), minClass: min, maxClass: max, roll } });
      return;
    }

    matchedIds.add(match.id);
    let min = match.minClass, max = match.maxClass;
    const data = {};
    if (!(classRange(min, max).length)) {                      // stored school has no class range yet
      if (withStudents.length === 0) return fail('Class 1–12 లో విద్యార్థులు లేరు, range set చేయలేను');
      min = withStudents[0]; max = withStudents[withStudents.length - 1];
      data.minClass = min; data.maxClass = max;
      if (!match.type) data.type = guessType(min, max);
    }
    const inRange = classRange(min, max);
    const outside = withStudents.filter(c => !inRange.includes(c));
    if (outside.length) res.warnings.push(`తరగతి ${outside.join(', ')} కి UDISE లో విద్యార్థులు ఉన్నారు కానీ school range (${min}–${max}) బయట, చేర్చలేదు`);

    const roll = { ...(match.roll || {}) };
    inRange.forEach(c => { roll[c] = { b: r.roll[c].b, g: r.roll[c].g }; });
    data.roll = roll;

    const before = sumRoll(match.roll, inRange), after = sumRoll(roll, inRange);
    const same = before.b === after.b && before.g === after.g
      && inRange.every(c => (Number(match.roll?.[c]?.b) || 0) === roll[c].b && (Number(match.roll?.[c]?.g) || 0) === roll[c].g)
      && !data.minClass;
    if (same) { unchanged++; return; }
    rows.push({ ...res, status: 'update', id: match.id, oldTotal: before.b + before.g, newTotal: after.b + after.g,
      oldBoys: before.b, oldGirls: before.g, newBoys: after.b, newGirls: after.g, data });
  });

  const missing = list.filter(s => s.udise && !seen.has(String(s.udise)) && !matchedIds.has(s.id)).length;
  return { rows, unchanged, missing };
}