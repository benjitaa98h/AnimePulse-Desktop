'use strict';
const { execFile } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PLAYERS = {
  vlc: /^vlc/i,
  mpv: /^mpv/i,
  'mpc-hc': /^mpc-hc/i,
  mpc: /^mpc/i,
  potplayer: /^potplayer|potplayermini/i,
  kodi: /^kodi/i,
  plex: /^plex/i
};

function detectPlayer(name) {
  if (!name) return null;
  for (const key of Object.keys(PLAYERS)) {
    if (PLAYERS[key].test(name)) return key;
  }
  return null;
}

const TIME_RE = /(?:\b|\[)(\d{1,2}):(\d{2}):(\d{2})\s*\/\s*(\d{1,2}):(\d{2}):(\d{2})(?:\]|\b)/;

function parseTitle(title) {
  const m = title.match(TIME_RE);
  if (!m) return null;
  const cur = (Number(m[1]) * 3600) + (Number(m[2]) * 60) + Number(m[3]);
  const dur = (Number(m[4]) * 3600) + (Number(m[5]) * 60) + Number(m[6]);
  if (dur <= 0) return null;
  const remaining = title.replace(TIME_RE, ' ').trim();
  return { current: cur, duration: dur, progress: cur / dur, clean: remaining };
}

function stripExtensions(name) {
  return name.replace(/\.(mkv|mp4|avi|m4v|mpg|mpeg|webm|flv|wmv)$/i, '');
}

function parseEpisodeFromTitle(clean) {
  if (!clean) return null;
  let m;
  m = clean.match(/(?:S(?:\d{1,2}))E(\d{1,4})\b/i);
  if (m) return parseInt(m[1], 10);
  m = clean.match(/\b(?:ep(?:isode)?(?:\.|\s|-)?)[ ]?(\d{1,4})\b/i);
  if (m) return parseInt(m[1], 10);
  m = clean.match(/[\[\(](\d{1,4})[\]\)]\s*(?:\d{3,4}p|\d{4}|mkv|mp4|avi|webm|m4v)/i);
  if (m && parseInt(m[1], 10) <= 5000) return parseInt(m[1], 10);
  m = clean.match(/\s-\s(\d{1,4})(?:\s+\[|\s+\d{3,4}p|\s+\.)/i);
  if (m) return parseInt(m[1], 10);
  m = clean.match(/\s-\s(\d{1,4})\s*$/);
  if (m) return parseInt(m[1], 10);
  return null;
}

async function getTitles() {
  const platform = process.platform;
  if (platform === 'win32') {
    const PS = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | ForEach-Object { [PSCustomObject]@{ n=$_.ProcessName; t=$_.MainWindowTitle } } | ConvertTo-Json -Compress';
    const { stdout } = await execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', PS], { timeout: 4000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    const txt = (stdout || '').trim();
    if (!txt) return [];
    const j = JSON.parse(txt);
    const arr = Array.isArray(j) ? j : [j];
    return arr.filter(w => w && w.t && w.n).map(w => ({ name: w.n, title: w.t }));
  }
  if (platform === 'linux') {
    try {
      const { stdout } = await execFile('hyprctl', ['clients', '-j'], { timeout: 4000, maxBuffer: 8 * 1024 * 1024 });
      const arr = JSON.parse((stdout || '').trim() || '[]');
      if (Array.isArray(arr)) {
        const out = arr
          .filter(c => c && c.title && String(c.title).trim())
          .map(c => ({ name: String(c.class || 'hyprland'), title: String(c.title).trim() }));
        if (out.length) return out;
      }
    } catch (e) { /* fallthrough */ }
    try {
      const { stdout } = await execFile('xdotool', ['search', '--name', '', 'getwindowname', '%1', 'getwindowpid', '%1'], { timeout: 4000, maxBuffer: 8 * 1024 * 1024 });
      const lines = (stdout || '').trim().split('\n').filter(Boolean);
      const out = [];
      for (let i = 0; i < lines.length; i += 2) {
        const title = (lines[i] || '').trim();
        const pid = (lines[i + 1] || '').trim();
        if (title && pid) out.push({ name: 'pid:' + pid, title });
      }
      if (out.length) return out;
    } catch (e) { /* fallthrough */ }
    try {
      const { stdout } = await execFile('wmctrl', ['-l'], { timeout: 3000 });
      const out = (stdout || '').trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        const title = parts.slice(2).join(' ');
        return { name: 'wmctrl', title };
      });
      if (out.length) return out;
    } catch (e) { /* noop */ }
    return [];
  }
  if (platform === 'darwin') {
    const { stdout } = await execFile('osascript', ['-e', 'tell application "System Events" to get {name, UNIX id} of every process whose background only is false'], { timeout: 4000, maxBuffer: 8 * 1024 * 1024 });
    const txt = (stdout || '').trim();
    if (!txt) return [];
    const parsed = JSON.parse('[' + txt + ']');
    return parsed.map(p => ({ name: String(p[0] || ''), title: String(p[0] || '') }));
  }
  return [];
}

