// services/ReportService.js
// Loads the data, builds a report (ReportModel) and exports it as A4 PDF or Excel (.xlsx) via the Share sheet.
// Read-only: nothing is written to AsyncStorage.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { utils, write } from 'xlsx';
import CatalogService from './CatalogService';
import ItemTypeService from './ItemTypeService';
import SchoolService from './SchoolService';
import SettingsService from './SettingsService';
import StockService from './StockService';
import LedgerService from './LedgerService';
import ReceiptHistory from './ReceiptHistory';
import { semesterMatches } from './ItemModel';
import { receivedTotals } from './StockModel';
import {
  buildStockReport, buildRequirementReport, buildSchoolReport, buildReceiptsReport, buildSelectedSchoolReport,
} from './ReportModel';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const REPORTS = [
  { key: 'stock',       icon: '📊', title: 'Stock Report',        sub: 'Item వారీగా Received · Given · Balance' },
  { key: 'requirement', icon: '📉', title: 'Requirement & కొరత',  sub: 'Item వారీగా Required · Received · కొరత' },
  { key: 'school',      icon: '🏫', title: 'School-wise Report',  sub: 'School వారీగా ఏ items ఎంత ఇచ్చాం' },
  { key: 'selschool',   icon: '🎯', title: 'Selected School Report', sub: 'ఒక school: Required · Given · Remaining (size వారీగా)', needsSchool: true },
  { key: 'receipts',    icon: '🧾', title: 'Receipts List',       sub: 'అన్ని receipts (invoice, school, spell, total)' },
];

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

class ReportService {

  /** -> { report, meta: { shop, academicYear, generated } } */
  async build(key, opts = {}) {
    const settings = await SettingsService.get();
    const ay = settings.academicYear;
    let report;
    if (key === 'receipts') {
      report = buildReceiptsReport({ index: await ReceiptHistory.getAll(), academicYear: ay });
    } else {
      const [allItems, types] = await Promise.all([CatalogService.getAll(), ItemTypeService.getAll()]);
      const sem = opts.semester ?? null;                                 // Semester filter (null = all items)
      const items = allItems.filter(i => semesterMatches(i, sem));
      if (key === 'stock') {
        const [entries, given] = await Promise.all([StockService.getAll(), LedgerService.givenTotals(ay)]);
        report = buildStockReport({ items, types, received: receivedTotals(entries, ay), given });
      } else if (key === 'requirement') {
        const [entries, schools] = await Promise.all([StockService.getAll(), SchoolService.getAll()]);
        report = buildRequirementReport({ items, types, schools, received: receivedTotals(entries, ay) });
      } else if (key === 'school') {
        const [schools, given] = await Promise.all([SchoolService.getAll(), LedgerService.givenTotals(ay)]);
        report = buildSchoolReport({ items, types, schools, given });
      } else if (key === 'selschool') {
        const [schools, given] = await Promise.all([SchoolService.getAll(), LedgerService.givenTotals(ay)]);
        const school = schools.find(x => x.id === opts.schoolId);
        if (!school) throw new Error('School కనబడలేదు.');
        report = buildSelectedSchoolReport({ items, types, school, given });
      } else {
        throw new Error('తెలియని report.');
      }
    }
    if (!report.rows.length) throw new Error('ఈ report లో చూపడానికి data ఏమీ లేదు.');
    if (key !== 'receipts' && opts.semester != null) report.title += ` - Semester ${opts.semester}`;
    return {
      report,
      meta: {
        shop: `SRKVM Kits - ${settings.shopName || ''} Mandal`,
        academicYear: ay,
        generated: new Date().toLocaleString(),
      },
    };
  }

  buildHTML({ report, meta }) {
    const th = report.columns.map(c =>
      `<th style="text-align:${c.align || 'left'}">${esc(c.label)}</th>`).join('');
    const cell = (c, v) => `<td style="text-align:${c.align || 'left'}">${esc(v)}</td>`;
    const body = report.rows.map(r =>
      `<tr${r.sub ? ' class="sub"' : ''}>${report.columns.map(c => cell(c, r[c.key])).join('')}</tr>`).join('');
    const foot = report.totals
      ? `<tr class="tot">${report.columns.map(c => cell(c, report.totals[c.key] ?? '')).join('')}</tr>` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .meta { color: #555; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #E8E8F4; border: 1px solid #999; padding: 4px 5px; font-size: 10.5px; }
  td { border: 1px solid #bbb; padding: 3px 5px; }
  tr { page-break-inside: avoid; }
  tr.sub td { color: #444; font-size: 10px; }
  tr.tot td { font-weight: bold; background: #F3F3F3; }
  .note { margin-top: 6px; color: #555; }
</style></head><body>
<h1>${esc(report.title)}</h1>
<div class="meta">${esc(meta.shop)} · Academic Year ${esc(meta.academicYear)} · ${esc(meta.generated)}</div>
<table><thead><tr>${th}</tr></thead><tbody>${body}${foot}</tbody></table>
${report.note ? `<div class="note">${esc(report.note)}</div>` : ''}
</body></html>`;
  }

  async exportPDF(key, opts) {
    const built = await this.build(key, opts);
    const { uri } = await Print.printToFileAsync({ html: this.buildHTML(built), width: 595, height: 842 });   // A4 @72dpi
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: built.report.title, UTI: 'com.adobe.pdf' });
  }

  async exportExcel(key, opts) {
    const { report, meta } = await this.build(key, opts);
    const header = report.columns.map(c => c.label);
    const aoa = [header, ...report.rows.map(r => report.columns.map(c => r[c.key] ?? ''))];
    if (report.totals) aoa.push(report.columns.map(c => report.totals[c.key] ?? ''));
    const ws = utils.aoa_to_sheet(aoa);
    ws['!cols'] = report.columns.map(c => ({ wch: c.width || 12 }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, report.key.slice(0, 31));
    utils.book_append_sheet(wb, utils.aoa_to_sheet([
      [report.title], [meta.shop], [`Academic Year ${meta.academicYear}`], [`Generated ${meta.generated}`],
      ...(report.note ? [[report.note]] : []),
    ]), 'Info');
    const b64 = write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = FileSystem.cacheDirectory + `srkvm-${report.key}-${stamp()}.xlsx`;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
    await Sharing.shareAsync(uri, { mimeType: XLSX_MIME, dialogTitle: report.title, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
  }
}

export default new ReportService();