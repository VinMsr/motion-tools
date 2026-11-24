// Cloner con un After Effects finto: le funzioni vere del plugin, nella sequenza che usa il pannello.
const makeAE = require('./support/fakeae.js');
test('Cloner: crea, leggi, cambia tipo e misura, falloff e colore senza errori', () => {
  const { ctx, makeComp, makeLayer, project } = makeAE();
  const comp = makeComp('Main'); project.activeItem = comp;
  const src = makeLayer(comp, 'Logo', 'shape'); comp._layers.push(src); src.selected = true;
  const call = (fn, ...a) => { const r = JSON.parse(ctx[fn](...a)); assert(r.ok, fn + ': ' + r.error); return r; };
  call('inflect_repeatCreate', JSON.stringify({ mode: 2, count: 8, cols: 3, rows: 2, levels: 1, threeD: false, pick: 'cycle', front: 'last', hide: true }));
  assert(call('inflect_repeatRead').repeat.clones === 6, 'sei copie');
  for (const m of [1, 3, 4, 5, 2]) { call('inflect_repeatSet', 'Distribuzione', String(m)); assert(call('inflect_repeatRead').repeat.params['Distribuzione'] === m, 'tipo ' + m); }
  call('inflect_repeatSet', 'Distanza', '[50,50,0]');
  call('inflect_repeatSet', 'Modo misura', '1'); call('inflect_repeatSet', 'Modo misura', '3');
  call('inflect_repeatMeasure');
  const f = call('inflect_falloffCreate', 1, 0);
  call('inflect_falloffLink', f.index, 7, -100, null);
  call('inflect_falloffLink', f.index, 10, 100, '[1,0.3,0.1,1]');
  assert(call('inflect_repeatRead').repeat.behaviours.length === 2, 'due collegamenti');
  call('inflect_repeatKey', 'ctrl', 0, 'Colonne');
  call('inflect_clonerCenter', true);
  call('inflect_state');
});

test('gruppi di annullamento: mai uno dentro l\'altro, mai chiusi due volte', () => {
  const { ctx, makeComp, makeLayer, project } = makeAE();
  const comp = makeComp('Main'); project.activeItem = comp;
  const src = makeLayer(comp, 'Logo', 'shape'); comp._layers.push(src); src.selected = true;
  const U = ctx.app._undo;
  // Ogni chiamata come la fa il pannello: funzione e poi mt_flushUndo.
  const call = (fn, ...a) => { const r = JSON.parse(ctx[fn](...a)); ctx.mt_flushUndo(); assert(r.ok, fn + ': ' + r.error); assert(U.depth === 0, fn + ': gruppo rimasto aperto'); return r; };
  call('inflect_repeatCreate', JSON.stringify({ mode: 2, count: 8, cols: 3, rows: 2, levels: 1, threeD: false, pick: 'cycle', front: 'last', hide: true }));
  call('inflect_repeatSet', 'Distribuzione', '1');
  call('inflect_repeatSet', 'pick', '"random"');
  const f = call('inflect_falloffCreate', 1, 0);
  call('inflect_falloffLink', f.index, 7, 100, null);
  call('inflect_falloffLink', f.index, 10, 100, '[1,0.3,0.1,1]');
  call('inflect_falloffSet', f.index, 'Morbidezza', '50');
  call('inflect_repeatRebuild');
  call('inflect_clonerCenter', true);
  call('inflect_clonerAnchor', 0.5, 0.5);
  call('inflect_repeatRecipe', 'cascata');
  call('inflect_aeUndo', false, 2);
  assert(!U.errors.length, U.errors.join(' | '));
});

test('falloff: invisibile nell\'export, contorno a richiesta, profondita\' su un falloff vecchio', () => {
  const { ctx, makeComp, makeLayer, project } = makeAE();
  const comp = makeComp('Main'); project.activeItem = comp;
  const src = makeLayer(comp, 'Logo', 'shape'); comp._layers.push(src); src.selected = true;
  const U = ctx.app._undo;
  const call = (fn, ...a) => { const r = JSON.parse(ctx[fn](...a)); ctx.mt_flushUndo(); assert(r.ok, fn + ': ' + r.error); return r; };
  call('inflect_repeatCreate', JSON.stringify({ mode: 1, count: 5, threeD: true, pick: 'cycle', front: 'last', hide: true }));
  assert(call('inflect_repeatRead').repeat.inputs[0].scale === 100, 'controlli degli input creati subito');
  call('inflect_repeatSet', 'I1 Scala', '70');
  const f = call('inflect_falloffCreate', 1, 0);
  const F = comp.layer(f.index);
  assert(F.guideLayer && F.adjustmentLayer && F.threeDLayer, 'guida, regolazione e 3D');
  call('inflect_falloffOutline', f.index, true); assert(!F.adjustmentLayer, 'contorno visibile');
  call('inflect_falloffOutline', f.index, false); assert(F.adjustmentLayer, 'contorno nascosto');
  // Falloff fatto prima della Profondita'
  const fx = F.property('ADBE Effect Parade'); fx._kids = fx._kids.filter((k) => k.name !== 'Profondità');
  call('inflect_falloffSet', f.index, 'Profondità', '300');
  assert(ctx.mt_get(F, 'Profondità') === 300, 'profondita\' creata e impostata');
  const rf = call('inflect_repeatRead').repeat.falloffs[0];
  assert('Rotazione X' in rf && rf.outline === false, JSON.stringify(rf));
  call('inflect_repeatTSet', 'fallT', f.index, 'Rotazione Y', '30');
  assert(!U.errors.length, U.errors.join(' | '));
});
