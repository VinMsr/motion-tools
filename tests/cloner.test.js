// Cloner: le espressioni vere delle copie, eseguite con un controllo finto.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
const ctx = { $: { global: {} } };
vm.createContext(ctx);
vm.runInContext(src, ctx);

const P0 = () => {
  const p = {};
  ctx.MT_PARAMS.forEach(([n, , v]) => { p[n] = Array.isArray(v) ? v.slice() : v; });
  return p;
};
// Valuta un'espressione della copia i con i parametri del controllo.
function run(kind, params, i, extra = {}) {
  const expr = ctx.mt_expr(kind, 'Cloner', kind === 'behave' ? 1 : undefined);
  const C = { effect: (nm) => () => ({ value: params[nm], valueAtTime: () => params[nm] }), marker: { numKeys: 0 }, toWorld: (v) => v };
  const own = Object.assign({ 'MT Indice': i, 'MT Base': [0, 0, 0], 'MT Pos': [0, 0, 0], 'MT Extra': [0, 0, 0], 'MT Origine': [0, 0, 0] }, extra.fx || {});
  const env = Object.assign({
    thisComp: { layer: () => C, frameDuration: 1 / 25 }, effect: (nm) => () => ({ value: own[nm] }),
    Math, degreesToRadians: (d) => d * Math.PI / 180, radiansToDegrees: (r) => r * 180 / Math.PI,
    clamp: (x, a, b) => Math.min(b, Math.max(a, x)), seedRandom() {}, random: () => 0.5, noise: () => 0, time: 0,
    value: [0, 0], inPoint: 0, outPoint: 4, anchorPoint: [0, 0], scale: [100, 100], rotation: 0,
    sourceRectAtTime: () => ({ left: 0, top: 0, width: 0, height: 0 }) }, extra.env || {});
  return vm.runInNewContext(expr, env);
}
const xs = (params, n) => Array.from({ length: n }, (_, i) => run('base', params, i));

test('Lineare con Spazio: bordi a 50 px, centrata sul controllo', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 1, 'Quantità': 4, 'Modo misura': 3, 'Distanza': [50, 0, 0], 'Dimensione copia': [200, 100, 100] });
  const pos = xs(p, 4).map((v) => v[0]);
  assert(pos.join() === '-375,-125,125,375', pos.join());
  assert(xs(p, 4).every((v) => v[1] === 0), 'riga orizzontale');
});

test('Spazio tiene conto di Trasforma scala', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 1, 'Quantità': 2, 'Modo misura': 3, 'Distanza': [50, 0, 0], 'Dimensione copia': [200, 100, 100], 'Trasforma scala': 50 });
  const pos = xs(p, 2).map((v) => v[0]);
  near(pos[1] - pos[0], 150, 1e-9, '100 di copia + 50 di spazio');
});

test('Lineare con Spazio in verticale (Per colonne)', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 1, 'Quantità': 3, 'Modo misura': 3, 'Distanza': [0, 20, 0], 'Dimensione copia': [200, 100, 100], 'Direzione griglia': 2 });
  const pos = xs(p, 3);
  assert(pos.map((v) => v[1]).join() === '-120,0,120' && pos.every((v) => v[0] === 0), JSON.stringify(pos));
});

test('Griglia con Spazio: passo = copia + spazio su X e Y', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 2, 'Colonne': 3, 'Righe': 2, 'Quantità': 6, 'Modo misura': 3, 'Distanza': [20, 10, 0], 'Dimensione copia': [200, 100, 100] });
  const pos = xs(p, 6);
  near(pos[1][0] - pos[0][0], 220, 1e-9, 'X'); near(pos[3][1] - pos[0][1], 110, 1e-9, 'Y');
  near(pos[0][0] + pos[2][0], 0, 1e-9, 'centrata');
});

test('Passo e Adatta funzionano come prima', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 1, 'Quantità': 3, 'Modo misura': 1, 'Passo': [150, 0, 0] });
  assert(xs(p, 3).map((v) => v[0]).join() === '-150,0,150', 'passo');
  Object.assign(p, { 'Modo misura': 2, 'Passo': [600, 0, 0] });
  assert(xs(p, 3).map((v) => v[0]).join() === '-300,0,300', 'adatta');
});

