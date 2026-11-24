#!/bin/bash
# Motion Tools per After Effects: installazione su Mac, senza password.
#
#   curl -fsSL https://raw.githubusercontent.com/VinMsr/motion-tools/main/install.sh | bash
#
# Scarica l'ultima versione da GitHub, controlla l'impronta SHA-256, la copia nella cartella
# delle estensioni del tuo utente e abilita le estensioni non firmate (solo per il tuo utente).
# Se accanto allo script c'e' la cartella "motion-tools" (zip scaricato a mano), installa quella.
set -euo pipefail

REPO="${MT_REPO:-VinMsr/motion-tools}"
ID="tools.inflect.panel"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/$ID"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say() { printf '%s\n' "$*"; }
fail() { say ""; say "Non riuscito: $*"; exit 1; }

sha() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1; else sha256sum "$1" | cut -d' ' -f1; fi; }

# 1. Da dove prendere Motion Tools
SRC=""
HERE=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; fi
if [ -n "$HERE" ] && [ -f "$HERE/motion-tools/CSXS/manifest.xml" ]; then
  SRC="$HERE/motion-tools"
  say "Installo la copia accanto a questo script."
else
  URL="${MT_ZIP_URL:-}"
  if [ -z "$URL" ]; then
    say "Cerco l'ultima versione su github.com/$REPO ..."
    JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' -H 'User-Agent: MotionTools-Installer' "https://api.github.com/repos/$REPO/releases/latest")" \
      || fail "GitHub non risponde o non c'e' ancora nessuna release pubblicata."
    URL="$(printf '%s' "$JSON" | grep -o '"browser_download_url": *"[^"]*/motion-tools-[0-9.]*\.zip"' | head -1 | sed 's/.*"\(http[^"]*\)"$/\1/')"
    [ -n "$URL" ] || fail "Nell'ultima release non c'e' il file motion-tools-X.Y.Z.zip."
  fi
  say "Scarico $(basename "$URL") ..."
  curl -fsSL -o "$TMP/mt.zip" "$URL" || fail "download non riuscito."
  if curl -fsSL -o "$TMP/mt.sha256" "$URL.sha256" 2>/dev/null; then
    WANT="$(grep -oE '[0-9a-fA-F]{64}' "$TMP/mt.sha256" | head -1 | tr 'A-F' 'a-f')"
    HAVE="$(sha "$TMP/mt.zip")"
    [ "$WANT" = "$HAVE" ] || fail "il file scaricato non corrisponde alla release (impronta diversa)."
    say "File verificato."
  fi
  mkdir -p "$TMP/x"
  unzip -q "$TMP/mt.zip" -d "$TMP/x" || fail "non riesco ad aprire lo zip."
  SRC="$TMP/x/motion-tools"
fi

[ -f "$SRC/CSXS/manifest.xml" ] || fail "nello zip manca Motion Tools (CSXS/manifest.xml)."
grep -q "ExtensionBundleId=\"$ID\"" "$SRC/CSXS/manifest.xml" || fail "lo zip contiene un'altra estensione."
VER="$(grep -o 'ExtensionBundleVersion="[0-9.]*"' "$SRC/CSXS/manifest.xml" | cut -d'"' -f2)"

# 2. Copia nella cartella delle estensioni dell'utente
say "Installo Motion Tools $VER in:"
say "  $DEST"
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

# 3. Cache dei pannelli: senza pulirla After Effects puo' usare i file vecchi
rm -rf "$HOME/Library/Caches/CSXS/cep_cache/"*"$ID"* 2>/dev/null || true

# 4. Estensioni non firmate, solo per questo utente
if command -v defaults >/dev/null 2>&1; then
  for v in 9 10 11 12 13 14; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
fi

say ""
say "Fatto: Motion Tools $VER installato."
say "Chiudi After Effects del tutto (Cmd+Q), riaprilo e apri Finestra > Estensioni > Motion Tools."
say "Da qui in poi si aggiorna da solo."
