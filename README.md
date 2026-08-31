# AnimePulse Desktop — Next-Gen Tracker

App de escritorio para el seguimiento de anime inspirada en la potencia de **Taiga** con la estética moderna de **AniList / Netflix**.

![Stack](https://img.shields.io/badge/Electron-33-blue) ![Stack](https://img.shields.io/badge/HTML5-Tailwind%20CSS%20v3-purple) ![Stack](https://img.shields.io/badge/API-AniList%20%2B%20Jikan-orange)

**Catalogo/búsqueda:** **AniList (GraphQL)** como API primaria con **Jikan (MyAnimeList)** de respaldo automático (fallback transparente si AniList no responde).

## Características

- **Mi Lista**: filtros por estado (Viendo, Pendientes, Completados, En pausa, Abandonados), vista de cuadrícula o lista densa con incremento rápido de episodios (`+1 Ep`).
- **Búsqueda en tiempo real** contra la API GraphQL de [AniList](https://anilist.co) (con respaldo de Jikan) con autocompletado y modal de previsualización (sinopsis, tráiler, puntuación, episodios).
- **Auto-Scrobbler**: detecta automáticamente el anime que estás viendo en cualquier navegador (Chrome / Edge / Firefox / Brave…) o reproductor mediante el título de la ventana (Windows), también dentro de la app (tráiler/ficha). Si el título detectado no está en tu lista, te sugiere agregarlo abriendo su ficha. Registra episodios al terminar e incluye simulador manual (VLC / MPV / PotPlayer).
- **Estadísticas personales**: métricas globales, género favoritos, distribución por estado y gráfico de actividad de los últimos 7 días.
- **Calendario de emisión** horario JST con datos en vivo desde el `airingSchedules` de AniList (sábados-completos) con respaldo de demo.
- **Persistencia total** en `localStorage` con exportación/importación de respaldo JSON. Arranca con la lista vacía (sin datos de demo).

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior.

## Instalación y ejecución

```bash
npm install
npm start
```

## Empaquetar como ejecutable (.exe)

```bash
npm run dist
```

Los instaladores se generan en la carpeta `dist/` (`NSIS` + `portable`).

## Estructura

```
AnimePulse-Desktop/
├── index.html    # UI completa (HTML + Tailwind + Lucide + JS ES6 en un solo archivo)
├── main.js       # Proceso principal de Electron (ventana sin marco + IPC)
├── preload.js    # Puente seguro contextBridge -> electronAPI
└── package.json
```

## Notas para empaquetar iconos

El proceso de empaquetado usa el icono por defecto de Electron. Para personalizarlo, añade un `build/icon.ico` (256x256) y referencia su ruta en `package.json` → `build.win.icon`.

## Licencia

MIT