test('i comportamenti si calcolano anche con la misura Spazio', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 1, 'Quantità': 3, 'Modo misura': 3, 'Distanza': [50, 0, 0], 'Dimensione copia': [100, 100, 100], 'Comportamenti': 1,
    'B1 Attivo': 1, 'B1 Destinazione': 2, 'B1 Tipo': 1, 'B1 Min': 0, 'B1 Max': 100, 'B1 Seme': 1, 'B1 Ordine': 1, 'B1 Curva': 1 });
  const v = run('behave', p, 2);
  near(v[1], 100, 1e-9, 'stagger su Y all\'ultima copia');
});

test('posizione: con l\'origine letta dopo l\'aggancio la copia sta sul suo punto', () => {
  // Valore della copia nello spazio del controllo = origine: resta solo la disposizione del Cloner.
  const p = P0(); p['Allinea copie'] = 2;
  const v = run('position', p, 0, { fx: { 'MT Base': [250, 0, 0], 'MT Origine': [-960, -540, 0] }, env: { value: [-960, -540] } });
  assert(v[0] === 250 && v[1] === 0, JSON.stringify(v));
});

test('centro del contenuto misurato a meta\' vita, non a ogni fotogramma', () => {
  const p = P0(); p['Allinea copie'] = 1;
  const rect = (t) => ({ left: t < 2 ? 0 : 500, top: 0, width: 100, height: 100 }); // il contenuto cambia nel tempo
  const at = (time) => run('position', p, 0, { env: { time, sourceRectAtTime: rect, anchorPoint: [50, 50] } });
  near(at(0)[0], at(3.9)[0], 1e-9, 'stessa posizione in tutto il layer');
});

test('da Griglia a Lineare: il passo Y si azzera, niente diagonale', () => {
  const store = { 'Passo': [150, 150, 0], 'Dimensione copia': [120, 80, 80], 'Direzione griglia': 1 };
  const ctrl = { threeDLayer: false };
  const saved = { get: ctx.mt_get, set: ctx.mt_set };
  ctx.mt_get = (c, n) => store[n]; ctx.mt_set = (c, n, v) => { store[n] = v; return true; };
  ctx.mt_adaptStep(ctrl, 2, 1, 0);
  assert(store['Passo'].join() === '150,0,0', store['Passo'].join());
  ctx.mt_adaptStep(ctrl, 1, 2, 0);
  assert(store['Passo'].join() === '150,100,0', 'in griglia torna una Y dalla dimensione: ' + store['Passo'].join());
  ctx.mt_get = saved.get; ctx.mt_set = saved.set;
});

test('griglia con colonne animate: le copie oltre il numero di adesso si nascondono', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 2, 'Colonne': 2, 'Righe': 2, 'Livelli': 1, 'Quantità': 9, 'Trasforma opacità': 100 });
  const op = (i) => run('opacity', p, i, { env: { value: 100 } });
  assert(op(3) === 100 && op(4) === 0 && op(8) === 0, [op(3), op(4), op(8)].join());
});

test('copie da creare: il keyframe piu\' alto di colonne e righe', () => {
  const fx = { 'Distribuzione': { value: 2, numKeys: 0 }, 'Colonne': { value: 2, numKeys: 2, keyValue: (k) => [2, 6][k - 1] }, 'Righe': { value: 3, numKeys: 0 } };
  const saved = ctx.mt_fxProp, savedGet = ctx.mt_get;
  ctx.mt_fxProp = (c, n) => fx[n] || null; ctx.mt_get = (c, n) => (fx[n] ? fx[n].value : null);
  const n = ctx.mt_countFor({ threeDLayer: false });
  ctx.mt_fxProp = saved; ctx.mt_get = savedGet;
  assert(n === 18, String(n));
});

test('colore dal falloff: colore del comportamento con il suo peso', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 1, 'Quantità': 3, 'Comportamenti': 1,
    'B1 Attivo': 1, 'B1 Destinazione': 10, 'B1 Tipo': 5, 'B1 Min': 0, 'B1 Max': 50, 'B1 Seme': 1, 'B1 Colore': [0, 0.5, 1, 1] });
  const expr = ctx.mt_expr('fcolor', 'Cloner', 10);
  const C = { effect: (nm) => () => ({ value: p[nm], index: 0 }), marker: { numKeys: 0 } };
  const own = { 'MT Indice': 1, 'MT Base': [0, 0, 0] };
  const v = vm.runInNewContext(expr, { thisComp: { layer: () => C }, effect: (nm) => () => ({ value: own[nm] }), Math, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), seedRandom() {}, random: () => 0.5, noise: () => 0, time: 0, degreesToRadians: (d) => d * Math.PI / 180 });
  assert(v.join() === '0,0.5,1,0.5', v.join());
});