function createScrobbler(onEvent) {
  const s = { active: false, timer: null, lastProgress: null };
  const intervalMs = 3000;

  function mpvSocketPaths() {
    if (process.platform === 'win32') return ['\\\\?\\pipe\\mpv-ipc', '\\\\?\\pipe\\mpv'];
    const dir = process.env.XDG_RUNTIME_DIR || '/tmp';
    const candidates = [
      path.join(dir, 'mpv', 'socket'),
      path.join(dir, 'mpv-socket'),
      path.join(dir, 'mpv'),
      '/tmp/mpvsocket',
      '/tmp/mpv-socket'
    ];
    return candidates.filter(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
  }

  function mpvQuery(socketPath) {
    return new Promise(resolve => {
      const sock = net.connect({ path: socketPath });
      const timeout = setTimeout(() => { try { sock.destroy(); } catch (e) {} resolve(null); }, 600);
      let buf = '';
      sock.on('connect', () => {
        sock.write(JSON.stringify({ command: ['get_property', 'time-pos'] }) + '\n');
        sock.write(JSON.stringify({ command: ['get_property', 'duration'] }) + '\n');
        sock.write(JSON.stringify({ command: ['get_property', 'path'] }) + '\n');
        sock.write(JSON.stringify({ command: ['get_property', 'filename'] }) + '\n');
        sock.write(JSON.stringify({ command: ['get_property', 'pause'] }) + '\n');
      });
      sock.on('data', d => {
        buf += d.toString('utf8');
        try {
          const lines = buf.split('\n').filter(Boolean);
          let result = {};
          for (const line of lines) {
            const msg = JSON.parse(line);
            if (msg.error === 'success') result[msg.request_id || 'v'] = msg.data;
          }
          if (Object.keys(result).length >= 1) {
            clearTimeout(timeout);
            try { sock.destroy(); } catch (e) {}
            resolve(result);
          }
        } catch (e) {}
      });
      sock.on('error', () => { clearTimeout(timeout); resolve(null); });
    });
  }

  function tick() {
    const sockets = mpvSocketPaths();
    const mpvPromise = sockets.length
      ? mpvQuery(sockets[0]).then(data => {
          if (!data) return null;
          const cur = Number(data['time-pos']);
          const dur = Number(data['duration']);
          if (!Number.isFinite(cur) || !Number.isFinite(dur) || dur <= 0) return null;
          const filename = String(data['filename'] || data['path'] || '');
          return {
            player: 'mpv',
            title: stripExtensions(path.basename(filename)),
            current_sec: cur,
            duration_sec: dur,
            progress: cur / dur,
            episode: parseEpisodeFromTitle(path.basename(filename))
          };
        })
      : Promise.resolve(null);

    mpvPromise.then(mpvResult => {
      if (mpvResult) {
        s.lastProgress = mpvResult;
        onEvent({ type: 'progress', ...mpvResult });
        if (mpvResult.progress >= 0.8) onEvent({ type: 'complete', ...mpvResult });
        return;
      }
      return fallbackTitleTick();
    }).catch(() => {});

    function fallbackTitleTick() {
      return getTitles().then(titles => {
        const t = titles.find(t => {
          const p = detectPlayer(t.name);
          return p && TIME_RE.test(t.title);
        }) || titles.find(t => detectPlayer(t.name));

        if (!t) {
          if (s.lastProgress && s.lastProgress.progress >= 0.8) {
            onEvent({ type: 'complete', ...s.lastProgress });
          }
          s.lastProgress = null;
          return;
        }

        const player = detectPlayer(t.name);
        const parsed = parseTitle(t.title);
        if (!parsed) return;
        const progress = {
          player,
          title: stripExtensions(parsed.clean),
          current_sec: parsed.current,
          duration_sec: parsed.duration,
          progress: parsed.progress,
          episode: parseEpisodeFromTitle(parsed.clean)
        };
        s.lastProgress = progress;
        onEvent({ type: 'progress', ...progress });

        if (parsed.progress >= 0.8) {
          onEvent({ type: 'complete', ...progress });
        }
      }).catch(() => {});
    }
  }

  function start() {
    if (s.active) return;
    s.active = true;
    tick();
    s.timer = setInterval(tick, intervalMs);
  }

  function stop() {
    s.active = false;
    if (s.timer) { clearInterval(s.timer); s.timer = null; }
    s.lastProgress = null;
  }

  return { start, stop, get state() { return s; } };
}

module.exports = { createScrobbler, detectPlayer, parseTitle, parseEpisodeFromTitle };
