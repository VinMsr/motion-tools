// Tracciati: curve applicate e lette su keyframe di forma, con un After Effects finto che sposta i punti
// in linea retta e usa per la velocita' un'unita' sconosciuta al plugin (qui: % del segmento al secondo).
const fs = require('fs'), path = require('path'), vm = require('vm');
const C = require('../js/core.js');
function host() {
  function KeyframeEase(s, i) { this.speed = s; this.influence = i; }
  function Shape() { this.vertices = []; this.inTangents = []; this.outTangents = []; this.closed = true; }
  const ctx = { $: { global: {} }, KeyframeEase, Shape, app: { beginUndoGroup() {}, endUndoGroup() {} },
    KeyframeInterpolationType: { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 },
    PropertyValueType: { OneD: 6417, TwoD: 6418, ThreeD: 6419, TwoD_SPATIAL: 6413, ThreeD_SPATIAL: 6414, COLOR: 6416, NO_VALUE: 6412, SHAPE: 6415 } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8'), ctx);
  return ctx;
}
function shapeProp(ctx) {
  const mk = (pts) => { const s = new ctx.Shape(); s.vertices = vm.runInContext(JSON.stringify(pts), ctx); s.inTangents = vm.runInContext(JSON.stringify(pts.map(() => [0, 0])), ctx); s.outTangents = vm.runInContext(JSON.stringify(pts.map(() => [0, 0])), ctx); return s; };
  const E = (s, i) => new ctx.KeyframeEase(s, i);
  const K = [{ t: 0, v: mk([[0, 0], [100, 0], [100, 100]]) }, { t: 2, v: mk([[50, 20], [300, 40], [120, 400]]) }]
    .map((k) => Object.assign({ ein: [E(0, 33.33)], eout: [E(0, 33.33)], it: 6613, ot: 6613 }, k));
  const flat = (s) => [].concat(...s.vertices, ...s.inTangents, ...s.outTangents);
  return { K, name: 'Tracciato', matchName: 'ADBE Mask Shape', propertyValueType: 6415, propertyDepth: 3, parentProperty: null, propertyIndex: 1,
    propertyGroup: () => ({ index: 1, containingComp: { id: 1 } }),
    get numKeys() { return K.length; }, keyTime: (i) => K[i - 1].t, keyValue: (i) => K[i - 1].v,
    setValueAtTime(t, v) { K.push({ t, v, ein: [E(0, 33.33)], eout: [E(0, 33.33)], it: 6613, ot: 6613 }); K.sort((a, b) => a.t - b.t); },
    setValueAtKey(i, v) { K[i - 1].v = v; },
    keyInTemporalEase: (i) => K[i - 1].ein, keyOutTemporalEase: (i) => K[i - 1].eout,
    keyInInterpolationType: (i) => K[i - 1].it, keyOutInterpolationType: (i) => K[i - 1].ot,
    setInterpolationTypeAtKey(i, a, b) { K[i - 1].it = a; K[i - 1].ot = b; },
    setTemporalEaseAtKey(i, a, b) { K[i - 1].ein = a; K[i - 1].eout = b; },
    setTemporalContinuousAtKey() {}, setTemporalAutoBezierAtKey() {},
    valueAtTime(t) {
      let i = 0; while (i < K.length - 2 && K[i + 1].t <= t) i++;
      const a = K[i], b = K[i + 1], dt = b.t - a.t, f0 = Math.max(0, Math.min(1, (t - a.t) / dt));
      // velocita' in % del segmento al secondo
      const oi = a.eout[0].influence / 100, ii = b.ein[0].influence / 100;
      const x = [0, oi, 1 - ii, 1], y = [0, a.eout[0].speed / 100 * oi * dt, 1 - b.ein[0].speed / 100 * ii * dt, 1];
      const bz = (c, u) => (1 - u) ** 3 * c[0] + 3 * (1 - u) ** 2 * u * c[1] + 3 * (1 - u) * u * u * c[2] + u ** 3 * c[3];
      let lo = 0, hi = 1; for (let n = 0; n < 60; n++) { const m = (lo + hi) / 2; if (bz(x, m) < f0) lo = m; else hi = m; }
      return ctx.mt_shapeLerp(a.v, b.v, bz(y, (lo + hi) / 2));
    }, flat };
}
const lab = C.parseCurvesText(JSON.stringify({ name: 'Rimbalzo', points: [
  { t: 0, v: 0, hi: { x: 0, y: 0 }, ho: { x: 0.175, y: 0 }, broken: false },
  { t: 0.35, v: 0.1, hi: { x: -0.053, y: -0.045 }, ho: { x: 0.059, y: 0.495 }, broken: true },
  { t: 0.7, v: 1.12, hi: { x: -0.1, y: 0 }, ho: { x: 0.1, y: 0 }, broken: false },
  { t: 1, v: 1, hi: { x: -0.2, y: 0 }, ho: { x: 0, y: 0 }, broken: false }] })).curves[0];

test('tracciato: curva multi punto applicata, con velocita\' calibrata su After Effects', () => {
  const ctx = host(), p = shapeProp(ctx), report = { segments: 0, notes: [] };
  ctx.inflect_applySegment({ frameDuration: 1 / 1000 }, p, 1, C.toAEPlan(lab).points, { snapFrames: false }, false, false, true, report);
  assert(p.K.length === 4, 'quattro keyframe');
  const c = report.check[0];
  assert(c && c.worst < 1 && c.fixed === 0, JSON.stringify(report));
});

test('tracciato: leggere i keyframe restituisce la curva', () => {
  const ctx = host(), p = shapeProp(ctx);
  ctx.inflect_applySegment({ frameDuration: 1 / 1000 }, p, 1, C.toAEPlan(lab).points, { snapFrames: false }, false, false, true, { segments: 0, notes: [] });
  const r = ctx.mt_readShape(p, [1, 2, 3, 4]);
  assert(!r.error, r.error);
  const back = C.fromAEPoints(JSON.parse(JSON.stringify(r.points)));
  let worst = 0;
  for (let s = 0; s <= 100; s++) worst = Math.max(worst, Math.abs(C.evaluate(back, s / 100) - C.evaluate(lab, s / 100)));
  assert(worst < 0.01, 'scarto ' + worst);
});

test('tracciato: lo slider della velocita\' cambia davvero il picco', () => {
  const ctx = host(), p = shapeProp(ctx);
  // easing di partenza: velocita' 0, influenza 50% ai due lati
  p.K[0].eout = [new ctx.KeyframeEase(0, 50)]; p.K[1].ein = [new ctx.KeyframeEase(0, 50)];
  const meter = ctx.mt_shapeMeter(p.K[0].v, p.K[1].v);
  const peak = () => { let m = 0; for (let s = 0; s < 400; s++) { const t = s / 400 * 2; m = Math.max(m, (meter(p.valueAtTime(t + 0.002)) - meter(p.valueAtTime(t))) / 0.001); } return m; };
  const it = { outEase: [new ctx.KeyframeEase(0, 50)], inEase: [new ctx.KeyframeEase(0, 50)], sOut: ctx.mt_shapeSlope(p, 1, meter, 2, 1), sIn: ctx.mt_shapeSlope(p, 2, meter, 2, -1) };
  const p0 = peak();
  it.pct = 50; ctx.mt_speedShape(p, 1, it, 1);
  const p1 = peak();
  assert(p1 > p0 * 1.1, `piu' veloce: ${p0.toFixed(3)} -> ${p1.toFixed(3)}`);
  it.pct = -100; ctx.mt_speedShape(p, 1, it, 1);
  const p2 = peak();
  assert(Math.abs(p2 - 1) < 0.04, `lineare: ${p2.toFixed(3)}`); // la misura di peak() e' il doppio della velocita' al secondo: lineare = 1
});
