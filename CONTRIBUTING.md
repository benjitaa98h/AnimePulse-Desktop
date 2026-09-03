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
4. **Agregá/actualizá tests** para cualquier cambio de lógica en `src/api.js` o `src/modules/`.
5. Corré la suite antes de abrir el PR:
   ```bash
   npm test
   ```
6. Abrí el **Pull Request** describiendo qué cambia y por qué.

## Estructura del código

La UI es un archivo único (`index.html` con JS ES6 inline) y los módulos de lógica viven en `src/` como scripts globales cargados con `<script defer>`:

```
src/
├── utils.js            # helpers (esc, titleTokens, sleep, clamp…)
├── state.js            # estado global y persistencia
├── api.js              # AniList (principal) + Jikan (respaldo)
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