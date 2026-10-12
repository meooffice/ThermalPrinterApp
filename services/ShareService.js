// services/ShareService.js
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Names may contain & < > — escape them so the PDF layout cannot break
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Size-wise lines (e.g. Shoes): { '20': 3, '21': -1 } -> "20x3, 21x-1"
const sizeText = (sizes) => !sizes || typeof sizes !== 'object' ? '' : Object.keys(sizes)
  .filter(s => parseInt(sizes[s], 10) !== 0 && !isNaN(parseInt(sizes[s], 10)))
  .sort((a, b) => (parseFloat(a) - parseFloat(b)) || a.localeCompare(b))
  .map(s => `${s}x${parseInt(sizes[s], 10)}`).join(', ');

class ShareService {

  // Build HTML version of the receipt
  buildReceiptHTML({ settings, school, spell, items, totalQty, invoiceNo }) {
    const mandal   = settings?.shopName || 'Mandal';
    const now      = new Date();
    const dateStr  = now.toLocaleDateString();
    const timeStr  = now.toLocaleTimeString();

    const itemRows = items
      .filter(i => i.name)
      .map(i => `
        <tr>
          <td>${parseInt(i.count || 0, 10) < 0 ? '* ' : ''}${esc(i.name)}${sizeText(i.sizes) ? `<br/><span style="font-size:11px">Size: ${esc(sizeText(i.sizes))}</span>` : ''}</td>
          <td style="text-align:center">${i.count || 0}</td>
        </tr>
      `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          body {
            font-family: monospace;
            max-width: 300px;
            margin: 0 auto;
            padding: 16px;
            font-size: 13px;
          }
          h1 {
            text-align: center;
            font-size: 18px;
            margin: 4px 0;
          }
          h2 {
            text-align: center;
            font-size: 14px;
            margin: 4px 0;
            font-weight: normal;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .divider-solid {
            border-top: 2px solid #000;
            margin: 8px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            text-align: left;
            border-bottom: 1px solid #000;
            padding: 4px 0;
          }
          td { padding: 3px 0; }
          .total-row {
            font-weight: bold;
            border-top: 1px solid #000;
            padding-top: 4px;
          }
          .footer {
            text-align: center;
            margin-top: 12px;
            font-size: 12px;
          }
          .sign-section {
            margin-top: 16px;
          }
          .sign-line {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <h1>SRKVM Kits</h1>
        <h2>${esc(mandal)} Mandal</h2>
        <div class="divider-solid"></div>

        ${invoiceNo ? `<div><strong>Invoice : ${esc(invoiceNo)}</strong></div>` : ''}
        <div>Date : ${dateStr}</div>
        <div>Time : ${timeStr}</div>
        <div><strong>Spell: Spell ${spell}</strong></div>
        <div class="divider"></div>

        ${school ? `
          <div><strong>School:</strong></div>
          <div>${esc(school.name)}</div>
          ${school.udise ? `<div>UDISE : ${esc(school.udise)}</div>` : ''}
          ${school.address ? `<div>${esc(school.address)}</div>` : ''}
          <div class="divider"></div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center">Count</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td>Total Items</td>
              <td style="text-align:center">
                ${items.filter(i => i.name).length}
              </td>
            </tr>
            <tr class="total-row">
              <td>Total Qty</td>
              <td style="text-align:center">${totalQty}</td>
            </tr>
          </tfoot>
        </table>

        <div class="divider-solid"></div>

        <div class="sign-section">
          <div class="sign-line">Received By:</div>
          <div class="sign-line">Name : ____________________</div>
          <div class="sign-line">Sign : ____________________</div>
        </div>

        <div class="divider-solid"></div>
        <div class="footer">${esc(settings?.shopTagline || 'Thank you!')}</div>
      </body>
      </html>
    `;
  }

  // Generate PDF and share it
  async sharePDF(receiptData) {
    const html  = this.buildReceiptHTML(receiptData);
    const { uri } = await Print.printToFileAsync({ html, width: 300 });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Receipt PDF',
      UTI: 'com.adobe.pdf',
    });
  }

  // Print to system printer (other apps)
  async printViaSystem(receiptData) {
    const html = this.buildReceiptHTML(receiptData);
    await Print.printAsync({ html, width: 300 });
  }
}

export default new ShareService();