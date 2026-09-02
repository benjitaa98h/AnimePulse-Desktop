const PASS_MISSIONS = [
  { id: 'eps', label: 'Ver episodios esta temporada', target: 30, icon: '▶️', reward: '120 🪙' },
  { id: 'new', label: 'Ver estrenos del trimestre', target: 3, icon: '🆕', reward: '150 🪙' },
  { id: 'complete', label: 'Alcanzar el nivel 30 del pase', target: 1, icon: '👑', reward: 'Marco Maestro' }
];

const TROPHY_DEFS = [
  { id: 'first_episode', name: 'Primer Paso', description: 'Registra tu primer episodio', rarity: 'comun' },
  { id: 'ep10', name: 'Veterano', description: 'Registra 10 episodios', rarity: 'comun' },
  { id: 'ep50', name: 'Maratonista', description: 'Registra 50 episodios', rarity: 'raro' },
  { id: 'ep100', name: 'Centurión', description: 'Registra 100 episodios', rarity: 'epico' },
  { id: 'ep300', name: 'Leyenda Viva', description: 'Registra 300 episodios', rarity: 'legendario' },
  { id: 'marathon3', name: 'Racha Ardiente', description: 'Logra un maratón de 3+ episodios seguidos', rarity: 'raro' },
  { id: 'classic5', name: 'Clásico Imprescindible', description: 'Completa 5 animes anteriores al 2000', rarity: 'epico' },
  { id: 'genre5', name: 'Explorador de Géneros', description: 'Completa 5 animes de un mismo género', rarity: 'raro' },
  { id: 'first_franchise', name: 'Cazador de Franquicias', description: 'Completa tu primera franquicia entera', rarity: 'raro' },
  { id: 'franchise2', name: 'Maestro de Sagas', description: 'Completa 2 franquicias enteras', rarity: 'legendario' }
];
let currentGameStats = null;

function xpNeeded(level) { return level * 100; }

function addXP(amount) {
  const g = state.gamification;
  g.xp += amount;
  let leveled = false;
  while (g.xp >= xpNeeded(g.level)) {
    g.xp -= xpNeeded(g.level);
    g.level++;
    leveled = true;
  }
  if (leveled) toast('¡Subiste al <b>nivel ' + g.level + '</b>! 🎉', 'ok');
  return leveled;
}

function addCoins(amount) {
  state.gamification.coins += amount;
}

function awardEpisode(a) {
  const g = state.gamification;
  if (g.lastAnimeId === a.id) g.marathon++;
  else { g.marathon = 1; g.lastAnimeId = a.id; }
  g.totalEpisodes++;

  let coins = 10, xp = 20;
  const mult = rankMult();
  if (mult > 1) { coins = Math.round(coins * mult); xp = Math.round(xp * mult); }
  if (g.marathon >= 3) { coins = Math.round(coins * 1.5); xp = Math.round(xp * 1.5); }
  addCoins(coins); addXP(xp);
  recordEpisodeToDB(a, coins, xp);
  const isSeasonNew = a.year === new Date().getFullYear() && (a.watched || 0) <= 1;
  trackPassEpisode(isSeasonNew);

  if (g.marathon >= 3) toast('🔥 Maratón x' + g.marathon + '! +' + coins + ' 🪙', 'ok');
  else toast('+' + coins + ' 🪙 y +' + xp + ' XP', 'info');

  const completed = !a.airing && totalEps(a) > 0 && a.watched >= totalEps(a);
  if (completed && !(state.gamification.completedIds || []).includes(a.id)) {
    state.gamification.completedIds = (state.gamification.completedIds || []).concat([a.id]);
    const bonus = 50, xpBonus = 100;
    addCoins(bonus); addXP(xpBonus);
    toast('🎬 <b>' + esc(a.title) + '</b> completado! +' + bonus + ' 🪙 bonus', 'ok');
    checkFranquicia(a);
  }
  save();
  syncGameDB();
  checkTrophies();
  renderGamification();
}

function recordEpisodeToDB(a, coins, xp) {
  if (!a || !a.id) return;
  const sb = state.scrobbler || {};
  const evt = {
    anime_id: a.id,
    anime_title: a.title,
    episode: a.watched || 1,
    source: sb.source || 'manual',
    player: sb.player || '',
    progress: sb.progress != null ? (sb.progress / 100) : null,
    coins, xp,
    marathon: state.gamification.marathon || 1,
    season: 1
  };
  if (window.electronAPI && window.electronAPI.gameRecordEpisode) {
    window.electronAPI.gameRecordEpisode(evt);
  }
}

