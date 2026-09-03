function watchScore(animeTitle, winTitle) {
  const at = titleTokens(animeTitle);
  if (!at.length) return 0;
  const wt = titleTokens(winTitle);
  if (!wt.length) return 0;
  let hits = 0;
  at.forEach(w => { if (wt.indexOf(w) !== -1) hits++; });
  return hits / at.length;
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

let lastPromptName = null;
let detectSearchBusy = false;

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

function detectHint(list) {
  for (const w of list) {
    if (!STREAM_MARK.test(w.t)) continue;
    const name = animeNameFromTitle(w.t);
    if (!name || name.length < 3) continue;
    const ep = episodeFromTitle(w.t);
    state.scrobbler.detected = { title: name, ep, from: w.n };
    renderScrobblerUI();
    if (name === lastPromptName) continue;
    lastPromptName = name;
    toast('Viendo en <b>' + esc(w.n.replace(/\.exe$/i, '')) + '</b>: «<b>' + esc(name) + '</b>' + (ep ? ' — Ep ' + ep : '') + '» no está en tu lista. Buscando su ficha para que lo agregues…', 'info');
    resolveDetectedAnime(name);
  }
}

async function resolveDetectedAnime(name) {
  if (detectSearchBusy) return;
  detectSearchBusy = true;
  let item = null;
  const found = await searchAnimeFinal(name, 3);
  detectSearchBusy = false;
  if (found && found.length) item = found[0];
  if (!item) {
    toast('No pude resolver «' + esc(name) + '». Búscalo en la barra superior para agregarlo.', 'warn');
    return;
  }
  apiDetailCache[String(item.mal_id)] = item;
  const det = state.scrobbler.detected || {};
  if (state.settings && state.settings.autoAdd === true) {
    const entry = addAnimeFrom(item, 'watching');
    if (entry) {
      if (det.ep) {
        const anteriores = det.ep - 1;
        if (anteriores > 0) {
          const msg = anteriores === 1
            ? '¿Ya viste el episodio 1 de "' + esc(item.title) + '"?'
            : '¿Ya viste los episodios 1 al ' + anteriores + ' de "' + esc(item.title) + '"? (' + anteriores + ' episodios)';
          const yes = await askConfirm(msg, 'Sí, marcarlos');
          if (yes) {
            entry.watched = anteriores;
            save(); renderDashboard(); recomputeStats();
            toast('Episodios 1–' + anteriores + ' de <b>' + esc(entry.title) + '</b> marcados ✓', 'ok');
            alMaybeSync(entry.id); kitsuMaybeSync(entry.id);
          }
        }
      }
      startScrobble({ animeId: entry.id, player: det.from || 'Navegador', fileName: det.title || item.title, source: 'browser', increment: state.settings.autoIncrement !== false, ep: (det.ep || entry.watched + 1) });
    }
  } else {
    openAddPrompt(item);
  }
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
      const s = Math.max(watchScore(a.title, w.t), watchScore(a.title_english || '', w.t));
      if (s > bestScore) { bestScore = s; best = a; bestWin = w; }
    });
  });
  if (best && bestScore >= 0.5) {
    if (state.scrobbler.running && state.scrobbler.source === 'browser' && state.scrobbler.animeId === best.id) return;
    if (state.scrobbler.running && (state.scrobbler.source === 'manual' || state.scrobbler.source === 'trailer')) return;
    if (state.scrobbler.running) stopScrobble();
    const ep = episodeFromTitle(bestWin.t);
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
    const s = Math.max(watchScore(a.title, evt.title), watchScore(a.title_english || '', evt.title));
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
