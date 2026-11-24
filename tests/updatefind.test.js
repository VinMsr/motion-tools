// Ricerca del pacchetto negli aggiornamenti: versioni affiancate, si prende la più alta.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
const a = src.indexOf('function mt_packageAt'), b = src.indexOf('function inflect_updateCheck');
const code = src.slice(a, b);

function makeFs(files) {
  // files: { "/percorso/file": "contenuto" }; le cartelle si ricavano dai percorsi.
  const kids = {};
  const addKid = (p) => { const parent = path.posix.dirname(p); (kids[parent] = kids[parent] || {})[p] = true; };
  Object.keys(files).forEach((f) => { let p = f; while (path.posix.dirname(p) !== p) { addKid(p); p = path.posix.dirname(p); } });
  const ctx = {};
  ctx.Folder = function (p) { this.fsName = p; this.name = path.posix.basename(p); this.exists = !!kids[p]; this.getFiles = () => Object.keys(kids[p] || {}).map((c) => (kids[c] ? new ctx.Folder(c) : new ctx.File(c))); };
  ctx.File = function (p) { this.fsName = p; this.exists = files[p] !== undefined; };
  ctx.inflect_readText = (f) => files[f.fsName] || '';
  vm.createContext(ctx);
  vm.runInContext(code + '\n;this.mt_findPackage = mt_findPackage;', ctx);
  return ctx;
}
const manifest = (v) => `<ExtensionManifest ExtensionBundleVersion="${v}"><Extension Version="${v}"/></ExtensionManifest>`;
const base = '/nas/Motion Tools/Aggiornamenti';

test('sceglie la versione più alta tra le cartelle affiancate', () => {
  const ctx = makeFs({
    [`${base}/2.12.0/motion-tools/CSXS/manifest.xml`]: manifest('2.12.0'),
    [`${base}/2.12.2/motion-tools/CSXS/manifest.xml`]: manifest('2.12.2'),
    [`${base}/2.12.1/motion-tools/CSXS/manifest.xml`]: manifest('2.12.1'),
  });
  const pkg = ctx.mt_findPackage(new ctx.Folder(base));
  assert(pkg && pkg.fsName === `${base}/2.12.2/motion-tools`, 'pacchetto: ' + (pkg && pkg.fsName));
});
test('versione singola in motion-tools diretta', () => {
  const ctx = makeFs({ [`${base}/motion-tools/CSXS/manifest.xml`]: manifest('2.12.3') });
  const pkg = ctx.mt_findPackage(new ctx.Folder(base));
  assert(pkg && pkg.fsName === `${base}/motion-tools`, 'pacchetto: ' + (pkg && pkg.fsName));
});
test('wrapper Motion Tools con la versione dentro', () => {
  const ctx = makeFs({ [`${base}/2.13.0/Motion Tools/motion-tools/CSXS/manifest.xml`]: manifest('2.13.0') });
  const pkg = ctx.mt_findPackage(new ctx.Folder(base));
  assert(pkg && pkg.fsName.endsWith('2.13.0/Motion Tools/motion-tools'), 'pacchetto: ' + (pkg && pkg.fsName));
});
test('cartella vuota non trova nulla', () => {
  const ctx = makeFs({ [`${base}/altro/file.txt`]: 'x' });
  assert(ctx.mt_findPackage(new ctx.Folder(base)) === null, 'doveva essere null');
});
