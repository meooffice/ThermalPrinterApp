// services/DriveBackupService.js
// Automatic backup to the user's Google Drive (hidden appDataFolder, ONE file that is overwritten = "latest only").
// Reuses BackupService.buildPayload / inspect / restore. Never touches existing app data keys.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import BackupService from './BackupService';

// 👉 Google Cloud Console లో create చేసిన "Web application" OAuth Client ID ఇక్కడ పెట్టండి
export const WEB_CLIENT_ID = '378761747962-tc6m4cnonmun1ecfinsvo07jtkb09jb0.apps.googleusercontent.com';

const META_KEY    = 'drive_backup_meta';            // not included in Backup (not in BackupService key list)
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME   = 'tprint-backup-latest.json';
const API         = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_HOUR = 19;                             // 7 PM
const RETRY_MS    = 30 * 60 * 1000;                 // after a failure, wait 30 min before retrying

let configured = false;
let running    = null;                              // shared promise: only one backup at a time

const configure = () => {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
};

const parseJSON = (raw) => { try { return JSON.parse(raw); } catch { return undefined; } };

// Most recent 7 PM that has already passed (today if it is past 7 PM, otherwise yesterday)
export function lastDueBoundary(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), BACKUP_HOUR, 0, 0, 0);
  if (now.getTime() < d.getTime()) d.setDate(d.getDate() - 1);
  return d;
}

class DriveBackupService {

  async getMeta() {
    const m = parseJSON(await AsyncStorage.getItem(META_KEY));
    return { enabled: false, email: null, lastBackupAt: null, lastError: null, lastAttemptAt: null, ...(m || {}) };
  }
  async setMeta(patch) {
    const m = { ...(await this.getMeta()), ...patch };
    await AsyncStorage.setItem(META_KEY, JSON.stringify(m));
    return m;
  }

  // ── Google account ────────────────────────────────────────────────
  _emailOf(res) {
    const data = res && res.data ? res.data : res;
    return (data && data.user && data.user.email) || null;
  }

  async _accessToken() {
    configure();
    const t = await GoogleSignin.getTokens();
    if (!t || !t.accessToken) throw new Error('Google token రాలేదు. మళ్ళీ sign in చేయండి.');
    return t.accessToken;
  }

  // First-time sign in (shows account picker + permission). Returns email.
  async signIn() {
    configure();
    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    if (res && res.type === 'cancelled') throw new Error('Sign in రద్దు చేశారు.');
    try { await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] }); } catch { /* already granted / unsupported */ }
    return this._emailOf(res);
  }

  async signOut() {
    configure();
    try { await GoogleSignin.signOut(); } catch { /* ignore */ }
  }

  // Silent sign in (no UI). Throws if the user must sign in again.
  async _ensureSignedIn() {
    configure();
    let u = GoogleSignin.getCurrentUser ? GoogleSignin.getCurrentUser() : null;
    if (!u) {
      const res = await GoogleSignin.signInSilently();
      if (res && res.type && res.type !== 'success') {
        throw new Error('Google sign in మళ్ళీ చేయాలి (Settings లో Auto Backup ఆఫ్/ఆన్ చేయండి).');
      }
    }
  }

  // fetch with one retry after refreshing an expired token
  async _fetch(url, init = {}) {
    await this._ensureSignedIn();
    let token = await this._accessToken();
    const call = (tk) => fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${tk}` } });
    let res = await call(token);
    if (res.status === 401) {
      try { await GoogleSignin.clearCachedAccessToken(token); } catch { /* ignore */ }
      token = await this._accessToken();
      res = await call(token);
    }
    if (!res.ok) {
      let msg = '';
      try { msg = (await res.json()).error.message; } catch { /* ignore */ }
      throw new Error(`Drive error ${res.status}${msg ? ': ' + msg : ''}`);
    }
    return res;
  }

  // ── Drive file ────────────────────────────────────────────────────
  async _findFile() {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const res = await this._fetch(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`);
    const j = await res.json();
    return (j.files && j.files[0]) || null;
  }

  // Info about the backup currently in Drive (null = none)
  async remoteInfo() {
    const f = await this._findFile();
    return f ? { id: f.id, modifiedTime: f.modifiedTime } : null;
  }

  async _upload(payloadText) {
    const existing = await this._findFile();
    const boundary = 'tprint' + Date.now();
    const meta = existing ? { name: FILE_NAME } : { name: FILE_NAME, parents: ['appDataFolder'] };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${payloadText}\r\n` +
      `--${boundary}--`;
    const url = existing
      ? `${UPLOAD_API}/files/${existing.id}?uploadType=multipart`
      : `${UPLOAD_API}/files?uploadType=multipart`;
    await this._fetch(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }

  // Download backup from Drive → { payload, summary, exportedAt } (validated, same shape as pickBackup)
  async downloadBackup() {
    const f = await this._findFile();
    if (!f) throw new Error('Drive లో backup లేదు.');
    const res = await this._fetch(`${API}/files/${f.id}?alt=media`);
    const payload = parseJSON(await res.text());
    if (payload === undefined) throw new Error('Drive file చదవలేకపోయాను.');
    return BackupService.inspect(payload);
  }

  // ── Backup now ────────────────────────────────────────────────────
  // Returns { summary, at }. Throws on failure (and records lastError).
  backupNow() {
    if (running) return running;
    running = (async () => {
      await this.setMeta({ lastAttemptAt: new Date().toISOString() });
      try {
        const payload = await BackupService.buildPayload();
        if (Object.keys(payload.data).length === 0) {
          throw new Error('Backup చేయడానికి data ఏమీ లేదు.');
        }
        const { summary } = BackupService.inspect(payload); // same validation as manual backup
        await this._upload(JSON.stringify(payload));
        const at = new Date().toISOString();
        await this.setMeta({ lastBackupAt: at, lastError: null });
        return { summary, at };
      } catch (e) {
        await this.setMeta({ lastError: e.message || String(e) });
        throw e;
      }
    })().finally(() => { running = null; });
    return running;
  }

  // Auto: runs only if enabled and a 7 PM boundary has passed since the last backup.
  // Silent: never throws, never shows UI. Returns true if a backup was made.
  async runIfDue() {
    try {
      const m = await this.getMeta();
      if (!m.enabled) return false;
      const last = m.lastBackupAt ? new Date(m.lastBackupAt).getTime() : 0;
      if (last >= lastDueBoundary().getTime()) return false;                 // already done for this slot
      const tried = m.lastAttemptAt ? new Date(m.lastAttemptAt).getTime() : 0;
      if (m.lastError && Date.now() - tried < RETRY_MS) return false;        // failed recently, wait
      await this.backupNow();
      return true;
    } catch {
      return false; // error already stored in meta
    }
  }
}

export default new DriveBackupService();