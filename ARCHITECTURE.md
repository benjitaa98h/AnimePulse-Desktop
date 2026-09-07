# Arquitectura

Tracker de anime de escritorio sobre **Electron 44**. Un proceso `main` (Node) gestiona ventana, persistencia, servicios y actualizaciones; el renderer es una app web clásica (Tiny scripts `defer`, sin bundler ni frameworks) con Tailwind vía CDN.

## Procesos y límites

```
┌────────────────────────────────────────────────────────┐
│ main process (main.js + módulos CJS)                    │
│  ├─ electron-updater   : auto-actualización            │
│  ├─ createDB (node:sqlite) : persistencia + gamificación│
│  ├─ createScrobbler    : mpv socket + títulos ventana  │
│  ├─ createWatcher      : detección de archivos nuevos  │
│  ├─ createDiscord      : Rich Presence (pipes nativos) │
│  └─ src/secrets.js     : cifrado de tokens             │
└──────────────▲──────────────────────────────▲──────────┘
               │ ipcMain.handle('…')          │ send '…'
               │ preload.js (contextBridge)   │ webContents.send
┌──────────────┴──────────────────────────────┴──────────┐
│ renderer (index.html, scripts clásicos con defer)       │
│  src/{utils,state,api}.js + src/modules/*.js + app.js   │
└─────────────────────────────────────────────────────────┘
```

El renderer **no tiene `nodeIntegration`**: todo el acceso a Node pasa por `window.electronAPI` expuesto por `preload.js` (channel-whitelist sobre `ipcRenderer.invoke` + suscripciones `on`). Los canales se reservan en `ipcMain.handle` en `main.js` y en `src/secrets.js`.

## Flujo de datos

1. `state.js` mantiene el estado global del renderer y pide/salva por `state:load` / `state:save`.
2. El handler `state:save` llama a `createDB().saveFull(state)`, que vuelca todo (JSON) en SQLite `animepulse-db.sqlite` (tabla `app_state` + vistas de `anime_list`).
3. Los módulos (`organizer`, `calendar`, `stats`, `gamification`, `settings`) escuchan los eventos IPC y re-renderizan el DOM que les toca. No hay templating: el DOM se construye con `innerHTML` y `createElement`.

## Auto-scrobbler

Detecta qué se está viendo sin tocar el navegador:

- **mpv en vivo**: sondeo cada 3 s al socket IPC de mpv (`/tmp/mpv-socket-*`) pidiendo `time-pos`, `duration`, `path`, `pause`.
- **Títulos de ventana**: si no hay mpv, cadena de fallbacks por plataforma — Windows `powershell Get-Process`, Linux `hyprctl → xdotool → wmctrl`, macOS `osascript` — y parseo del título para sacar episodio/anime.
- **Extensión de navegador** (`extension/`, AnimePulse Watcher): lee el DOM directo y manda `{t, n}` por WebSocket a `127.0.0.1:8787`; `src/ext-bridge.js` valida el `Origin` (`chrome`/`moz-extension`) y reinyecta en el mismo canal `browser:titles`. Es el reemplazo de la detección por título de ventana.
- El renderer cruza el título detectado contra la lista, pregunta por episodios previos (`addYes`), ofrece precuelas si aplica y dispara el scrobble (monedas/XP vía `game:record-episode`).
- **Estados grises**: si el capítulo detectado supera el total registrado de un anime, `markAiringOnDetect` (app.js) lo marca en emisión, destapa el tope de episodios y lo pasa a `watching` (era `completed`/`plan`). Al terminar la última temporada vuelve a `completed` solo con `totalEps` conocido (no malcompleta shows en emisión).
- **Prioridad ext vs. ventana**: el polling nativo de títulos de ventana corre cada 6 s solo si la extensión no está conectada (`main.js: pollWindowTitles` → `extBridge.isConnected()`); sin eso, el título "AnimePulse" del propio Electron mataría el scrobble que acaba de disparar la extensión.
- **Historial offline**: la extensión guarda en `chrome.storage.local` los episodios cuyo video llegó a ≥85% mientras la app estaba cerrada (`apHistoryAdd`, dedupe `site|titulo|episodio`, top 300). Al reconectar hace flush de lo pendiente (`{type:'history'}`, re-flush cada 60 s hasta recibir ack); `ext-bridge.js` lo reinyecta por `extension:history` (nunca por `browser:titles`, para no interferir con el scrobble en vivo), el renderer lo procesa con `processWatchHistory` (app.js) — avanza `watched` en animes ya en lista, agrega los faltantes usando la cadena de APIs, respetando que si el ítem resuelto ya existe por `id` (p. ej. lo agregó el detector nativo) nunca rebaja `watched` — y responde `extension:history-ack` (preload → `ipcMain` → `extBridge.ackHistory()` → extensión marca `sent`).

## APIs de metadatos

`src/api.js` resuelve fichas con cadena de respaldo: **AniList** → **Kitsu** → **Jikan**. Kitsu es la más estable (sin OAuth para GET); sus ids son `kitsu_*` y no traen `mal_id` (la sincronización por MAL no aplica a esos ítems). Los mapers viven en `src/api.js` (`mapAnilistItem`, `mapKitsuItem`, `mapJikanItem`).

`refreshAirStatuses` (app.js) re-verifica los "Completados" contra Kitsu cada 6 h (30 por pasada, 400 ms de intervalo): si un title vuelve a emitir (`status: current`) o tiene más capítulos que los registrados, lo pasa a **Pendientes** con badge EN EMISIÓN; si figura terminado y estaba en emisión, fija el total y apaga el badge.

## Modelo de seguridad

- **CSP estricta** en `index.html`: `script-src 'self'` más los dos CDN permitidos, sin `unsafe-inline`; `connect-src` restringido a `https:`.
- **Tokens** en `src/secrets.js`: `safeStorage` del sistema cuando existe; si no (Linux sin keyring), fallback XOR con `SECRET_ANCHOR` = clave aleatoria por instalación en `userData/.install-key` (0600). Los archivos viven en `userData/secrets/*.enc`.
- Los tokens **nunca** se serializan a disco plano: `serializeStateForDisk` en blanquea los `SECRET_SETTING_KEYS` al persistir.

## Persistencia

`node:sqlite` (DatabaseSync) en `src/db.js`, WAL + synchronous=NORMAL. Una sola instancia por app (`appDB`) cerrada en `before-quit`. La primera migración desde el JSON legacy (`animepulse-state.json`) se hace con `migrateLegacy` y renombra el archivo a `.migrated`.

## Logging

`src/logger.js` escribe a `userData/logs/app-YYYY-MM-DD.log`. Se usa en paths que fallaron alguna vez: auto-updater, `state:save/load`, Discord RPC, folder-watcher y scrobbler nativo. En loops de polling (tick de scrobbler, scan de carpeta) el log lleva **throttle** para no spamear.

## Build y release

- `npm run dist` → electron-builder (AppImage + deb). `publish: never` en CI; el release se publica con el `gh` CLI local (`scripts/release.sh`).
- `scripts/release.sh` : bump semver → `npm test` → commit con Conventional Commits → tag `v*` → push → `gh release create` con los assets.
- **Calidad**: `npm run lint` (ESLint **solo de bugs**, sin reglas de formato — el código conserva su estilo) y `npm test` (vitest: `test/scrobbler.test.js`, `test/api.test.js`, `test/db.test.js`). Los tests del renderer se cargan con `vm.createContext` sin tocar DOM (ver `test/helpers/load.js`); `test/db.test.js` usa una base SQLite real en carpeta temporal.