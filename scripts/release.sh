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
OLD="$(node -p "require('./package.json').version" 2>/dev/null || node -e "console.log(require('./package.json').version)")"
OLD="${OLD//[$'\t\r\n']/}"
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

# --- 5. Build AppImage + deb --------------------------------------------------
echo "==> Build..."
npx electron-builder --linux AppImage deb

# --- 6. Changelog desde git log desde el último tag ---------------------------
PREV_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [[ -n "$PREV_TAG" ]]; then
  RANGE="$PREV_TAG..HEAD"
else
  RANGE=""
fi
NOTES="/tmp/opencode/rel_${NEW}.md"
{
  echo "## AnimePulse v$NEW"
  echo
  echo "### Cambios desde $PREV_TAG"
  if [[ -n "$RANGE" ]]; then
    git log --oneline --no-merges "$RANGE" | sed 's/^/- /'
  fi
  echo
} > "$NOTES"

# --- 7. Commit + tag + push ---------------------------------------------------
git add package.json README.md
git commit -m "chore: release v$NEW"
git tag "v$NEW"
git push origin main "v$NEW"

# --- 8. GitHub release --------------------------------------------------------
gh release create "v$NEW" --title "AnimePulse v$NEW" --notes-file "$NOTES" \
  "dist/AnimePulse-$NEW.AppImage" \
  "dist/animepulse_${NEW}_amd64.deb" \
  "dist/latest-linux.yml"

echo "==> v$NEW publicada: $(gh release view "v$NEW" --json url -q .url)"