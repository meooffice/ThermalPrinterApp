// services/ReceiptPrinter.js
// ESC/POS bytes of a receipt (logo + SRKVM header + items). Used by the Receipt screen (new receipt)
// and the History screen (Reprint -> same layout, with "DUPLICATE COPY"). Moved here from ReceiptScreen.js
// without changing the layout; nothing is sent to the printer here (BluetoothService does that).
import { unzlibSync } from 'fflate';
import EscPosEncoder from './EscPosEncoder';
import { APP_VERSION, APP_CREDITS } from '../constants/AppInfo';

// Target print width in dots (fits both 58mm and 80mm paper)
const LOGO_PRINT_WIDTH = 100;  // reduced — logo sits left of SRKVM text

// ─── Logo (baked-in base64) ───────────────────────────────────────────────────
// Replace the value below with your own logo PNG encoded as base64:
//   node -e "const fs=require('fs'); console.log(fs.readFileSync('./assets/srkv.png').toString('base64'));"
const LOGO_BASE64 = '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';

// ─── Logo cache ───────────────────────────────────────────────────────────────
let _logoCache = null;

// ─── Self-contained PNG decoder (fflate for inflate, no TextDecoder) ──────────
// Reads only IHDR + IDAT chunks — enough to get raw RGBA pixels for printing.
function parsePng(u8) {
  // Validate PNG signature
  const sig = [137,80,78,71,13,10,26,10];
  for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) throw new Error('Not a PNG');

  const view = new DataView(u8.buffer, u8.byteOffset);
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];

  while (pos < u8.length) {
    const length   = view.getUint32(pos);      pos += 4;
    const typeCode = view.getUint32(pos);      pos += 4;
    const type = String.fromCharCode(
      (typeCode >> 24) & 0xff, (typeCode >> 16) & 0xff,
      (typeCode >>  8) & 0xff,  typeCode        & 0xff
    );
    const data = u8.subarray(pos, pos + length); pos += length;
    pos += 4; // skip CRC

    if (type === 'IHDR') {
      width     = view.getUint32(8  + 4 + 4);  // re-read absolute offset
      height    = view.getUint32(8  + 4 + 8);
      // Use DataView on the chunk data directly
      const dv  = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width     = dv.getUint32(0);
      height    = dv.getUint32(4);
      bitDepth  = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height) throw new Error('PNG IHDR not found');
  if (bitDepth !== 8) throw new Error(`Unsupported bit depth: ${bitDepth}`);

  // Concatenate IDAT chunks and decompress (zlib)
  let totalLen = 0;
  for (const c of idatChunks) totalLen += c.length;
  const compressed = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of idatChunks) { compressed.set(c, offset); offset += c.length; }
  const raw = unzlibSync(compressed);

  // Channels per colorType: 0=Grey,2=RGB,3=Indexed,4=GreyA,6=RGBA
  const channels = [1,0,3,1,2,0,4][colorType];
  if (!channels) throw new Error(`Unsupported colorType: ${colorType}`);

  // PNG filter reconstruction (per scanline)
  const stride = width * channels;
  const rgba   = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const filterByte = raw[y * (stride + 1)];
    const src  = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y > 0 ? raw.subarray((y-1) * (stride+1) + 1, (y-1)*(stride+1)+1+stride) : null;
    const line = new Uint8Array(stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = (x >= channels && prev) ? prev[x - channels] : 0;
      let val = src[x];
      if      (filterByte === 1) val = (val + a) & 0xff;
      else if (filterByte === 2) val = (val + b) & 0xff;
      else if (filterByte === 3) val = (val + Math.floor((a + b) / 2)) & 0xff;
      else if (filterByte === 4) {
        // Paeth
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      line[x] = val;
    }

    // Write to RGBA output
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      if (colorType === 6) {           // RGBA
        rgba[di]   = line[x*4]; rgba[di+1] = line[x*4+1];
        rgba[di+2] = line[x*4+2]; rgba[di+3] = line[x*4+3];
      } else if (colorType === 2) {    // RGB
        rgba[di]   = line[x*3]; rgba[di+1] = line[x*3+1];
        rgba[di+2] = line[x*3+2]; rgba[di+3] = 255;
      } else if (colorType === 0) {    // Greyscale
        const v = line[x];
        rgba[di] = rgba[di+1] = rgba[di+2] = v; rgba[di+3] = 255;
      } else if (colorType === 4) {    // Greyscale+Alpha
        const v = line[x*2];
        rgba[di] = rgba[di+1] = rgba[di+2] = v; rgba[di+3] = line[x*2+1];
      }
    }
  }
  return { data: rgba, width, height };
}

