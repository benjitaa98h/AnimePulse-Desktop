const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, shell, dialog, clipboard, session, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

const autoUpdate = require('electron-updater');
const { autoUpdater } = autoUpdate;
let updateNotified = false;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('update-available', (info) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('update:status', { type: 'available', version: info.version });
});
autoUpdater.on('update-downloaded', (info) => {
  updateNotified = true;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('update:status', { type: 'downloaded', version: info.version });
});
autoUpdater.on('error', (err) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('update:status', { type: 'error', message: String((err && err.message) || err) });
});
function maybeCheckForUpdates() {
  if (process.env.ZXS_DISABLE_UPDATES) return;
  if (app.isPackaged) {
    setTimeout(() => {
      try { autoUpdater.checkForUpdates().catch(() => {}); } catch (e) {}
    }, 8000);
    setInterval(() => {
      try { autoUpdater.checkForUpdates().catch(() => {}); } catch (e) {}
    }, 6 * 3600 * 1000);
  }
}
let pollTimer = null;
let pollInFlight = false;

const { execFile: execFileCb } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFileCb);

function pollWindowTitles() {
  if (pollInFlight || !mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  pollInFlight = true;

  const platform = process.platform;

  let promise;
  if (platform === 'win32') {
    const PS_TITLES = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | ForEach-Object { [PSCustomObject]@{ n=$_.ProcessName; t=$_.MainWindowTitle } } | ConvertTo-Json -Compress';
    promise = execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', PS_TITLES], { timeout: 4500, maxBuffer: 8 * 1024 * 1024, windowsHide: true })
      .then(({ stdout }) => {
        const txt = (stdout || '').trim();
        let list = [];
        if (txt) {
          const j = JSON.parse(txt);
          list = Array.isArray(j) ? j : [j];
        }
        return list.filter(w => w && w.t && w.n && !/animepulse|zxs/i.test(w.t));
      });
  } else if (platform === 'linux') {
    promise = execFileAsync('hyprctl', ['clients', '-j'], { timeout: 4500, maxBuffer: 8 * 1024 * 1024 })
      .then(({ stdout }) => {
        const arr = JSON.parse((stdout || '').trim() || '[]');
        if (!Array.isArray(arr)) return [];
        return arr
          .filter(c => c && c.title && String(c.title).trim() && !/animepulse|zxs/i.test(String(c.title)) && !/opencode/i.test(String(c.title)))
          .map(c => ({ t: String(c.title).trim(), n: String(c.class || 'hyprland') }));
      })
      .catch(() => execFileAsync('xdotool', ['search', '--name', '', 'getwindowname', '%1', 'getwindowpid', '%1'], { timeout: 4500, maxBuffer: 8 * 1024 * 1024 })
        .then(({ stdout }) => {
          const lines = (stdout || '').trim().split('\n').filter(Boolean);
          const list = [];
          for (let i = 0; i < lines.length; i += 2) {
            const title = (lines[i] || '').trim();
            const pid = (lines[i + 1] || '').trim();
            if (title && pid) list.push({ t: title, n: 'pid:' + pid });
          }
          return list.filter(w => w.t && !/animepulse|zxs/i.test(w.t));
        })
        .catch(() => {
          return execFileAsync('wmctrl', ['-l'], { timeout: 3000 })
            .then(({ stdout }) => {
              return (stdout || '').trim().split('\n').filter(Boolean).map(line => {
                const parts = line.split(/\s+/);
                const title = parts.slice(2).join(' ');
                return { t: title, n: 'wmctrl' };
              }).filter(w => w.t && !/animepulse|zxs/i.test(w.t));
            })
            .catch(() => []);
        }));
  } else if (platform === 'darwin') {
    promise = execFileAsync('osascript', ['-e', 'tell application "System Events" to get {name, UNIX id} of every process whose background only is false'], { timeout: 4500, maxBuffer: 8 * 1024 * 1024 })
      .then(({ stdout }) => {
        const txt = (stdout || '').trim();
        let list = [];
        if (txt) {
          const parsed = JSON.parse('[' + txt + ']');
          list = parsed.map(p => ({ t: String(p[0] || ''), n: 'pid:' + String(p[1] || '') }));
        }
        return list.filter(w => w.t && !/animepulse|zxs/i.test(w.t));
      })
      .catch(() => []);
  } else {
    promise = Promise.resolve([]);
  }

  promise
    .then(list => {
      pollInFlight = false;
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
      mainWindow.webContents.send('browser:titles', list);
    })
    .catch(() => { pollInFlight = false; });
}

function startBrowserPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollWindowTitles, 6000);
  pollWindowTitles();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    frame: false,
    show: false,
    backgroundColor: '#08080f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.argv.includes('--smoke-test')) setTimeout(() => app.quit(), 2500);
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { clearInterval(pollTimer); pollTimer = null; mainWindow = null; });
}

