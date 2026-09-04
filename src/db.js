'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

function createDB(userDataDir) {
  const dir = path.join(userDataDir, 'animepulse-db.sqlite');
  const db = new DatabaseSync(dir);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS anime_list (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT,
      rating INTEGER,
      watched INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      studio TEXT,
      genres TEXT,
      airing INTEGER DEFAULT 0,
      mal_score REAL,
      image TEXT,
      synopsis TEXT,
      year INTEGER,
      air_notified TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trophies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trophies_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id TEXT,
      anime_title TEXT,
      trophy_id TEXT,
      coins INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      event TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scrobble_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id TEXT NOT NULL,
      anime_title TEXT,
      episode INTEGER NOT NULL,
      season INTEGER DEFAULT 1,
      source TEXT,
      player TEXT,
      progress REAL,
      coins INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      marathon INTEGER DEFAULT 1,
      watched_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scrobble_anime ON scrobble_history(anime_id, episode);
    CREATE INDEX IF NOT EXISTS idx_scrobble_date ON scrobble_history(watched_at);

    CREATE TABLE IF NOT EXISTS coin_tx (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS xp_tx (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marathons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id TEXT,
      start_at INTEGER NOT NULL,
      end_at INTEGER NOT NULL,
      episode_count INTEGER NOT NULL,
      multiplier REAL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS store_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      rarity TEXT NOT NULL,
      cost INTEGER NOT NULL,
      min_rank TEXT NOT NULL,
      value TEXT NOT NULL,
      owned INTEGER DEFAULT 0,
      equipped INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT,
      acquired_at INTEGER NOT NULL,
      equipped INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_kind ON inventory(kind);

    CREATE TABLE IF NOT EXISTS season_pass (
      id TEXT PRIMARY KEY,
      tier INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      redeemed TEXT,
      missions TEXT,
      updated_at INTEGER NOT NULL
    );
  `);

  const dbPath = path.join(userDataDir, 'animepulse-state.json');

  function migrateLegacy() {
    if (!fs.existsSync(dbPath)) return false;
    try {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.animeList)) return false;
      saveFull(data);
      fs.renameSync(dbPath, dbPath + '.migrated');
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveFull(state) {
    const now = Date.now();
    if (state && typeof state === 'object') {
      const stmt = db.prepare(
        'INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
      );
      stmt.run('main', JSON.stringify(state), now);

      const upsert = db.prepare(
        'INSERT INTO anime_list (id, title, status, rating, watched, total, studio, genres, airing, mal_score, image, synopsis, year, air_notified, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET title = excluded.title, status = excluded.status, rating = excluded.rating, ' +
        'watched = excluded.watched, total = excluded.total, studio = excluded.studio, genres = excluded.genres, ' +
        'airing = excluded.airing, mal_score = excluded.mal_score, image = excluded.image, synopsis = excluded.synopsis, ' +
        'year = excluded.year, air_notified = excluded.air_notified, updated_at = excluded.updated_at'
      );
      const list = Array.isArray(state.animeList) ? state.animeList : [];
      const notified = state.airNotified || {};
      for (const a of list) {
        upsert.run(
          String(a.id || ''),
          String(a.title || ''),
          String(a.status || ''),
          a.rating == null ? null : Number(a.rating),
          Number(a.watched || 0),
          Number(a.malEpisodes || a.totalEpisodes || 0),
          String(a.studio || ''),
          JSON.stringify(Array.isArray(a.genres) ? a.genres : []),
          a.airing ? 1 : 0,
          a.malScore == null ? null : Number(a.malScore),
          String(a.image || ''),
          String(a.synopsis || ''),
          a.year == null ? null : Number(a.year),
          notified[a.id] != null ? JSON.stringify(notified[a.id]) : null,
          now
        );
      }
    }
    return { ok: true };
  }

  function loadFull() {
    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('main');
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch (e) {
      return null;
    }
  }

  function wipe() {
    db.exec('DELETE FROM app_state; DELETE FROM anime_list; DELETE FROM user_stats; DELETE FROM trophies; DELETE FROM trophies_history; DELETE FROM scrobble_history; DELETE FROM coin_tx; DELETE FROM xp_tx; DELETE FROM marathons; DELETE FROM store_items; DELETE FROM inventory; DELETE FROM season_pass;');
    return { ok: true };
  }

  function info() {
    const stateRow = db.prepare('SELECT updated_at FROM app_state WHERE key = ?').get('main');
    const countRow = db.prepare('SELECT COUNT(*) AS n FROM anime_list').get();
    let size = 0, mtime = 0;
    try {
      const st = fs.statSync(dir);
      size = st.size; mtime = st.mtimeMs;
    } catch (e) { /* noop */ }
    return {
      size,
      mtime,
      updated_at: stateRow ? Number(stateRow.updated_at) : null,
      anime_count: countRow ? Number(countRow.n) : 0
    };
  }

  function ipcGetUserStats() {
    const row = db.prepare('SELECT value FROM user_stats WHERE key = ?').get('main');
    if (!row) return null;
    try { return JSON.parse(row.value); } catch (e) { return null; }
  }

  function ipcSaveUserStats(stats) {
    if (!stats || typeof stats !== 'object') return { ok: false };
    db.prepare(
      'INSERT INTO user_stats (key, value, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).run('main', JSON.stringify(stats), Date.now());
    return { ok: true };
  }

  function ipcListTrophies() {
    return db.prepare('SELECT id, name, description, rarity, unlocked_at FROM trophies ORDER BY unlocked_at').all();
  }

  function ipcAddTrophy(t) {
    if (!t || !t.id) return { ok: false };
    try {
      const r = db.prepare(
        'INSERT INTO trophies (id, name, description, rarity, unlocked_at) VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO NOTHING'
      ).run(String(t.id), String(t.name || t.id), String(t.description || ''), String(t.rarity || 'comun'), Number(t.unlocked_at || Date.now()));
      return { ok: true, inserted: r.changes > 0 };
    } catch (e) {
      return { ok: false, error: String(e && e.message) };
    }
  }

  function ipcAddHistory(entry) {
    if (!entry) return { ok: false };
    db.prepare(
      'INSERT INTO trophies_history (anime_id, anime_title, trophy_id, coins, xp, event, created_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      String(entry.anime_id || ''),
      String(entry.anime_title || ''),
      String(entry.trophy_id || ''),
      Number(entry.coins || 0),
      Number(entry.xp || 0),
      String(entry.event || ''),
      Number(entry.created_at || Date.now())
    );
    return { ok: true };
  }

  function ipcHistory(limit) {
    const n = Number(limit || 50);
    return db.prepare('SELECT anime_id, anime_title, trophy_id, coins, xp, event, created_at FROM trophies_history ORDER BY created_at DESC LIMIT ?').all(n);
  }

  function ipcRecordEpisode(evt) {
    if (!evt || evt.anime_id == null) return { ok: false, error: 'missing anime_id' };
    const now = Date.now();
    const anime = db.prepare('SELECT title FROM anime_list WHERE id = ?').get(String(evt.anime_id));
    const title = String(evt.anime_title || (anime && anime.title) || '');
    const episode = Number(evt.episode || 0);
    const coins = Math.round(Number(evt.coins || 0));
    const xp = Math.round(Number(evt.xp || 0));
    const marathon = Number(evt.marathon || 1);
    const source = String(evt.source || 'manual');
    const player = String(evt.player || '');
    const progress = evt.progress == null ? null : Number(evt.progress);

    const tx = db.prepare('BEGIN');
    const cHistory = db.prepare(
      'INSERT INTO scrobble_history (anime_id, anime_title, episode, season, source, player, progress, coins, xp, marathon, watched_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const cCoins = db.prepare('INSERT INTO coin_tx (delta, reason, ref_id, created_at) VALUES (?, ?, ?, ?)');
    const cXp = db.prepare('INSERT INTO xp_tx (delta, reason, ref_id, created_at) VALUES (?, ?, ?, ?)');
    const cMarathon = db.prepare(
      'INSERT INTO marathons (anime_id, start_at, end_at, episode_count, multiplier) VALUES (?, ?, ?, ?, ?)'
    );

    try {
      tx.run();
      const r = cHistory.run(
        String(evt.anime_id), title, episode, Number(evt.season || 1), source, player,
        progress, coins, xp, marathon, now
      );
      const historyId = Number(r.lastInsertRowid);
      if (coins !== 0) cCoins.run(coins, 'episode', String(historyId), now);
      if (xp !== 0) cXp.run(xp, 'episode', String(historyId), now);
      if (marathon >= 3) {
        cMarathon.run(String(evt.anime_id), now - 3 * 60 * 60 * 1000, now, marathon, 1.5);
      }
      db.prepare('COMMIT').run();
      return { ok: true, id: historyId };
    } catch (e) {
      try { db.prepare('ROLLBACK').run(); } catch (e2) { /* noop */ }
      return { ok: false, error: String(e && e.message) };
    }
  }

  function ipcScrobbleHistory(limit) {
    const n = Number(limit || 50);
    return db.prepare(
      'SELECT id, anime_id, anime_title, episode, season, source, player, progress, coins, xp, marathon, watched_at ' +
      'FROM scrobble_history ORDER BY watched_at DESC LIMIT ?'
    ).all(n);
  }

  function ipcCoinSummary() {
    const row = db.prepare('SELECT COALESCE(SUM(delta),0) AS total, COUNT(*) AS tx FROM coin_tx').get();
    return { total: row ? Number(row.total) : 0, tx: row ? Number(row.tx) : 0 };
  }

  function ipcScrobbleStats() {
    const r = db.prepare(
      'SELECT COUNT(*) AS episodes, COUNT(DISTINCT anime_id) AS animes, COALESCE(SUM(episode),0) AS total_eps, ' +
      'MAX(marathon) AS best_marathon FROM scrobble_history'
    ).get();
    return {
      episodes: r ? Number(r.episodes) : 0,
      animes: r ? Number(r.animes) : 0,
      best_marathon: r ? Number(r.best_marathon || 1) : 1
    };
  }

  function isItemOwned(id) {
    const row = db.prepare('SELECT 1 FROM inventory WHERE item_id = ?').get(String(id));
    return !!row;
  }

  function ipcStoreList() {
    return db.prepare(
      'SELECT id, name, kind, rarity, cost, min_rank, value, owned, equipped FROM store_items ORDER BY cost'
    ).all();
  }

  function ipcStoreUpsert(items) {
    if (!Array.isArray(items)) return { ok: false };
    const stmt = db.prepare(
      'INSERT INTO store_items (id, name, kind, rarity, cost, min_rank, value, owned, equipped) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, rarity = excluded.rarity, ' +
      'cost = excluded.cost, min_rank = excluded.min_rank, value = excluded.value'
    );
    const now = Date.now();
    for (const it of items) {
      if (!it || !it.id) continue;
      const owned = isItemOwned(String(it.id)) ? 1 : 0;
      stmt.run(
        String(it.id), String(it.name || it.id), String(it.kind || 'wallpaper'),
        String(it.rarity || 'comun'), Number(it.cost || 0), String(it.min_rank || 'basico'),
        String(it.value || ''), owned, 0
      );
    }
    return { ok: true };
  }

  function ipcStorePurchase(itemId, rank) {
    const item = db.prepare('SELECT * FROM store_items WHERE id = ?').get(String(itemId));
    if (!item) return { ok: false, error: 'not_found' };
    if (isItemOwned(String(itemId))) return { ok: false, error: 'owned' };

    const rankOrder = { basico: 0, pro: 1, master: 2, legendario: 3 };
    const need = rankOrder[String(item.min_rank)] || 0;
    const have = rankOrder[String(rank)] || 0;
    if (have < need) return { ok: false, error: 'rank' };

    const coins = db.prepare('SELECT COALESCE(SUM(delta),0) AS total FROM coin_tx').get();
    const balance = coins ? Number(coins.total) : 0;
    if (balance < Number(item.cost)) return { ok: false, error: 'coins', balance };

    const now = Date.now();
    const tx = db.prepare('BEGIN');
    try {
      tx.run();
      db.prepare('INSERT INTO coin_tx (delta, reason, ref_id, created_at) VALUES (?, ?, ?, ?)').run(
        -Number(item.cost), 'store:' + String(item.id), String(item.id), now
      );
      db.prepare(
        'INSERT INTO inventory (id, item_id, kind, name, value, acquired_at, equipped) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(String(item.id), String(item.id), String(item.kind), String(item.name), String(item.value || ''), now, 0);
      db.prepare('UPDATE store_items SET owned = 1 WHERE id = ?').run(String(item.id));
      db.prepare('COMMIT').run();
      return { ok: true, balance: balance - Number(item.cost) };
    } catch (e) {
      try { db.prepare('ROLLBACK').run(); } catch (e2) { /* noop */ }
      return { ok: false, error: String(e && e.message) };
    }
  }

  function ipcStoreEquip(itemId, on) {
    const owned = db.prepare('SELECT * FROM inventory WHERE item_id = ?').get(String(itemId));
    if (!owned) return { ok: false, error: 'not_owned' };
    if (on) {
      db.prepare('UPDATE inventory SET equipped = 0 WHERE kind = (SELECT kind FROM inventory WHERE item_id = ?)').run(String(itemId));
      db.prepare('UPDATE store_items SET equipped = 0 WHERE kind = (SELECT kind FROM store_items WHERE id = ?)').run(String(itemId));
    }
    db.prepare('UPDATE inventory SET equipped = ? WHERE item_id = ?').run(on ? 1 : 0, String(itemId));
    db.prepare('UPDATE store_items SET equipped = ? WHERE id = ?').run(on ? 1 : 0, String(itemId));
    return { ok: true };
  }

  function ipcStoreInventory() {
    return db.prepare('SELECT item_id, kind, name, value, equipped FROM inventory ORDER BY acquired_at').all();
  }

  function ipcSeasonGet(id) {
    const r = db.prepare('SELECT tier, xp, redeemed, missions, updated_at FROM season_pass WHERE id = ?').get(String(id || 'current'));
    if (!r) return null;
    let redeemed = {}, missions = {};
    try { redeemed = JSON.parse(r.redeemed || '{}'); } catch (e) {}
    try { missions = JSON.parse(r.missions || '{}'); } catch (e) {}
    return { id: String(id || 'current'), tier: Number(r.tier), xp: Number(r.xp), redeemed, missions };
  }

  function ipcSeasonSave(s) {
    if (!s) return { ok: false };
    db.prepare(
      'INSERT INTO season_pass (id, tier, xp, redeemed, missions, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET tier = excluded.tier, xp = excluded.xp, redeemed = excluded.redeemed, ' +
      'missions = excluded.missions, updated_at = excluded.updated_at'
    ).run(
      String(s.id || 'current'), Number(s.tier || 1), Number(s.xp || 0),
      JSON.stringify(s.redeemed || {}), JSON.stringify(s.missions || {}), Date.now()
    );
    return { ok: true };
  }

  function ipcSeasonGrantItem(item) {
    if (!item || !item.item_id) return { ok: false };
    const exists = db.prepare('SELECT 1 FROM inventory WHERE item_id = ?').get(String(item.item_id));
    if (exists) return { ok: true, already: true };
    db.prepare(
      'INSERT INTO inventory (id, item_id, kind, name, value, acquired_at, equipped) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(String(item.item_id), String(item.item_id), String(item.kind || 'frame'), String(item.name || item.item_id), String(item.value || ''), Date.now(), 0);
    return { ok: true, already: false };
  }

  function close() {
    try { db.close(); } catch (e) { /* noop */ }
  }

  return {
    migrateLegacy, saveFull, loadFull, wipe, info, close,
    getUserStats: ipcGetUserStats,
    saveUserStats: ipcSaveUserStats,
    listTrophies: ipcListTrophies,
    addTrophy: ipcAddTrophy,
    addHistory: ipcAddHistory,
    history: ipcHistory,
    recordEpisode: ipcRecordEpisode,
    scrobbleHistory: ipcScrobbleHistory,
    coinSummary: ipcCoinSummary,
    scrobbleStats: ipcScrobbleStats,
    storeList: ipcStoreList,
    storeUpsert: ipcStoreUpsert,
    storePurchase: ipcStorePurchase,
    storeEquip: ipcStoreEquip,
    storeInventory: ipcStoreInventory,
    seasonGet: ipcSeasonGet,
    seasonSave: ipcSeasonSave,
    seasonGrantItem: ipcSeasonGrantItem
  };
}

module.exports = { createDB };