function resizeRGBA(srcData, srcW, srcH, dstW, dstH) {
  const dst = new Uint8Array(dstW * dstH * 4);
  const xr  = srcW / dstW;
  const yr  = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(Math.floor(x * xr), srcW - 1);
      const sy = Math.min(Math.floor(y * yr), srcH - 1);
      const si = (sy * srcW + sx) * 4;
      const di = (y  * dstW + x)  * 4;
      dst[di]   = srcData[si];   dst[di+1] = srcData[si+1];
      dst[di+2] = srcData[si+2]; dst[di+3] = srcData[si+3];
    }
  }
  return dst;
}

async function loadLogo() {
  if (_logoCache) return _logoCache;
  try {
    // base64 → Uint8Array
    const binary = atob(LOGO_BASE64);
    const buf    = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

    // Decode PNG with our own parser (no TextDecoder, no native deps)
    const { data: rgba, width: w, height: h } = parsePng(buf);

    // Scale down if wider than target print width
    let finalData = rgba, finalW = w, finalH = h;
    if (w > LOGO_PRINT_WIDTH) {
      finalH = Math.round(h * LOGO_PRINT_WIDTH / w);
      finalW = LOGO_PRINT_WIDTH;
      finalData = resizeRGBA(rgba, w, h, finalW, finalH);
    }

    _logoCache = { data: finalData, width: finalW, height: finalH };
    return _logoCache;
  } catch (err) {
    console.warn('[ReceiptScreen] Logo load failed:', err.message);
    return null;
  }
}

export { loadLogo };

/**
 * Last lines of every receipt (between two dividers): credits (split at the comma when wider than the paper) + version.
 */
export function footerLines(width) {
  const out = [];
  const k = APP_CREDITS.indexOf(', ');
  if (APP_CREDITS.length <= width) out.push(APP_CREDITS);
  else if (k > 0 && k < width && APP_CREDITS.length - k - 2 <= width) out.push(APP_CREDITS.slice(0, k + 1), APP_CREDITS.slice(k + 2));
  else out.push(APP_CREDITS);
  out.push(`SRKVM v${APP_VERSION}`);
  return out;
}

/**
 * Extra text lines for an item given size-wise (item.sizes = { '20': 3, '21': -1 }), wrapped to the paper width:
 *   "  Size: 20x3, 21x-1"   -> [] for items without sizes (so normal items print exactly as before)
 */
export function sizeLines(item, width) {
  const sizes = item && item.sizes;
  if (!sizes || typeof sizes !== 'object') return [];
  const parts = Object.keys(sizes)
    .filter(s => parseInt(sizes[s], 10) !== 0 && !isNaN(parseInt(sizes[s], 10)))
    .sort((a, b) => (parseFloat(a) - parseFloat(b)) || a.localeCompare(b))
    .map(s => `${s}x${parseInt(sizes[s], 10)}`);
  if (parts.length === 0) return [];
  const lines = [];
  let cur = '  Size: ';
  parts.forEach((p, idx) => {
    const piece = p + (idx < parts.length - 1 ? ', ' : '');
    if (cur.trim() !== 'Size:' && (cur + piece).trimEnd().length > width) { lines.push(cur.trimEnd()); cur = '        '; }
    cur += piece;
  });
  lines.push(cur.trimEnd());
  return lines;
}

/**
 * settings, school ({ name, udise, address }), spell, items ([{ name, count }]), invoiceNo,
 * when (Date, default now), duplicate (true = reprint) -> base64 ESC/POS data
 */
