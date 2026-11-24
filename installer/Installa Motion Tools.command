#!/bin/bash
# Installa Motion Tools per After Effects (stessa cartella della versione precedente, che viene sostituita) nella cartella dell'utente. Nessuna password richiesta.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)/motion-tools"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/tools.inflect.panel"

if [ ! -d "$SRC" ]; then
  echo "Non trovo la cartella 'motion-tools' accanto a questo file."; exit 1
fi

echo "Copio Motion Tools in:"
echo "  $DEST"
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

# Cache dei pannelli di CEP: senza pulirla After Effects puo' continuare a usare i file vecchi.
rm -rf "$HOME/Library/Caches/CSXS/cep_cache/"*tools.inflect.panel* 2>/dev/null || true

echo "Abilito le estensioni non firmate (solo per il tuo utente)..."
for v in 9 10 11 12 13 14; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1
done

echo ""
echo "Fatto. Chiudi After Effects del tutto (Cmd+Q), riaprilo e apri Finestra > Estensioni > Motion Tools."
echo "Puoi chiudere questa finestra."
