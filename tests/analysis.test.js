// Analisi della timeline: i keyframe dentro le precomp vengono riportati al tempo della comp principale.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
const code = src.slice(src.indexOf('function mt_walkProps'), src.indexOf('function inflect_setTime'));

function setup() {
  const ctx = { CompItem: function CompItem() {}, PropertyType: { PROPERTY: 1 }, KeyframeInterpolationType: { HOLD: 'HOLD', LINEAR: 'LINEAR' } };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}
// Proprieta' con keyframe ai tempi dati (in secondi, nel tempo della propria comp).
function prop(times) {
  return { propertyType: 1, numKeys: times.length, keyTime: (k) => times[k - 1], keyValue: (k) => k,
    keyOutInterpolationType: () => 'LINEAR', keyInInterpolationType: () => 'LINEAR', expressionEnabled: false, expression: '', canSetExpression: false };
}
function layer(o, props) {
  const L = Object.assign({ name: 'L', enabled: true, inPoint: 0, outPoint: 100, startTime: 0, stretch: 100, source: null, comment: '' }, o);
  L.numProperties = props.length;
  L.property = (i) => (typeof i === 'number' ? props[i - 1] : null);
  return L;
}
function comp(dur, layers) {
  return { name: 'c', duration: dur, frameDuration: 1 / 25, numLayers: layers.length, layer: (i) => layers[i - 1], time: 0 };
}

test('keyframe nella precomp si riporta al tempo della comp principale', () => {
  const ctx = setup();
  // Precomp interna con un figlio che ha keyframe a 1 s e 2 s del tempo della precomp.
  const inner = Object.create(ctx.CompItem.prototype);
  Object.assign(inner, comp(4, [layer({ name: 'figlio', inPoint: 0, outPoint: 4 }, [prop([1, 2])])]));
  // Nella principale la precomp inizia a 2 s e va a meta' velocita' (stretch 50): 1 s interno = 2.5 s esterno.
  const pre = layer({ name: 'precomp', startTime: 2, stretch: 50, inPoint: 2, outPoint: 10, source: inner }, []);
  const root = comp(10, [pre]);
  const acc = { bw: 0.1, nb: 100, keysBins: new Array(100).fill(0), motion: [], cands: [], perLayer: [],
    totals: { expr: 0 }, easing: { hold: 0, linear: 0, easy: 0, custom: 0 } };
  ctx.mt_anaWalk(root, [], acc, 0);
  const bins = acc.keysBins.map((x, i) => (x ? (i + 0.5) * acc.bw : null)).filter((x) => x !== null);
  near(bins[0], 2.5, 0.06, 'primo keyframe');
  near(bins[1], 3.0, 0.06, 'secondo keyframe');
  assert(acc.perLayer.length === 1 && acc.perLayer[0].keys === 2, 'la precomp conta i keyframe interni');
});
