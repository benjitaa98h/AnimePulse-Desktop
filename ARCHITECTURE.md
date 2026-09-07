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