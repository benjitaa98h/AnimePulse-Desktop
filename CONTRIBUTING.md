# Contribuyendo a AnimePulse

¡Gracias por querer sumarte al proyecto! Esto es lo que necesitás saber para aportar sin fricción.

## Empezar

```bash
git clone https://github.com/benjitaa98h/AnimePulse-Desktop.git
cd AnimePulse-Desktop
npm install
npm start
```

## Flujo de trabajo

1. **Abrí un issue** primero para discutir el cambio (bug o feature) si es más que un typo.
2. Trabajá en una rama con nombre descriptivo:
   ```bash
   git checkout -b fix/mejora-buscador
   ```
3. Hacé **commits chicos y con mensajes claros** (estilo convencional: `fix:`, `feat:`, `docs:`, `test:`, `chore:`).
4. **Agregá/actualizá tests** para cualquier cambio de lógica en `src/api.js`, `src/modules/` o `src/db.js`.
5. Corré calidad antes de abrir el PR:
   ```bash
   npm run lint   # ESLint: solo reglas de bugs (sin formato)
   npm test       # vitest (scrobbler, api, db)
   ```
6. Abrí el **Pull Request** describiendo qué cambia y por qué.

## Estructura del código

La UI es `index.html` (markup) con scripts clásicos cargados como `<script defer>`; los módulos de lógica viven en `src/` y comparten scope global (por eso importa el orden de carga). El CSS está en `src/css/styles.css`. Los archivos del proceso main (`main.js`, `discord-rpc.js`, `folder-watcher.js`, `src/db.js`, `src/scrobbler.js`, `src/secrets.js`, `src/logger.js`) son CommonJS.

Para el flujo completo de datos y el modelo de seguridad, ver [`ARCHITECTURE.md`](ARCHITECTURE.md).

```
src/
├── utils.js            # helpers (esc, titleTokens, sleep, clamp…)
├── state.js            # estado global del renderer
├── api.js              # AniList (principal) + Jikan (respaldo)
├── secrets.js          # cifrado de tokens (safeStorage + fallback .install-key)
├── logger.js           # logs a userData/logs/
├── db.js               # persistencia SQLite (node:sqlite)
└── modules/
    ├── scrobbler.js    # detección por título de ventana
    ├── calendar.js
    ├── stats.js
    ├── gamification.js
    ├── organizer.js
    └── settings.js
```

Los **tests** (Vitest) cargan esos archivos con un sandbox de Node y testean las funciones puras, así que mantené las funciones de transformación/matching **libres de DOM** para que sigan siendo testables.

## Estándares

- **AniList es la API principal**, Jikan es solo el respaldo. No inviertas ese orden.
- No rompas la **persistencia triple** (localStorage + SQLite) ni el auto-update.
- Mantené `contextIsolation: true` y `nodeIntegration: false` en el `BrowserWindow`.

## Commit

Usá Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Preferí mensajes en español, específicos y en imperativo.

## Preguntas

Ante dudas, abrí un issue o comentá en el PR directamente. Si es tu primera contribución, buscá issues etiquetados `good first issue`.