test('due colori: media pesata', () => {
  const p = P0(); Object.assign(p, { 'Distribuzione': 1, 'Quantità': 1, 'Comportamenti': 2,
    'B1 Attivo': 1, 'B1 Destinazione': 10, 'B1 Tipo': 5, 'B1 Max': 100, 'B1 Seme': 1, 'B1 Colore': [1, 0, 0, 1],
    'B2 Attivo': 1, 'B2 Destinazione': 10, 'B2 Tipo': 5, 'B2 Max': 100, 'B2 Seme': 1, 'B2 Colore': [0, 0, 1, 1] });
  const C = { effect: (nm) => () => ({ value: p[nm], index: 0 }), marker: { numKeys: 0 } };
  const v = vm.runInNewContext(ctx.mt_expr('fcolor', 'Cloner', 10), { thisComp: { layer: () => C }, effect: (nm) => () => ({ value: nm === 'MT Indice' ? 0 : [0, 0, 0] }), Math, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), seedRandom() {}, random: () => 0.5, noise: () => 0, time: 0, degreesToRadians: (d) => d });
  assert(v.join() === '0.5,0,0.5,1', v.join());
});

test('prova del falloff: peso al centro e indice del layer', () => {
  const Ff = { 'Forma': 1, 'Dimensione': [500, 500], 'Morbidezza': 60, 'Intensità': 100, 'Inverti': 0, 'Probabilità': 0, 'Seme': 1 };
  const F = { index: 3, effect: (n) => () => ({ value: Ff[n] }), fromWorld: (w) => [w[0] - 960, w[1] - 540, 0], transform: { anchorPoint: { value: [0, 0] } } };
  const p = P0();
  const C = { effect: (n) => () => (n === 'B2 Falloff' ? F : { value: p[n] }), toWorld: (v) => [v[0] + 960, v[1] + 540, 0] };
  const v = vm.runInNewContext(ctx.mt_expr('fallTest', 'Cloner', 2), { thisComp: { layer: () => C }, effect: (n) => () => ({ value: n === 'MT Indice' ? 0 : [0, 0, 0] }), Math, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), seedRandom() {}, random: () => 0.5 });
  assert(v.join() === '1,3,1', v.join());
});

// Fila di 9 copie larghe 100 con 40 di spazio; falloff al centro che raddoppia la scala.
function fallRow(A, keep, morb = 100) {
  const p = P0(); const N = 9;
  Object.assign(p, { 'Distribuzione': 1, 'Quantità': N, 'Modo misura': 3, 'Distanza': [40, 0, 0], 'Dimensione copia': [100, 100, 100], 'Comportamenti': 1 });
  ctx.MT_BPARAMS.forEach(([n, , v]) => { p['B1 ' + n] = Array.isArray(v) ? v.slice() : v; });
  Object.assign(p, { 'B1 Tipo': 5, 'B1 Destinazione': 7, 'B1 Max': A, 'B1 Mantieni spazi': keep });
  const Ff = { 'Forma': 1, 'Dimensione': [300, 300], 'Morbidezza': morb, 'Intensità': 100, 'Inverti': 0, 'Probabilità': 0, 'Seme': 1 };
  const F = { index: 3, effect: (n) => () => ({ value: Ff[n] }), fromWorld: (w) => [w[0] - 960, w[1] - 540, 0], toWorld: (l) => [l[0] + 960, l[1] + 540, 0], transform: { anchorPoint: { value: [0, 0] } } };
  const C = { effect: (n) => () => (n === 'B1 Falloff' ? F : { value: p[n] }), marker: { numKeys: 0 }, toWorld: (v) => [v[0] + 960, v[1] + 540, v[2] || 0], fromWorld: (v) => [v[0] - 960, v[1] - 540, v[2] || 0] };
  const env = (own) => ({ thisComp: { layer: () => C }, effect: (n) => () => ({ value: own[n] }), Math, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), seedRandom() {}, random: () => 0.5, noise: () => 0, time: 0, degreesToRadians: (d) => d * Math.PI / 180 });
  return Array.from({ length: N }, (_, i) => {
    const own = { 'MT Indice': i };
    own['MT Base'] = vm.runInNewContext(ctx.mt_expr('base', 'Cloner'), env(own));
    const pos = vm.runInNewContext(ctx.mt_expr('behave', 'Cloner', 1), env(own));
    const ex = vm.runInNewContext(ctx.mt_expr('behave', 'Cloner', 7), env(own));
    return { x: own['MT Base'][0] + pos[0], w: 100 + ex[0] };
  });
}
const gapsOf = (R) => R.slice(1).map((r, i) => r.x - R[i].x - (r.w + R[i].w) / 2);

