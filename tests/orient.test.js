// Orientation: quaternioni, ordine degli assi e punti lungo l'arco.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { $: { global: {} } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8'), ctx);
const A = (a) => vm.runInContext(JSON.stringify(a), ctx);
const same = (p, q) => 1 - Math.abs(ctx.mt_qDot(p, q)) < 1e-9;

test('orientamento: angoli -> quaternione -> angoli, per tutti e sei gli ordini', () => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const ord of ctx.MT_ORDERS) for (let n = 0; n < 50; n++) {
    const e = A([rnd() * 360, rnd() * 160 - 80, rnd() * 360]);
    const q = ctx.mt_qFromEuler(e, ord), e2 = ctx.mt_qToEuler(q, ord);
    assert(same(q, ctx.mt_qFromEuler(e2, ord)), ord + ' ' + JSON.stringify(e) + ' -> ' + JSON.stringify(e2));
  }
});

test('orientamento: punti lungo l\'arco, anche oltre la fine, e frazione con il segno', () => {
  const qa = ctx.mt_qFromEuler(A([10, 20, 30]), 'XYZ'), qb = ctx.mt_qFromEuler(A([80, -40, 200]), 'XYZ');
  for (const f of [-0.2, 0, 0.1, 0.5, 1, 1.18]) near(ctx.mt_qFraction(qa, qb, ctx.mt_qAlong(qa, qb, f), f), f, 1e-9, 'f ' + f);
  // lato corto: da 350 a 10 gradi su un asse sono 20 gradi, non 340
  const r = ctx.mt_qRel(ctx.mt_qFromEuler(A([0, 0, 350]), 'XYZ'), ctx.mt_qFromEuler(A([0, 0, 10]), 'XYZ'));
  near(r.angle, 20, 1e-9, 'arco corto');
});

test('orientamento: l\'ordine degli assi si ricava dai valori di After Effects', () => {
  // After Effects finto che usa l'ordine ZYX e interpola lungo l'arco.
  const truth = 'ZYX', K = [{ t: 0, v: A([20, 70, 10]) }, { t: 1, v: A([300, 10, 150]) }];
  const p = { keyValue: (i) => K[i - 1].v, keyTime: (i) => K[i - 1].t,
    keyInInterpolationType: () => 1, keyOutInterpolationType: () => 1, keyInTemporalEase: () => [], keyOutTemporalEase: () => [],
    setInterpolationTypeAtKey() {}, setTemporalEaseAtKey() {},
    valueAtTime: (t) => ctx.mt_qToEuler(ctx.mt_qAlong(ctx.mt_qFromEuler(K[0].v, truth), ctx.mt_qFromEuler(K[1].v, truth), t), truth) };
  ctx.KeyframeInterpolationType = { LINEAR: 6612 };
  const r = ctx.mt_orientOrder(p, 1);
  assert(r.order === truth && r.ok, JSON.stringify(r));
});