export async function buildReceiptBase64({ settings, school, spell, items, invoiceNo, when = new Date(), duplicate = false }) {
  const totalQty = (items || []).reduce((s, i) => s + parseInt(i.count || 0), 0);
  const encoder = new EscPosEncoder();
  const width   = settings?.paperWidth || 32;
  const mandal  = settings?.shopName || 'Mandal';

  encoder.initialize().align('center');

  // ── Header: Logo LEFT + "SRKVM" text bitmap RIGHT ──
  const logo = await loadLogo();

  // ── Pixel font: 5-wide × 9-tall glyphs, each row is a 5-bit mask (MSB=left) ──
  const GLYPHS = {
    //         row0   row1   row2   row3   row4   row5   row6   row7   row8
    S: [0b01110,0b10001,0b10000,0b01110,0b00001,0b10001,0b01110,0b00000,0b00000],
    R: [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001,0b00000,0b00000],
    K: [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001,0b00000,0b00000],
    V: [0b10001,0b10001,0b10001,0b10001,0b01010,0b01010,0b00100,0b00000,0b00000],
    M: [0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001,0b00000,0b00000],
  };
  const GLYPH_W = 5, GLYPH_H = 9, GLYPH_GAP = 3;
  const LABEL   = ['S','R','K','V','M'];

  // 58mm paper = 384 dots wide
  const paperDots = 384;

  // Logo size — already resized to LOGO_PRINT_WIDTH in loadLogo
  const logoW = logo ? logo.width  : 0;
  const logoH = logo ? logo.height : 0;

  // Gap between logo and text
  const GAP = 16;
  // Available dot-width for the SRKVM text block
  const availForText = paperDots - logoW - GAP;
  // Max scale that fits all 5 letters: totalTxtW = (GLYPH_W*S)*5 + (GLYPH_GAP*S)*4 = S*(5*GLYPH_W+4*GLYPH_GAP)
  const SCALE   = Math.max(2, Math.floor(availForText / (LABEL.length * GLYPH_W + (LABEL.length - 1) * GLYPH_GAP)));
  const txtH    = GLYPH_H * SCALE;
  const txtW    = (GLYPH_W * SCALE) * LABEL.length + (GLYPH_GAP * SCALE) * (LABEL.length - 1);

  // Header height = taller of logo or text
  const headerH    = Math.max(logoH, txtH);
  const totalW     = paperDots;
  const txtStartX  = logoW + GAP;
  const logoStartY = Math.floor((headerH - logoH) / 2);
  const txtStartY  = Math.floor((headerH - txtH)  / 2);

  const totalBytes = Math.ceil(totalW / 8);
  const raster     = new Uint8Array(headerH * totalBytes);  // all white

  // ── Paint logo into LEFT of raster ──
  if (logo) {
    for (let y = 0; y < logoH; y++) {
      for (let x = 0; x < logoW; x++) {
        const i   = (y * logoW + x) * 4;
        const r   = logo.data[i], g = logo.data[i+1], b2 = logo.data[i+2], a = logo.data[i+3];
        const lum = a < 128 ? 255 : 0.299*r + 0.587*g + 0.114*b2;
        if (lum < 128) {
          const ry = logoStartY + y;
          const rx = x;
          raster[ry * totalBytes + Math.floor(rx / 8)] |= (0x80 >> (rx % 8));
        }
      }
    }
  }

  // ── Paint SRKVM glyphs into RIGHT side ──
  for (let ci = 0; ci < LABEL.length; ci++) {
    const glyph  = GLYPHS[LABEL[ci]];
    const charX0 = txtStartX + ci * (GLYPH_W * SCALE + GLYPH_GAP * SCALE);
    for (let gy = 0; gy < GLYPH_H; gy++) {
      const row = glyph[gy];
      for (let gx = 0; gx < GLYPH_W; gx++) {
        // MSB of 5-bit row = leftmost pixel
        if ((row >> (GLYPH_W - 1 - gx)) & 1) {
          for (let sy = 0; sy < SCALE; sy++) {
            for (let sx = 0; sx < SCALE; sx++) {
              const ry = txtStartY + gy * SCALE + sy;
              const rx = charX0 + gx * SCALE + sx;
              if (rx < totalW && ry < headerH) {
                raster[ry * totalBytes + Math.floor(rx / 8)] |= (0x80 >> (rx % 8));
              }
            }
          }
        }
      }
    }
  }

  // Send as single GS v 0 raster bitmap
  const xL = totalBytes & 0xff, xH = (totalBytes >> 8) & 0xff;
  const yL = headerH   & 0xff, yH = (headerH   >> 8) & 0xff;
  encoder._push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);
  encoder._buffer.push(...raster);
  encoder.newline();

  // ── Header ──
  encoder
    .bold(true).text(`${mandal} Mandal`).newline().bold(false)
    .divider('=', width)
    .align('left')
    .bold(true).text(`Invoice : ${invoiceNo || '-'}`).newline().bold(false)
    .text(`Date    : ${when.toLocaleDateString()}`).newline()
    .text(`Time    : ${when.toLocaleTimeString()}`).newline()
    .bold(true).text(`Spell   : Spell ${spell}`).newline()
    .bold(false).divider('-', width);

  if (duplicate) {
    encoder.align('center').bold(true).text('*** DUPLICATE COPY ***').newline().bold(false).align('left');
  }

  if (school) {
    encoder.bold(true).text('School:').bold(false).newline()
      .text(school.name).newline();
    if (school.udise)   encoder.text(`UDISE  : ${school.udise}`).newline();
    if (school.address) encoder.text(school.address).newline();
  }

  encoder.divider('-', width);
  const countCol = 6, nameCol = width - countCol - 1;
  encoder.bold(true).text('Item'.padEnd(nameCol) + 'Count').newline()
    .bold(false).divider('-', width);

  let hasReturn = false;
  items.forEach(item => {
    const isReturn = parseInt(item.count || 0, 10) < 0;
    if (isReturn) hasReturn = true;
    encoder.text(
      ((isReturn ? '* ' : '') + item.name).substring(0, nameCol).padEnd(nameCol) +
      String(item.count || 0).padStart(countCol)
    ).newline();
    sizeLines(item, width).forEach(l => encoder.text(l).newline());
  });
  if (hasReturn) encoder.text('* = Return (taken back)').newline();

  encoder.divider('-', width)
    .row('Total Items :', String(items.length), width)
    .bold(true).row('Total Qty   :', String(totalQty), width).bold(false)
    .divider('=', width)
    .align('left')
    .text('Received By:').newline().newline()
    .text('Name : ____________________').newline().newline()
    .text('Sign : ____________________').newline()
    .divider('=', width)
    .align('center')
    .text(settings?.shopTagline || 'Thank you!').newline()
    .divider('-', width);
  footerLines(width).forEach(l => encoder.text(l).newline());
  encoder.divider('-', width)
    .newline(3).cut();

  return encoder.encodeBase64();
}

