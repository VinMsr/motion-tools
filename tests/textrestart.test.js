// Testo: lo sfalsamento che riparte a ogni parola o riga, e il colore di riempimento.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
const ctx = { $: { global: {} } };
vm.createContext(ctx);
vm.runInContext(src, ctx);

// Valore del selettore (0-100) per ogni unita' al tempo t, come lo calcola After Effects.
function amounts(P, text, total, t) {
  const expr = ctx.mt_textExpr(P, P.in);
  const out = [];
  for (let k = 1; k <= total; k++) {
    const env = { textTotal: total, textIndex: k, time: t, inPoint: 0, outPoint: 10, thisLayer: { text: { sourceText: text } }, Math, seedRandom() {}, random: (x) => x / 2 };
    out.push(vm.runInNewContext(expr, env)[0]);
  }
  return out;
}
const lin = (o) => Object.assign({ ref: 100, unit: 'chars' }, o);
const phase = (x) => Object.assign({ dur: 1, stg: 0.1, delay: 0, ord: 0, spread: 0, seed: 1, ease: { type: 'bezier', v: [0, 0, 1, 1] }, from: { opacity: 0 } }, x);

test('lettere che ripartono a ogni parola: la prima di ogni parola parte insieme', () => {
  // "Ciao mondo": 4 + 5 lettere, senza spazi = 9 unita'.
  const a = amounts(lin({ in: phase({ restart: 'words' }) }), 'Ciao mondo', 9, 0.5);
  near(a[0], a[4], 1e-9, 'C e m'); near(a[1], a[5], 1e-9, 'i e o');
  assert(a[3] > a[0], 'dentro la parola resta lo sfalsamento');
});

test('ritardo tra le parole con wstg', () => {
  const a = amounts(lin({ in: phase({ restart: 'words', wstg: 0.3 }) }), 'Ciao mondo', 9, 0.5);
  // La m parte 0.3 s dopo la C: a 0.5 s la C e' al 50%, la m al 20% (curva lineare): restano 50 e 80.
  near(a[0], 50, 1e-2, 'C'); near(a[4], 80, 1e-2, 'm');
});

test('righe: parole che ripartono a ogni riga', () => {
  const a = amounts(lin({ unit: 'words', in: phase({ restart: 'lines' }) }), 'Uno due\rtre quattro cinque', 5, 0.15);
  near(a[0], a[2], 1e-9, 'prima parola di ogni riga');
  assert(a[1] > a[0] && a[4] > a[3], 'sfalsamento nella riga');
});

test('senza restart il comportamento non cambia', () => {
  const a = amounts(lin({ in: phase({}) }), 'Ciao mondo', 9, 0.5);
  near(a[4], 90, 1e-2, 'quinta lettera: 0.4 s di ritardo');
});

test('colore in esadecimale', () => {
  const c = ctx.mt_hexColor('#FF8000');
  near(c[0], 1, 1e-9); near(c[1], 128 / 255, 1e-9); near(c[2], 0, 1e-9);
  assert(ctx.mt_hexColor('#f00')[0] === 1 && ctx.mt_hexColor('rosso') === null, 'forme corte e non valide');
});

// Blocco fill: animatore "MT Colore" con la sua unita'. Si costruisce come fa inflect_textApply.
function fillAmounts(fill, text, total, t) {
  const Pf = { unit: fill.unit || 'chars', ref: 100, restart: fill.restart, in: fill };
  const expr = ctx.mt_textExpr(Pf, fill);
  const out = [];
  for (let k = 1; k <= total; k++) {
    const env = { textTotal: total, textIndex: k, time: t, inPoint: 0, outPoint: 10, thisLayer: { text: { sourceText: text } }, Math, seedRandom() {}, random: (x) => x / 2 };
    out.push(vm.runInNewContext(expr, env)[0]);
  }
  return out;
}

test('colore per lettere: ritardo = parola x wordStg + lettera x stg', () => {
  const fill = { unit: 'chars', restart: 'words', wordStg: 0.5, dur: 1, stg: 0.1, delay: 0, ease: { type: 'bezier', v: [0, 0, 1, 1] }, from: { fill: '#FF5A1F' } };
  // "Ciao mondo": la m (indice 4) parte a 0.5 s, la o dopo (indice 5) a 0.6 s.
  const a = fillAmounts(fill, 'Ciao mondo', 9, 0.8);
  near(a[0], 20, 1e-2, 'C: 0.8 s su 1 s');
  near(a[4], 70, 1e-2, 'm: parte a 0.5 s');
  near(a[5], 80, 1e-2, 'o: parte a 0.6 s');
});

test('colore che arriva (to) invece di partire', () => {
  const fill = { unit: 'chars', dur: 1, stg: 0, ease: { type: 'bezier', v: [0, 0, 1, 1] }, to: { fill: '#FF5A1F' } };
  near(fillAmounts(fill, 'Ciao', 4, 0.25)[0], 25, 1e-2, 'al 25% del colore');
});

// Lettura dal layer: MT Colore viene riconosciuto anche da solo o fatto da un altro script.
function animLayer(anims) {
  const list = anims.map(([name, expr, fill, rt]) => ({ name,
    property: (n) => n === 'ADBE Text Selectors'
      ? { property: () => ({ property: (m) => (m === 'ADBE Text Range Type2' ? { value: rt || 2 } : { expression: expr || '' }) }) }
      : { property: () => ({ value: fill || [1, 0, 0, 1] }) } }));
  return { property: () => ({ property: () => ({ numProperties: list.length, property: (i) => list[i - 1] }) }) };
}
test('legge MT Colore: preset completo in testa, anche senza entrata', () => {
  const P = { id: 'u1', name: 'Solo colore', unit: 'words', fill: { unit: 'chars', from: { fill: '#FF5A1F' } } };
  const r = ctx.mt_textRead(animLayer([['MT Colore', '// MT_TEXT ' + JSON.stringify(P) + '\nvar x;']]));
  assert(r && r.id === 'u1' && r.fill.from.fill === '#FF5A1F', JSON.stringify(r));
});
test('legge MT Colore fatto da un altro script: colore e unita\' dal layer', () => {
  const r = ctx.mt_textRead(animLayer([['MT Colore', 'linear(time,0,1,100,0)', [1, 90 / 255, 31 / 255, 1], 3]]));
  assert(r && r.fill && r.fill.from.fill === '#FF5A1F' && r.fill.unit === 'words', JSON.stringify(r));
});
test('entrata + MT Colore: il blocco colore si aggiunge al preset', () => {
  const P = { id: 'u2', name: 'Parole', unit: 'words', in: { dur: 1 } };
  const r = ctx.mt_textRead(animLayer([['MT Entrata', '// MT_TEXT ' + JSON.stringify(P)], ['MT Colore', 'x', [0, 0, 1, 1]]]));
  assert(r.id === 'u2' && r.in && r.fill && r.fill.from.fill === '#0000FF', JSON.stringify(r));
});