// After Effects finto per Orientation: tra due keyframe percorre l'arco corto, con la velocita'
// (gradi al secondo) e l'influenza delle maniglie, come una posizione lungo il percorso.
function orientProp(truth, A0, B0) {
  const E = (s, i) => new ctx.KeyframeEase(s, i);
  const K = [{ t: 0, v: A(A0) }, { t: 1, v: A(B0) }].map((k) => Object.assign({ ein: [E(0, 33.33)], eout: [E(0, 33.33)], it: 6613, ot: 6613 }, k));
  const q = (v) => ctx.mt_qFromEuler(v, truth);
  const p = { K, name: 'Orientation', matchName: 'ADBE Orientation', propertyValueType: 6414, propertyDepth: 2, parentProperty: null, propertyIndex: 1,
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
      const a = K[i], b = K[i + 1], dt = b.t - a.t, th = ctx.mt_qRel(q(a.v), q(b.v)).angle;
      let f = (t - a.t) / dt;
      if (!(a.ot === 6612 && b.it === 6612)) {
        const oi = a.eout[0].influence / 100, ii = b.ein[0].influence / 100;
        const x = [0, oi, 1 - ii, 1], y = [0, a.eout[0].speed * oi * dt, th - b.ein[0].speed * ii * dt, th];
        const bz = (c, u) => (1 - u) ** 3 * c[0] + 3 * (1 - u) ** 2 * u * c[1] + 3 * (1 - u) * u * u * c[2] + u ** 3 * c[3];
        let lo = 0, hi = 1; for (let n = 0; n < 60; n++) { const m = (lo + hi) / 2; if (bz(x, m) < f) lo = m; else hi = m; }
        f = th > 1e-9 ? bz(y, (lo + hi) / 2) / th : 0;
      }
      return ctx.mt_qToEuler(ctx.mt_qAlong(q(a.v), q(b.v), f), truth);
    } };
  return p;
}
const C = require('../js/core.js');
test('Orientation: la curva incollata segue l\'arco anche con gli assi in un altro ordine', () => {
  ctx.KeyframeEase = function (s, i) { this.speed = s; this.influence = i; };
  ctx.KeyframeInterpolationType = { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 };
  ctx.PropertyValueType = { ThreeD_SPATIAL: 6414, TwoD_SPATIAL: 6413, OneD: 6417 };
  const curve = C.parseCurvesText(JSON.stringify({ name: 'Milito', points: [
    { t: 0, v: 0, hi: { x: 0, y: 0 }, ho: { x: 0.175, y: 0 }, broken: false },
    { t: 0.35, v: 0.1, hi: { x: -0.053, y: -0.045 }, ho: { x: 0.059, y: 0.495 }, broken: true },
    { t: 1, v: 1, hi: { x: -0.507, y: 0 }, ho: { x: 0, y: 0 }, broken: false }] })).curves[0];
  for (const [truth, A0, B0] of [['ZYX', [0, 0, 0], [20, 300, 0]], ['XYZ', [350, 10, 40], [30, 80, 200]], ['YXZ', [0, 0, 0], [0, 0, 90]]]) {
    const p = orientProp(truth, A0, B0), report = { segments: 0, notes: [] };
    ctx.inflect_applySegment({ frameDuration: 1 / 1000 }, p, 1, C.toAEPlan(curve).points, { snapFrames: false }, true, true, true, report);
    const c = report.check[0];
    assert(p.K.length === 3, 'tre keyframe');
    assert(c.worst < 1 && c.fixed === 0, truth + ' ' + JSON.stringify(c));
    near(ctx.mt_qFraction(ctx.mt_qFromEuler(p.K[0].v, truth), ctx.mt_qFromEuler(p.K[2].v, truth), ctx.mt_qFromEuler(p.K[1].v, truth)), 0.1, 1e-6, truth + ' keyframe al 10% dell\'arco');
  }
});

test('Orientation: lo slider della velocita\' accelera e arriva fino al lineare', () => {
  ctx.KeyframeEase = function (s, i) { this.speed = s; this.influence = i; };
  ctx.KeyframeInterpolationType = { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 };
  ctx.PropertyValueType = { ThreeD_SPATIAL: 6414, TwoD_SPATIAL: 6413, OneD: 6417, TwoD: 6418, ThreeD: 6419, SHAPE: 6415 };
  ctx.PropertyType = { PROPERTY: 6212 };
  const truth = 'ZYX', p = orientProp(truth, [0, 0, 0], [20, 300, 0]);
  p.K[0].eout = [new ctx.KeyframeEase(0, 50)]; p.K[1].ein = [new ctx.KeyframeEase(0, 50)];
  Object.assign(p, { propertyType: 6212, canVaryOverTime: true, selectedKeys: [1, 2], setSelectedAtKey() {}, nearestKeyIndex: (t) => p.K.findIndex((k) => Math.abs(k.t - t) < 1e-6) + 1 });
  const comp = { id: 3, selectedProperties: [p], frameDuration: 1 / 25 };
  ctx.inflect_activeComp = () => comp; ctx.mt_layerById = () => null; ctx.app = { project: { itemByID: () => null }, beginUndoGroup() {}, endUndoGroup() {} };
  ctx.INFLECT_SPEED = null;
  const q = (v) => ctx.mt_qFromEuler(v, truth), qa = q(p.K[0].v), qb = q(p.K[1].v);
  const peak = () => { let m = 0; for (let s = 0; s < 400; s++) { const t = s / 400; m = Math.max(m, (ctx.mt_qFraction(qa, qb, q(p.valueAtTime(t + 0.001))) - ctx.mt_qFraction(qa, qb, q(p.valueAtTime(t)))) / 0.001); } return m; };
  const p0 = peak();
  const b = JSON.parse(ctx.inflect_speedBegin()); assert(b.ok && b.segments === 1, JSON.stringify(b));
  const r = JSON.parse(ctx.inflect_speedSet(30)); assert(r.ok, JSON.stringify(r));
  const p1 = peak();
  assert(p1 > p0 * 1.1, `piu' veloce: ${p0.toFixed(3)} -> ${p1.toFixed(3)}`);
  JSON.parse(ctx.inflect_speedSet(-100));
  const p2 = peak();
  assert(Math.abs(p2 - 1) < 0.03, `tutto a sinistra = lineare: ${p2.toFixed(3)}`);
});
