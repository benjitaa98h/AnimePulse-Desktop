# zxs

> **Next-Gen anime tracker** para PC, inspirado en la potencia de **Taiga** con la estética moderna de **AniList / Netflix**.

[![Electron](https://img.shields.io/badge/Electron-44-47848f?style=flat&logo=electron&logoColor=white)](https://www.electronjs.org)
[![Node](https://img.shields.io/badge/Node-26-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![Tailwind](https://img.shields.io/badge/TailwindCSS-v3-38bdf8?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MIT](https://img.shields.io/badge/Licencia-MIT-yellow?style=flat)](LICENSE)

**Catálogo y búsqueda:** [AniList](https://anilist.co) (GraphQL) como API primaria, con [Jikan](https://jikan.moe) / MyAnimeList de respaldo automático, y [AnimeSchedule.net](https://www.animeschedule.net) para el calendario.

---

## ✨ Características

| Área | Detalle |
| --- | --- |
| 📺 **Mi Lista** | Filtros por estado (Viendo / Pendientes / Completados / En pausa / Abandonados), vista cuadrícula o lista densa, incremento rápido `+1 Ep`. |
| 🔍 **Búsqueda** | En tiempo real contra AniList (GraphQL) con respaldo de Jikan: autocompletado, sinopsis, tráiler (autoplay), puntuación y episodios. |
| 🖥️ **Auto-Scrobbler** | Detecta el anime que estás viendo en el navegador o reproductor por el título de la ventana. Windows (`PowerShell`), Linux (`xdotool`/`wmctrl`/`hyprctl`), macOS (`osascript`). Incluye simulador manual y progreso real vía MPV IPC. |
| 🧠 **Prompts inteligentes** | Si el anime no está en tu lista te ofrece añadirlo (Añadir / Ficha / Descartar). Para franquicias largas detecta temporadas previas vía `relations` y las marca como completadas al instante. |
| 🎁 **Gamificación** | AnimeCoins, XP, niveles, maratones y **trofeos** por reproducir propios y estrenos. |
| 🏅 **Rangos** | Básico → Pro → Master → Legendario con multiplicadores de recompensa (1.1x / 1.25x / 1.5x) según tu nivel. |
| 🛒 **Tienda local** | Tienda de cosméticos en SQLite: compra y equipa **fondos, banners y marcos** de perfil. |
| 🎨 **Fondos de app** | Wallpapers con gradientes CSS y búsqueda por imagen desde **Unsplash**. |
| 👤 **Perfil estilo Steam** | Nombre, bio, foto, tema visual (Cyberpunk, Synthwave, Sakura, Cerezo) y tarjeta de perfil con banner/avatar personalizables. |
| 🎟️ **Pase de Temporada** | 30 niveles por temporada (Invierno / Primavera / Verano / Otoño) con XP de pase, **misiones** y recompensas cosméticas exclusivas. |
| 🔔 **Notificaciones** | Aviso nativo cuando emite un episodio de un anime que sigues (Viendo / En pausa). |
| 📁 **Organizador de archivos** | Renombra en lote a `Anime - S01E01.ext`, con modo vigilancia y detección de conflictos. |
| 🃏 **Tarjetas compartibles** | Copia como texto o imagen (PNG) desde la ficha de cualquier anime. |
| 🎮 **Rich Presence Discord** | Muestra qué estás viendo (título + episodio) en tiempo real. Cliente IPC propio, sin dependencias nativas. |
| 📊 **Estadísticas** | Métricas globales, géneros favoritos, distribución por estado y gráfico de actividad. |
| 📅 **Calendario** | Horario JST con datos en vivo y contador regresivo por episodio. |

---

## 🚀 Requisitos

- [Node.js](https://nodejs.org) 18 o superior.

### Por plataforma

- **Windows**: sin dependencias adicionales.
- **Linux**: para la detección del Auto-Scrobbler en el navegador:
  ```bash
  sudo apt install xdotool wmctrl      # Debian / Ubuntu
  sudo dnf install xdotool wmctrl      # Fedora
  sudo pacman -S xdotool wmctrl        # Arch
  ```

## ⚙️ Instalación y ejecución

```bash
npm install
npm start
```

## 📦 Empaquetar

```bash
npm run dist
```

Los instaladores se generan en `dist/`: **Windows** (`NSIS` + `portable`), **Linux** (`AppImage` + `deb`) y **macOS** (`dmg`).

---

## 🗂️ Estructura

```
zxs/
├── index.html        # UI completa (HTML + Tailwind + Lucide + JS ES6, archivo único)
├── main.js           # Proceso principal de Electron (ventana + IPC + base en disco + Discord)
├── preload.js        # Puente seguro contextBridge -> electronAPI
├── discord-rpc.js    # Cliente Rich Presence de Discord (IPC, sin dependencias)
├── folder-watcher.js # Vigilante de la carpeta del organizador
└── src/              # Backend: db.js (SQLite), scrobbler.js, etc.
```

---

## 🧱 Stack

| Capa | Tecnología |
| --- | --- |
| Runtime | Electron 44 · Node 26 |
| UI | HTML + Tailwind CSS v3 + Lucide |
| Persistencia | SQLite (`node:sqlite`) offline-first |
| APIs | AniList (GraphQL) · Jikan/MyAnimeList · AnimeSchedule.net · Unsplash · Kitsu |

> **Nota de empaquetado:** el proceso usa el icono por defecto de Electron. Para personalizarlo, añade `build/icon.ico` (256×256) y referéncialo en `package.json → build.win.icon`.

## 📄 Licencia

MIT
