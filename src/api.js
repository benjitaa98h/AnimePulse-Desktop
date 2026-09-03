async function apiFetch(url, attempt) {
  attempt = attempt || 0;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
  } catch (e) {
    clearTimeout(timer);
    if (attempt < 1) { await sleep(600); return apiFetch(url, attempt + 1); }
    toast('Error de red al conectar con Jikan. Verifica tu conexión a internet.', 'err');
    return null;
  }
  clearTimeout(timer);
  if (res.status === 429) {
    if (attempt < 1) { await sleep(1200); return apiFetch(url, attempt + 1); }
    toast('Límite de la API de Jikan alcanzado. Espera unos segundos e inténtalo otra vez.', 'warn');
    return null;
  }
  if (!res.ok) {
    if (attempt < 1) { await sleep(900); return apiFetch(url, attempt + 1); }
    toast('La API de Jikan no responde (error ' + res.status + '). Suele ser temporal; inténtalo en unos segundos.', 'err');
    return null;
  }
  try { return await res.json(); }
  catch (e) { toast('Respuesta inválida de la API de Jikan.', 'err'); return null; }
}

function mapJikanItem(d) {
  return {
    id: 'mal_' + d.mal_id,
    mal_id: d.mal_id,
    title: d.title || d.title_english || 'Sin título',
    title_english: d.title_english || '',
    image: (d.images && (d.images.jpg.large_image_url || d.images.jpg.image_url)) || '',
    studio: (d.studios && d.studios[0] && d.studios[0].name) || 'Desconocido',
    genres: (d.genres || []).map(g => g.name),
    year: (d.year || (d.aired && d.aired.prop && d.aired.prop.from && d.aired.prop.from.year)) || null,
    malScore: d.score || null,
    malEpisodes: d.episodes || 0,
    synopsis: d.synopsis || '',
    trailerId: (d.trailer && d.trailer.youtube_id) || '',
    airing: !!d.airing,
    airingEpisodes: 0
  };
}

function mapAnilistItem(m) {
  const t = m.title || {};
  const img = (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || '';
  const studios = (m.studios && m.studios.nodes) || [];
  const st = studios.find(s => s.isAnimationStudio) || studios[0];
  const tr = (m.trailer && m.trailer.site === 'youtube') ? m.trailer.id : '';
  return {
    id: 'mal_' + m.id,
    mal_id: m.id,
    al_id: m.id,
    title: t.romaji || t.english || t.native || 'Sin título',
    title_english: t.english || '',
    image: img,
    studio: (st && st.name) || 'Desconocido',
    genres: m.genres || [],
    year: m.seasonYear || null,
    malScore: m.averageScore ? m.averageScore / 10 : null,
    malEpisodes: m.episodes || 0,
    synopsis: (m.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    trailerId: tr,
    airing: m.status === 'RELEASING',
    airingEpisodes: m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : (m.episodes || 0)
  };
}

const AL_FIELDS = 'id title { romaji english native } coverImage { extraLarge large } studios { nodes { name isAnimationStudio } } genres averageScore episodes seasonYear season format status trailer { id site } description nextAiringEpisode { episode airingAt }';
const AL_SEARCH = 'query($s: String, $n: Int) { Page(page: 1, perPage: $n) { media(search: $s, type: ANIME, isAdult: false) { ' + AL_FIELDS + ' } } }';
const AL_MEDIA = 'query($id: Int) { Media(id: $id, type: ANIME) { ' + AL_FIELDS + ' } }';
const AL_TRENDING = 'query($n: Int) { Page(page: 1, perPage: $n) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ' + AL_FIELDS + ' } } }';
const AL_SCHED = 'query($g: Int, $l: Int) { Page(page: 1, perPage: 50) { airingSchedules(airingAt_greater: $g, airingAt_lesser: $l) { airingAt episode media { id title { romaji english native } coverImage { large medium } studios { nodes { name } } } } } }';
const AL_PING = 'query { Page(page: 1, perPage: 1) { media(type: ANIME, sort: POPULARITY_DESC) { id } } }';
const AL_SCHED_P = 'query($g: Int, $l: Int, $pg: Int) { Page(page: $pg, perPage: 50) { pageInfo { hasNextPage } airingSchedules(airingAt_greater: $g, airingAt_lesser: $l) { airingAt episode media { id title { romaji english native } coverImage { large medium } studios { nodes { name } } } } } }';
async function fetchSchedAll(g, l) {
  const out = [];
  for (let pg = 1; pg <= 6; pg++) {
    const data = await anilistQuery(AL_SCHED_P, { g, l, pg });
    const arr = (data && data.Page && data.Page.airingSchedules) || [];
    if (!arr.length) break;
    out.push(...arr);
    if (!(data.Page.pageInfo && data.Page.pageInfo.hasNextPage)) break;
  }
  return out;
}
const AL_RELATIONS = 'query($id: Int) { Media(id: $id, type: ANIME) { id relations { edges { relationType node { id title { romaji english native } coverImage { medium } episodes } } } } }';
const AL_VIEWER = 'query { Viewer { id name avatar { large } } }';
const AL_SAVE = 'mutation($mid: Int, $progress: Int, $status: MediaListStatus) { SaveMediaListEntry(mediaId: $mid, progress: $progress, status: $status) { id progress status } }';

async function anilistQuery(query, variables, token) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(ANILIST, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query: query, variables: variables || {} }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.status === 429) {
        await sleep(2200 * (attempt + 1) + 400 * Math.random());
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        if (attempt < 1) { await sleep(700); continue; }
        console.warn('AniList error', res.status, txt.slice(0, 200));
        return null;
      }
      const body = await res.json();
      if (body && body.errors) {
        if (attempt < 1) { await sleep(600); continue; }
        return null;
      }
      return body.data || null;
    } catch (e) {
      clearTimeout(timer);
      if (attempt < 1) { await sleep(600); continue; }
      return null;
    }
  }
  return null;
}

async function searchAnimeFinal(q, limit) {
  const data = await anilistQuery(AL_SEARCH, { s: q, n: limit });
  if (data && data.Page && data.Page.media && data.Page.media.length) return data.Page.media.map(mapAnilistItem);
  const json = await apiFetch(JIKAN + '/anime?q=' + encodeURIComponent(q) + '&limit=' + limit + '&sfw=true');
  if (json && Array.isArray(json.data) && json.data.length) return json.data.map(mapJikanItem);
  return null;
}
