// Precomponi e ritaglia: misura veloce, effetti con ingombro enorme limitati, controllo della dimensione.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
const ctx = { $: { global: {} }, CameraLayer: function () {}, LightLayer: function () {}, AVLayer: function () {}, TextLayer: function () {}, ShapeLayer: function () {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);

// Layer 200x100 con posizione x(t); fx: con effetti, e con l'ingombro degli effetti enorme.
function layer(xAt, keys, fx) {
  let calls = 0;
  const mk = (v) => vm.runInContext(JSON.stringify(v), ctx);
  const pos = { dimensionsSeparated: false, numKeys: keys.length, keyTime: (k) => keys[k - 1], valueAtTime: (t) => mk([xAt(t), 300]) };
  const tr = { numProperties: 1, property: (m) => {
    if (m === 1 || m === 'ADBE Position') return pos;
    if (m === 'ADBE Scale') return { valueAtTime: () => mk([100, 100]) };
    if (m === 'ADBE Rotate Z') return { valueAtTime: () => 0 };
    if (m === 'ADBE Anchor Point') return { valueAtTime: () => mk([100, 50]) };
  } };
  return { inPoint: 0, outPoint: 4, parent: null,
    sourceRectAtTime: (t, ext) => { calls++; return ext && fx ? { left: -25000, top: -25000, width: 50200, height: 50100 } : { left: 0, top: 0, width: 200, height: 100 }; },
    property: (n) => (n === 'ADBE Transform Group' ? tr : { numProperties: fx ? 1 : 0 }),
    get calls() { return calls; } };
}
const comp = { duration: 4, frameDuration: 1 / 25, width: 1920, height: 1080 };

test('effetto con ingombro enorme: il riquadro cresce al massimo di 300 px per lato', () => {
  const L = layer(() => 960, [], true);
  const B = ctx.mt_boundsOverTime([L], comp);
  near(B.l, 860 - 300, 1e-9, 'sinistra'); near(B.r, 1060 + 300, 1e-9, 'destra');
  assert(L.calls < 70, 'misure: ' + L.calls);
});

test('keyframe fra i campioni: il punto piu\' lontano viene preso', () => {
  // Picco a 1.013 s, tra due campioni: lo prende perche' c'e' un keyframe li'.
  const L = layer((t) => (Math.abs(t - 1.013) < 1e-6 ? 3000 : 960), [1.013], false);
  const B = ctx.mt_boundsOverTime([L], comp);
  near(B.r, 3100, 1e-9, 'destra al keyframe');
});

test('precomp troppo grande: limite sul lato massimo', () => {
  assert(ctx.mt_maxSide(comp) === 5760, String(ctx.mt_maxSide(comp)));
  assert(ctx.mt_maxSide({ width: 640, height: 360 }) === 4096, 'minimo 4096');
});
