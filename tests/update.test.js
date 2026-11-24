// Aggiornamenti da GitHub: scelta della release, lettura dello zip, controlli.
const U = require('../js/update.js');
const zlib = require('zlib');

const rel = (o) => Object.assign({ tag_name: 'v2.32.0', draft: false, prerelease: false, body: 'Novità', assets: [
  { name: 'motion-tools-2.32.0.zip', browser_download_url: 'https://x/z', size: 10, digest: 'sha256:' + 'a'.repeat(64) },
  { name: 'motion-tools-2.32.0.zip.sha256', browser_download_url: 'https://x/s' },
] }, o);

test('update: sceglie lo zip e la versione dalla release', () => {
  const r = U.pickRelease(rel({}), 'stable');
  assert(r && r.version === '2.32.0' && r.zipUrl === 'https://x/z', JSON.stringify(r));
  assert(r.sha256 === 'a'.repeat(64), 'digest letto');
});
test('update: il canale stabile salta le prerelease, il beta no', () => {
  const list = [rel({ prerelease: true, assets: [{ name: 'motion-tools-2.33.0.zip', browser_download_url: 'u' }] }), rel({})];
  assert(U.pickRelease(list, 'stable').version === '2.32.0');
  assert(U.pickRelease(list, 'beta').version === '2.33.0');
});
test('update: senza zip valido nessuna release', () => {
  assert(U.pickRelease(rel({ assets: [{ name: 'Aggiornamento 2.32.0.zip' }] }), 'stable') === null);
});
test('update: confronto versioni', () => {
  assert(U.verCmp('2.32.0', '2.31.9') > 0 && U.verCmp('2.4', '2.30') < 0 && U.verCmp('2.30.0', '2.30') === 0);
});
test('update: nome del repository anche da URL', () => {
  assert(U.normRepo('https://github.com/vinmsr/motion-tools.git') === 'vinmsr/motion-tools');
  assert(U.normRepo('vinmsr/motion-tools') === 'vinmsr/motion-tools');
  assert(U.normRepo('') === '');
});

// Zip costruito a mano: un file salvato e uno compresso.
function makeZip(files) {
  const locals = [], centrals = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), data = Buffer.from(f.data), comp = f.deflate ? zlib.deflateRawSync(data) : data;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(f.deflate ? 8 : 0, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(f.deflate ? 8 : 0, 10);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, comp); centrals.push(ch, name); off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}
test('update: apre lo zip e trova il pacchetto', () => {
  const man = '<ExtensionManifest ExtensionBundleId="tools.inflect.panel" ExtensionBundleVersion="2.32.0">';
  const z = makeZip([{ name: 'motion-tools/CSXS/manifest.xml', data: man, deflate: true }, { name: 'motion-tools/panel.html', data: '<p>ciao</p>' }]);
  const e = U.unzip(z, zlib);
  assert(e.length === 2 && e[1].data.toString() === '<p>ciao</p>');
  const root = U.findPackageRoot(e);
  assert(root === 'motion-tools/', root);
  const m = U.manifestInfo(e[0].data.toString());
  assert(m.version === '2.32.0' && m.id === 'tools.inflect.panel');
});
test('update: rifiuta percorsi che escono dalla cartella', () => {
  let err = '';
  try { U.unzip(makeZip([{ name: '../fuori.txt', data: 'x' }]), zlib); } catch (e) { err = e.message; }
  assert(/non valido/.test(err), err);
});
