# AnimePulse

**Versión estable actual: v2.0.4** · [Descargar AppImage](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/download/v2.0.4/zxs-2.0.4.AppImage)

**Novedades destacadas en v2.0.4:** auto-scrobbler más preciso (detecta el episodio exacto y pregunta si ya viste los anteriores), límite real de episodios para animes en emisión, undo al eliminar, atajos de teclado (Ctrl+F, Ctrl+1..6, `/`), importador masivo más rápido y auto-actualización integrada.

---

Tracker de anime para PC. Sincroniza con AniList y MyAnimeList, registra lo que ves automáticamente y organiza tu lista con la estética moderna de AniList / Netflix.

[![Release](https://img.shields.io/github/v/release/benjitaa98h/AnimePulse-Desktop?label=versi%C3%B3n&color=7c3aed)](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/benjitaa98h/AnimePulse-Desktop/total?color=7c3aed)](https://github.com/benjitaa98h/AnimePulse-Desktop/releases)
[![Electron](https://img.shields.io/badge/Electron-44-47848f?style=flat&logo=electron&logoColor=white)](https://www.electronjs.org)
[![License](https://img.shields.io/github/license/benjitaa98h/AnimePulse-Desktop?color=7c3aed)](LICENSE)

[Descargar](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/latest) · [Releases](https://github.com/benjitaa98h/AnimePulse-Desktop/releases)

---

## ¿Qué es AnimePulse?

AnimePulse es un tracker de anime de escritorio que registra tu progreso sin que tengas que hacer nada. Detecta lo que estás viendo en tu navegador o reproductor, lo suma a tu lista y sincroniza tu progreso con AniList. Antes conocido como **zxs**.

---

## ¿Por qué AnimePulse?

**Sin comandos.** Todo lo que harías con scripts o webs puede hacerse desde la interfaz: buscar anime, marcarlo como visto, ver estadísticas y calendario de emisión.

**Auto-Scrobbler real.** Detecta por título de ventana lo que ves en Chrome, Edge, Firefox, Brave, VLC, MPV y PotPlayer. Suma los episodios, pregunta por los que te saltaste y arranca donde lo dejaste.

**Doble fuente de datos.** AniList como API principal, con Jikan (MyAnimeList) como respaldo automático y transparente si la primera falla.

**100% privado.** Tu lista vive en tu propia máquina, sin cuentas obligatorias ni servidores intermedios. Con auto-actualización integrada.

---

## Características

| Función | Descripción |
|---|---|
| Mi Lista | Filtros por estado (Viendo, Pendientes, Completados, En pausa, Abandonados), vista cuadrícula o lista densa, cambios de estado en masa |
| Búsqueda en tiempo real | Autocompletado contra AniList con modal de previsualización, tráiler y puntuación |
| Auto-Scrobbler | Detección automática por título de ventana con preguntas de episodios anteriores y límite de emisión |
| Sincronización | Progreso y estado con AniList, lista con Kitsu |
| Estadísticas | Métricas globales, géneros favoritos, actividad de los últimos 7 días |
| Calendario JST | Horarios de emisión en vivo desde AniList |
| Gamificación | Niveles, XP, monedas, Season Pass y trofeos |
| Temas | Seis temas visuales (dark, OLED, light, cyberpunk, synthwave, sakura) y acento de color reactivo |
| Backup | Exportación e importación completa en JSON, persistencia triple (localStorage + SQLite) |
| Discord | Rich Presence del anime que estás viendo |

---

## Descarga

| Plataforma | Enlace |
|---|---|
| Linux x64 (AppImage) | [zxs-2.0.4.AppImage](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/download/v2.0.4/zxs-2.0.4.AppImage) |
| Linux / Debian (deb) | [zxs_2.0.4_amd64.deb](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/download/v2.0.4/zxs_2.0.4_amd64.deb) |
| Windows | Próximamente (build NSIS en camino) |

Todas las versiones: [Releases](https://github.com/benjitaa98h/AnimePulse-Desktop/releases)

---

## Instalación

**Requisitos:** Node.js 18 o superior para correr desde el código fuente.

```bash
git clone https://github.com/benjitaa98h/AnimePulse-Desktop.git
cd AnimePulse-Desktop
npm install
npm start
```

### Empaquetar como ejecutable

```bash
npm run dist
```

Los instaladores (AppImage, deb) se generan en `dist/`.

---

## Requisitos

**PC:** Linux x64 o Windows 10/11. La app AppImage es autocontenida: no requiere electron ni Node instalados por separado.

**Cuentas (opcionales):** AniList para sincronizar progreso, Kitsu para lista. Todo funciona offline sin ellas.

---

## Historial de versiones

| Versión | Descripción | Descargar |
|---|---|---|
| v2.0.4 | Auto-scrobbler más preciso (episodio exacto, huecos, autoAdd), límite real de animes en emisión, undo, atajos, beforeunload | [Download](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/tag/v2.0.4) |
| v2.0.3 | Fix de seguridad (tokens en safeStorage), importador mejorado con selector de estado, fix de scrobbler "pegado" | [Download](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/tag/v2.0.3) |
| v2.0.2 | Empaquetado con módulos extraídos, auto-update funcionando | [Download](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/tag/v2.0.2) |
| v2.0.1 | Primera release pública | [Download](https://github.com/benjitaa98h/AnimePulse-Desktop/releases/tag/v2.0.1) |

---

## Estructura del proyecto

```
AnimePulse-Desktop/
├── index.html          # UI completa (HTML + Tailwind + Lucide + JS ES6)
├── main.js             # Proceso principal de Electron (ventana + IPC)
├── preload.js          # Puente seguro contextBridge → electronAPI
├── src/
│   ├── api.js          # AniList + Jikan
│   ├── state.js        # Estado global y persistencia
│   ├── utils.js        # Helpers (sanitización, hash, etc.)
│   └── modules/        # scrobbler, calendar, stats, gamification, organizer, settings
└── package.json
```

---

## Cómo contribuir

¿Te interesa sumarte? El proyecto está en crecimiento activo:

- Revisá los issues etiquetados `good first issue` para empezar.
- Ideas en camino: extensión de navegador para el Auto-Scrobbler, OAuth real con AniList, build para Windows y macOS.
- Abrí un issue si encontrás un bug o tenés una idea antes de mandar un pull request grande.

```bash
git checkout -b mi-feature
git commit -m "Agrega mi-feature"
git push origin mi-feature
# Y abrí el Pull Request
```

---

## Licencia

MIT — libre para usar, modificar y compartir.