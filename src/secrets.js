'use strict';
const { ipcMain, app, safeStorage } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const SECRET_KEYS = ['alToken','kitsuToken','kitsuSecret','kitsuEmail','asToken','unsplashKey'];

function installKeyPath() {
  return path.join(app.getPath('userData'), '.install-key');
}
function getInstallKey() {
  const fp = installKeyPath();
  try {
    if (fs.existsSync(fp)) { const k = fs.readFileSync(fp, 'utf8').trim(); if (k) return k; }
    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(fp, key, { mode: 0o600 });
    try { fs.chmodSync(fp, 0o600); } catch (e) {}
    return key;
  } catch (e) { return null; }
}
const SECRET_ANCHOR = process.env.SECRET_ANCHOR || getInstallKey() || 'zxs-animepulse-local';
function secretPath(key) {
  if (!SECRET_KEYS.includes(key)) return null;
  return path.join(app.getPath('userData'), 'secrets', key + '.enc');
}
function obfuscate(buf) {
  let key = crypto.createHash('sha256').update(SECRET_ANCHOR).digest();
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out;
}
function secretDir() {
  const dir = path.join(app.getPath('userData'), 'secrets');
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
  try { fs.chmodSync(dir, 0o700); } catch (e) {}
  return dir;
}

function registerSecretsIpc() {
  ipcMain.handle('secret:save', (e, key, value) => {
    try {
      const fp = secretPath(key);
      if (!fp) return { ok: false, error: 'clave-no-permitida' };
      const val = value === undefined || value === null ? '' : String(value);
      if (val === '') { if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (err) { /* noop */ } } return { ok: true }; }
      secretDir();
      let data;
      if (safeStorage.isEncryptionAvailable()) data = safeStorage.encryptString(val);
      else data = obfuscate(Buffer.from(val, 'utf8'));
      fs.writeFileSync(fp, data, { mode: 0o600 });
      try { fs.chmodSync(fp, 0o600); } catch (e) {}
      return { ok: true, backend: safeStorage.isEncryptionAvailable() ? 'safeStorage' : 'fallback' };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });
  ipcMain.handle('secret:load', (e, key) => {
    try {
      const fp = secretPath(key);
      if (!fp || !fs.existsSync(fp)) return '';
      const raw = fs.readFileSync(fp);
      if (safeStorage.isEncryptionAvailable()) {
        try { return safeStorage.decryptString(raw); } catch (err) { /* probar fallback */ }
      }
      const buf = obfuscate(raw);
      const txt = buf.toString('utf8');
      if (/^[ -~\n\r]*$/.test(txt)) return txt;
      return '';
    } catch (err) { return ''; }
  });
}

module.exports = { registerSecretsIpc, SECRET_KEYS };