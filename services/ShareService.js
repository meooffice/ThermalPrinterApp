// services/ShareService.js
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { APP_VERSION, APP_CREDITS } from '../constants/AppInfo';

// Names may contain & < > — escape them so the PDF layout cannot break
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Size-wise lines (e.g. Shoes): { '20': 3, '21': -1 } -> "20x3, 21x-1"
const sizeText = (sizes) => !sizes || typeof sizes !== 'object' ? '' : Object.keys(sizes)
  .filter(s => parseInt(sizes[s], 10) !== 0 && !isNaN(parseInt(sizes[s], 10)))
  .sort((a, b) => (parseFloat(a) - parseFloat(b)) || a.localeCompare(b))
  .map(s => `${s}x${parseInt(sizes[s], 10)}`).join(', ');

// A4 in points / pixels at 72 PPI
const A4_W = 595;
const A4_H = 842;

class ShareService {

  // Build HTML version of the receipt.
  // Layout: A4 page (595 x 842 px @72 PPI) = two identical A5 halves (top / bottom, dashed cut line).
  // A long receipt continues on the next page; every page again holds the same part twice.
  // when (Date) and duplicate (bool) are optional: used when an OLD receipt is shared again from History
  buildReceiptHTML({ settings, school, spell, items, totalQty, invoiceNo, when, duplicate }) {
    const mandal   = settings?.shopName || 'Mandal';
    const now      = when instanceof Date && !isNaN(when) ? when : new Date();
    const dateStr  = now.toLocaleDateString();
    const timeStr  = now.toLocaleTimeString();

    const rows = items.filter(i => i.name);

    // One item = 1 line (+1 when it has size-wise counts). Each half shows two columns of items.
    const PER_COL = 8;                                   // lines per column in one half
    const weight  = (i) => (sizeText(i.sizes) ? 2 : 1);
    const chunks  = [];
    let cur = [], used = 0;
    rows.forEach(i => {
      if (used + weight(i) > PER_COL * 2 && cur.length) { chunks.push(cur); cur = []; used = 0; }
      cur.push(i); used += weight(i);
    });
    chunks.push(cur);                                    // last chunk (may be empty when there are no items)

    const itemRow = (i) => `
      <tr>
        <td>${parseInt(i.count || 0, 10) < 0 ? '* ' : ''}${esc(i.name)}${sizeText(i.sizes) ? `<br/><span class="sz">Size: ${esc(sizeText(i.sizes))}</span>` : ''}</td>
        <td class="cnt">${i.count || 0}</td>
      </tr>`;
    const itemTable = (list) => `
      <table class="items">
        <thead><tr><th>Item</th><th class="cnt">Count</th></tr></thead>
        <tbody>${list.map(itemRow).join('')}</tbody>
      </table>`;

    // Split a chunk into left / right columns by line weight
    const columns = (chunk) => {
      const total = chunk.reduce((a, i) => a + weight(i), 0);
      let acc = 0, k = 0;
      while (k < chunk.length && acc < total / 2) { acc += weight(chunk[k]); k++; }
      return [chunk.slice(0, k), chunk.slice(k)];
    };

    const half = (chunk, idx) => {
      const last = idx === chunks.length - 1;
      const [left, right] = columns(chunk);
      return `
        <div class="half">
          <div class="head">
            <div>
              <div class="h1">SRKVM Kits</div>
              <div class="h2">${esc(mandal)} Mandal</div>
            </div>
            <div class="meta">
              ${invoiceNo ? `<div><strong>Invoice : ${esc(invoiceNo)}</strong></div>` : ''}
              <div>Date : ${dateStr} &nbsp; ${timeStr}</div>
              ${duplicate ? '<div><strong>DUPLICATE COPY</strong></div>' : ''}
              <div><strong>Spell ${esc(spell)}</strong>${chunks.length > 1 ? ` &nbsp; (${idx + 1}/${chunks.length})` : ''}</div>
            </div>
          </div>
          ${school ? `
            <div class="school">
              <strong>${esc(school.name)}</strong>${school.udise ? ` &nbsp; UDISE : ${esc(school.udise)}` : ''}
              ${school.address ? `<div>${esc(school.address)}</div>` : ''}
            </div>` : ''}
          <div class="cols">
            <div class="col">${left.length ? itemTable(left) : ''}</div>
            <div class="col">${right.length ? itemTable(right) : ''}</div>
          </div>
          ${last ? `
            <div class="totals">
              <span>Total Items : <strong>${rows.length}</strong></span>
              <span>Total Qty : <strong>${totalQty}</strong></span>
            </div>
            <div class="sign">
              <span>Received By :</span>
              <span>Name : ______________</span>
              <span>Sign : ______________</span>
            </div>` : `<div class="cont">… continued on next page</div>`}
          <div class="foot">
            <div>${esc(settings?.shopTagline || 'Thank you!')}</div>
            <div class="rule"></div>
            <div>${esc(APP_CREDITS)}</div>
            <div>SRKVM v${esc(APP_VERSION)}</div>
            <div class="rule"></div>
          </div>
        </div>`;
    };

    const pages = chunks.map((chunk, idx) => `
      <div class="page">
        ${half(chunk, idx)}
        <div class="cut"></div>
        ${half(chunk, idx)}
      </div>`).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          @page { size: 595px 842px; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; font-family: monospace; font-size: 11px; line-height: 14px; color: #000; }
          .page { width: 595px; height: 842px; page-break-after: always; overflow: hidden; }
          .page:last-child { page-break-after: auto; }
          .half { height: 420px; padding: 16px 20px 10px 20px; overflow: hidden; position: relative; }
          .cut  { height: 2px; border-top: 1px dashed #666; }
          .head { display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; }
          .h1   { font-size: 18px; line-height: 22px; font-weight: bold; }
          .h2   { font-size: 12px; }
          .meta { text-align: right; }
          .school { padding: 6px 0; border-bottom: 1px dashed #000; }
          .cols { display: flex; flex-direction: row; gap: 16px; padding-top: 6px; }
          .col  { flex: 1; }
          table.items { width: 100%; border-collapse: collapse; }
          table.items th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; }
          table.items td { padding: 1px 0; vertical-align: top; }
          .cnt  { text-align: center; width: 44px; }
          .sz   { font-size: 10px; }
          .totals { display: flex; flex-direction: row; justify-content: space-between; border-top: 1px solid #000; margin-top: 8px; padding-top: 4px; font-size: 12px; }
          .sign { display: flex; flex-direction: row; justify-content: space-between; margin-top: 18px; }
          .cont { margin-top: 8px; text-align: center; font-style: italic; }
          .foot { position: absolute; left: 20px; right: 20px; bottom: 6px; text-align: center; font-size: 10px; line-height: 13px; }
          .rule { border-top: 1px dashed #000; margin: 2px 0; }
        </style>
      </head>
      <body>${pages}</body>
      </html>
    `;
  }

  // Generate PDF and share it
  async sharePDF(receiptData) {
    const html  = this.buildReceiptHTML(receiptData);
    const { uri } = await Print.printToFileAsync({ html, width: A4_W, height: A4_H });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Receipt PDF',
      UTI: 'com.adobe.pdf',
    });
  }

  // Print to system printer (other apps)
  async printViaSystem(receiptData) {
    const html = this.buildReceiptHTML(receiptData);
    await Print.printAsync({ html, width: A4_W, height: A4_H });
  }
}

export default new ShareService();