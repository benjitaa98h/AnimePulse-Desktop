import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import createDBModule from '../src/db.js';

const { createDB } = createDBModule;

let dir;
let db;

beforeEach(() => {
  if (db) try { db.close(); } catch (e) {}
  dir = mkdtempSync(path.join(tmpdir(), 'ap-test-'));
  db = createDB(dir);
});

describe('createDB / persistencia', () => {
  it('guarda y carga el estado completo', () => {
    const state = {
      animeList: [{ id: '1', title: 'Frieren', status: 'viendo', watched: 4, malScore: 9 }],
      filter: 'viendo',
      version: 3
    };
    db.saveFull(state);
    expect(db.loadFull()).toEqual(state);
  });

  it('el upsert de anime_list actualiza el mismo id sin duplicar', () => {
    db.saveFull({ animeList: [{ id: '1', title: 'Frieren' }] });
    db.saveFull({ animeList: [{ id: '1', title: 'Frieren S2' }] });
    const r = db.info();
    expect(r.anime_count).toBe(1);
    expect(db.loadFull().animeList).toEqual([{ id: '1', title: 'Frieren S2' }]);
  });

  it('wipe borra todo', () => {
    db.saveFull({ animeList: [{ id: '1', title: 'A' }] });
    db.wipe();
    expect(db.info().anime_count).toBe(0);
    expect(db.loadFull()).toBeNull();
  });

  it('migra el JSON legacy y lo renombra', () => {
    const legacy = path.join(dir, 'animepulse-state.json');
    writeFileSync(legacy, JSON.stringify({ animeList: [{ id: 'x', title: 'Legacy' }] }));
    expect(db.migrateLegacy()).toBe(true);
    expect(db.info().anime_count).toBe(1);
    expect(existsSync(legacy)).toBe(false);
    expect(existsSync(legacy + '.migrated')).toBe(true);
  });

  it('migrateLegacy devuelve false sin archivo o con JSON inválido', () => {
    expect(db.migrateLegacy()).toBe(false);
    writeFileSync(path.join(dir, 'animepulse-state.json'), 'no-json');
    expect(db.migrateLegacy()).toBe(false);
  });
});

describe('registro de episodios y gamificación', () => {
  it('registra un episodio y suma monedas/xp', () => {
    db.saveFull({ animeList: [{ id: '1', title: 'Frieren' }] });
    const r = db.recordEpisode({ anime_id: '1', episode: 3, coins: 10, xp: 5 });
    expect(r.ok).toBe(true);
    const stats = db.scrobbleStats();
    expect(stats.episodes).toBe(1);
    expect(stats.animes).toBe(1);
    expect(db.coinSummary().total).toBe(10);
  });

  it('rechaza episodio sin anime_id', () => {
    const r = db.recordEpisode({ episode: 1 });
    expect(r.ok).toBe(false);
  });

  it('hace rollback completo si la transacción falla', () => {
    // episode: {} -> Number() = NaN -> NOT NULL constraint -> ROLLBACK
    const r = db.recordEpisode({ anime_id: '9', episode: {}, coins: 50, xp: 20 });
    expect(r.ok).toBe(false);
    expect(db.coinSummary().total).toBe(0);
    expect(db.scrobbleHistory()).toHaveLength(0);
  });
});

describe('tienda y equipo', () => {
  it('compra un ítem, descuenta monedas y lo marca owned', () => {
    db.saveFull({ animeList: [] });
    db.storeUpsert([{ id: 'frame1', name: 'Marco', kind: 'frame', cost: 100, min_rank: 'basico', value: '#fff' }]);
    db.recordEpisode({ anime_id: '1', episode: 1, coins: 200, xp: 1 });

    const purchase = db.storePurchase('frame1', 'master');
    expect(purchase.ok).toBe(true);
    expect(db.coinSummary().total).toBe(100); // 200 - 100
    expect(db.storeList().find(i => i.id === 'frame1').owned).toBe(1);
  });

  it('no deja comprar sin rango suficiente', () => {
    db.storeUpsert([{ id: 'g', name: 'Gpanel', kind: 'wallpaper', cost: 10, min_rank: 'master', value: '#000' }]);
    const r = db.storePurchase('g', 'basico');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('rank');
  });

  it('equipar desequipa otros del mismo kind', () => {
    db.storeUpsert([
      { id: 'c1', name: 'A', kind: 'frame', cost: 100, value: '1' },
      { id: 'c2', name: 'B', kind: 'frame', cost: 100, value: '2' },
      { id: 'w', name: 'W', kind: 'wallpaper', cost: 100, value: '3' }
    ]);
    db.recordEpisode({ anime_id: '1', episode: 1, coins: 300, xp: 1 });
    db.storePurchase('c1', 'master');
    db.storePurchase('c2', 'master');

    const noOwned = db.storeEquip('w', true);
    expect(noOwned.ok).toBe(false);

    db.storeEquip('c1', true);
    expect(db.storeList().find(i => i.id === 'c1').equipped).toBe(1);
    db.storeEquip('c2', true);
    const list = db.storeList();
    expect(list.find(i => i.id === 'c1').equipped).toBe(0);
    expect(list.find(i => i.id === 'c2').equipped).toBe(1);
  });

  it('grantItem no duplica un ítem ya otorgado', () => {
    const g1 = db.seasonGrantItem({ item_id: 'badge1', name: 'Insignia', kind: 'badge' });
    expect(g1.already).toBe(false);
    const g2 = db.seasonGrantItem({ item_id: 'badge1' });
    expect(g2.already).toBe(true);
  });
});

describe('season pass', () => {
  it('guarda y recarga', () => {
    expect(db.seasonSave({ id: 'season-1', tier: 2, xp: 300, redeemed: { e1: 1 } }).ok).toBe(true);
    const s = db.seasonGet('season-1');
    expect(s.tier).toBe(2);
    expect(s.xp).toBe(300);
    expect(s.redeemed).toEqual({ e1: 1 });
  });
});