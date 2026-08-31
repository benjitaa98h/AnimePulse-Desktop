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
    db.exec('DELETE FROM app_state; DELETE FROM anime_list; DELETE FROM user_stats; DELETE FROM trophies; DELETE FROM trophies_history;');
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
    history: ipcHistory
  };
}

module.exports = { createDB };
