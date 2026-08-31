const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  onMaximized: (cb) => ipcRenderer.on('window:maximized', (_e, val) => cb(val)),
  browserDetectStart: () => ipcRenderer.send('browser:detect-start'),
  onBrowserTitles: (cb) => ipcRenderer.on('browser:titles', (_e, list) => cb(list)),
  openExternal: (url) => ipcRenderer.invoke('external:open', String(url)),
  focus: () => ipcRenderer.invoke('win:focus'),
  pickFolder: () => ipcRenderer.invoke('fs:pick-folder'),
  listFolder: (dir) => ipcRenderer.invoke('fs:list-files', String(dir)),
  renameFile: (dir, from, to) => ipcRenderer.invoke('fs:rename-file', String(dir), String(from), String(to))
});