test('falloff come area: pieno dentro, sfuma fuori, zero lontano', () => {
  const R = fallRow(100, 0);
  near(R[4].w, 200, 1e-9, 'centro'); near(R[3].w, 200, 1e-9, 'dentro l\'area');
  assert(R[2].w > 100 && R[2].w < 200, 'nella sfumatura: ' + R[2].w);
  near(R[0].w, 100, 1e-9, 'lontano');
});

test('scala dal falloff con Distanze: le copie non si toccano', () => {
  const g = gapsOf(fallRow(100, 1));
  assert(g.every((v) => v > 25 && v < 55), g.map(Math.round).join());
  const g2 = gapsOf(fallRow(-60, 1));
  assert(g2.every((v) => v > 25 && v < 55), g2.map(Math.round).join());
});

test('scala dal falloff senza Distanze: le posizioni non cambiano', () => {
  const R = fallRow(100, 0);
  assert(R.map((r) => r.x).join() === '-560,-420,-280,-140,0,140,280,420,560', R.map((r) => r.x).join());
});

test('falloff 3D: la profondita\' conta lungo Z', () => {
  const run3 = (depth) => {
    const Ff = { 'Forma': 1, 'Dimensione': [200, 200], 'Profondità': depth, 'Morbidezza': 100, 'Intensità': 100, 'Inverti': 0, 'Probabilità': 0, 'Seme': 1 };
    const F = { index: 3, effect: (n) => () => ({ value: Ff[n] }), fromWorld: (w) => [w[0], w[1], w[2]], transform: { anchorPoint: { value: [0, 0, 0] } } };
    const p = P0();
    const C = { effect: (n) => () => (n === 'B2 Falloff' ? F : { value: p[n] }), toWorld: (v) => [v[0], v[1], v[2]] };
    return vm.runInNewContext(ctx.mt_expr('fallTest', 'Cloner', 2), { thisComp: { layer: () => C }, effect: (n) => () => ({ value: n === 'MT Indice' ? 0 : [0, 0, 80] }), Math, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), seedRandom() {}, random: () => 0.5 })[0];
  };
  near(run3(0), 1, 1e-9, 'senza profondita\': come la larghezza');
  assert(run3(100) > 0 && run3(100) < 1, 'con profondita\' 100 sta nella sfumatura: ' + run3(100));
  near(run3(40), 0, 1e-9, 'profondita\' 40: fuori');
});

test('falloff in 3D: rotazione X e Y e posizione Z delle copie', () => {
  const Ff = { 'Forma': 1, 'Dimensione': [400, 400], 'Profondità': 0, 'Morbidezza': 100, 'Intensità': 100, 'Inverti': 0, 'Probabilità': 0, 'Seme': 1 };
  const F = { index: 3, effect: (n) => () => ({ value: Ff[n] }), fromWorld: (w) => [w[0], w[1], w[2]], toWorld: (l) => l, transform: { anchorPoint: { value: [0, 0, 0] } } };
  const p = P0(); Object.assign(p, { 'Distribuzione': 1, 'Quantità': 1, 'Comportamenti': 3 });
  [[1, 5, 90], [2, 6, 45], [3, 3, -300]].forEach(([k, d, a]) => {
    ctx.MT_BPARAMS.forEach(([n, , v]) => { p[`B${k} ${n}`] = Array.isArray(v) ? v.slice() : v; });
    Object.assign(p, { [`B${k} Tipo`]: 5, [`B${k} Destinazione`]: d, [`B${k} Max`]: a });
  });
  const C = { effect: (n) => () => (/^B\d Falloff$/.test(n) ? F : { value: p[n] }), marker: { numKeys: 0 }, toWorld: (v) => v, fromWorld: (v) => v };
  const env = { thisComp: { layer: () => C }, effect: (n) => () => ({ value: n === 'MT Indice' ? 0 : [0, 0, 0] }), Math, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), seedRandom() {}, random: () => 0.5, noise: () => 0, time: 0, degreesToRadians: (d) => d * Math.PI / 180 };
  const rot = vm.runInNewContext(ctx.mt_expr('behave', 'Cloner', 4), env);
  const pos = vm.runInNewContext(ctx.mt_expr('behave', 'Cloner', 1), env);
  assert(rot[1] === 90 && rot[2] === 45, 'rotazione X e Y: ' + rot.join());
  assert(pos[2] === -300, 'posizione Z: ' + pos.join());
});
