import { describe, it, expect } from 'vitest';
import { loadScrobbler } from './helpers/load.js';

const { watchScore, episodeFromTitle, animeNameFromTitle } = loadScrobbler();

describe('watchScore', () => {
  it('devuelve 1 cuando todos los tokens coinciden', () => {
    expect(watchScore('Attack on Titan', 'Attack on Titan - Episode 1 - Netflix')).toBe(1);
  });

  it('puntúa parcial por tokens coincidentes', () => {
    const s = watchScore('Shingeki no Kyojin Season 2', 'Shingeki no Kyojin');
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(1);
  });

  it('devuelve 0 sin coincidencias', () => {
    expect(watchScore('Naruto', 'One Piece')).toBe(0);
  });

  it('ignora acentos y mayúsculas en la comparación', () => {
    expect(watchScore('Español', 'ESPANOL')).toBe(1);
    expect(watchScore('Café', 'cafe')).toBe(1);
  });

  it('ignora tokens demasiado cortos', () => {
    expect(watchScore('a', 'anything')).toBe(0);
  });

  it('devuelve 0 si falta un título', () => {
    expect(watchScore('', 'algo')).toBe(0);
    expect(watchScore('Naruto', '')).toBe(0);
  });
});

describe('episodeFromTitle', () => {
  it('detecta SxEy', () => {
    expect(episodeFromTitle('Anime S02E07')).toBe(7);
  });

  it('detecta "ep" con variantes', () => {
    expect(episodeFromTitle('Anime ep.12')).toBe(12);
    expect(episodeFromTitle('Anime EP 3')).toBe(3);
    expect(episodeFromTitle('Anime Episode 20')).toBe(20);
  });

  it('detecta "capítulo"', () => {
    expect(episodeFromTitle('Anime capítulo 5')).toBe(5);
    expect(episodeFromTitle('Anime capitulo 8')).toBe(8);
  });

  it('devuelve null sin número de episodio reconocible', () => {
    expect(episodeFromTitle('Anime Sin Numero')).toBe(null);
    expect(episodeFromTitle('abc123')).toBe(null);
  });
});

describe('animeNameFromTitle', () => {
  it('recorta la parte de episodio al final', () => {
    expect(animeNameFromTitle('Sword Art Online ep.10')).toBe('Sword Art Online');
  });

  it('separa título del reproductor', () => {
    expect(animeNameFromTitle('One Piece | Crunchyroll')).toBe('One Piece');
  });

  it('elimina marcadores de calidad y subtítulos', () => {
    expect(animeNameFromTitle('One Piece 1080p Sub Español HD')).toBe('One Piece');
  });

  it('normaliza espacios múltiples', () => {
    expect(animeNameFromTitle('Demon Slayer   ver online')).toBe('Demon Slayer');
  });
});