/**
 * Preview only (nothing is printed, no invoice number is used): the text part of the receipt as
 * lines { t, bold, center } in the same order / widths as buildReceiptBase64 above.
 * invoiceNo is shown as given (the real number is only taken when printing).
 * If the text layout in buildReceiptBase64 changes, change this too.
 */
export function buildReceiptPreview({ settings, school, spell, items, invoiceNo, when = new Date(), duplicate = false }) {
  const list = items || [];
  const totalQty = list.reduce((s, i) => s + parseInt(i.count || 0), 0);
  const width  = settings?.paperWidth || 32;
  const mandal = settings?.shopName || 'Mandal';
  const L = [];
  const add = (t, o = {}) => L.push({ t, bold: !!o.bold, center: !!o.center });
  const div = (c) => add(c.repeat(width));
  const row = (l, r) => add(l + ' '.repeat(Math.max(width - l.length - r.length, 1)) + r);

  add('[ Logo ]  S R K V M', { center: true });
  add(`${mandal} Mandal`, { bold: true, center: true });
  div('=');
  add(`Invoice : ${invoiceNo || '-'}`, { bold: true });
  add(`Date    : ${when.toLocaleDateString()}`);
  add(`Time    : ${when.toLocaleTimeString()}`);
  add(`Spell   : Spell ${spell}`, { bold: true });
  div('-');
  if (duplicate) add('*** DUPLICATE COPY ***', { bold: true, center: true });
  if (school) {
    add('School:', { bold: true });
    add(school.name);
    if (school.udise)   add(`UDISE  : ${school.udise}`);
    if (school.address) add(school.address);
  }
  div('-');
  const countCol = 6, nameCol = width - countCol - 1;
  add('Item'.padEnd(nameCol) + 'Count', { bold: true });
  div('-');
  let hasReturn = false;
  list.forEach(item => {
    const isReturn = parseInt(item.count || 0, 10) < 0;
    if (isReturn) hasReturn = true;
    add(((isReturn ? '* ' : '') + item.name).substring(0, nameCol).padEnd(nameCol) + String(item.count || 0).padStart(countCol));
    sizeLines(item, width).forEach(l => add(l));
  });
  if (hasReturn) add('* = Return (taken back)');
  div('-');
  row('Total Items :', String(list.length));
  row('Total Qty   :', String(totalQty));
  L[L.length - 1].bold = true;
  div('=');
  add('Received By:');
  add('');
  add('Name : ____________________');
  add('');
  add('Sign : ____________________');
  div('=');
  add(settings?.shopTagline || 'Thank you!', { center: true });
  div('-');
  footerLines(width).forEach(l => add(l, { center: true }));
  div('-');
  return L;
}