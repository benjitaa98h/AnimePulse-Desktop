# AnimePulse Desktop — Next-Gen Tracker

App de escritorio para el seguimiento de anime inspirada en la potencia de **Taiga** con la estética moderna de **AniList / Netflix**.

![Stack](https://img.shields.io/badge/Electron-33-blue) ![Stack](https://img.shields.io/badge/HTML5-Tailwind%20CSS%20v3-purple) ![Stack](https://img.shields.io/badge/API-AniList%20%2B%20Jikan-orange)

**Catalogo/búsqueda:** **AniList (GraphQL)** como API primaria con **Jikan (MyAnimeList)** de respaldo automático (fallback transparente si AniList no responde).

## Características

- **Mi Lista**: filtros por estado (Viendo, Pendientes, Completados, En pausa, Abandonados), vista de cuadrícula o lista densa con incremento rápido de episodios (`+1 Ep`).
- **Búsqueda en tiempo real** contra la API GraphQL de [AniList](https://anilist.co) (con respaldo de Jikan) con autocompletado y modal de previsualización (sinopsis, tráiler reproducible con autoplay y botón «Abrir en YouTube», puntuación, episodios).
- **Auto-Scrobbler**: detecta automáticamente el anime que estás viendo en cualquier navegador (Chrome / Edge / Firefox / Brave…) o reproductor mediante el título de la ventana (Windows), también dentro de la app (tráiler/ficha). Registrar episodios al terminar e incluye simulador manual (VLC / MPV / PotPlayer).
- **Prompts inteligentes al detectar**: si el anime que ves no está en tu lista te pregunta si quieres agregarlo (Añadir / Ver ficha / Descartar). Para franquicias largas (p. ej. Bleach) detecta las temporadas anteriores vía `relations` de AniList y te ofrece marcarlas como completadas al instante.
- **Tráiler funcional**: se reproduce dentro de la app al abrir la ficha (autoplay) con enlace externo a YouTube si el embed está bloqueado.
- **Cuenta AniList (OAuth)**: conecta tu cuenta pegando el Client ID y access token (crea una app gratis en `anilist.co/settings/developer`). Tu progreso y estado se sincronizan automáticamente en línea; hay re-sincronización completa con un clic desde la ficha del conector o con el botón «Sync AniList» de la barra de Mi Lista. Crunchyroll y otras webs se detectan solas al verlas en el navegador (Crunchyroll no ofrece API pública para terceros).
- **Notificaciones de escritorio**: cuando un episodio de un anime que estás siguiendo (Viendo/En pausa) se emite, recibes un aviso nativo (también al abrir la app si se emitió en las últimas 24 h; cada episodio avisa una sola vez).
- **Organizador de Archivos**: elige una carpeta con tus descargas (.mkv/.mp4/.avi…) y renombra en lote a `Anime - S01E01.ext`. Detecta la serie y el episodio por nombre, marca conflictos si el destino ya existe, y puede usar el título oficial de AniList como referencia de serie.
- **Ajustes del Tracker**: temas («Oscuro», «OLED Negro», «Claro») y 6 colores de acento, además de los interruptores del Auto-Scrobbler (detección, incremento, notificaciones, prompt automático y sincronización).
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