function checkFranquicia(a) {
  const completedIds = state.gamification.completedIds || [];
  const familia = completedIds.filter(id2 => id2 !== a.id && relationsFamilia(id2, a));
  if (familia.length + 1 >= 2) {
    addCoins(100); addXP(200);
    toast('👑 Franquicia completada! Cofre legendario: +100 🪙', 'ok');
    unlockTrophy('first_franchise', 'Cazador de Franquicias', 'Completa tu primera franquicia entera', 'raro');
    if (familia.length + 1 >= 2) unlockTrophy('franchise2', 'Maestro de Sagas', 'Completa 2 franquicias enteras', 'legendario');
  }
}

function relationsFamilia(idA, idB) {
  const a = findAnime(idA), b = findAnime(idB);
  if (!a || !b) return false;
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return (norm(a.title).includes(norm(b.title.split(/[ :]/)[0])) || norm(b.title).includes(norm(a.title.split(/[ :]/)[0]))) && norm(a.title) !== norm(b.title);
}

function unlockTrophy(id, name, desc, rarity) {
  const g = state.gamification;
  g.trophies = g.trophies || {};
  if (g.trophies[id]) return;
  g.trophies[id] = { name, desc, rarity, at: Date.now() };
  toast('🏆 Trofeo desbloqueado: <b>' + esc(name) + '</b> (' + rarity + ')', 'ok');
  save();
  if (window.electronAPI && window.electronAPI.gameAddTrophy) {
    window.electronAPI.gameAddTrophy({ id, name, description: desc, rarity, unlocked_at: Date.now() });
  }
}

function checkTrophies() {
  const g = state.gamification;
  if (g.totalEpisodes >= 1) unlockTrophy('first_episode', 'Primer Paso', 'Registra tu primer episodio', 'comun');
  if (g.totalEpisodes >= 10) unlockTrophy('ep10', 'Veterano', 'Registra 10 episodios', 'comun');
  if (g.totalEpisodes >= 50) unlockTrophy('ep50', 'Maratonista', 'Registra 50 episodios', 'raro');
  if (g.totalEpisodes >= 100) unlockTrophy('ep100', 'Centurión', 'Registra 100 episodios', 'epico');
  if (g.totalEpisodes >= 300) unlockTrophy('ep300', 'Leyenda Viva', 'Registra 300 episodios', 'legendario');
  if (g.marathon >= 3) unlockTrophy('marathon3', 'Racha Ardiente', 'Logra un maratón de 3+ episodios seguidos', 'raro');
  const classics = (state.animeList || []).filter(a => a.year && a.year < 2000 && a.watched >= totalEps(a));
  if (classics.length >= 5) unlockTrophy('classic5', 'Clásico Imprescindible', 'Completa 5 animes anteriores al 2000', 'epico');
  const byGenre = {};
  (state.animeList || []).forEach(a => { if (Array.isArray(a.genres) && a.watched >= totalEps(a)) a.genres.forEach(gr => { byGenre[gr] = (byGenre[gr] || 0) + 1; }); });
  if (Object.entries(byGenre).some(([k, v]) => v >= 5)) unlockTrophy('genre5', 'Explorador de Géneros', 'Completa 5 animes de un mismo género', 'raro');
  if ((g.completedIds || []).length >= 1) unlockTrophy('first_franchise', 'Cazador de Franquicias', 'Completa tu primera franquicia entera', 'raro');
  if ((g.completedIds || []).length >= 2) unlockTrophy('franchise2', 'Maestro de Sagas', 'Completa 2 franquicias enteras', 'legendario');
  renderTrophies();
}

async function loadGameDB() {
  try {
    if (window.electronAPI && window.electronAPI.gameListTrophies) {
      const dbTrophies = await window.electronAPI.gameListTrophies();
      if (Array.isArray(dbTrophies)) {
        state.gamification.trophies = state.gamification.trophies || {};
        dbTrophies.forEach(t => { if (!state.gamification.trophies[t.id]) state.gamification.trophies[t.id] = { name: t.name, desc: t.description, rarity: t.rarity, at: Number(t.unlocked_at) }; });
      }
    }
    if (window.electronAPI && window.electronAPI.gameGetStats) {
      const st = await window.electronAPI.gameGetStats();
      if (st && st.level) { state.gamification.level = st.level; state.gamification.xp = st.xp || 0; state.gamification.coins = st.coins || 0; }
    }
  } catch (e) { /* noop */ }
}

