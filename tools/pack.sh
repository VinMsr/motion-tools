#!/bin/bash
# Impacchetta installer e aggiornamento per il NAS. Uso: bash tools/pack.sh
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
VER=$(grep -o 'ExtensionBundleVersion="[^"]*"' "$SRC/CSXS/manifest.xml" | cut -d'"' -f2)
OUT="${OUT:-$SRC/dist}"
D="$OUT/Motion Tools/motion-tools"
rm -rf "$D" && mkdir -p "$D/jsx"
cp -r "$SRC"/{CSXS,js,css,index.html,panel.html,NOVITA.txt,update.json} "$D/"; cp "$SRC/jsx/host.jsx" "$D/jsx/"
[ -d "$SRC/img" ] && cp -r "$SRC/img" "$D/"
cp "$SRC"/installer/* "$OUT/Motion Tools/"
chmod +x "$OUT/Motion Tools/"*.command
cd "$OUT" && rm -f "Motion Tools.zip" && zip -qr "Motion Tools.zip" "Motion Tools" -x '*.DS_Store'
# Aggiornamento: la radice dello zip e' la cartella di versione, con dentro motion-tools
T=$(mktemp -d); mkdir -p "$T/$VER"; cp -r "$D" "$T/$VER/"
rm -f "$OUT/Aggiornamento $VER.zip"; (cd "$T" && zip -qr "$OUT/Aggiornamento $VER.zip" "$VER"); rm -rf "$T"
# Controllo
unzip -l "$OUT/Aggiornamento $VER.zip" | grep -q " $VER/motion-tools/CSXS/manifest.xml" || { echo "STRUTTURA SBAGLIATA"; exit 1; }
unzip -p "$OUT/Aggiornamento $VER.zip" "$VER/motion-tools/CSXS/manifest.xml" | grep -q "ExtensionBundleVersion=\"$VER\"" || { echo "VERSIONE SBAGLIATA"; exit 1; }
# GitHub: zip con la cartella motion-tools alla radice, piu' la sua impronta SHA-256
GH="$OUT/github"; rm -rf "$GH"; mkdir -p "$GH"
(cd "$OUT/Motion Tools" && zip -qr "$GH/motion-tools-$VER.zip" motion-tools -x '*.DS_Store')
(cd "$GH" && sha256sum "motion-tools-$VER.zip" > "motion-tools-$VER.zip.sha256")
node -e "
const U=require('$SRC/js/update.js'),fs=require('fs'),zlib=require('zlib');
const e=U.unzip(fs.readFileSync('$GH/motion-tools-$VER.zip'),zlib);const r=U.findPackageRoot(e);
const m=U.manifestInfo(e.find(x=>x.name===r+'CSXS/manifest.xml').data.toString());
if(m.version!=='$VER'||m.id!=='tools.inflect.panel'){console.log('ZIP GITHUB SBAGLIATO');process.exit(1)}"
echo "ok $VER"
