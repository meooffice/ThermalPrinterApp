// services/YearCloseService.js
// Academic Year Close: promote school rolls, clear the year's receipts and stock, move to the next year.
//
// Safe order (the app already separates data by academic year, so old receipts/stock of a closed year are
// ignored by every count):
//   1. ONE atomic multiSet: shop_settings (new academicYear) + schools_list (promoted rolls)
//   2. then remove receipts ('receipt_index', 'receipt:<id>'), 'stock_entries' and the new year's counter key
// If step 2 fails, the new year is already active and the old data is only leftovers.
// NOT touched: Items, Item Types, Settings (other fields), 'receipt_history' (legacy), old invoice counters.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidAcademicYear, nextAcademicYear } from './AcademicYear';
import { classRange } from './SchoolModel';
import { INDEX_KEY, RECEIPT_PREFIX } from './ReceiptModel';
import { STOCK_KEY } from './StockModel';

const SETTINGS_KEY = 'shop_settings';
const SCHOOLS_KEY  = 'schools_list';

const rollTotal = (roll, classes) =>
  classes.reduce((s, c) => s + (Number(roll?.[c]?.b) || 0) + (Number(roll?.[c]?.g) || 0), 0);

/**
 * Class N takes the old class N-1 roll. The lowest class keeps its roll (new admissions are unknown).
 * The old highest class leaves. -> { newRoll } or null when the school has no class range.
 */
export function promoteRoll(school) {
  const classes = classRange(school.minClass, school.maxClass);
  if (classes.length === 0) return null;
  const min = classes[0];
  const newRoll = {};
  classes.forEach(c => {
    const src = c === min ? school.roll?.[c] : school.roll?.[c - 1];
    newRoll[c] = { b: Number(src?.b) || 0, g: Number(src?.g) || 0 };
  });
  return newRoll;
}

export function planRolls(schools) {
  return (schools || []).map(s => {
    const classes = classRange(s.minClass, s.maxClass);
    const newRoll = promoteRoll(s);
    return {
      id: s.id, name: s.name, classes,
      oldRoll: s.roll || {}, newRoll,
      oldTotal: rollTotal(s.roll, classes),
      newTotal: newRoll ? rollTotal(newRoll, classes) : 0,
    };
  });
}

async function readJSON(key, fallback) {
  const raw = await AsyncStorage.getItem(key);          // throws on storage error (never treated as empty)
  if (raw === null) return fallback;
  const v = JSON.parse(raw);
  return v;
}

class YearCloseService {

  async preview() {
    const settings = await readJSON(SETTINGS_KEY, null);
    const ay = settings?.academicYear;
    if (!isValidAcademicYear(ay)) throw new Error('Settings లో Academic Year సరిగా లేదు.');
    const schools = await readJSON(SCHOOLS_KEY, []);
    if (!Array.isArray(schools)) throw new Error('Schools data పాడైంది.');
    const index = await readJSON(INDEX_KEY, []);
    const stock = await readJSON(STOCK_KEY, []);
    return {
      academicYear: ay,
      nextYear: nextAcademicYear(ay),
      receipts: Array.isArray(index) ? index.length : 0,
      stockEntries: Array.isArray(stock) ? stock.length : 0,
      plans: planRolls(schools),
    };
  }

  /** Runs the close. Returns { nextYear, removedReceipts, removedStock }. Throws before changing anything if data is unreadable. */
  async execute() {
    const settings = await readJSON(SETTINGS_KEY, null);
    if (!settings || !isValidAcademicYear(settings.academicYear)) throw new Error('Settings లో Academic Year సరిగా లేదు.');
    const schools = await readJSON(SCHOOLS_KEY, []);
    if (!Array.isArray(schools)) throw new Error('Schools data పాడైంది.');

    const nextYear = nextAcademicYear(settings.academicYear);
    const promoted = schools.map(s => {
      const newRoll = promoteRoll(s);
      return newRoll ? { ...s, roll: newRoll } : s;
    });

    // 1. atomic: new year + promoted rolls
    await AsyncStorage.multiSet([
      [SETTINGS_KEY, JSON.stringify({ ...settings, academicYear: nextYear })],
      [SCHOOLS_KEY,  JSON.stringify(promoted)],
    ]);

    // 2. clear the closed year's receipts / stock; the new year's invoice counter starts again at 0001
    const allKeys = await AsyncStorage.getAllKeys();
    const receiptKeys = allKeys.filter(k => k === INDEX_KEY || k.startsWith(RECEIPT_PREFIX));
    const removeKeys = [...receiptKeys, STOCK_KEY, `invoice_serial_${nextYear}`];
    await AsyncStorage.multiRemove(removeKeys);

    return {
      nextYear,
      removedReceipts: receiptKeys.filter(k => k !== INDEX_KEY).length,
    };
  }
}

export default new YearCloseService();