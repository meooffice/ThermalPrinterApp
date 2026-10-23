// services/TemplateService.js
// Builds the upload-template Excel files inside the app (xlsx is already installed) and opens the Share sheet.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { utils, write } from 'xlsx';
import { DEFAULT_ITEM_ROWS, DEFAULT_ITEM_INSTRUCTIONS } from '../constants/DefaultItems';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ITEM_HEADERS = ['Code', 'Name', 'Type', 'SubType', 'ClassFrom', 'ClassTo', 'Semester', 'Sizes', 'Barcode',
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12'];

const pad = (arr) => [...arr, ...Array(Math.max(ITEM_HEADERS.length - arr.length, 0)).fill('')];
// The template already contains the items currently being distributed (constants/DefaultItems.js).
// Edit / delete rows in Excel as needed; the same list is the first-run default Item Catalog.
const ITEM_ROWS = DEFAULT_ITEM_ROWS.map(pad);

export function buildItemsTemplateWorkbook() {
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet([ITEM_HEADERS, ...ITEM_ROWS]);
  ws['!cols'] = ITEM_HEADERS.map((h, i) => ({ wch: i === 1 ? 26 : i < 9 ? 14 : 5 }));
  utils.book_append_sheet(wb, ws, 'Items');                       // data sheet FIRST
  const wsNotes = utils.aoa_to_sheet(DEFAULT_ITEM_INSTRUCTIONS);
  wsNotes['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 70 }, { wch: 22 }];
  utils.book_append_sheet(wb, wsNotes, 'Instructions');
  return wb;
}

// ───────── Schools template ─────────
const SCHOOL_HEADERS = ['UDISE', 'School Name', 'Type', 'Address', 'MinClass', 'MaxClass',
  ...Array.from({ length: 12 }, (_, i) => [`C${i + 1}_B`, `C${i + 1}_G`]).flat()];

function schoolRow(udise, name, type, address, min, max, rolls) {
  const row = [udise, name, type, address, min, max];
  for (let c = 1; c <= 12; c++) {
    const r = rolls[c];
    row.push(r ? r[0] : '', r ? r[1] : '');
  }
  return row;
}
// EXAMPLE rows – delete them before real use
const SCHOOL_SAMPLES = [
  schoolRow('36000000001', 'SAMPLE ZP High School', 'HS', 'Sample Village', 6, 10, { 6: [22, 20], 7: [25, 21], 8: [24, 26], 9: [23, 22], 10: [20, 24] }),
  schoolRow('36000000002', 'SAMPLE MPP Primary School', 'PS', 'Sample Village 2', 1, 5, { 1: [8, 7], 2: [9, 6], 3: [7, 8], 4: [10, 9], 5: [6, 7] }),
];
const SCHOOL_NOTES = [
  'SRKVM · Schools Upload Format',
  'ఒక school = ఒక row. ఉదాహరణ rows (Schools sheet) నిజమైన data వేసే ముందు తొలగించండి.',
  'UDISE, School Name, Type, MinClass, MaxClass తప్పనిసరి. UDISE unique: ఇదే UDISE ఉన్న school ఉంటే update అవుతుంది, లేకపోతే కొత్తది add అవుతుంది.',
  'Type: FS / PS / UPS / HS / HS+. MinClass, MaxClass: 1–12.',
  'C1_B … C12_B = ఆ తరగతిలో Boys సంఖ్య, C1_G … C12_G = Girls సంఖ్య. MinClass–MaxClass బయట తరగతులు ఖాళీగా ఉంచండి (ఖాళీ = 0).',
];

export function buildSchoolsTemplateWorkbook() {
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet([SCHOOL_HEADERS, ...SCHOOL_SAMPLES]);
  ws['!cols'] = SCHOOL_HEADERS.map((h, i) => ({ wch: i === 1 ? 30 : i === 3 ? 24 : i < 6 ? 12 : 6 }));
  utils.book_append_sheet(wb, ws, 'Schools');                     // data sheet FIRST
  utils.book_append_sheet(wb, utils.aoa_to_sheet(SCHOOL_NOTES.map(l => [l])), 'Instructions');
  return wb;
}

async function shareWorkbook(wb, fileName, title) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('ఈ device లో Share అందుబాటులో లేదు.');
  const b64 = write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = FileSystem.cacheDirectory + fileName;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
  await Sharing.shareAsync(uri, { mimeType: XLSX_MIME, dialogTitle: title, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
}

const TemplateService = {
  shareItemsTemplate:   () => shareWorkbook(buildItemsTemplateWorkbook(),   'SRKVM_Items_Template.xlsx',   'Items Template'),
  shareSchoolsTemplate: () => shareWorkbook(buildSchoolsTemplateWorkbook(), 'SRKVM_Schools_Template.xlsx', 'Schools Template'),
};

export default TemplateService;