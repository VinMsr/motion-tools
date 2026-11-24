// Assestamento A -> C -> B: valori, tempi, curva principale, cancellazione di C e ripristino.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
function KeyframeEase(speed, influence) { this.speed = speed; this.influence = influence; }
const ctx = { $: { global: {} }, KeyframeEase, KeyframeInterpolationType: { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 },
  PropertyValueType: { OneD: 6417, TwoD: 6418, ThreeD: 6419, TwoD_SPATIAL: 6413, ThreeD_SPATIAL: 6414, COLOR: 6416, NO_VALUE: 6412, CUSTOM_VALUE: 6420, MARKER: 6421, LAYER_INDEX: 6422, MASK_INDEX: 6423, SHAPE: 6415, TEXT_DOCUMENT: 6424 } };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const BZ = 6613, FD = 1 / 25;
// Proprieta' 1D (per esempio la rotazione) con keyframe [t, v, easeOut, easeIn].
function prop(keys) {
  const K = keys.map(([t, v, oe, ie]) => ({ t, v, ii: BZ, oi: BZ, ie: [new KeyframeEase(ie ? ie[0] : 0, ie ? ie[1] : 75)], oe: [new KeyframeEase(oe ? oe[0] : 0, oe ? oe[1] : 75)], sel: false }));
  const at = (t) => K.findIndex((k) => Math.abs(k.t - t) < 1e-6);
  const P = { name: 'Rotazione', propertyValueType: 6417, propertyDepth: 1, K,
    propertyGroup: () => ({ inPoint: 0, containingComp: { frameDuration: FD } }),
    get numKeys() { return K.length; },
    keyTime: (k) => K[k - 1].t, keyValue: (k) => K[k - 1].v,
    keyInInterpolationType: (k) => K[k - 1].ii, keyOutInterpolationType: (k) => K[k - 1].oi,
    keyInTemporalEase: (k) => K[k - 1].ie, keyOutTemporalEase: (k) => K[k - 1].oe,
    keyTemporalContinuous: () => false, keyTemporalAutoBezier: () => false, keySelected: (k) => K[k - 1].sel,
    setInterpolationTypeAtKey: (k, i, o) => { K[k - 1].ii = i; K[k - 1].oi = o; },
    setTemporalEaseAtKey: (k, i, o) => { K[k - 1].ie = i; K[k - 1].oe = o; },
    setTemporalContinuousAtKey() {}, setTemporalAutoBezierAtKey() {}, setSelectedAtKey: (k, s) => { K[k - 1].sel = s; },
    setValueAtKey: (k, v) => { K[k - 1].v = v; },
    setValueAtTime: (t, v) => { const i = at(t); if (i >= 0) K[i].v = v; else { K.push({ t, v, ii: BZ, oi: BZ, ie: [new KeyframeEase(0, 33.33)], oe: [new KeyframeEase(0, 33.33)], sel: false }); K.sort((a, b) => a.t - b.t); } },
    removeKey: (k) => { K.splice(k - 1, 1); },
    nearestKeyIndex: (t) => { let b = 0; K.forEach((x, i) => { if (Math.abs(x.t - t) < Math.abs(K[b].t - t)) b = i; }); return b + 1; },
    valueAtTime: (t) => 0 };
  return P;
}
const comp = { frameDuration: FD };
const summary = (P) => P.K.map((k) => `${+k.t.toFixed(3)}:${+k.v.toFixed(3)}`).join(' ');
function apply(P, K, side, frames, pct) {
  ctx.mt_propGet = () => P;
  const report = { notes: [] };
  const rec = ctx.inflect_tailApplyOne(comp, P, K, side, frames * FD, pct / 100, report);
  return { rec, report };
}

test('fine: A -> C -> B, C prima dell\'arrivo e B avanti dei frame scelti', () => {
  const P = prop([[0, 0, [0, 80]], [1, 100, null, [0, 70]]]);
  const { rec } = apply(P, 2, 'end', 12, 10);
  assert(rec, 'applicato');
  assert(summary(P) === '0:0 1:90 1.48:100', summary(P));
});

