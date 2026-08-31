'use strict';
const net = require('net');
const path = require('path');

function getDiscordPipePath(n) {
  if (process.platform === 'win32') return '\\\\?\\pipe\\discord-ipc-' + n;
  if (process.platform === 'darwin') return path.join(process.env.HOME || '/tmp', 'Library', 'Application Support', 'discord-ipc-' + n);
  return path.join(process.env.XDG_RUNTIME_DIR || '/tmp', 'discord-ipc-' + n);
}

function createDiscord(onEvent) {
  const dc = { socket: null, buffer: Buffer.alloc(0), clientId: '', activity: null, ready: false };
  let nonce = 0;

  function write(op, data) {
    if (!dc.socket || dc.socket.destroyed) return false;
    const body = Buffer.from(JSON.stringify(data || {}));
    const head = Buffer.alloc(8);
    head.writeUInt32LE(op, 0);
    head.writeUInt32LE(body.length, 4);
    dc.socket.write(Buffer.concat([head, body]));
    return true;
  }
  function emit(evt) { if (typeof onEvent === 'function') onEvent(evt); }
  function sendActivity() {
    if (!dc.ready || !dc.clientId || !dc.activity) return;
    const act = {
      type: 3,
      details: String(dc.activity.details || '').slice(0, 128),
      state: String(dc.activity.state || '').slice(0, 128),
      timestamps: { start: Date.now() }
    };
    dc.activity = act;
    write(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: act }, nonce: 'dc' + (++nonce) });
  }
  function read(chunk) {
    dc.buffer = Buffer.concat([dc.buffer, chunk]);
    while (dc.buffer.length >= 8) {
      const op = dc.buffer.readUInt32LE(0);
      const len = dc.buffer.readUInt32LE(4);
      if (dc.buffer.length < 8 + len) break;
      const payload = dc.buffer.slice(8, 8 + len).toString('utf8');
      dc.buffer = dc.buffer.slice(8 + len);
      let msg = null;
      try { msg = JSON.parse(payload); } catch (e) { continue; }
      if (msg && msg.evt === 'READY') { dc.ready = true; emit({ ok: true }); sendActivity(); }
      else if (msg && msg.evt === 'ERROR') { emit({ ok: false, error: (msg.data && msg.data.message) || 'error rpc' }); }
    }
  }
  function connect(clientId, initialActivity) {
    dc.clientId = String(clientId || '').trim();
    dc.ready = false;
    if (dc.socket) { try { dc.socket.destroy(); } catch (e) {} dc.socket = null; }
    dc.buffer = Buffer.alloc(0);
    if (initialActivity && initialActivity.details !== undefined) dc.activity = { details: initialActivity.details, state: initialActivity.state || '' };
    if (!dc.clientId) { emit({ ok: false, error: 'sin client id' }); return; }
    let idx = 0;
    const tryNext = () => {
      if (idx > 9) { emit({ ok: false, error: 'Discord no está abierto' }); return; }
      const n = idx++;
      const s = net.connect({ path: getDiscordPipePath(n) });
      s.on('connect', () => { dc.socket = s; write(0, { v: 1, client_id: dc.clientId }); });
      s.on('data', read);
      s.once('error', () => { if (dc.socket === s) dc.socket = null; tryNext(); });
      s.once('close', () => { if (dc.socket === s) { dc.socket = null; dc.ready = false; emit({ ok: false, error: 'conexion cerrada' }); } });
    };
    tryNext();
  }
  function setActivity(p, clientId) {
    const activity = { details: '', state: '', type: 3 };
    if (p && typeof p === 'object') { activity.details = String(p.title != null ? p.title : p.details || ''); activity.state = String(p.ep ? 'Episodio ' + p.ep : (p.state || '')); }
    else if (p) activity.details = String(p);
    dc.activity = { type: 3, details: activity.details.slice(0, 128), state: activity.state.slice(0, 128) };
    if (!dc.socket || dc.socket.destroyed || !dc.ready) connect(clientId || dc.clientId, activity);
    sendActivity();
  }
  function clear() { dc.activity = null; sendActivity(); }
  function destroy() { dc.activity = null; if (dc.socket) { try { dc.socket.destroy(); } catch (e) {} } dc.socket = null; dc.ready = false; }
  return { connect, setActivity, clear, destroy, get state() { return dc; } };
}

module.exports = { createDiscord };