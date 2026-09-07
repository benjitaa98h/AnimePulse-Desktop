# AnimePulse Watcher (extensión de navegador)

Reemplaza la detección por "título de ventana del SO" (frágil, depende de que
la ventana esté enfocada y de módulos nativos) por una detección que lee
directo el DOM de la página. Funciona en pestañas en segundo plano también.

Sitios soportados de entrada: Crunchyroll, AnimeFLV, Jkanime, TioAnime.
Agregar más sitios = copiar `content/generic.js` o `content/animeflv.js`
como base, y sumar el `match` en `manifest.json`.

## Cómo se conecta con la app

1. La extensión detecta título + episodio + play/pause por pestaña.
2. Cada 4s manda un resumen por WebSocket a `ws://127.0.0.1:8787`.
3. Del lado de Electron (proceso **main**) corre `src/ext-bridge.js` (vive en
   el repo de la app, no hace falta copiarlo). Levanta el server WS y
   reinyecta los datos al pipeline existente (`onBrowserTitles`) que ya usa
   `index.html`. **No hace falta tocar `scrobbler.js`.**

El bridge exige que el `Origin` de la conexión sea `chrome-extension://` o
`moz-extension://` (rechaza cualquier otro). Es localhost y solo alimenta
títulos, pero es el indicador de que el WebSocket viene de la extensión y no
de un proceso cualquiera.

4. **Historial offline**: al ver un episodio hasta ≥85% con la app cerrada, el
   `background.js` lo guarda en `chrome.storage.local` (dedupe
   `site|titulo|episodio`, top 300). Al reconectar lo manda como
   `{type:'history'}`, lo reenvía `ext-bridge.js` por `extension:history` y el
   renderer avanza `watched` o agrega el anime (resuelto por Kitsu/AniList/Jikan);
   la extensión lo marca como enviado recién al recibir `history-ack`.

## Instalar en modo desarrollador

**Chrome / Edge / Brave / Opera:**
1. Ir a `chrome://extensions` (o `edge://extensions`).
2. Activar "Modo de desarrollador" (arriba a la derecha).
3. "Cargar descomprimida" → seleccionar esta carpeta.
   Los `manifest.json` ya están arreglados (sin `default_locale`, que rompía
   la carga al faltar la carpeta `_locales`).

**Firefox:**
1. Copiar `manifest.firefox.json` sobre `manifest.json` (guardá una copia del
   original para volver a Chrome).
2. Ir a `about:debugging#/runtime/this-firefox`.
3. "Cargar complemento temporal" → seleccionar `manifest.json` dentro de la carpeta.
4. Ojo: en Firefox la extensión se desinstala al cerrar el navegador (así son
   las temporales). Para algo permanente hay que firmarla en addons.mozilla.org.

## Limitaciones conocidas

- Los selectores de Crunchyroll/AnimeFLV son best-effort — si les cambian el
  HTML de la página esto se puede romper. Hay fallback a `document.title`.
- En AnimeFLV el video a veces corre desde servidores externos en un
  `<iframe>` cross-origin; ahí llega el título/episodio pero no el estado de
  pausa (el `hasVideo` va en `false`).
- `background.js` descarta las pestañas pausadas: si pausás el video, el
  título desaparece del flujo y la app interpreta que dejaste de ver. Es la
  semántica actual; cambiarla es tocar `apBroadcastToApp`.
- El progreso (`progress`) se usa en `background.js` para el historial offline
  (episodios vistos ≥85% con la app cerrada); el scrobbler en vivo sigue usando
  su progreso simulado.