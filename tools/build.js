// Ricompone jsx/src/*.jsx nell'ordine dei nomi in jsx/host.jsx, il file che il pannello carica.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'jsx/src');
const parts = fs.readdirSync(dir).filter((f) => f.endsWith('.jsx')).sort();
// Numero di build: lo stesso in host.jsx e nel pannello, cosi' il pannello si accorge se After Effects
// sta usando un host.jsx di un'altra versione (cache di CEP, After Effects non riavviato).
const ver = (fs.readFileSync(path.join(root, 'CSXS/manifest.xml'), 'utf8').match(/ExtensionBundleVersion="([^"]+)"/) || [])[1] || '0';
const body = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
const hash = require('crypto').createHash('sha1').update(body + fs.readFileSync(path.join(root, 'js/app.js'), 'utf8')).digest('hex').slice(0, 8);
const build = ver + '-' + hash;
const out = 'var MT_BUILD = "' + build + '";\nfunction inflect_build() { return MT_BUILD; }\n' + body;
fs.writeFileSync(path.join(root, 'jsx/host.jsx'), out);
fs.writeFileSync(path.join(root, 'js/build.js'), '// Generato da tools/build.js\nwindow.MT_BUILD = "' + build + '";\n');
console.log('build', build);
console.log('host.jsx ricomposto da', parts.length, 'parti,', out.split('\n').length, 'righe');
