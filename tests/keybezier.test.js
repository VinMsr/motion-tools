// Conversione dei keyframe di After Effects in maniglie cubiche (host.jsx, funzione mt_keyBezier).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
const a = src.indexOf('function mt_keyBezier'), b = src.indexOf('function inflect_textReadKeys');
eval(src.slice(a, b));
const seg = (speedOut, infOut, speedIn, infIn) => ({
  keyOutTemporalEase: () => [{ speed: speedOut, influence: infOut }],
  keyInTemporalEase: () => [{ speed: speedIn, influence: infIn }],
  keyTime: (k) => (k === 1 ? 0 : 1),
  keyValue: (k) => (k === 1 ? 0 : 100),
});
test('movimento lineare dà maniglie a 1/3 e 2/3', () => {
  const bz = mt_keyBezier(seg(100, 100 / 3, 100, 100 / 3), 1);
  near(bz[0], 1 / 3, 1e-3); near(bz[1], 1 / 3, 1e-3); near(bz[2], 2 / 3, 1e-3); near(bz[3], 2 / 3, 1e-3);
});
test('uscita veloce dà pendenza iniziale alta', () => {
  const bz = mt_keyBezier(seg(200, 33, 0, 60), 1);
  near(bz[1], 0.66, 1e-2, 'y1'); near(bz[3], 1, 1e-2, 'y2');
});
test('segmento senza variazione non dà curva', () => {
  const p = seg(0, 33, 0, 33); p.keyValue = () => 5;
  assert(mt_keyBezier(p, 1) === null, 'doveva essere null');
});
