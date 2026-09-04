import { describe, it, expect } from 'vitest';
import { loadApi } from './helpers/load.js';

const { mapAnilistItem, mapJikanItem, malNumFromId } = loadApi();

describe('mapAnilistItem', () => {
  it('mapea título romaji y en inglés', () => {
    const r = mapAnilistItem({
      id: 123,
      title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan', native: '進撃の巨人' },
    });
    expect(r.id).toBe('mal_123');
    expect(r.mal_id).toBe(123);
    expect(r.al_id).toBe(123);
    expect(r.title).toBe('Shingeki no Kyojin');
    expect(r.title_english).toBe('Attack on Titan');
  });

  it('deriva airingEpisodes desde nextAiringEpisode', () => {
    const r = mapAnilistItem({
      id: 7,
      title: { romaji: 'X' },
      status: 'RELEASING',
      nextAiringEpisode: { episode: 9, airingAt: 0 },
    });
    expect(r.airing).toBe(true);
    expect(r.airingEpisodes).toBe(8);
  });

  it('usa nextAiringEpisode.episode - 1, no el total de episodios', () => {
    const r = mapAnilistItem({
      id: 7,
      title: { romaji: 'X' },
      status: 'RELEASING',
      episodes: 24,
      nextAiringEpisode: { episode: 9 },
    });
    expect(r.airingEpisodes).toBe(8);
  });

  it('sin nextAiringEpisode usa episodes como airingEpisodes', () => {
    const r = mapAnilistItem({ id: 7, title: { romaji: 'X' }, status: 'FINISHED', episodes: 12 });
    expect(r.airing).toBe(false);
    expect(r.airingEpisodes).toBe(12);
  });

  it('limpia etiquetas HTML del synopsis', () => {
    const r = mapAnilistItem({
      id: 1,
      title: { romaji: 'Y' },
      description: '<p>Hola <b>mundo</b>  </p>',
    });
    expect(r.synopsis).toBe('Hola mundo');
  });

  it('escala averageScore de 0-100 a 0-10', () => {
    const r = mapAnilistItem({ id: 1, title: { romaji: 'Z' }, averageScore: 85 });
    expect(r.malScore).toBe(8.5);
  });

  it('devuelve studio desconocido si no hay estudios', () => {
    const r = mapAnilistItem({ id: 1, title: { romaji: 'W' } });
    expect(r.studio).toBe('Desconocido');
    expect(r.genres).toEqual([]);
    expect(r.trailerId).toBe('');
  });
});

describe('mapJikanItem', () => {
  it('mapea los campos básicos de Jikan', () => {
    const r = mapJikanItem({
      mal_id: 900,
      title: 'One Piece',
      episodes: 1100,
      airing: true,
    });
    expect(r.id).toBe('mal_900');
    expect(r.mal_id).toBe(900);
    expect(r.title).toBe('One Piece');
    expect(r.malEpisodes).toBe(1100);
    expect(r.airing).toBe(true);
    expect(r.airingEpisodes).toBe(0);
  });

  it('extrae géneros y estudio de Jikan', () => {
    const r = mapJikanItem({
      mal_id: 1,
      title_english: 'Cowboy Bebop',
      genres: [{ name: 'Action' }, { name: 'Sci-Fi' }],
      studios: [{ name: 'Sunrise' }],
      score: 8.8,
    });
    expect(r.genres).toEqual(['Action', 'Sci-Fi']);
    expect(r.studio).toBe('Sunrise');
    expect(r.malScore).toBe(8.8);
  });

  it('usa título de respaldo cuando no hay título', () => {
    const r = mapJikanItem({ mal_id: 2, title_english: 'Filler' });
    expect(r.title).toBe('Filler');
  });
});

describe('malNumFromId', () => {
  it('extrae el número de un id mal_', () => {
    expect(malNumFromId('mal_12345')).toBe(12345);
  });
  it('devuelve null sin prefijo mal_', () => {
    expect(malNumFromId('kitsu_5')).toBe(null);
    expect(malNumFromId(null)).toBe(null);
    expect(malNumFromId('')).toBe(null);
  });
});