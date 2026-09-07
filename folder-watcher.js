'use strict';
const fs = require('fs');
const log = require('./src/logger');
const VIDEO_RE = /\.(mkv|mp4|avi|m4v|mpg|mpeg|webm|flv|wmv)$/i;

let lastScanErr = 0;
function createWatcher(onNew, intervalMs) {
  const w = { active: false, dir: null, known: new Set(), timer: null };
  const interval = intervalMs || 5000;
  function scan(dir) {
    try { return new Set(fs.readdirSync(dir).filter(n => VIDEO_RE.test(n))); }
    catch (e) {
      const now = Date.now();
      if (now - lastScanErr > 60000) { log.warn('folder-watcher: scan falló (' + dir + ')', e); lastScanErr = now; }
      return new Set();
    }
  }
  function stop() {
    w.active = false;
    if (w.timer) { clearInterval(w.timer); w.timer = null; }
  }
  function start(dir) {
    w.dir = dir;
    w.known = scan(dir);
    w.active = true;
    if (!w.timer) {
      w.timer = setInterval(() => {
        const cur = scan(dir);
        if (!cur.size) { w.known = cur; return; }
        const fresh = [...cur].filter(n => !w.known.has(n));
        if (fresh.length) { w.known = cur; try { onNew(fresh); } catch (e) { log.error('folder-watcher: onNew', e); } }
      }, interval);
    }
  }
  return { start, stop, get state() { return w; } };
}

module.exports = { createWatcher, VIDEO_RE };