// Input del Cloner con un After Effects finto: aggiungi, riordina, sostituisci, togli, modi d'uso.
const makeAE = require('./support/fakeae.js');
test('Cloner: input come in Cavalry', () => {
  const { ctx, makeComp, makeLayer, project } = makeAE();
  const comp = makeComp('Main'); project.activeItem = comp;
  const mk = (n) => { const l = makeLayer(comp, n, 'shape'); comp._layers.push(l); return l; };
  const A = mk('A'), B = mk('B'), Cc = mk('C'), D = mk('D');
  const call = (fn, ...a) => { const r = JSON.parse(ctx[fn](...a)); assert(r.ok, fn + ': ' + r.error); return r; };
  const sel = (...ls) => { comp._layers.forEach((l) => { l.selected = false; }); ls.forEach((l) => { l.selected = true; }); };
  const names = () => call('inflect_repeatRead').repeat.inputs.map((x) => x.name).join(',');
  const used = () => call('inflect_repeatRead').repeat.inputs.map((x) => x.copies).join(',');
  sel(A, B);
  call('inflect_repeatCreate', JSON.stringify({ mode: 1, count: 6, threeD: false, pick: 'cycle', front: 'last', hide: true }));
  assert(names() === 'A,B', names());
  call('inflect_repeatPin', true);
  sel(Cc);
  assert(call('inflect_repeatRead').repeat.name === 'Cloner 1', 'resta sul Cloner mentre scegli');
  assert(call('inflect_repeatInput', 'add', 0).inputs === 3, 'tre input');
  sel(); assert(!JSON.parse(ctx.inflect_repeatRead()).repeat, 'dopo l\'aggiunta torna libero');
  const ctrl = comp._layers.find((l) => String(l.comment).indexOf('MT_REPEAT') === 0); sel(ctrl);
  assert(names() === 'A,B,C' && used() === '2,2,2', names() + ' ' + used());
  assert(Cc.enabled === false, 'input nuovo nascosto');
  call('inflect_repeatInput', 'up', 2); assert(names() === 'A,C,B', names());
  call('inflect_repeatInput', 'down', 0); assert(names() === 'C,A,B', names());
  call('inflect_repeatPin', true); sel(D); call('inflect_repeatInput', 'replace', 1); sel(ctrl); assert(names() === 'C,D,B', names());
  call('inflect_repeatInput', 'remove', 0); assert(names() === 'D,B', names());
  assert(call('inflect_repeatRead').repeat.clones === 6, 'sempre sei copie');
  call('inflect_repeatSet', 'pick', '"only:1"'); assert(used() === '0,6', 'solo il secondo: ' + used());
  call('inflect_repeatSet', 'pick', '"stretch"'); assert(used() === '3,3', 'a blocchi: ' + used());
  call('inflect_repeatSet', 'pick', '"pingpong"'); assert(used() === '3,3', 'avanti e indietro: ' + used());
  call('inflect_repeatInput', 'remove', 1);
  const r = JSON.parse(ctx.inflect_repeatInput('remove', 0)); assert(!r.ok, 'almeno un input');
  call('inflect_repeatPin', true); sel(); const r2 = JSON.parse(ctx.inflect_repeatInput('add', 0)); assert(!r2.ok, 'niente selezionato');
});

test('Cloner: scala e colore per input, che seguono l\'input quando la lista cambia', () => {
  const { ctx, makeComp, makeLayer, project } = makeAE();
  const comp = makeComp('Main'); project.activeItem = comp;
  const mk = (n) => { const l = makeLayer(comp, n, 'shape'); comp._layers.push(l); return l; };
  const A = mk('A'), B = mk('B');
  const call = (fn, ...a) => { const r = JSON.parse(ctx[fn](...a)); ctx.mt_flushUndo(); assert(r.ok, fn + ': ' + r.error); return r; };
  const sel = (...ls) => { comp._layers.forEach((l) => { l.selected = false; }); ls.forEach((l) => { l.selected = true; }); };
  sel(A, B);
  call('inflect_repeatCreate', JSON.stringify({ mode: 1, count: 4, threeD: false, pick: 'cycle', front: 'last', hide: true }));
  const ctrl = comp._layers.find((l) => String(l.comment).indexOf('MT_REPEAT') === 0);
  sel(ctrl);
  call('inflect_repeatSet', 'I2 Scala', '50');
  call('inflect_repeatSet', 'I2 Colora', '1');
  call('inflect_repeatSet', 'I2 Colore', '[0,0.5,1,1]');
  let ins = call('inflect_repeatRead').repeat.inputs;
  assert(ins[1].scale === 50 && ins[1].colorOn === 1 && ins[1].vector, JSON.stringify(ins[1]));
  call('inflect_repeatInput', 'up', 1);
  ins = call('inflect_repeatRead').repeat.inputs;
  assert(ins[0].name === 'B' && ins[0].scale === 50 && ins[0].colorOn === 1 && ins[1].scale === 100, JSON.stringify(ins));
  // Ogni copia sa da quale input viene e, se vettoriale, ha il suo riempimento.
  const cl = ctx.mt_clones(comp, ctrl);
  assert(cl.every((c) => ctx.mt_get(c.layer, 'MT Input') === c.s), 'MT Input');
  assert(cl.every((c) => c.layer.property('ADBE Effect Parade').property('MT Colore input')), 'riempimento dell\'input');
  const sx = cl[0].layer.property('ADBE Transform Group').property('ADBE Scale').expression;
  assert(sx.indexOf('" Scala")') > 0, 'la scala legge I<n> Scala');
  // Con il colore del falloff, il riempimento dell'input sta prima.
  const f = call('inflect_falloffCreate', 1, 0);
  call('inflect_falloffLink', f.index, 10, 100, '[1,0.3,0.1,1]');
  const par = ctx.mt_clones(comp, ctrl)[0].layer.property('ADBE Effect Parade');
  assert(par.property('MT Colore input').propertyIndex < par.property('MT Colore falloff').propertyIndex, 'ordine dei riempimenti');
});
