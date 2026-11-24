// Applica una curva multi punto a una proprieta' finta che interpola come After Effects (bezier 1D
// con velocita' e influenza) e confronta valori e forma con la curva del pannello.
const fs = require('fs'), path = require('path'), vm = require('vm');
const C = require('../js/core.js');
function host() {
  function KeyframeEase(s, i) { this.speed = s; this.influence = i; }
  const ctx = { $: { global: {} }, KeyframeEase, app: { beginUndoGroup() {}, endUndoGroup() {} },
    KeyframeInterpolationType: { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 },
    PropertyValueType: { OneD: 6417, TwoD: 6418, ThreeD: 6419, TwoD_SPATIAL: 6413, ThreeD_SPATIAL: 6414, COLOR: 6416, NO_VALUE: 6412 } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8'), ctx);
  return ctx;
}
// Proprieta' 1D. strict: come After Effects, un keyframe continuo o auto bezier non tiene velocita' diverse
// in entrata e in uscita (qui: l'entrata prende quella d'uscita).
function prop(ctx, strict, k0, k1) {
  const E = (s, i) => new ctx.KeyframeEase(s, i);
  const K = [k0, k1].map((k) => Object.assign({ ein: [E(0, 33.33)], eout: [E(0, 33.33)], it: 6613, ot: 6613, cont: true, auto: false }, k));
  const fix = (k) => { if (strict && (k.cont || k.auto)) k.ein = [E(k.eout[0].speed, k.ein[0].influence)]; };
  return { K, name: 'Opacità', propertyValueType: 6417, isSpatial: false, dimensionsSeparated: false, propertyDepth: 1, parentProperty: null, propertyIndex: 1,
    propertyGroup: () => ({ index: 1, containingComp: { id: 1 } }),
    get numKeys() { return K.length; },
    keyTime: (i) => K[i - 1].t, keyValue: (i) => K[i - 1].v,
    valueAtTime(t) { return aeValue(this, t); },
    setValueAtKey(i, v) { K[i - 1].v = v; },
    setValueAtTime(t, v) { if (this.bad) v = K[K.length - 1].v; const k = { t, v, ein: [E(0, 33.33)], eout: [E(0, 33.33)], it: 6613, ot: 6613, cont: true, auto: true }; K.push(k); K.sort((a, b) => a.t - b.t); },
    keyInTemporalEase: (i) => K[i - 1].ein, keyOutTemporalEase: (i) => K[i - 1].eout,
    keyInInterpolationType: (i) => K[i - 1].it, keyOutInterpolationType: (i) => K[i - 1].ot,
    setInterpolationTypeAtKey(i, a, b) { K[i - 1].it = a; K[i - 1].ot = b; },
    setTemporalEaseAtKey(i, a, b) { K[i - 1].ein = a; K[i - 1].eout = b; fix(K[i - 1]); },
    setTemporalContinuousAtKey(i, on) { K[i - 1].cont = on; },
    setTemporalAutoBezierAtKey(i, on) { K[i - 1].auto = on; },
  };
}
// Valore come lo calcola After Effects tra due keyframe bezier.
function aeValue(p, t) {
  const K = p.K; let i = 0; while (i < K.length - 2 && K[i + 1].t <= t) i++;
  const a = K[i], b = K[i + 1], dt = b.t - a.t;
  const oi = a.eout[0].influence / 100, ii = b.ein[0].influence / 100;
  const x = [a.t, a.t + oi * dt, b.t - ii * dt, b.t], y = [a.v, a.v + a.eout[0].speed * oi * dt, b.v - b.ein[0].speed * ii * dt, b.v];
  const bz = (q, u) => (1 - u) ** 3 * q[0] + 3 * (1 - u) ** 2 * u * q[1] + 3 * (1 - u) * u * u * q[2] + u ** 3 * q[3];
  let lo = 0, hi = 1; for (let n = 0; n < 60; n++) { const m = (lo + hi) / 2; if (bz(x, m) < t) lo = m; else hi = m; }
  return bz(y, (lo + hi) / 2);
}
const Pt = (t, v, hi, ho, broken) => ({ t, v, hi: { x: hi[0], y: hi[1] }, ho: { x: ho[0], y: ho[1] }, broken });
const lab = C.parseCurvesText(JSON.stringify({ name: 'Rimbalzo', points: [
  Pt(0, 0, [0, 0], [0.18, 0.7], false), Pt(0.45, 1.2, [-0.12, -0.15], [0.08, -0.1], true),
  Pt(0.7, 0.92, [-0.08, -0.12], [0.1, 0.06], true), Pt(1, 1, [-0.12, 0], [0, 0], false)] })).curves[0];

function applyAndCompare(strict) {
  const ctx = host();
  const p = prop(ctx, strict, { t: 0, v: 0 }, { t: 1, v: 100 });
  const comp = { frameDuration: 1 / 1000 };
  ctx.inflect_applySegment(comp, p, 1, C.toAEPlan(lab).points, { snapFrames: false }, true, false, true);
  let worst = 0;
  for (let s = 0; s <= 200; s++) { const t = s / 200; worst = Math.max(worst, Math.abs(aeValue(p, t) - C.evaluate(lab, t) * 100)); }
  return { p, worst };
}

test('curva multi punto: valori dei keyframe intermedi', () => {
  const { p } = applyAndCompare(false);
  assert(p.K.length === 4, 'quattro keyframe');
  near(p.K[1].v, 120, 1e-9, 'rimbalzo a 120'); near(p.K[2].v, 92, 1e-9, 'ritorno a 92');
});

test('curva multi punto: la forma in After Effects combacia con quella del pannello', () => {
  const { worst } = applyAndCompare(false);
  assert(worst < 0.5, 'scarto massimo ' + worst.toFixed(3));
});

test('curva multi punto: maniglie spezzate anche su keyframe continui o auto bezier', () => {
  const { worst } = applyAndCompare(true);
  assert(worst < 0.5, 'scarto massimo ' + worst.toFixed(3));
});

test('dopo l\'applicazione: controllo con i valori di After Effects e keyframe intermedi rimessi a posto', () => {
  const ctx = host();
  const p = prop(ctx, false, { t: 0, v: 0 }, { t: 1, v: 100 });
  p.bad = true; // come se After Effects avesse messo al keyframe nuovo il valore finale
  const report = { segments: 0, notes: [] };
  ctx.inflect_applySegment({ frameDuration: 1 / 1000 }, p, 1, C.toAEPlan(lab).points, { snapFrames: false }, true, false, true, report);
  near(p.K[1].v, 120, 1e-9, 'rimesso a 120'); near(p.K[2].v, 92, 1e-9, 'rimesso a 92');
  const c = report.check[0];
  assert(c.fixed === 2 && c.worst < 0.5, JSON.stringify(c));
});

test('slider della velocita\': con maniglie ripide aumentare accelera, non appiattisce', () => {
  const ctx = host();
  // maniglia d'uscita ripida (pendenza 3) e arrivo dolce
  const c0 = [0.2, 0.6, 0.6, 1];
  const pk = (c) => ctx.inflect_peak(c[0], c[1], c[2], c[3]);
  const up = ctx.inflect_speedCurve(c0, 60)[0];
  assert(pk(up) > pk(c0), `picco ${pk(c0).toFixed(2)} -> ${pk(up).toFixed(2)}`);
  near(pk(ctx.inflect_speedCurve(c0, -100)[0]), 1, 0.01, 'tutto a sinistra = lineare');
  const steps = [-100, -60, -30, 0, 30, 60, 100].map((v) => pk(ctx.inflect_speedCurve(c0, v)[0]));
  assert(steps.every((v, i) => i === 0 || v >= steps[i - 1] - 1e-9), 'il picco cresce con lo slider: ' + steps.map((v) => v.toFixed(2)).join(' '));
});
