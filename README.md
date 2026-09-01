# zxs

> **Next-Gen anime tracker** para PC, inspirado en la potencia de **Taiga** con la estética moderna de **AniList / Netflix**.

[![Electron](https://img.shields.io/badge/Electron-44-47848f?style=flat&logo=electron&logoColor=white)](https://www.electronjs.org)
[![Node](https://img.shields.io/badge/Node-26-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![MIT](https://img.shields.io/badge/Licencia-MIT-yellow?style=flat)](LICENSE)

---


## ✨ ¿Por qué ZXS?

A diferencia de otros trackers, ZXS combina:

- **Doble fuente de datos**: AniList como API principal, con Jikan (MyAnimeList) como respaldo automático y transparente si la primera falla.
- **Auto-Scrobbler real**: detecta lo que estás viendo en tu navegador o reproductor sin que tengas que hacer nada manualmente.
- **100% privado**: tu lista vive en tu propia máquina, sin cuentas obligatorias ni servidores intermedios.

---

## 🚀 Características

| Función | Descripción |
|---|---|
| Mi Lista | Filtros por estado (Viendo, Pendientes, Completados, En pausa, Abandonados), vista cuadrícula o lista densa |
| Búsqueda en tiempo real | Autocompletado contra AniList con modal de previsualización, tráiler y puntuación |
| Auto-Scrobbler | Detección automática por título de ventana (Chrome, Edge, Firefox, Brave, VLC, MPV, PotPlayer) |
| Estadísticas | Métricas globales, géneros favoritos, actividad de los últimos 7 días |
| Calendario JST | Horarios de emisión en vivo desde AniList |
| Backup | Exportación e importación completa en JSON |

---

## 🛠️ Instalación

**Requisitos:** Node.js 18 o superior.

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

Los instaladores (NSIS + portable) se generan en `dist/`.

---

## 🧩 Estructura del proyecto

```
AnimePulse-Desktop/
├── index.html # UI completa (HTML + Tailwind + Lucide + JS ES6)
├── main.js # Proceso principal de Electron (ventana + IPC)
├── preload.js # Puente seguro contextBridge → electronAPI
└── package.json
```

---

## 🤝 Cómo contribuir

¿Te interesa sumarte? Este proyecto está en crecimiento activo y hay espacio para todo tipo de aportes:

- Revisá los issues etiquetados `good first issue` si es tu primera vez contribuyendo.
- Ideas en camino: importador masivo de listas, sincronización con cuenta de AniList, extensión de navegador para el Auto-Scrobbler.
- Abrí un issue si encontrás un bug o tenés una idea antes de mandar un pull request grande.

```bash
# Fork del repo, después:
git checkout -b mi-feature
git commit -m "Agrega mi-feature"
git push origin mi-feature
# Y abrí el Pull Request
```

---

## 📄 Licencia

MIT — libre para usar, modificar y compartir.
