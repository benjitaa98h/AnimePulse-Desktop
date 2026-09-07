function watchScore(animeTitle, winTitle) {
  const at = titleTokens(animeTitle);
  if (!at.length) return 0;
  const wt = titleTokens(winTitle);
  if (!wt.length) return 0;
  let hits = 0;
  at.forEach(w => { if (wt.indexOf(w) !== -1) hits++; });
  return hits / at.length;
}

// versión estricta para decidir si "esto que se está viendo" es una serie de la
// lista: un 0.5 con 1 de 2 palabras compartidas es un falso fácil (p.ej. el
// título de ventana "Grand Blue Episodio 6 …" matchea 0.5 contra "Blue Box"
// solo por la palabra "Blue"). Para series de 2+ tokens solo vale el título completo.
function isTitleMatch(animeTitle, winTitle) {
  const at = titleTokens(animeTitle);
  if (!at.length) return false;
  const wt = titleTokens(winTitle);
  if (!wt.length) return false;
  let hits = 0;
  at.forEach(w => { if (wt.indexOf(w) !== -1) hits++; });
  if (hits / at.length < 0.5) return false;
  if (at.length > 1 && hits < 2) return false;
  return true;
}

function episodeFromTitle(t) {
  let m = t.match(/\bS\d{1,2}\s?E(\d{1,3})\b/i);
  if (m) return +m[1];
  m = t.match(/(?:ep|ep\.|episode|episodio)\s*\.?\s*:?\s*(\d{1,3})\b/i);
  if (m) return +m[1];
  m = t.match(/\bcap[ií]tulo\s*\.?\s*:?\s*(\d{1,3})\b/i);
  if (m) return +m[1];
  return null;
}

const STREAM_MARK = /\b(animeflv|crunchyroll|myanimelist|mangacrash|animeonline|aniplay|jkanime|zoro\.to|netflix|disney\s*plus|crunchy|hbomax|max\.com|funimation|prime\s*video|hulu|mxplayer|bilibili|animedao|gogoanime)\b|episodio|episode|cap[ií]tulo/i;

const RETRY_MS = 30000;
const DETECT_TTL = 5 * 60 * 1000;
const DETECT_MAX = 3;
// un slot por anime detectado: varios títulos compiten en el mismo flujo
// (extensión + títulos de ventana nativos) y ninguno puede bloquear al otro
const detectPending = new Map(); // name -> { name, ep, from, attempts, nextRetryAt, running, lastSeen }

