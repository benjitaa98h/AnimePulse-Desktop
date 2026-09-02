const CAL_DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const CAL_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const CAL_JST_DAY = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Tokyo' });
const CAL_JST_TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' });
const CAL_MOCK = {
  monday:    [{ title:'Kimetsu no Yaiba', studio:'ufotable', time:'21:00' }],
  tuesday:   [{ title:'One Piece', studio:'Toei Animation', time:'09:30' }],
  thursday:  [{ title:'Steins;Gate', studio:'White Fox', time:'22:30' }],
  saturday:  [{ title:'Jujutsu Kaisen 2', studio:'MAPPA', time:'23:00' }],
  sunday:    [{ title:'Chainsaw Man', studio:'MAPPA', time:'23:00' }]
};
let sched7Cache = null;
let asSchedCache = null;
let asSchedLoaded = false;

const CAL_LOCAL_TIME = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
function firstCalendarOpen() {
  if (!state.calendarTouched) {
    state.calendarTouched = true;
    state.calendarDay = CAL_JST_DAY.format(new Date()).toLowerCase();
  }
}
function renderCalendar() {
  firstCalendarOpen();
  const today = CAL_JST_DAY.format(new Date()).toLowerCase();
  const tabs = document.getElementById('calDays');
  tabs.innerHTML = CAL_DAYS.map(d => {
    const active = state.calendarDay === d;
    const esHoy = d === today;
    return '<button data-day="' + d + '" class="cal-day px-3 py-2 rounded-xl text-[12px] font-semibold transition border ' +
      (active ? 'tab-active' : 'bg-white/[.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[.07]') + '">' + CAL_NAMES[CAL_DAYS.indexOf(d)] +
      (esHoy ? '<span class="ml-1.5 text-[9px] uppercase tracking-wide ' + (active ? 'text-amber-300' : 'text-purple-400') + '">● Hoy</span>' : '') + '</button>';
  }).join('');
  const wrap = document.getElementById('calList');
  wrap.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">' +
    Array.from({ length: 6 }).map(() => '<div class="h-[76px] rounded-xl glass edge opacity-40 animate-pulse"></div>').join('') +
    '<div class="col-span-full text-[11px] text-slate-500 mt-1">Cargando emisiones desde AniList…</div>' + '</div>';
  loadSchedule(state.calendarDay);
}

function scheduleCard(m, isMock) {
  const hue = hashHue(m.title);
  const clk = (m.mal_id ? ' cal-card cursor-pointer' : '');
  const localT = m.ts ? CAL_LOCAL_TIME.format(new Date(m.ts)) : '';
  const siguiendo = m.inList ? '<span class="ml-1 text-[9px] font-bold text-emerald-400">● en tu lista</span>' : '';
  return '<div' + (m.mal_id ? ' data-mal="' + m.mal_id + '"' : '') + ' class="flex items-center gap-3 p-3 rounded-xl glass edge anim-in' + clk + '">' +
    '<div class="relative w-10 h-14 rounded-lg overflow-hidden shrink-0" style="background:linear-gradient(150deg,hsl(' + hue + ',65%,28%),hsl(' + ((hue + 120) % 360) + ',60%,16%))">' +
    '<span class="poster-fallback" style="font-size:.75rem">' + initials(m.title) + '</span>' +
    (m.image ? '<img src="' + esc(m.image) + '" class="w-full h-full object-cover relative z-[1]" loading="lazy" onerror="this.remove()">' : '') + '</div>' +
    '<div class="flex-1 min-w-0"><div class="text-[13px] font-semibold text-white truncate">' + esc(m.title) + siguiendo + '</div>' +
    '<div class="text-[11px] text-slate-500 truncate">' + esc(m.studio || 'Anime') + '</div></div>' +
    '<div class="text-right shrink-0 no-select"><div class="font-mono font-bold text-white text-[13px]">' + m.time + '</div>' +
    '<div class="text-[9px] text-slate-500 uppercase tracking-wide">JST · ' + (localT || '') + (m.ep ? ' · Ep ' + m.ep : '') + '</div>' +
    (m.ts ? '<div class="cal-countdown text-[9px] font-bold ' + (m.ts <= Date.now() ? 'text-emerald-400' : 'text-amber-300') + '" data-ts="' + m.ts + '"></div>' : '') + '</div></div>';
}

