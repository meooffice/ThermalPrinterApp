// services/EscPosEncoder.js
const ESC = 0x1b;
const GS  = 0x1d;

export default class EscPosEncoder {
  constructor() {
    this._buffer = [];
  }

  _push(...bytes) {
    this._buffer.push(...bytes);
    return this;
  }

  _pushText(text) {
    for (let i = 0; i < text.length; i++) {
      this._buffer.push(text.charCodeAt(i) & 0xff);
    }
    return this;
  }

  initialize() {
    return this._push(ESC, 0x40);
  }

  align(value) {
    const n = value === 'center' ? 1 : value === 'right' ? 2 : 0;
    return this._push(ESC, 0x61, n);
  }

  size(value) {
    const map = {
      normal:          0x00,
      'double-height': 0x01,
      'double-width':  0x10,
      double:          0x11,
    };
    return this._push(GS, 0x21, map[value] ?? 0x00);
  }

  bold(on) {
    return this._push(ESC, 0x45, on ? 1 : 0);
  }

  underline(on) {
    return this._push(ESC, 0x2d, on ? 1 : 0);
  }

  text(value) {
    return this._pushText(value);
  }

  newline(n = 1) {
    for (let i = 0; i < n; i++) this._buffer.push(0x0a);
    return this;
  }

  divider(char = '-', width = 32) {
    return this.text(char.repeat(width)).newline();
  }

  row(left, right, width = 32) {
    const space = width - left.length - right.length;
    const line  = left + ' '.repeat(Math.max(space, 1)) + right;
    return this.text(line).newline();
  }

  cut(partial = false) {
    return this._push(GS, 0x56, partial ? 0x01 : 0x00);
  }

  beep(times = 1, duration = 2) {
    return this._push(ESC, 0x42, times, duration);
  }

  /**
   * Print a raster bitmap using ESC/POS "GS v 0" command.
   *
   * @param {Uint8ClampedArray|Buffer} rgbaData  Flat RGBA array (4 bytes per pixel).
   *                                             This is exactly what jimp gives via bitmap.data.
   * @param {number} imgW   Image width in pixels.
   * @param {number} imgH   Image height in pixels.
   * @param {number} [threshold=128]  Luminance cutoff — pixels darker than this print black.
   *
   * Command format:  GS 0x76 0x30  m  xL xH  yL yH  [data]
   *   m    = 0x00  normal density
   *   xL/H = bytes per row = ceil(width / 8)
   *   yL/H = number of rows = height
   *   data = raster bytes, MSB = leftmost pixel, 1 = black
   */
  imageBitmap(rgbaData, imgW, imgH, threshold = 128) {
    const bytesPerRow = Math.ceil(imgW / 8);
    const raster      = [];

    for (let y = 0; y < imgH; y++) {
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x < imgW) {
            const i   = (y * imgW + x) * 4;
            const r   = rgbaData[i];
            const g   = rgbaData[i + 1];
            const b   = rgbaData[i + 2];
            const a   = rgbaData[i + 3];
            // Transparent pixels → white (don't print)
            const lum = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < threshold) byte |= (0x80 >> bit);
          }
        }
        raster.push(byte);
      }
    }

    const xL = bytesPerRow & 0xff;
    const xH = (bytesPerRow >> 8) & 0xff;
    const yL = imgH & 0xff;
    const yH = (imgH >> 8) & 0xff;

    this._push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);
    this._buffer.push(...raster);
    return this;
  }

  encode() {
    return new Uint8Array(this._buffer);
  }

  encodeBase64() {
    const bytes = this.encode();
    let binary  = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }
}