// Curve incollate come testo: i quattro formati, valori fuori da 0..1, maniglie spezzate, errori in italiano.
const C = require('../js/core.js');
const P = (t, v, hi, ho, broken) => ({ t, v, hi: { x: hi[0], y: hi[1] }, ho: { x: ho[0], y: ho[1] }, broken });
const bounce = { id: 'iml_bounce', name: 'Rimbalzo Inter', group: 'Entrata', notes: 'da Motion Lab',
  points: [P(0, 0, [0, 0], [0.2, 0.6], false), P(0.55, 1.18, [-0.15, 0.05], [0.1, -0.2], true), P(0.8, 0.94, [-0.1, 0], [0.08, 0], false), P(1, 1, [-0.1, 0], [0, 0], false)] };

test('incolla: una curva sola con rimbalzo e maniglie spezzate', () => {
  const r = C.parseCurvesText(JSON.stringify(bounce));
  assert(!r.error, r.error);
  const c = r.curves[0];
  assert(c.id === 'iml_bounce' && c.name === 'Rimbalzo Inter' && c.group === 'Entrata' && c.notes === 'da Motion Lab', 'meta');
  assert(c.points.length === 4 && c.points[1].v === 1.18 && c.points[2].v === 0.94, 'valori fuori da 0..1 intatti');
  assert(c.points[1].broken === true && c.points[1].hi.y === 0.05 && c.points[1].ho.y === -0.2, 'maniglie spezzate intatte');
});

test('incolla: libreria, array e blocco di codice', () => {
  const lib = C.parseCurvesText(JSON.stringify({ format: 'inflect-library', name: 'Inter', curves: [bounce, Object.assign({}, bounce, { id: 'b2', name: 'Due' })] }));
  assert(lib.curves.length === 2 && lib.name === 'Inter', 'libreria');
  const arr = C.parseCurvesText('```json\n' + JSON.stringify([bounce]) + '\n```');
  assert(arr.curves.length === 1, 'array dentro ```json');
});

test('incolla: quattro numeri e cubic-bezier', () => {
  const r = C.parseCurvesText('0.25, 0.1, 0.25, 1');
  assert(r.curves[0].points.length === 2 && C.toCubic(r.curves[0]).join() === '0.25,0.1,0.25,1', 'numeri');
  const r2 = C.parseCurvesText('cubic-bezier(0.68, -0.6, 0.32, 1.6)');
  assert(C.toCubic(r2.curves[0]).join() === '0.68,-0.6,0.32,1.6', 'cubic-bezier con valori fuori');
  assert(/tra 0 e 1/.test(C.parseCurvesText('1.2, 0, 0.3, 1').error), 'x fuori');
  assert(/quattro numeri/.test(C.parseCurvesText('0.2, 0.3, 0.4').error), 'tre numeri');
});

test('incolla: sanitize tiene le maniglie nel segmento', () => {
  const c = JSON.parse(JSON.stringify(bounce)); c.points[0].ho.x = 0.9;
  const r = C.parseCurvesText(JSON.stringify(c));
  assert(r.curves[0].points[0].ho.x === 0.55, 'maniglia accorciata al segmento: ' + r.curves[0].points[0].ho.x);
});

test('incolla: errori chiari in italiano', () => {
  const e = (x) => C.parseCurvesText(typeof x === 'string' ? x : JSON.stringify(x)).error;
  assert(/vuoto/.test(e('  ')), 'vuoto');
  assert(/JSON valido/.test(e('{ "name": "x", ')), 'json rotto');
  assert(/manca "points"/.test(e({ name: 'X', group: 'g' }) || '') || /Non trovo curve/.test(e({ name: 'X' })), 'senza points');
  assert(/almeno 2/.test(e({ name: 'X', points: [bounce.points[0]] })), 'un punto');
  const noHo = JSON.parse(JSON.stringify(bounce)); delete noHo.points[1].ho;
  assert(/punto 2.*manca "ho"/.test(e(noHo)), 'senza ho: ' + e(noHo));
  const noV = JSON.parse(JSON.stringify(bounce)); delete noV.points[2].v;
  assert(/punto 3.*manca "v"/.test(e(noV)), 'senza v');
  const back = JSON.parse(JSON.stringify(bounce)); back.points[2].t = 0.4;
  assert(/devono crescere/.test(e(back)), 'tempi');
  const end = JSON.parse(JSON.stringify(bounce)); end.points[3].v = 0.9;
  assert(/arrivare a v 1/.test(e(end)), 'fine');
  assert(/elenco/.test(e({ curves: {} })), 'curves non array');
});
