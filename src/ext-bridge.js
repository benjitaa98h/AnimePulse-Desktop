'use strict';
const WebSocket = require('ws');
const log = require('./logger');

const PORT = 8787;
const CHANNEL_TITLES = 'browser:titles';
const CHANNEL_DETAIL = 'ext-anime-detail';

function startExtensionBridge(getWindow) {
  let wss;
  try {
    wss = new WebSocket.Server({ host: '127.0.0.1', port: PORT });
  } catch (e) {
    log.error('ext-bridge: no se pudo levantar el server', e);
    return null;
  }
  log.info('ext-bridge: escuchando en ws://127.0.0.1:' + PORT);

  wss.on('connection', (ws, req) => {
    const origin = String((req.headers && req.headers.origin) || '');
    if (origin && !/^(chrome|moz)-extension:\/\//.test(origin)) {
      log.warn('ext-bridge: conexión rechazada (origin ' + origin + ')');
      ws.close();
      return;
    }
    log.info('ext-bridge: extensión conectada');

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }

      const win = typeof getWindow === 'function' ? getWindow() : getWindow;
      if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) return;

      if (msg.type === 'titles' && Array.isArray(msg.titles)) {
        win.webContents.send(CHANNEL_TITLES, msg.titles);
      } else if (msg.type === 'ap-detail' && Array.isArray(msg.tabs)) {
        win.webContents.send(CHANNEL_DETAIL, msg.tabs);
      }
    });
  });

  wss.on('error', (e) => {
    log.error('ext-bridge: error del servidor ws', e);
  });

  return wss;
}

module.exports = { startExtensionBridge };