function syncGameDB() {
  if (window.electronAPI && window.electronAPI.gameSaveStats) {
    window.electronAPI.gameSaveStats({ level: state.gamification.level, xp: state.gamification.xp, coins: state.gamification.coins, marathon: state.gamification.marathon, totalEpisodes: state.gamification.totalEpisodes });
  }
}

function trophyList() {
  const t = state.gamification.trophies || {};
  return TROPHY_DEFS.map(d => ({ ...d, unlocked: !!t[d.id], at: t[d.id] ? t[d.id].at : null }));
}

function renderTrophies() {
  const el = document.getElementById('trophyGrid');
  if (!el) return;
  const list = trophyList();
  el.innerHTML = list.map(d => {
    const c = RARITY[d.rarity].color;
    const un = d.unlocked;
    return '<div class="glass edge rounded-xl p-3 text-center ' + (un ? '' : 'opacity-40') + '" title="' + esc(d.description) + '">' +
      '<div class="w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-2xl mb-2" style="background:' + (un ? c + '22' : 'rgba(255,255,255,.04)') + ';border:1px solid ' + (un ? c : 'transparent') + '">' +
      (un ? '🏆' : '🔒') + '</div>' +
      '<div class="text-[11px] font-semibold text-slate-200">' + esc(d.name) + '</div>' +
      '<div class="text-[9px] text-slate-500 mt-0.5">' + esc(d.description) + '</div>' +
      '<div class="text-[8px] uppercase tracking-wide mt-1 font-bold" style="color:' + c + '">' + d.rarity + '</div>' +
      '</div>';
  }).join('');
}

function renderGamification() {
  const g = state.gamification;
  const lvl = document.getElementById('gameLevel');
  const xpBar = document.getElementById('gameXpBar');
  const xpText = document.getElementById('gameXpText');
  const coinText = document.getElementById('gameCoins');
  const epTextG = document.getElementById('gameEpisodes');
  if (lvl) lvl.textContent = 'Nivel ' + g.level;
  if (xpBar) { xpBar.style.width = Math.min(100, Math.round((g.xp / xpNeeded(g.level)) * 100)) + '%'; }
  if (xpText) xpText.textContent = g.xp + ' / ' + xpNeeded(g.level) + ' XP';
  if (coinText) coinText.textContent = '🪙 ' + g.coins;
  if (epTextG) epTextG.textContent = g.totalEpisodes + ' ep';
  renderTrophies();
  renderScrobbleHistory();
  renderProfileSidebar();
  renderSeasonPass();
}

function renderScrobbleHistory() {
  const listEl = document.getElementById('scrobHistList');
  const emptyEl = document.getElementById('scrobHistEmpty');
  const coinEl = document.getElementById('scrobHistCoin');
  if (!listEl) return;
  if (window.electronAPI && window.electronAPI.gameScrobbleHistory) {
    Promise.all([window.electronAPI.gameScrobbleHistory(30), window.electronAPI.gameCoinSummary()])
      .then(([rows, coins]) => {
        if (Array.isArray(rows) && rows.length) {
          listEl.innerHTML = rows.map(h => {
            const d = new Date(Number(h.watched_at || Date.now()));
            const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const mar = (h.marathon && h.marathon >= 3) ? '<span class="text-[9px] font-bold text-orange-300 ml-1">🔥×' + h.marathon + '</span>' : '';
            return '<div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[.03]">' +
              '<div class="min-w-0"><div class="text-[12px] text-slate-200 truncate">' + esc(h.anime_title || 'Anime') + ' <b class="text-white">Ep ' + h.episode + '</b>' + mar + '</div>' +
              '<div class="text-[10px] text-slate-500">' + esc(h.player || h.source || '—') + ' · ' + date + '</div></div>' +
              '<div class="text-right shrink-0"><div class="text-[11px] font-semibold text-amber-300">+' + h.coins + ' 🪙</div><div class="text-[10px] text-slate-500">+' + h.xp + ' XP</div></div>' +
              '</div>';
          }).join('');
          if (emptyEl) emptyEl.style.display = 'none';
        } else if (listEl) listEl.innerHTML = '';
        if (coinEl && coins && coins.total != null) coinEl.textContent = '🪙 ' + coins.total + ' acumulados';
      })
      .catch(() => {});
  }
}

