const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
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