const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

let mainWindow = null;
let pollTimer = null;
let pollInFlight = false;

const PS_TITLES = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | ForEach-Object { [PSCustomObject]@{ n=$_.ProcessName; t=$_.MainWindowTitle } } | ConvertTo-Json -Compress';

function pollWindowTitles() {
  if (pollInFlight || !mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  pollInFlight = true;
  execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', PS_TITLES],
    { timeout: 4500, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      pollInFlight = false;
      if (err) return;
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
      const txt = (stdout || '').trim();
      let list = [];
      if (txt) {
        try {
          const j = JSON.parse(txt);
          list = Array.isArray(j) ? j : [j];
        } catch (e) { return; }
      }
      list = list.filter(w => w && w.t && w.n && !/animepulse/i.test(w.t));
      mainWindow.webContents.send('browser:titles', list);
    });
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
    fs.renameSync(src, dst);
    return { ok: true };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});