const THEME_UNLOCK = { cyberpunk: 'pro', synthwave: 'pro', sakura: 'master', cerezo: 'master' };
function themeLabel(t) {
  return ({ dark: 'Oscuro', oled: 'OLED Negro', light: 'Claro', cyberpunk: 'Cyberpunk', synthwave: 'Synthwave', sakura: 'Sakura', cerezo: 'Cerezo' })[t] || t;
}
function rankOfUser() {
  const g = state.gamification || {};
  const levelRank = normRank(computeRank(g.level || 1));
  let best = levelRank;
  if (g.ownerVerified) best = 'legendario';
  (g.boughtRanks || []).forEach(r => {
    if (RANK_KEYS[r] != null && RANK_KEYS[r] > RANK_KEYS[best]) best = r;
  });
  return normRank(best);
}

const RANK_COSTS = { pro: 300, master: 600, legendario: 1000 };
const OWNER_PASS = 'nashe1234';

function hasRank(rank) {
  const g = state.gamification || {};
  if (g.ownerVerified) return true;
  if ((g.boughtRanks || []).indexOf(rank) !== -1) return true;
  return RANK_KEYS[rank] <= RANK_KEYS[computeRank(g.level || 1)];
}

function buyRank(rank) {
  const g = state.gamification || {};
  if (hasRank(rank)) return;
  const cost = RANK_COSTS[rank];
  if (cost == null) return;
  if ((g.coins || 0) < cost) { toast('No tenés suficientes AnimeCoins 🪙', 'warn'); return; }
  g.coins -= cost;
  g.boughtRanks = g.boughtRanks || [];
  g.boughtRanks.push(rank);
  save();
  renderProfileModal();
  toast('Rango <b>' + PROFILE_RANKS[rank].label + '</b> comprado! 🎉', 'ok');
}

function verifyOwner(pass) {
  if (String(pass) === OWNER_PASS) {
    state.gamification.ownerVerified = true;
    save();
    renderProfileModal();
    toast('👑 ¡Creador verificado! Rango máximo activado.', 'ok');
  } else {
    toast('Código de creador incorrecto', 'warn');
  }
}

function renderProfileRanks() {
  const holder = document.getElementById('profileRanks');
  if (!holder) return;
  const g = state.gamification || {};
  const rk = rankOfUser();
  let html = '<div class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><i data-lucide="crown" class="w-3.5 h-3.5"></i> Rangos</div>';
  for (const key of ['pro', 'master', 'legendario']) {
    const m = PROFILE_RANKS[key];
    const owned = hasRank(key);
    const active = RANK_KEYS[key] === RANK_KEYS[rk];
    const creator = g.ownerVerified;
    let btn;
    if (creator || owned) btn = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold ' + (active ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-500') + '">' + (creator ? '👑 Creador' : '✓') + '</span>';
    else if ((g.coins || 0) < RANK_COSTS[key]) btn = '<button data-bu="' + key + '" class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 text-slate-500" disabled>🪙 ' + RANK_COSTS[key] + '</button>';
    else btn = '<button data-bu="' + key + '" class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 transition">Comprar · ' + RANK_COSTS[key] + ' 🪙</button>';
    html += '<div class="py-2 px-3 rounded-xl ' + (active ? 'bg-white/[.07]' : 'bg-white/[.03]') + '">' +
      '<div class="flex items-center justify-between gap-2 mb-1"><div class="min-w-0"><div class="text-[12px] font-semibold" style="color:' + m.color + '">' + m.icon + ' ' + m.label + '</div>' +
      '<div class="text-[10px] text-slate-500">💰 ' + m.cost + ' 🪙</div></div>' + btn + '</div>' +
      '<div class="flex flex-wrap gap-1 mt-1">' + (m.benefits || []).map(b => '<span class="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-slate-300">' + esc(b) + '</span>').join('') + '</div></div>';
  }
  if (!g.ownerVerified) {
    html += '<div class="mt-3 pt-3 border-t border-white/5">' +
      '<div class="text-[11px] text-slate-400 mb-1.5">Sos el creador? Ingresá el código para el rango máximo 👑</div>' +
      '<div class="flex gap-2"><input id="ownerPass" type="password" placeholder="Código" class="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/5 edge text-[12px] text-white outline-none focus:ring-2 focus:ring-purple-400/40">' +
      '<button id="ownerVerify" class="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 transition">Verificar</button></div></div>';
  }
  holder.innerHTML = html;
  holder.querySelectorAll('[data-bu]').forEach(b => {
    b.addEventListener('click', () => { if (!b.disabled) buyRank(b.getAttribute('data-bu')); });
  });
  const vy = document.getElementById('ownerVerify');
  if (vy) vy.addEventListener('click', () => { verifyOwner(document.getElementById('ownerPass').value); });
}
