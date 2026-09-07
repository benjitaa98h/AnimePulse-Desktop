'use strict';
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let logStream = null;
let logDirPath = '';

function dateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function ensureStream() {
  if (logStream) return;
  try {
    logDirPath = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDirPath)) fs.mkdirSync(logDirPath, { recursive: true });
    logStream = fs.createWriteStream(path.join(logDirPath, 'app-' + dateStr() + '.log'), { flags: 'a' });
    logStream.on('error', () => { logStream = null; });
  } catch (e) { logStream = null; }
}
function write(level, msg, extra) {
  ensureStream();
  const detail = extra ? (extra && extra.stack ? '\n' + extra.stack : (' :: ' + String(extra))) : '';
  const line = '[' + new Date().toISOString() + '] [' + level + '] ' + msg + detail;
  try { if (logStream) logStream.write(line + '\n'); } catch (e) {}
  if (level === 'ERROR') console.error(line);
}
module.exports = {
  error: (m, e) => write('ERROR', m, e),
  warn: (m, e) => write('WARN', m, e),
  info: (m) => write('INFO', m)
};