function animeNameFromTitle(t) {
  let s = t;
  const m = s.match(/\b(?:ep\.?|episode|episodio|cap[ií]tulo)\b.*$/i);
  if (m) s = s.slice(0, m.index);
  s = s
    .replace(/\b(?:sub\s*[ée]spa[nñ]ol|sub\s*ingles|lati?no|subtitulado|\d{3,4}p|ver\s*online|hd|animeflv|crunchyroll|jkanime|aniplay|animeonline|gogoanime|mangacrash|mxplayer|bilibili|netflix|hbomax|brave)\b/gi, '')
    .replace(/\s*[-—|]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function animeAlreadyInList(name) {
  return state.animeList.some(a => isTitleMatch(a.title, name) || isTitleMatch(a.title_english || '', name));
}

function cancelPendingDetection(name) {
  if (name) detectPending.delete(name);
  else detectPending.clear();
}

function detectHint(list) {
  for (const w of list) {
    if (!STREAM_MARK.test(w.t)) continue;
    const name = animeNameFromTitle(w.t);
    if (!name || name.length < 3) continue;
    const ep = episodeFromTitle(w.t);
    state.scrobbler.detected = { title: name, ep, from: w.n };
    renderScrobblerUI();
    ensureDetectPending(name, ep, w.n);
  }
}

function ensureDetectPending(name, ep, from) {
  if (animeAlreadyInList(name)) { detectPending.delete(name); return; }
  let d = detectPending.get(name);
  const isNew = !d;
  if (isNew) {
    if (detectPending.size >= DETECT_MAX) return;
    d = { name, ep, from, attempts: 0, nextRetryAt: 0, running: false, lastSeen: Date.now() };
    detectPending.set(name, d);
    toast('Viendo en <b>' + esc(from) + '</b>: «<b>' + esc(name) + '</b>' + (ep ? ' — Ep ' + ep : '') + '» no está en tu lista. Buscando su ficha para agregarlo a <b>Viendo</b>…', 'info');
  } else {
    d.ep = ep;
    d.from = from;
    d.lastSeen = Date.now();
  }
  if (!d.running && Date.now() >= d.nextRetryAt) attemptDetect(name);
}

async function attemptDetect(name) {
  const d = detectPending.get(name);
  if (!d || d.running) return;
  d.running = true;
  d.attempts++;
  d.nextRetryAt = Date.now() + RETRY_MS;
  let item = null;
  try {
    const found = await searchAnimeFinal(d.name, 3);
    if (found && found.length) item = found[0];
  } catch (e) { item = null; }
  if (!item) {
    if (d.attempts === 1) toast('No pude resolver «' + esc(d.name) + '» (API caída). Reintentaré automáticamente cada ~' + Math.round(RETRY_MS / 1000) + ' s mientras sigas viéndolo.', 'warn');
    d.running = false;
    return;
  }
  d.running = false;
  detectPending.delete(name);
  // mientras buscábamos pudo haber entrado a la lista (por título u otro flujo);
  // nunca rebajar lo que ya tiene
  if (animeAlreadyInList(d.name)) return;
  const dup = state.animeList.find(a => a.id === item.id);
  if (dup) {
    if (d.ep && d.ep > (dup.watched || 0)) {
      if (dup.status === 'completed' || dup.status === 'plan') dup.status = 'watching';
      dup.watched = d.ep;
      save(); renderDashboard(); recomputeStats();
    }
    return;
  }
  apiDetailCache[String(item.mal_id)] = item;
  if (state.settings && state.settings.autoAdd === true) {
    const entry = addAnimeFrom(item, 'watching');
    if (entry) finalizeDetectedAdd(entry, d);
  } else {
    openAddPrompt(item);
  }
}

// limpia candidatos que ya no se ven hace rato (cerraste la pestaña, etc.)
if (typeof setInterval === 'function') {
  setInterval(() => {
    const now = Date.now();
    for (const [name, d] of detectPending) {
      if (now - d.lastSeen > DETECT_TTL) detectPending.delete(name);
    }
  }, 30000);
}

function onBrowserTitles(list) {
  if (!state.settings || state.settings.detectPlayers === false) {
    if (state.scrobbler.running && state.scrobbler.source === 'browser') stopScrobble();
    return;
  }
  state.scrobbler.detected = null;
  let best = null;
  let bestScore = 0;
  let bestWin = null;
  list.forEach(w => {
    state.animeList.forEach(a => {
      const okTitle = isTitleMatch(a.title, w.t);
      if (okTitle) { bestScore = 1; best = a; bestWin = w; return; }
      const s = isTitleMatch(a.title_english || '', w.t) ? 1 : 0;
      if (s > bestScore) { bestScore = s; best = a; bestWin = w; }
    });
  });
  if (best && bestScore >= 0.5) {
    const ep = episodeFromTitle(bestWin.t);
    if (best.status === 'plan') {
      best.status = 'watching';
      save(); renderDashboard(); recomputeStats();
    }
    if (ep && totalEps(best) > 0 && ep > totalEps(best)) markAiringOnDetect(best, ep);
    if (state.scrobbler.running && state.scrobbler.source === 'browser' && state.scrobbler.animeId === best.id) return;
    if (state.scrobbler.running && (state.scrobbler.source === 'manual' || state.scrobbler.source === 'trailer')) return;
    if (state.scrobbler.running) stopScrobble();
    startScrobble({
      animeId: best.id,
      player: 'Navegador (' + bestWin.n + ')',
      fileName: bestWin.t,
      source: 'browser',
      increment: state.settings.autoIncrement !== false,
      ep: ep
    });
  } else {
    if (state.scrobbler.running && state.scrobbler.source === 'browser') stopScrobble();
    detectHint(list);
  }
}

function onScrobbleNative(evt) {
  if (!state.settings || state.settings.detectPlayers === false) return;
  if (!evt || !evt.title) return;
  let best = null, bestScore = 0;
  state.animeList.forEach(a => {
    const s = isTitleMatch(a.title, evt.title) || isTitleMatch(a.title_english || '', evt.title) ? 1 : 0;
    if (s > bestScore) { bestScore = s; best = a; }
  });

  if (evt.type === 'progress') {
    if (!state.scrobbler.running || state.scrobbler.source === 'browser') {
      if (best && bestScore >= 0.5) {
        if (state.scrobbler.running) stopScrobble();
        startScrobble({
          animeId: best.id,
          player: evt.player,
          fileName: evt.title,
          source: 'native',
          increment: state.settings.autoIncrement !== false,
          ep: evt.episode || null,
          nativeProgress: evt.progress
        });
      }
    } else if (state.scrobbler.source === 'native') {
      state.scrobbler.progress = clamp(Math.round(evt.progress * 100), 0, 100);
      const p = Math.round(state.scrobbler.progress);
      const pctF = document.getElementById('simPct');
      const bar = document.getElementById('simBar');
      const nowF = document.getElementById('simFileNow');
      if (bar) bar.style.width = p + '%';
      if (pctF) pctF.textContent = p + '%';
      if (nowF) nowF.innerHTML = 'Reproduciendo <b class="text-white">Ep ' + (state.scrobbler.episodeNow || evt.episode || 1) + '</b> · ' + esc(state.scrobbler.fileName);
      if (state.scrobbler.progress >= 100) finishEpisode();
    }
    return;
  }

  if (evt.type === 'complete') {
    if (state.scrobbler.running && state.scrobbler.source === 'native') {
      finishEpisode();
    }
  }
}