function calCountdownText(tsMs) {
  if (!tsMs) return '';
  const diff = tsMs - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60000) return diff < 0 ? 'ahora' : 'en breve';
  const m = Math.max(1, Math.round(abs / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  const parts = [];
  if (d) parts.push(d + 'd'); if (h) parts.push(h + 'h'); parts.push(mm + 'm');
  return (diff < 0 ? 'hace ' : 'en ') + parts.join(' ');
}
function updateCalCountdowns() {
  const els = document.querySelectorAll('#calList .cal-countdown');
  els.forEach(el => { const ts = parseInt(el.getAttribute('data-ts'), 10); if (!ts) return; el.textContent = calCountdownText(ts); });
}

async function loadSchedule(day) {
  const wrap = document.getElementById('calList');
  if (!wrap) return;
  wrap.dataset.day = day;
  const emptyMsg = '<div class="col-span-full text-[12px] text-slate-500 py-8 text-center">Sin emisiones programadas para este día (JST).</div>';
  const renderItems = (items) => {
    if (!items.length) { wrap.innerHTML = emptyMsg; return; }
    wrap.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">' +
      items.map(m => scheduleCard(m, false)).join('') + '</div>';
    updateCalCountdowns();
  };
  if (asSchedLoaded && asSchedCache && state.settings && state.settings.asOn) {
    renderItems(asSchedCache[day] && asSchedCache[day].sort((a,b)=>a.ts-b.ts) || []);
    return;
  }
  const siguiendo = followedALIds();
  try {
    if (sched7Cache === null) {
      const start = Math.floor(Date.now() / 1000) - 12 * 3600;
      const end = start + 8 * 24 * 3600;
      sched7Cache = await fetchSchedAll(start, end);
    }
  } catch (e) { sched7Cache = null; }
  if (wrap.dataset.day !== day) return;
  if (sched7Cache && sched7Cache.length) {
    const items = sched7Cache
      .filter(a => CAL_JST_DAY.format(new Date(a.airingAt * 1000)).toLowerCase() === day)
      .map(a => {
        const m = a.media || {};
        const t = m.title || {};
        const st = (m.studios && m.studios.nodes && m.studios.nodes[0]) || null;
        const ts = a.airingAt * 1000;
        return {
          title: t.romaji || t.english || t.native || 'Sin título',
          studio: (st && st.name) || '',
          time: CAL_JST_TIME.format(new Date(ts)),
          image: (m.coverImage && (m.coverImage.large || m.coverImage.medium)) || '',
          mal_id: m.id,
          ep: a.episode,
          ts: ts,
          inList: siguiendo.has(Number(m.id)) || inListByTitle(t.romaji || t.english || t.native)
        };
      })
      .filter(x => x.ts >= Date.now() - 12 * 3600 * 1000)
      .sort((a, b) => a.ts - b.ts);
    renderItems(items);
    return;
  }
  wrap.innerHTML = '<div class="col-span-full text-[12px] text-slate-400 py-8 text-center">No se pudo cargar el calendario (AniList no respondió). Revisá tu conexión e intentá de nuevo.</div>';
}

async function calOpenDetail(malId, cardText) {
  const usingAs = asSchedLoaded && state.settings && state.settings.asOn;
  if (!usingAs) { await openApiDetailById(malId); return; }
  const title = (cardText || '').split('\n')[0].trim();
  toast('Cargando ficha de «' + esc(title || 'este título') + '»…', 'info');
  let item = null;
  try { const found = await searchAnimeFinal(title, 3); if (found && found.length) item = found[0]; } catch (e) { item = null; }
  if (!item) { toast('No se pudo localizar «' + esc(title) + '» para ver su ficha.', 'warn'); return; }
  apiDetailCache[String(item.mal_id)] = item;
  state.searchCache['id_' + String(item.mal_id)] = item;
  openApiDetail(item);
}
function asWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const ft = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fdn = (ft.getUTCDay() + 6) % 7;
  ft.setUTCDate(ft.getUTCDate() - fdn + 3);
  return { year: t.getUTCFullYear(), week: 1 + Math.round((t - ft) / (7 * 24 * 3600 * 1000)) };
}
function asImg(route) {
  return (route && route !== '0001-01-01T00:00:00Z') ? 'https://img.animeschedule.net/production/assets/public/img/' + route : '';
}
async function asSchedule() {
  const token = ((state.settings && state.settings.asToken) || '').trim();
  const { year, week } = asWeek(new Date());
  const url = 'https://animeschedule.net/api/v3/timetables/all?tz=Asia/Tokyo&year=' + year + '&week=' + week;
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' } });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token inválido o expirado (401). Revisa tu Application token en animeschedule.net.');
    throw new Error('Error de AnimeSchedule: ' + res.status);
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Respuesta inesperada de AnimeSchedule.');
  const byDay = {};
  data.forEach(a => {
    if (!a || !a.episodeDate) return;
    const ts = Date.parse(a.episodeDate);
    if (isNaN(ts)) return;
    const day = CAL_JST_DAY.format(new Date(ts)).toLowerCase();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({
      title: a.title || a.romaji || a.english || a.native || 'Sin título',
      studio: (a.mediaTypes && a.mediaTypes[0] && a.mediaTypes[0].name) || '',
      time: CAL_JST_TIME.format(new Date(ts)),
      image: asImg(a.imageVersionRoute),
      mal_id: a.id || '',
      ep: a.episodeNumber,
      ts: ts
    });
  });
  for (const k in byDay) byDay[k].sort((x, y) => x.ts - y.ts).forEach(c => { c.time = CAL_JST_TIME.format(new Date(c.ts)); });
  asSchedCache = byDay;
  asSchedLoaded = Object.keys(byDay).length > 0;
  return byDay;
}
function renderAsStatus(mode) {
  const el = document.getElementById('asStatus');
  if (!el) return;
  if (mode === 'loading') { el.innerHTML = '<span class="text-sky-300">Cargando horario desde AnimeSchedule…</span>'; return; }
  if (mode === 'ok') {
    const n = Object.keys(asSchedCache || {}).reduce((s, k) => s + (asSchedCache[k] || []).length, 0);
    el.innerHTML = '<span class="text-emerald-300"><b>' + n + '</b> emisiones cargadas (' + Object.keys(asSchedCache || {}).length + ' días). El Calendario ya usa AnimeSchedule.</span>';
    return;
  }
  if (mode === 'err') { el.innerHTML = '<span class="text-rose-300">' + (lastAsErr || 'No se pudo cargar AnimeSchedule.') + '</span>'; return; }
  el.textContent = (state.settings && state.settings.asOn)
    ? (asSchedLoaded ? 'AnimeSchedule cargado y activo en el Calendario.' : 'Casilla activa pero sin horario cargado todavía. Pulsa «Probar y cargar».')
    : 'Sin token de AnimeSchedule.';
}
let lastAsErr = '';
async function asLoadSchedule() {
  const token = ((state.settings && state.settings.asToken) || '').trim();
  if (!token) { lastAsErr = 'Pega primero tu Application token de AnimeSchedule.'; renderAsStatus('err'); return; }
  renderAsStatus('loading');
  try {
    const byDay = await asSchedule();
    if (!asSchedLoaded) throw new Error('Ese horario no trae emisiones. Prueba con el año/semana actual.');
    state.settings.asOn = true;
    const cb = document.querySelector('[data-setting="asOn"]'); if (cb) cb.checked = true;
    save();
    renderAsStatus('ok');
    renderCalendar();
    toast('Calendario ahora usa AnimeSchedule ✓', 'ok');
  } catch (e) {
    lastAsErr = (e && e.message) ? e.message : 'No se pudo cargar AnimeSchedule.';
    renderAsStatus('err');
    toast('No se pudo cargar AnimeSchedule', 'warn');
  }
}

