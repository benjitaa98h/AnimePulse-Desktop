#!/usr/bin/env bash
#
# AnimePulse release script (semver)
# Uso:
#   ./scripts/release.sh patch     # 2.0.5 -> 2.0.6
#   ./scripts/release.sh minor     # 2.0.5 -> 2.1.0
#   ./scripts/release.sh major     # 2.0.5 -> 3.0.0
#   ./scripts/release.sh 2.1.3     # versión explícita
#
# Requiere: gh autenticado, git, node, acceso a dist para electron-builder.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# gh estatico (evita dependencia de sistema donde falta)
export PATH="${GH_BIN:-/tmp/opencode/gh_2.71.2_linux_amd64/bin}:$PATH"
if ! command -v gh >/dev/null 2>&1; then
  echo "ERR: 'gh' no está en PATH. Definí GH_BIN o instalá gh." >&2
  exit 1
fi

# --- 1. Determiná la versión nueva -----------------------------------------
OLD="$(node -e "console.log(require('./package.json').version)")"
read -r MAJ MIN PAT < <(echo "$OLD" | tr '.' ' ')

BUMP="${1:-patch}"
case "$BUMP" in
  patch) NEW="$MAJ.$MIN.$((PAT+1))" ;;
  minor) NEW="$MAJ.$((MIN+1)).0" ;;
  major) NEW="$((MAJ+1)).0.0" ;;
  [0-9]*.[0-9]*.[0-9]*) NEW="$BUMP" ;;
  *) echo "ERR: bump inválido: '$BUMP' (patch|minor|major|X.Y.Z)" >&2; exit 1 ;;
esac

echo "Versión: $OLD -> $NEW"
read -r -p "¿Continuar? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then echo "Cancelado."; exit 0; fi

# --- 2. Tests primero --------------------------------------------------------
echo "==> Corriendo tests..."
npm test

# --- 3. Bump versión en package.json -----------------------------------------
node -e "const fs=require('fs');const p='package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.version='$NEW';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')"

# --- 4. README: reemplazá la version vieja por la nueva -----------------------
if [[ -f README.md ]]; then
  sed -i "s/${OLD//./\\.}/${NEW}/g" README.md
fi

# --- 5'. Build local de verificación (opcional, LOCAL_BUILD=1) -----------------
if [[ "${LOCAL_BUILD:-0}" == "1" ]]; then
  echo "==> Build local de verificación (LOCAL_BUILD=1)..."
  npx electron-builder --linux AppImage deb
fi

# --- 6. Commit + tag + push ---------------------------------------------------
# El tag dispara el workflow .github/workflows/release.yml en GitHub Actions,
# que compila el AppImage + .deb y publica la release automáticamente.
# Así podés releasear desde el celular con solo: git tag + git push.
git add package.json README.md
git commit -m "chore: release v$NEW"
git tag "v$NEW"
git push origin main "v$NEW"

echo "==> Tag v$NEW pusheado. GitHub Actions está compilando y publicando..."
echo "==> Seguilo en: https://github.com/benjitaa98h/AnimePulse-Desktop/actions"