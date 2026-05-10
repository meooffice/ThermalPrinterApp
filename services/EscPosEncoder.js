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
    return this._push(ESC, 0x40); // Reset printer
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

  // Two column row e.g. "Item name        $10.00"
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

  encode() {
    return new Uint8Array(this._buffer);
  }

  // Returns base64 string — used to send over Bluetooth
  encodeBase64() {
    const bytes = this.encode();
    let binary  = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }
}