app.whenReady().then(() => {
  maybeCheckForUpdates();
  appDB = createDB(app.getPath('userData'));
  const migrated = appDB.migrateLegacy();
  if (migrated) console.log('[zxs] Copia de seguridad JSON migrada a SQLite.');

  // Fix YouTube "Error 153": la app se carga con loadFile() (origen file://) y
  // Chromium no envia header Referer desde un documento file:// a un subframe https.
  // YouTube rechaza requests sin referrer y muestra Error 153
  // (ERROR_CODE_EMBEDDER_IDENTITY_MISSING_REFERRER). Inyectamos un Referer valido
  // solo en las peticiones a youtube-nocookie / youtube embed que lleguen sin referrer.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = Object.assign({}, details.requestHeaders);
    const host = (details.url || '').toLowerCase();
    if ((host.indexOf('youtube-nocookie.com') !== -1 || host.indexOf('youtube.com/embed') !== -1) && !headers['Referer']) {
      headers['Referer'] = 'https://animepulse.app/';
    }
    callback({ requestHeaders: headers });
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

ipcMain.on('browser:detect-start', startBrowserPolling);

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('win:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('win:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('win:close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle('win:is-maximized', () => (mainWindow ? mainWindow.isMaximized() : false));

ipcMain.handle('external:open', (e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.handle('win:focus', () => {
  if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
});

const FOLDER_VIDEO_RE = /\.(mkv|mp4|avi|m4v|mpg|mpeg|webm|flv|wmv)$/i;
ipcMain.handle('fs:pick-folder', async () => {
  if (!mainWindow) return null;
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Elegir carpeta con tus episodios', properties: ['openDirectory'] });
  return r.canceled ? null : (r.filePaths[0] || null);
});
ipcMain.handle('fs:list-files', (e, dir) => {
  try {
    if (typeof dir !== 'string' || !dir) return { error: 'dir-invalido' };
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.filter(x => x.isFile() && FOLDER_VIDEO_RE.test(x.name)).map(x => x.name).slice(0, 600);
  } catch (err) { return { error: String((err && err.message) || err) }; }
});
ipcMain.handle('fs:rename-file', (e, dir, from, to) => {
  try {
    if (typeof dir !== 'string' || !dir || typeof from !== 'string' || !from || typeof to !== 'string' || !to) return { error: 'parametros' };
    if (/[\\/]/m.test(to) || /^\.+$/.test(to) || to.indexOf('\0') >= 0) return { error: 'nombre-no-permitido' };
    const src = path.join(dir, from);
    const dst = path.join(dir, to);
    if (path.dirname(src) !== path.dirname(dst)) return { error: 'ruta-invalida' };
    if (!fs.existsSync(src)) return { error: 'no-existe' };
    if (fs.existsSync(dst)) return { error: 'destino-existe' };
    fs.renameSync(src, dst);
    return { ok: true };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

ipcMain.handle('clipboard:set-text', async (e, txt) => {
  try {
    if (typeof txt !== 'string') return { error: 'formato' };
    await clipboard.writeText(txt);
    return { ok: true };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

ipcMain.handle('fs:save-png', async (e, dataUrl, name) => {
  try {
    if (typeof dataUrl !== 'string' || !/^data:image\/png/.test(dataUrl)) return { error: 'formato' };
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    if (!buf.length) return { error: 'vacio' };
    let outName = String(name || 'zxs.png').replace(/[\\/:*?"<>|]/g, '_');
    if (!/\.png$/i.test(outName)) outName += '.png';
    const dir = app.getPath('downloads');
    const full = path.join(dir, outName);
    fs.writeFileSync(full, buf);
    return { ok: true, path: full };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

const SECRET_KEYS = ['alToken','kitsuToken','kitsuSecret','kitsuEmail','asToken','unsplashKey'];
const SECRET_ANCHOR = process.env.SECRET_ANCHOR || 'zxs-animepulse-local'; 
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
ipcMain.handle('secret:save', (e, key, value) => {
  try {
    const fp = secretPath(key);
    if (!fp) return { ok: false, error: 'clave-no-permitida' };
    const val = value === undefined || value === null ? '' : String(value);
    if (val === '') { if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (err) { /* noop */ } } return { ok: true }; }
    const dir = secretDir();
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

const { createDB } = require('./src/db');
let appDB = null;

ipcMain.handle('state:save', (e, data) => {
  try {
    if (typeof data !== 'string' || !data) return { error: 'formato' };
    if (!appDB) return { error: 'db-no-iniciado' };
    const state = JSON.parse(data);
    appDB.saveFull(state);
    return { ok: true };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});
ipcMain.handle('state:load', () => {
  try {
    if (!appDB) return null;
    return appDB.loadFull();
  } catch (e) { return null; }
});
ipcMain.handle('state:info', () => {
  try {
    if (!appDB) return null;
    return appDB.info();
  } catch (e) { return null; }
});
ipcMain.handle('state:wipe', () => {
  try { if (appDB) appDB.wipe(); } catch (e) { /* noop */ }
  return { ok: true };
});

ipcMain.handle('game:get-stats', () => {
  try { return appDB ? appDB.getUserStats() : null; } catch (e) { return null; }
});
ipcMain.handle('game:save-stats', (e, stats) => {
  try { return appDB ? appDB.saveUserStats(stats) : { ok: false }; } catch (e) { return { ok: false }; }
});
ipcMain.handle('game:list-trophies', () => {
  try { return appDB ? appDB.listTrophies() : []; } catch (e) { return []; }
});
ipcMain.handle('game:add-trophy', (e, t) => {
  try { return appDB ? appDB.addTrophy(t) : { ok: false }; } catch (e) { return { ok: false }; }
});
ipcMain.handle('game:add-history', (e, entry) => {
  try { return appDB ? appDB.addHistory(entry) : { ok: false }; } catch (e) { return { ok: false }; }
});
ipcMain.handle('game:history', (e, limit) => {
  try { return appDB ? appDB.history(limit) : []; } catch (e) { return []; }
});
ipcMain.handle('game:record-episode', (e, evt) => {
  try { return appDB ? appDB.recordEpisode(evt) : { ok: false }; } catch (e) { return { ok: false, error: String(e && e.message) }; }
});
ipcMain.handle('game:scrobble-history', (e, limit) => {
  try { return appDB ? appDB.scrobbleHistory(limit) : []; } catch (e) { return []; }
});
ipcMain.handle('game:coin-summary', () => {
  try { return appDB ? appDB.coinSummary() : { total: 0, tx: 0 }; } catch (e) { return { total: 0, tx: 0 }; }
});
ipcMain.handle('game:scrobble-stats', () => {
  try { return appDB ? appDB.scrobbleStats() : { episodes: 0, animes: 0, best_marathon: 1 }; } catch (e) { return { episodes: 0, animes: 0, best_marathon: 1 }; }
});
ipcMain.handle('store:list', () => {
  try { return appDB ? appDB.storeList() : []; } catch (e) { return []; }
});
ipcMain.handle('store:upsert', (e, items) => {
  try { return appDB ? appDB.storeUpsert(items) : { ok: false }; } catch (e) { return { ok: false }; }
});
ipcMain.handle('store:purchase', (e, itemId, rank) => {
  try { return appDB ? appDB.storePurchase(itemId, rank) : { ok: false }; } catch (e) { return { ok: false, error: String(e && e.message) }; }
});
ipcMain.handle('store:equip', (e, itemId, on) => {
  try { return appDB ? appDB.storeEquip(itemId, on) : { ok: false }; } catch (e) { return { ok: false }; }
});
ipcMain.handle('store:inventory', () => {
  try { return appDB ? appDB.storeInventory() : []; } catch (e) { return []; }
});
ipcMain.handle('season:get', (e, id) => {
  try { return appDB ? appDB.seasonGet(id) : null; } catch (e) { return null; }
});
ipcMain.handle('season:save', (e, s) => {
  try { return appDB ? appDB.seasonSave(s) : { ok: false }; } catch (e) { return { ok: false }; }
});
ipcMain.handle('season:grant-item', (e, item) => {
  try { return appDB ? appDB.seasonGrantItem(item) : { ok: false }; } catch (e) { return { ok: false }; }
});

const { createWatcher } = require('./folder-watcher');
const watcher = createWatcher(fresh => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('organizer:new', fresh);
});
ipcMain.handle('organizer:watch', (e, payload) => {
  try {
    const p = payload || {};
    if (!p.on) { watcher.stop(); return { ok: true }; }
    if (typeof p.dir !== 'string' || !p.dir) return { error: 'dir' };
    if (!fs.existsSync(p.dir)) return { error: 'no-existe' };
    watcher.start(p.dir);
    return { ok: true };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});
app.on('quit', () => watcher.stop());
app.on('before-quit', () => watcher.stop());

const { createScrobbler } = require('./src/scrobbler');
const nativeScrobbler = createScrobbler(evt => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('scrobble:native', evt);
  }
});
ipcMain.handle('scrobble:native-start', () => { nativeScrobbler.start(); return { ok: true }; });
ipcMain.handle('scrobble:native-stop', () => { nativeScrobbler.stop(); return { ok: true }; });
app.on('before-quit', () => nativeScrobbler.stop());
ipcMain.handle('update:check-now', () => {
  try { autoUpdater.checkForUpdates().catch(() => {}); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message) }; }
});

const { createDiscord } = require('./discord-rpc');
const dc = createDiscord(evt => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('discord:status', evt); });
ipcMain.handle('discord:connect', (e, p) => {
  const payload = p || {};
  dc.connect(payload.id, payload.activity);
  return { ok: true };
});
ipcMain.handle('discord:set', (e, p) => {
  const payload = p || {};
  if (payload.id) dc.state.clientId = String(payload.id).trim();
  dc.setActivity(payload, dc.state.clientId || payload.id);
  return { ok: true };
});
ipcMain.handle('discord:stop', () => { dc.clear(); return { ok: true }; });
app.on('before-quit', () => dc.destroy());
app.on('before-quit', () => { if (appDB) { appDB.close(); appDB = null; } });