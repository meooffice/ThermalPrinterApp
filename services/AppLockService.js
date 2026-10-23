// services/AppLockService.js
// 6-digit PIN lock for the app. A casual-privacy lock for a shared phone, not bank-grade security.
// Only a salted, stretched hash of the PIN and of the recovery code is stored (never the PIN itself).
// Storage key 'app_lock' is NOT part of Backup/Restore (not in BackupService key list), so a restore on a new phone does not bring a PIN along.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY        = 'app_lock';
const ROUNDS     = 1000;
const MAX_TRIES  = 5;
const COOLDOWN_S = 30;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I

// ── SHA-256 (plain JS, ASCII input only: digits, hex salt, recovery code) ──
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

export function sha256(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

const randHex  = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const stretch  = (salt, secret) => { let h = `${salt}:${secret}`; for (let i = 0; i < ROUNDS; i++) h = sha256(`${salt}${h}`); return h; };
const newCode  = () => { const c = Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); return `${c.slice(0, 4)}-${c.slice(4)}`; };
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

let failed = 0;          // wrong tries since the last success (memory only)
let lockedUntil = 0;

class AppLockService {
  async _read() {
    try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  async isEnabled() {
    const v = await this._read();
    return !!(v && v.pinHash);
  }

  // Turns the lock on (or changes the PIN). Returns the NEW recovery code, to be shown to the user once.
  async enable(pin) {
    if (!/^\d{6}$/.test(String(pin))) throw new Error('PIN 6 అంకెలు ఉండాలి.');
    const salt = randHex(16), recSalt = randHex(16), code = newCode();
    await AsyncStorage.setItem(KEY, JSON.stringify({
      salt, pinHash: stretch(salt, pin),
      recSalt, recHash: stretch(recSalt, cleanCode(code)),
    }));
    failed = 0; lockedUntil = 0;
    return code;
  }

  // { ok } | { ok:false, left } (tries left before a short wait) | { ok:false, wait } (seconds to wait)
  async verify(pin) {
    const now = Date.now();
    if (now < lockedUntil) return { ok: false, wait: Math.ceil((lockedUntil - now) / 1000) };
    const v = await this._read();
    if (!v || !v.pinHash) return { ok: true };
    if (stretch(v.salt, String(pin)) === v.pinHash) { failed = 0; return { ok: true }; }
    failed += 1;
    if (failed >= MAX_TRIES) { failed = 0; lockedUntil = Date.now() + COOLDOWN_S * 1000; return { ok: false, wait: COOLDOWN_S }; }
    return { ok: false, left: MAX_TRIES - failed };
  }

  // Forgot PIN: the recovery code removes the lock (a new PIN can be set again in Settings)
  async verifyRecovery(code) {
    const v = await this._read();
    if (!v || !v.recHash) return false;
    if (stretch(v.recSalt, cleanCode(code)) !== v.recHash) return false;
    await this.disable();
    return true;
  }

  async disable() {
    await AsyncStorage.removeItem(KEY);
    failed = 0; lockedUntil = 0;
  }
}

export default new AppLockService();