test('fine: in C la velocita\' che arriva e quella che riparte sono uguali', () => {
  const P = prop([[0, 0, [0, 80]], [1, 100, null, [0, 70]]]);
  apply(P, 2, 'end', 12, 10);
  const c = P.K[1];
  near(c.ie[0].speed, c.oe[0].speed, 1e-9, 'continuita\'');
  near(c.oe[0].speed, 100 * 1.6 * 0.1 / 0.48, 1e-9, 'velocita\' della coda');
  near(P.K[2].ie[0].speed, 0, 1e-9, 'si posa ferma in B');
  near(P.K[0].oe[0].influence, 80, 1e-9, 'la partenza della curva resta');
});

test('fine: la velocita\' iniziale della curva si scala con la distanza del tratto', () => {
  const P = prop([[0, 0, [50, 40]], [1, 100]]);
  apply(P, 2, 'end', 10, 20);
  near(P.K[0].oe[0].speed, 40, 1e-9, '50 x 0.8');
});

test('fine: coda corta, la velocita\' in C si limita (niente gobba)', () => {
  const P = prop([[0, 0], [1, 100]]);
  const { report } = apply(P, 2, 'end', 2, 40);
  near(P.K[1].oe[0].speed, 2 * 60, 1e-9, 'al massimo il doppio della media del tratto principale');
  assert(report.notes.length === 1, 'avviso');
});

test('fine: cancellando C resta A -> B, che arriva al valore giusto', () => {
  const P = prop([[0, 0], [1, 100]]);
  apply(P, 2, 'end', 12, 10);
  P.removeKey(2);
  assert(summary(P) === '0:0 1.48:100', summary(P));
});

test('fine: Togli rimette tutto com\'era, curve comprese', () => {
  const P = prop([[0, 0, [0, 80]], [1, 100, null, [0, 70]], [3, 50]]);
  const { rec } = apply(P, 2, 'end', 12, 10);
  const back = ctx.inflect_tailRevertOne(rec);
  assert(summary(P) === '0:0 1:100 3:50', summary(P));
  assert(back === 2, 'indice di B: ' + back);
  near(P.K[0].oe[0].influence, 80, 1e-9, 'curva di A'); near(P.K[1].ie[0].influence, 70, 1e-9, 'curva di B');
});

test('fine: senza spazio dopo B, anche i keyframe successivi vanno avanti', () => {
  const P = prop([[0, 0], [1, 100], [1.2, 40]]);
  const { rec } = apply(P, 2, 'end', 12, 10);
  assert(summary(P) === '0:0 1:90 1.48:100 1.68:40', summary(P));
  ctx.inflect_tailRevertOne(rec);
  assert(summary(P) === '0:0 1:100 1.2:40', 'ripristino: ' + summary(P));
});

test('inizio: A va indietro, da A a C parte piano, velocita\' continua in C', () => {
  const P = prop([[2, 0, [0, 60]], [3, 100]]);
  const { rec } = apply(P, 1, 'start', 10, 10);
  assert(summary(P) === '1.6:0 2:10 3:100', summary(P));
  near(P.K[1].ie[0].speed, P.K[1].oe[0].speed, 1e-9, 'continuita\'');
  near(P.K[0].oe[0].speed, 0, 1e-9, 'parte da ferma');
  ctx.inflect_tailRevertOne(rec);
  assert(summary(P) === '2:0 3:100', 'ripristino: ' + summary(P));
});

test('inizio senza spazio prima: B e i successivi vanno avanti', () => {
  const P = prop([[0, 0], [1, 100]]);
  const { rec } = apply(P, 1, 'start', 10, 10);
  assert(summary(P) === '0:0 0.4:10 1.4:100', summary(P));
  ctx.inflect_tailRevertOne(rec);
  assert(summary(P) === '0:0 1:100', 'ripristino: ' + summary(P));
});
