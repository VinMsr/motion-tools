/*
 * Curve · app.js
 * Collega editor, libreria, generatori e After Effects.
 */
(function () {
  'use strict';
  const C = window.InflectCore;
  const { GraphEditor, thumb } = window.InflectEditor;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ================================================================ host == */

  const inCEP = typeof window.__adobe_cep__ !== 'undefined';
  const cs = inCEP ? new CSInterface() : null;

  /*
   * All'apertura si ricarica host.jsx dal disco: CEP tiene in memoria lo script finche' After Effects
   * resta aperto, quindi senza questo un aggiornamento userebbe ancora il codice vecchio.
   * Ogni chiamata aspetta che il caricamento sia finito.
   */
  let hostReady = null;
  function ensureHost() {
    if (!inCEP) return Promise.resolve('ok');
    if (!hostReady) hostReady = loadHostManually().then((r) => { hostLoadResult = r; return r; });
    return hostReady;
  }
  let hostLoadResult = '';
  function call(fn, ...args) {
    if (inCEP && hostLoadResult === '') return ensureHost().then(() => callNow(fn, ...args));
    return callNow(fn, ...args);
  }
  function callNow(fn, ...args) {
    const enc = (a) => (typeof a === 'boolean' || typeof a === 'number') ? String(a) : JSON.stringify(typeof a === 'string' ? a : JSON.stringify(a));
    // Ogni chiamata chiude i gruppi di annullamento rimasti aperti, cos\u00ec Cmd+Z non va mai in errore.
    // Se After Effects ha in memoria un host.jsx di un'altra build (cache di CEP, pannello ricaricato
    // dopo un aggiornamento), lo ricarica dal disco prima della chiamata: pannello e host restano allineati.
    const fresh = inCEP && window.MT_BUILD ? `if(typeof inflect_build!=="function"||inflect_build()!==${JSON.stringify(window.MT_BUILD)}){try{$.evalFile(new File(${JSON.stringify(cs.getSystemPath(SystemPath.EXTENSION) + '/jsx/host.jsx')}));}catch(eH){}}` : '';
    const src = `(function(){${fresh}var r;try{r=${fn}(${args.map(enc).join(',')});}catch(e){r='{"ok":false,"error":"'+String("${fn}: "+e).replace(/[\\\\"]/g,' ').replace(/[\\r\\n]+/g,' ')+'"}';}try{if(typeof mt_flushUndo==='function')mt_flushUndo();}catch(e2){}return r;})()`;
    if (!inCEP) return Promise.resolve(Mock.run(fn, args));
    return new Promise((resolve) => {
      cs.evalScript(src, (res) => {
        if (!res || res === 'EvalScript error.') return resolve({ ok: false, error: 'After Effects non ha risposto. Riapri il pannello.' });
        try { resolve(JSON.parse(res)); } catch (e) { resolve({ ok: false, error: String(res) }); }
      });
    });
  }

  /*
   * Se host.jsx non si è caricato (errore di sintassi, permessi), lo ricarica
   * a mano e restituisce il messaggio esatto di After Effects.
   */
  function loadHostManually() {
    return new Promise((resolve) => {
      if (!inCEP) return resolve('ok');
      const path = cs.getSystemPath(SystemPath.EXTENSION) + '/jsx/host.jsx';
      const src = `(function(){try{$.evalFile(new File(${JSON.stringify(path)}));return typeof inflect_ping==="function"?"ok":"funzioni mancanti";}catch(e){return "Errore in host.jsx: "+e.message+" (riga "+e.line+")";}})()`;
      cs.evalScript(src, (r) => resolve(r || 'nessuna risposta'));
    });
  }
  // Pannello e host.jsx devono essere della stessa build; se no, After Effects usa file vecchi (cache di CEP).
  async function checkBuild() {
    if (!inCEP) return;
    await ensureHost();
    if (hostLoadResult !== 'ok') return toast(`Non riesco a caricare host.jsx: ${hostLoadResult}`, 'err');
    const hb = await new Promise((res) => cs.evalScript('typeof inflect_build==="function"?inflect_build():"nessuna"', (r) => res(r)));
    if (hb !== window.MT_BUILD) toast(`Il pannello (build ${window.MT_BUILD}) e After Effects (build ${hb}) non coincidono. Chiudi After Effects, riaprilo e riapri il pannello.`, 'err');
  }

  /* Host simulato per provare il pannello in un browser normale. */
  const Mock = {
    project: null,
    user: null,
    shared: { 'brand.curve.json': { format: 'inflect-library', version: 1, name: 'Studio Rosa', owner: '', locked: false, curves: [], updated: 1 } },
    active: 'brand.curve.json',
    mtime: 1,
    speedPct: 0,
    empty: /[?&]empty/.test(location.search),
    tails: 0,
    rp: null,
    run(fn, args) {
      const parse = (s) => (typeof s === 'string' ? JSON.parse(s) : s);
      switch (fn) {
        case 'inflect_state': return this.empty
          ? { ok: true, version: '2.0.0', project: 'Campagna_Q1.aep', comp: 'Hero', props: 0, pairs: 0, keys: 0, duration: 0, fps: 25, layers: 0, sig: '', tails: 0, repeat: null }
          : { ok: true, version: '2.0.0', project: 'Campagna_Q1.aep', comp: 'Hero', props: 2, pairs: 2, keys: 4, duration: 0.6, fps: 25, layers: 2, sig: 'a', tails: this.tails, repeat: this.rp ? { name: this.rp.name, index: 1, mode: this.rp.params['Distribuzione'], count: this.rp.clones, threeD: this.rp.threeD } : null };
        case 'inflect_tailUpdate': this.tails = args[2] ? 0 : this.tails; return { ok: true, added: this.tails, removed: 2, tails: this.tails, notes: [] };
        case 'inflect_anchor': case 'inflect_align': case 'inflect_distribute': return { ok: true, layers: 2, notes: [] };
        case 'inflect_measure': return { ok: true, count: 2, comp: { w: 1920, h: 1080 }, a: { name: 'Logo', l: 300, r: 700, t: 300, b: 620 }, b: { name: 'Titolo', l: 860, r: 1500, t: 420, b: 560 }, gapX: 160, gapY: -140, dx: 680, dy: 30, dist: 680.66 };
        case 'inflect_setGap': return { ok: true, moved: 'Titolo' };
        case 'inflect_repeatCreate': {
          const o = parse(args[0]);
          const n = o.mode === 2 ? o.cols * o.rows * o.levels : o.count;
          const params = { 'Distribuzione': o.mode, 'Quantità': n, 'Colonne': o.cols, 'Righe': o.rows, 'Livelli': o.levels, 'Modo misura': 3, 'Passo': [150, 150, 0], 'Distanza': [40, 40, 40], 'Dimensione copia': [160, 90, 90], 'Direzione griglia': 1, 'Sfalsa righe': 0, 'Centra': 1, 'Raggio': 300, 'Angolo iniziale': 0, 'Arco': 360, 'Scorrimento': 0, 'Orienta': 0, 'Inverti senso': 0, 'Piano': 1, 'Area': [1500, 860, 0], 'Tracciato': 0, 'Seme': 1, 'Trasforma posizione': [0, 0, 0], 'Trasforma scala': 100, 'Trasforma rotazione': 0, 'Trasforma opacità': 100, 'Comportamenti': 0 };
          this.rp = { name: 'Cloner 1', index: 1, threeD: o.threeD, params, behaviours: [], falloffs: [], paths: [{ index: 6, name: 'Onda' }], pathName: '', sources: ['Logo'], pick: o.pick, front: o.front, clones: n };
          return { ok: true, name: 'Cloner 1', count: n };
        }
        case 'inflect_repeatRead': {
          if (!this.rp) return { ok: true, repeat: null };
          const r = JSON.parse(JSON.stringify(this.rp));
          r.group = this.group || (this.group = { 'Rotazione X': -18, 'Rotazione Y': 0, 'Rotazione Z': 0, 'Scala': 100 });
          r.anim = { ctrl: this.keys || {}, ctrlT: this.tkeys || {}, fall: {} };
          { // misure come le darebbe After Effects
            const q = r.params, dc = q['Dimensione copia'], sp = q['Distanza'], mm = Math.round(q['Modo misura']), m = Math.round(q['Distribuzione']);
            const stx = mm === 3 ? (m === 1 && Math.round(q['Direzione griglia']) === 2 ? 0 : dc[0] + sp[0]) : q['Passo'][0];
            const sty = mm === 3 ? (m === 1 ? (Math.round(q['Direzione griglia']) === 2 ? dc[1] + sp[1] : 0) : dc[1] + sp[1]) : q['Passo'][1];
            r.measure = { size: [dc[0], dc[1]], h: m === 1 && sty && !stx ? { center: sty, gap: sty - dc[1], axis: 'y' } : { center: stx, gap: stx - dc[0], axis: 'x' }, v: m === 2 ? { center: sty, gap: sty - dc[1], axis: 'y' } : null };
          }
          r.falloffs.forEach((f) => { f.threeD = r.threeD; f['Posizione'] = f['Posizione'] || [960, 540, -300]; r.anim.fall[f.index] = { 'Posizione': [1, 1] }; });
          return { ok: true, repeat: r };
        }
        case 'inflect_repeatKey': { this.keys = this.keys || {}; const st = this.keys[args[2]]; this.keys[args[2]] = st && st[1] ? [1, 0] : [1, 1]; return { ok: true, state: st && st[1] ? 'tolto' : 'aggiunto', keys: 2 }; }
        case 'inflect_repeatTSet': if (args[0] === 'ctrlT') { this.group[args[2]] = parse(args[3]); } return { ok: true };
        case 'inflect_repeatRecipe': if (args[0] === 'anello') { this.rp.threeD = true; this.rp.params['Distribuzione'] = 3; this.rp.params['Piano'] = 2; } return { ok: true, name: args[0] };
        case 'inflect_repeatMeasure': return { ok: true, size: this.rp.params['Dimensione copia'] };
        case 'inflect_repeatSet': {
          const nm = args[0], v = parse(args[1]);
          if (nm === 'threeD') { this.rp.threeD = !!v; return { ok: true }; }
          if (nm === 'pick' || nm === 'front') { this.rp[nm] = v; return { ok: true }; }
          const m = /^B(\d+) (.+)$/.exec(nm);
          if (m) { const b = this.rp.behaviours[+m[1] - 1]; b[m[2]] = v; if (m[2] === 'Falloff') b.FalloffName = (this.rp.falloffs.find((f) => f.index === v) || {}).name || ''; return { ok: true }; }
          this.rp.params[nm] = v;
          const p = this.rp.params;
          this.rp.clones = Math.round(p['Distribuzione']) === 2 ? p['Colonne'] * p['Righe'] * (this.rp.threeD ? p['Livelli'] : 1) : p['Quantità'];
          p['Quantità'] = this.rp.clones;
          return { ok: true, count: this.rp.clones };
        }
        case 'inflect_repeatAddBehaviour': {
          const o = parse(args[0]);
          const b = { k: this.rp.behaviours.length + 1, 'Tipo': o.tipo, 'Destinazione': o.dest, 'Attivo': 1, 'Min': o.min, 'Max': o.max, 'Curva': 1, 'Ordine': 1, 'Seme': 1, 'Frequenza': 1, 'Fase': 30, 'Falloff': 0, FalloffName: '' };
          this.rp.behaviours.push(b); this.rp.params['Comportamenti'] = b.k;
          return { ok: true, k: b.k };
        }
        case 'inflect_repeatRemoveBehaviour': this.rp.behaviours.splice(args[0] - 1, 1); this.rp.behaviours.forEach((b, i) => (b.k = i + 1)); return { ok: true };
        case 'inflect_falloffCreate': {
          const f = { index: 2 + this.rp.falloffs.length, name: 'Falloff ' + (this.rp.falloffs.length + 1), 'Forma': args[0], 'Dimensione': [500, 500], 'Morbidezza': 100, 'Intensità': 100, 'Inverti': 0, 'Probabilità': 0, 'Seme': 1 };
          this.rp.falloffs.push(f);
          if (args[1] > 0) { const b = this.rp.behaviours[args[1] - 1]; b['Falloff'] = f.index; b.FalloffName = f.name; }
          return { ok: true, name: f.name, index: f.index };
        }
        case 'inflect_falloffLink': {
          const b = { k: this.rp.behaviours.length + 1, 'Tipo': 5, 'Destinazione': args[1], 'Attivo': 1, 'Min': 0, 'Max': args[2], 'Curva': 1, 'Ordine': 1, 'Seme': 1, 'Frequenza': 1, 'Fase': 30, 'Falloff': args[0], 'Colore': args[3] ? parse(args[3]) : [1, 0.35, 0.12, 1] };
          this.rp.behaviours.push(b); this.rp.params['Comportamenti'] = this.rp.behaviours.length; return { ok: true, k: b.k };
        }
        case 'inflect_aeUndo': return { ok: true, steps: args[1] };
        case 'inflect_falloffSet': { const f = this.rp.falloffs.find((x) => x.index === args[0]); if (f) f[args[1]] = parse(args[2]); return { ok: true }; }
        case 'inflect_falloffSelect': return { ok: true };
        case 'inflect_precomposeFit': return { ok: true, name: 'Logo', width: 412, height: 186 };
        case 'inflect_textState': return { ok: true, count: 1, text: 'Nuova collezione', size: 90, applied: null, id: 5, fps: 25, name: 'Titolo' };
        case 'inflect_textApply': return { ok: true, count: 1 };
        case 'inflect_textRemove': return { ok: true, count: 1 };
        case 'inflect_dataLoad': return { ok: true, data: (this.data || {})[args[0]] ? JSON.parse(JSON.stringify(this.data[args[0]])) : null };
        case 'inflect_dataSave': (this.data = this.data || {})[args[0]] = JSON.parse(JSON.stringify(args[1])); return { ok: true };
        case 'inflect_guidesRead': return { ok: true, comp: 'Hero', width: 1920, height: 1080, supported: true, guides: this.guides || (this.guides = [{ i: 0, o: 1, p: 960 }, { i: 1, o: 0, p: 540 }, { i: 2, o: 1, p: 120 }]) };
        case 'inflect_guidesAdd': { const g = this.guides || []; args[0].forEach((x) => g.push({ i: g.length, o: x.o, p: x.p })); this.guides = g; return { ok: true, added: args[0].length, guides: g }; }
        case 'inflect_teamLoad': return { ok: true, folder: '~/Drive/Studio', folderName: 'Studio', isDefault: false, modified: 1, library: this.team || (this.team = { name: 'Studio', curves: [], text: [], lists: [], palettes: [{ id: 'p1', name: 'Inter', colors: ['#0A1C3D', '#1F5FD6', '#FFFFFF', '#C9A44C'] }, { id: 'p2', name: 'Campagna estate', colors: ['#FF6B35', '#F7C59F', '#EFEFD0', '#004E89', '#1A659E'] }] }) };
        case 'inflect_teamSave': this.team = args[0]; return { ok: true, modified: Date.now() };
        case 'inflect_teamStat': return { ok: true, modified: 1 };
        case 'inflect_clipCopy': return { ok: true, mode: 'keys', props: 2, keys: 4, layers: 1, names: ['Posizione', 'Scala'], comp: 'Main', t0: 2.4, fps: 25 };
        case 'inflect_clipPaste': return { ok: true, mode: 'keys', props: 2, base: 0.6, notes: [], fps: 25 };
        case 'inflect_momentTake': return { ok: true, id: 1, name: 'Main', t: 4.48, fps: 25 };
        case 'inflect_listApply': return { ok: true, count: 3, skipped: 0 };
        case 'inflect_clonerAnchor': return { ok: true };
        case 'inflect_clonerCenter': return { ok: true };
        case 'inflect_guidesFlip': return { ok: true };
        case 'inflect_updateInstallFrom': return { ok: true, installed: true, version: '2.32.0', from: '2.31.0', backup: true };
        case 'inflect_settingSet': return { ok: true, key: args[0], value: args[1] };
        case 'inflect_updateCheck': return { ok: true, current: '2.6.0', found: true, available: false, folderName: 'Aggiornamenti' };
        case 'inflect_notesList': return { ok: true, compId: 1, comp: 'Hero', fps: 25, notes: [
          { comp: 'Hero', compId: 1, fps: 25, layer: '', layerId: 0, time: 1.2, text: 'Il logo entra 4 frame troppo tardi', author: 'Vin', done: false, mt: true },
          { comp: 'Hero', compId: 1, fps: 25, layer: 'Titolo', layerId: 3, time: 3.4, text: 'Crenatura del titolo da rivedere, troppo larga sulla seconda riga', author: 'Marta', done: false, mt: true },
          { comp: 'Hero', compId: 1, fps: 25, layer: '', layerId: 0, time: 6, text: 'Musica: taglio qui', author: 'Luca', done: true, mt: true }] };
        case 'inflect_noteAdd': return { ok: true, time: 2, layer: '' };
        case 'inflect_noteSet': return { ok: true };
        case 'inflect_noteGo': return { ok: true };
        case 'inflect_mainGet': return { ok: true, main: { id: 1, name: 'Spot 15s' }, active: { id: 2, name: 'Logo precomp' }, fps: 25, masters: [{ id: 'a', text: 'Drop', author: 'Vin', time: 4.48 }, { id: 'b', text: 'Cambio scena', author: '', time: 9.2 }] };
        case 'inflect_syncAdd': return { ok: true, time: 6, fps: 25, main: 'Spot 15s', copies: 3, comps: ['Logo', 'Titoli', 'Sfondo'], skipped: [] };
        case 'inflect_groupList': return { ok: true, groups: [{ name: 'Logo e payoff', count: 3 }, { name: 'CTA', count: 2 }] };
        case 'inflect_groupSelect': return { ok: true, count: 3 };
        case 'inflect_groupCreate': return { ok: true, groups: [] };
        case 'inflect_offsetAnim': return { ok: true, props: 1, keys: 3 };
        case 'inflect_staggerLayers': return { ok: true, count: 5, span: 12 };
        case 'inflect_repeatRebuild': return { ok: true, count: 12, name: 'Cloner 1' };
        case 'inflect_setTime': return { ok: true, time: args[0] };
        case 'inflect_selectLayer': return { ok: true };
        case 'inflect_selectLinear': return { ok: true, count: 6 };
        case 'inflect_consolidate': return { ok: true, moved: 3, names: ['Logo.mov', 'Pack.psd'], skipped: [], used: 5 };
        case 'inflect_analyze': {
          const nb = 150, keys = [], motion = [];
          for (let b = 0; b < nb; b++) {
            const t = b / nb;
            keys.push(Math.max(0, Math.round(6 * Math.exp(-((t - 0.08) ** 2) / 0.002) + 9 * Math.exp(-((t - 0.42) ** 2) / 0.001) + 4 * Math.exp(-((t - 0.78) ** 2) / 0.003) + (b % 17 === 0 ? 2 : 0))));
            motion.push(Math.max(0, 900 * Math.exp(-((t - 0.12) ** 2) / 0.004) + 1500 * Math.exp(-((t - 0.46) ** 2) / 0.003) + 600 * Math.exp(-((t - 0.82) ** 2) / 0.006) + 60 * Math.sin(t * 40) + 60));
          }
          return { ok: true, comp: 'Spot 15s', duration: 15, fps: 25, time: 4.2, bins: nb, binWidth: 0.1, keys, motion,
            totals: { layers: 24, animated: 14, props: 41, keys: 186, expr: 7 },
            easing: { linear: 18, easy: 31, custom: 52, hold: 4 },
            peaks: [{ bin: 69, time: 6.95, motion: 1520, keys: 9 }, { bin: 18, time: 1.85, motion: 905, keys: 5 }, { bin: 123, time: 12.35, motion: 610, keys: 4 }],
            layers: [{ index: 3, name: 'Logo', keys: 42, props: 6 }, { index: 5, name: 'Titolo', keys: 28, props: 4 }, { index: 7, name: 'CTA', keys: 19, props: 3 }, { index: 2, name: 'Sfondo', keys: 8, props: 2 }],
            quiet: 0.22 };
        }
        case 'inflect_fitComp': return { ok: true, width: 412, height: 186 };
        case 'inflect_repeatSequence': case 'inflect_repeatSelect': return { ok: true, count: 12 };
        case 'inflect_repeatRemove': this.rp = null; return { ok: true, name: 'Cloner 1' };
        case 'inflect_ping': return { ok: true, version: '1.1.0', ae: 'anteprima', project: 'Campagna_Q1.aep' };
        case 'inflect_selectionInfo': return { ok: true, props: 2, pairs: 2, duration: 0.6, fps: 25, comp: 'Hero' };
        case 'inflect_apply': this.speedPct = 0; return { ok: true, segments: 2, skipped: 0, notes: [] };
        case 'inflect_loadProject': return { ok: true, library: this.project };
        case 'inflect_saveProject': this.project = parse(args[0]); return { ok: true, count: this.project.curves.length };
        case 'inflect_loadUser': return { ok: true, library: this.user };
        case 'inflect_saveUser': this.user = parse(args[0]); return { ok: true };
        case 'inflect_sharedList': return {
          ok: true, folder: '/Users/vin/SynologyDrive/Studio/Motion Tools', folderName: 'Motion Tools', isDefault: false, active: this.active,
          libraries: Object.keys(this.shared).map((f) => ({ file: f, name: this.shared[f].name, count: this.shared[f].curves.length, modified: this.mtime })),
        };
        case 'inflect_sharedLoad': return { ok: true, library: JSON.parse(JSON.stringify(this.shared[args[0]])), modified: this.mtime };
        case 'inflect_sharedSave': this.shared[args[0]] = parse(args[1]); this.mtime++; return { ok: true, modified: this.mtime };
        case 'inflect_sharedStat': return { ok: true, exists: true, modified: this.mtime };
        case 'inflect_sharedSetActive': this.active = args[0]; return { ok: true };
        case 'inflect_sharedCreate': { const f = args[0].toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.curve.json'; this.shared[f] = { format: 'inflect-library', version: 1, name: args[0], curves: [], updated: 1 }; this.active = f; return { ok: true, file: f }; }
        case 'inflect_sharedChooseFolder': return { ok: true, cancelled: true };
        case 'inflect_sharedResetFolder': return this.run('inflect_sharedList', []);
        case 'inflect_revealShared': return { ok: true };
        case 'inflect_speedBegin': return { ok: true, pct: this.speedPct, segments: 2 };
        case 'inflect_speedSet': this.speedPct = args[0]; return { ok: true, segments: 2, limited: args[0] < -60 ? 1 : 0, peakBefore: 2.1, peakAfter: Math.max(1, 2.1 * (1 + args[0] / 100)) };
        case 'inflect_tail': this.tails = 2; return { ok: true, added: 2, notes: [], tails: 2 };
        case 'inflect_read': return { ok: true, property: 'Posizione', duration: 0.8, points: C.toAEPlan(C.fromCubic(0.6, 0, 0.1, 1)).points };
        case 'inflect_exportFile': return { ok: true, path: '~/Desktop/brand-curves.curve.json' };
        case 'inflect_importFile': return { ok: true, cancelled: true };
        case 'inflect_audit': return {
          ok: true, comp: 'Hero',
          stats: { brand: 34, linear: 6, easyEase: 9, custom: 5, hold: 2, total: 56 },
          byCurve: { 'Entrata decisa': 21, 'Uscita morbida': 13 },
          offenders: [
            { layer: 'Logo', prop: 'Scala', time: 12, why: 'Easy Ease' },
            { layer: 'Titolo', prop: 'Posizione', time: 30, why: 'lineare' },
            { layer: 'CTA', prop: 'Opacità', time: 44, why: 'fuori brand' },
          ],
        };
        default: return { ok: false, error: 'Funzione sconosciuta' };
      }
    },
  };

  /* =============================================================== stato == */

  const S = {
    curve: C.fromCubic(0.6, 0, 0.1, 1, { name: 'Nuova curva' }),
    source: null,       // { lib: 'brand'|'user'|'preset', id }
    mode: 'both',
    snapFrames: true,
    brand: C.emptyLibrary('Brand'),      // libreria condivisa attiva
    shared: null,                         // { folder, folderName, isDefault, libraries, active }
    brandModified: 0,
    project: C.emptyLibrary('Progetto'),  // curve incorporate nel file .aep
    user: C.emptyLibrary('Le mie curve'),
    embed: true,                          // copia nel progetto le curve brand che applichi
    presets: C.presetLibrary(),
    projectName: '',
    history: [],
    future: [],
    gen: 'spring',
    genParams: {
      spring: { overshoot: 0.25, cycles: 3, attack: 1.2, launch: 0.5 },
      bounce: { bounces: 3, elasticity: 0.45 },
      antic: { anticipation: 0.12, overshoot: 0.1, windup: 0.3 },
      over: { overshoot: 0.12, attack: 1.6, launch: 0.5 },
    },
    search: '',
    lastAudit: null,
  };

  try {
    const saved = JSON.parse(localStorage.getItem('inflect.session') || 'null');
    if (saved && saved.curve) { S.curve = C.validateLibrary({ curves: [saved.curve] }).curves[0]; S.mode = saved.mode || 'both'; }
    if (saved && saved.embed === false) S.embed = false;
  } catch (e) { /* storage non disponibile */ }

  function persistSession() {
    try { localStorage.setItem('inflect.session', JSON.stringify({ curve: S.curve, mode: S.mode, embed: S.embed })); } catch (e) {}
  }

  /* ============================================================== editor == */

  const editor = new GraphEditor($('#graph'), {
    onChange: () => { drawSpacing(); renderInspector(); liveApply(); },
    onCommit: () => { pushHistory(); refreshCurveUI(); },
    onSelect: () => renderInspector(),
  });

  let lastSnapshot = JSON.stringify(S.curve);
  function pushHistory() {
    const now = JSON.stringify(S.curve);
    if (now === lastSnapshot) return;
    S.history.push(lastSnapshot);
    if (S.history.length > 80) S.history.shift();
    S.future = [];
    lastSnapshot = now;
    persistSession();
  }
  function undo() {
    if (!S.history.length) return;
    S.future.push(JSON.stringify(S.curve));
    lastSnapshot = S.history.pop();
    S.curve = JSON.parse(lastSnapshot);
    loadIntoEditor(true);
  }
  function redo() {
    if (!S.future.length) return;
    S.history.push(JSON.stringify(S.curve));
    lastSnapshot = S.future.pop();
    S.curve = JSON.parse(lastSnapshot);
    loadIntoEditor(true);
  }

  function setCurve(c, source = null) {
    pushHistory();
    S.curve = C.clone(c);
    delete S.curve.readonly;
    S.source = source;
    editor.selected = -1;
    pushHistory();
    loadIntoEditor(false);
  }

  function loadIntoEditor(keepView) {
    editor.setCurve(S.curve, keepView);
    refreshCurveUI();
  }

  function refreshCurveUI() {
    $('#curveName').value = S.curve.name;
    fitName();
    const simple = C.isSimple(S.curve);
    const kind = $('#curveKind');
    kind.textContent = simple ? 'Semplice' : `${S.curve.points.length} punti`;
    kind.classList.toggle('multi', !simple);
    $('#modeSeg').classList.toggle('is-disabled', !simple);
    $('#modeSeg').title = simple ? '' : 'Le curve multi punto si applicano sempre a tutto il segmento';
    $('[data-act="undo"]').disabled = !S.history.length;
    $('[data-act="redo"]').disabled = !S.future.length;
    drawSpacing();
    renderInspector();
    renderLibrary();
    persistSession();
  }

  // Il nome occupa solo lo spazio che serve, cos\u00ec il tipo di curva gli sta accanto.
  function fitName() { const n = $('#curveName'); n.style.width = Math.min(240, Math.max(60, n.value.length * 6.6 + 14)) + 'px'; }
  $('#curveName').addEventListener('input', fitName);
  $('#curveName').addEventListener('change', (e) => {
    S.curve.name = e.target.value.trim() || 'Senza nome';
    pushHistory();
    refreshCurveUI();
  });

  /* ========================================================= ispettore == */

  const fmt = (n, d = 3) => String(C.round(n, d));

  function numField(label, value, onInput, opts = {}) {
    const wrap = document.createElement('label');
    wrap.className = 'field' + (opts.wide ? ' wide' : '');
    wrap.innerHTML = `<span>${label}</span>`;
    const inp = document.createElement('input');
    inp.type = opts.wide ? 'text' : 'number';
    inp.step = opts.step || '0.01';
    inp.value = value;
    if (opts.title) inp.dataset.tip = opts.title;
    // Mentre trascini il valore la curva si aggiorna dal vivo; la cronologia si salva al rilascio.
    inp.addEventListener('input', () => { onInput(inp.value); C.sanitize(S.curve); editor.setCurve(S.curve, true); drawSpacing(); liveApply(); });
    inp.addEventListener('change', () => { onInput(inp.value); pushHistory(); loadIntoEditor(true); });
    wrap.appendChild(inp);
    return wrap;
  }

  /*
   * Si aspetta a ridisegnare solo mentre scrivi davvero: in un campo di testo o in una nota sempre,
   * in un campo numerico se hai premuto un tasto negli ultimi 2 secondi. Menu, caselle e pulsanti
   * non bloccano mai l'aggiornamento (prima un menu appena usato lo bloccava e la schermata restava vecchia).
   */
  let lastKeyAt = 0;
  document.addEventListener('keydown', () => { lastKeyAt = Date.now(); }, true);
  function isTyping(box) {
    const a = document.activeElement;
    if (!a || !box || !box.contains(a)) return false;
    if (a.tagName === 'TEXTAREA') return true;
    if (a.tagName === 'INPUT') {
      if (a.type === 'number') return Date.now() - lastKeyAt < 2000;
      return /^(text|search|email|url)?$/.test(a.type);
    }
    return false;
  }
  function renderInspector() {
    const box = $('#inspector');
    if (scrubbing || isTyping(box)) return; // non interrompere la digitazione
    box.textContent = '';
    const c = S.curve;
    if (C.isSimple(c)) {
      const cb = C.toCubic(c);
      const g = document.createElement('div');
      g.className = 'insp-group';
      const set = (k) => (val) => {
        const b = C.toCubic(S.curve);
        b[k] = parseFloat(val) || 0;
        if (k === 0 || k === 2) b[k] = C.clamp(b[k], 0, 1);
        const n = C.fromCubic(b[0], b[1], b[2], b[3], S.curve);
        S.curve.points = n.points;
      };
      g.append(numField('x1', cb[0], set(0)), numField('y1', cb[1], set(1)), numField('x2', cb[2], set(2)), numField('y2', cb[3], set(3)));
      box.appendChild(g);
      // Lettura in stile After Effects: influenza in percentuale.
      const note = document.createElement('span');
      note.className = 'insp-note';
      note.textContent = `Influenza ${Math.round(cb[0] * 100)}% / ${Math.round((1 - cb[2]) * 100)}%`;
      box.appendChild(note);
    } else {
      const i = editor.selected;
      if (i < 0) {
        const note = document.createElement('span');
        note.className = 'insp-note';
        note.textContent = 'Seleziona un punto per modificarne tempo e valore.';
        box.appendChild(note);
      } else {
        const p = c.points[i];
        const g = document.createElement('div');
        g.className = 'insp-group';
        const t = document.createElement('span');
        t.className = 'insp-title';
        t.textContent = i === 0 ? 'Inizio' : i === c.points.length - 1 ? 'Fine' : `Punto ${i}`;
        g.appendChild(t);
        const ends = i === 0 || i === c.points.length - 1;
        if (!ends) {
          g.append(
            numField('tempo', fmt(p.t * 100, 1), (v) => { p.t = C.clamp(parseFloat(v) / 100, c.points[i - 1].t + 0.01, c.points[i + 1].t - 0.01); C.sanitize(S.curve); }, { step: '1', title: 'Percentuale della durata' }),
            numField('valore', fmt(p.v * 100, 1), (v) => { p.v = parseFloat(v) / 100; }, { step: '1', title: 'Percentuale del movimento' }),
          );
        }
        box.appendChild(g);
        const brk = document.createElement('button');
        brk.className = 'btn ghost';
        brk.textContent = p.broken ? 'Unisci maniglie' : 'Spezza maniglie';
        brk.addEventListener('click', () => { p.broken = !p.broken; pushHistory(); loadIntoEditor(true); });
        if (!ends) box.appendChild(brk);
        if (!ends) {
          const del = document.createElement('button');
          del.className = 'btn ghost';
          del.textContent = 'Elimina punto';
          del.addEventListener('click', () => editor.deleteSelected());
          box.appendChild(del);
        }
      }
    }
    // Copia per gli sviluppatori
    const row = document.createElement('div');
    row.className = 'copyrow';
    const sel = document.createElement('select');
    sel.className = 'select';
    sel.title = 'Formato da copiare';
    const formats = C.isSimple(c)
      ? [['css', 'CSS'], ['lottie', 'Lottie'], ['swiftui', 'SwiftUI'], ['android', 'Android'], ['json', 'JSON']]
      : [['css', 'CSS linear()'], ['json', 'JSON']];
    formats.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o); });
    try { sel.value = localStorage.getItem('inflect.copyfmt') || 'css'; } catch (e) {}
    if (!sel.value) sel.value = 'css';
    const btn = document.createElement('button');
    btn.className = 'btn ghost';
    btn.textContent = 'Copia codice';
    btn.addEventListener('click', () => {
      try { localStorage.setItem('inflect.copyfmt', sel.value); } catch (e) {}
      const out = C.exportsFor(S.curve, durationMs())[sel.value];
      copyText(out);
      toast(`Copiato: ${sel.options[sel.selectedIndex].textContent}`);
    });
    row.append(sel, btn);
    box.appendChild(row);
  }

  /* ============================================= spaziatura e anteprima == */

  const durationMs = () => C.clamp(parseFloat($('#durMs').value) || 600, 50, 10000);
  const fps = () => C.clamp(parseFloat($('#fps').value) || 25, 1, 120);

  function drawSpacing() {
    const svg = $('#spacingSvg');
    const w = svg.getBoundingClientRect().width || 300, h = svg.getBoundingClientRect().height || 18;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const [lo, hi] = C.range(S.curve);
    const pad = 6;
    const X = (v) => pad + ((v - lo) / (hi - lo || 1)) * (w - pad * 2);
    const frames = Math.max(1, Math.round((durationMs() / 1000) * fps()));
    let out = `<line class="track" x1="${X(0)}" x2="${X(1)}" y1="${h / 2}" y2="${h / 2}"/>`;
    for (let f = 0; f <= frames; f++) {
      const v = C.evaluate(S.curve, f / frames);
      const over = v > 1.0005 || v < -0.0005;
      out += `<circle class="tick${over ? ' over' : ''}" cx="${X(v).toFixed(1)}" cy="${h / 2}" r="${f === 0 || f === frames ? 2.6 : 1.9}"/>`;
    }
    out += `<circle class="ball" id="ball" cx="${X(0)}" cy="${h / 2}" r="5" opacity="0"/>`;
    svg.innerHTML = out;
    svg.title = `${frames} frame`;
    const fc = $('#frameCount'); if (fc) fc.textContent = `${frames + 1} fotogrammi`;
  }
  new ResizeObserver(drawSpacing).observe($('#spacing'));
  $('#durMs').addEventListener('input', drawSpacing);
  $('#fps').addEventListener('input', drawSpacing);

  let playing = null;
  function play() {
    if (playing) { cancelAnimationFrame(playing); playing = null; editor.setPlayhead(null); return; }
    const svg = $('#spacingSvg');
    const start = performance.now();
    const loop = (now) => {
      const d = durationMs();
      const cycle = d + 400;
      const k = ((now - start) % cycle);
      const t = Math.min(1, k / d);
      const w = svg.getBoundingClientRect().width;
      const [lo, hi] = C.range(S.curve);
      const v = C.evaluate(S.curve, t);
      const ball = $('#ball');
      if (ball) { ball.setAttribute('cx', 6 + ((v - lo) / (hi - lo || 1)) * (w - 12)); ball.setAttribute('opacity', 1); }
      editor.setPlayhead(t);
      playing = requestAnimationFrame(loop);
    };
    playing = requestAnimationFrame(loop);
  }

  /* ========================================================== generatori == */

  const GEN_UI = {
    over: [
      ['overshoot', 'Quanto supera', 0.02, 0.6, 0.01, (v) => Math.round(v * 100) + '%'],
      ['attack', 'Arrivo', 0.5, 3, 0.05, (v) => (v < 1.2 ? 'rapido' : v < 2 ? 'medio' : 'lento')],
      ['launch', 'Partenza', 0, 1, 0.05, (v) => (v < 0.34 ? 'morbida' : v < 0.67 ? 'media' : 'scattante')],
    ],
    spring: [
      ['overshoot', 'Overshoot', 0.02, 0.8, 0.01, (v) => Math.round(v * 100) + '%'],
      ['cycles', 'Oscillazioni', 1, 8, 1, (v) => v],
      ['attack', 'Primo tratto', 0.5, 3, 0.05, (v) => '×' + C.round(v, 2)],
      ['launch', 'Partenza', 0, 1, 0.05, (v) => (v < 0.34 ? 'morbida' : v < 0.67 ? 'media' : 'scattante')],
    ],
    bounce: [
      ['bounces', 'Rimbalzi', 1, 6, 1, (v) => v],
      ['elasticity', 'Elasticità', 0.15, 0.8, 0.01, (v) => Math.round(v * 100) + '%'],
    ],
    antic: [
      ['anticipation', 'Anticipo', 0, 0.5, 0.01, (v) => Math.round(v * 100) + '%'],
      ['windup', 'Durata anticipo', 0.1, 0.6, 0.01, (v) => Math.round(v * 100) + '%'],
      ['overshoot', 'Overshoot', 0, 0.5, 0.01, (v) => Math.round(v * 100) + '%'],
    ],
  };

  function generate(live = true) {
    const p = S.genParams[S.gen];
    const c = S.gen === 'over' ? C.genSpring({ overshoot: p.overshoot, cycles: 1, attack: p.attack, launch: p.launch })
      : S.gen === 'spring' ? C.genSpring(p) : S.gen === 'bounce' ? C.genBounce(p) : C.genAnticipate(p);
    c.name = { over: 'Overshoot', spring: 'Elastico', bounce: 'Rimbalzo', antic: 'Anticipo' }[S.gen];
    if (live) {
      S.curve.points = c.points;
      S.curve.name = c.name;
      S.source = null;
      editor.setCurve(S.curve, false);
      refreshCurveUI();
      liveApply();
    }
    return c;
  }

  function renderGen() {
    const body = $('#genBody');
    body.textContent = '';
    const p = S.genParams[S.gen];
    GEN_UI[S.gen].forEach(([key, label, min, max, step, show]) => {
      const l = document.createElement('label');
      l.textContent = label;
      const r = document.createElement('input');
      Object.assign(r, { type: 'range', min, max, step, value: p[key] });
      const o = document.createElement('output');
      o.textContent = show(p[key]);
      r.addEventListener('input', () => { p[key] = parseFloat(r.value); o.textContent = show(p[key]); generate(true); });
      r.addEventListener('change', () => pushHistory());
      body.append(l, r, o);
    });
  }
  $$('.gen-tabs .chip').forEach((b) => b.addEventListener('click', () => {
    $$('.gen-tabs .chip').forEach((x) => x.classList.toggle('is-on', x === b));
    S.gen = b.dataset.gen;
    renderGen();
    generate(true);
    pushHistory();
  }));
  $('#gens').addEventListener('toggle', (e) => { if (e.target.open) renderGen(); });

  /* ============================================================ libreria == */

  const LIB_LABEL = { brand: 'brand', project: 'progetto', user: 'mie curve' };
  const fmtN = (v) => (+v).toFixed(2).replace('.', ',');
  function libFor(name) { return name === 'brand' ? S.brand : name === 'project' ? S.project : name === 'user' ? S.user : { curves: S.presets }; }

  function matches(c) {
    if (!S.search) return true;
    const q = S.search.toLowerCase();
    return (c.name + ' ' + (c.group || '') + ' ' + (c.notes || '')).toLowerCase().includes(q);
  }

  function renderLibrary() {
    const brandTitle = $('#brandTitle');
    brandTitle.textContent = 'Team';
    if (S.brand.locked) {
      const s = document.createElement('span');
      s.className = 'lock';
      s.textContent = 'bloccata';
      brandTitle.appendChild(s);
    }
    const sh = S.shared;
    $('#brandSub').textContent = !sh ? ''
      : sh.isDefault ? 'Solo su questo computer: scegli una cartella dal menu'
      : `Cartella ${sh.folderName}`;
    $('#brandSub').dataset.tip = sh ? (sh.isDefault ? 'Scegli una cartella condivisa dal menu per usarla con il team. ' : '') + sh.folder : '';
    $('#projectSub').textContent = S.projectName || '';
    $('#projectSub').dataset.tip = 'Curve salvate dentro il file di progetto: viaggiano con il .aep';

    const cnt = (id, n) => { const el = $(id); if (el) el.textContent = n ? String(n) : ''; };
    cnt('#cntBrand', S.brand.curves.length); cnt('#cntUser', S.user.curves.length); cnt('#cntProject', S.project.curves.length); cnt('#cntPreset', S.presets.length);
    renderList($('#listBrand'), 'brand', S.brand.curves,
      `Vuota. <button data-act="save-brand">Aggiungi la curva attuale</button> per condividerla con il team.`);
    renderList($('#listProject'), 'project', S.project.curves,
      'Vuota. Le curve salvate qui viaggiano con il file .aep.');
    renderList($('#listUser'), 'user', S.user.curves, 'Vuota. Premi Salva per tenere una curva in tutti i progetti.');
    renderList($('#listPreset'), 'preset', S.presets, '');
  }

  function renderList(box, lib, curves, emptyHtml) {
    box.textContent = '';
    const list = curves.filter(matches);
    if (!list.length) {
      if (emptyHtml && !S.search) { const e = document.createElement('div'); e.className = 'empty'; e.innerHTML = emptyHtml; box.appendChild(e); }
      else if (S.search) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Nessun risultato.'; box.appendChild(e); }
      return;
    }
    let group = null;
    const grouped = list.slice().sort((a, b) => (a.group || '').localeCompare(b.group || ''));
    (lib === 'preset' ? list : grouped).forEach((c) => {
      if ((c.group || '') !== group) {
        group = c.group || '';
        if (group) { const g = document.createElement('div'); g.className = 'group-label'; g.textContent = group; box.appendChild(g); }
      }
      const it = document.createElement('div');
      it.className = 'item' + (S.source && S.source.lib === lib && S.source.id === c.id ? ' is-active' : '');
      it.tabIndex = 0;
      it.title = (c.notes ? c.notes + '\n' : '') + 'Clic per modificare, doppio clic per applicare';
      const active = S.source && S.source.lib === lib && S.source.id === c.id;
      it.appendChild(thumb(c, 32, 20));
      const txt = document.createElement('div');
      txt.className = 'itxt';
      const cb = C.toCubic(c);
      txt.innerHTML = `<span class="nm"></span><span class="meta"></span>`;
      txt.querySelector('.nm').textContent = c.name;
      const meta = txt.querySelector('.meta');
      if (cb) cb.forEach((v) => { const x = document.createElement('i'); x.textContent = fmtN(v); meta.appendChild(x); }); else meta.textContent = `${c.points.length} punti`;
      it.appendChild(txt);
      if (lib !== 'preset') {
        const more = document.createElement('button');
        more.className = 'ibtn more';
        more.title = 'Altre azioni';
        more.innerHTML = '<svg viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12.5" cy="8" r="1.2"/></svg>';
        more.addEventListener('click', (e) => { e.stopPropagation(); itemMenu(e.currentTarget, lib, c); });
        it.appendChild(more);
      } else {
        it.appendChild(document.createElement('span'));
      }
      if (active) {
        // La curva aperta si allarga: grafico grande, poi Apri in Curve e Applica.
        it.classList.add('is-open');
        const big = document.createElement('div');
        big.className = 'itembig';
        big.appendChild(thumb(c, 300, 56));
        const acts = document.createElement('div');
        acts.className = 'itemacts';
        acts.innerHTML = '<span class="faint">Doppio clic o <span class="kc">↵</span> applica</span><span class="grow"></span><button class="btn sm" data-lib-open>Apri in Curve</button><button class="btn sm primary" data-lib-apply>Applica</button>';
        acts.querySelector('[data-lib-open]').addEventListener('click', (e) => { e.stopPropagation(); showView('curve'); });
        acts.querySelector('[data-lib-apply]').addEventListener('click', (e) => { e.stopPropagation(); apply(); });
        it.append(big, acts);
      }
      it.addEventListener('click', () => { if (active) return; setCurve(c, { lib, id: c.id }); });
      it.addEventListener('dblclick', () => { setCurve(c, { lib, id: c.id }); apply(); });
      it.addEventListener('keydown', (e) => { if (e.key === 'Enter') { setCurve(c, { lib, id: c.id }); apply(); } });
      it.addEventListener('contextmenu', (e) => { e.preventDefault(); if (lib !== 'preset') itemMenu(it, lib, c, e); });
      box.appendChild(it);
    });
  }

  $('#search').addEventListener('input', (e) => { S.search = e.target.value.trim(); renderLibrary(); });

  /* --- caricamento ---------------------------------------------------- */

  async function loadShared() {
    const list = await call('inflect_sharedList');
    if (!list.ok) { toast(list.error, 'err'); return; }
    S.shared = list;
    const res = await call('inflect_sharedLoad', list.active);
    if (res.ok) {
      S.brand = C.validateLibrary(res.library) || C.emptyLibrary('Brand');
      S.brandModified = res.modified;
    } else toast(res.error, 'err');
    renderLibrary();
  }

  async function loadProject() {
    const p = await call('inflect_loadProject');
    S.project = (p.ok && C.validateLibrary(p.library)) || C.emptyLibrary('Progetto');
    renderLibrary();
  }

  async function loadUser() {
    const u = await call('inflect_loadUser');
    S.user = (u.ok && C.validateLibrary(u.library)) || C.emptyLibrary('Le mie curve');
    renderLibrary();
  }

  /*
   * Ogni modifica rilegge la libreria dal disco, applica il cambiamento e la riscrive.
   * Così se un collega ha aggiunto una curva nella cartella condivisa un minuto fa,
   * la sua modifica non viene sovrascritta.
   */
  async function mutate(name, fn) {
    if (name === 'brand') {
      let ok = true;
      const done = await mutateTeam((T) => {
        const L = C.validateLibrary({ curves: T.curves }) || C.emptyLibrary('Team');
        if (fn(L) === false) { ok = false; return false; }
        T.curves = L.curves;
      });
      return ok && done;
    }
    let fresh = null;
    if (name === 'brand') {
      const r = await call('inflect_sharedLoad', S.shared.active);
      if (!r.ok) { toast(r.error, 'err'); return false; }
      fresh = C.validateLibrary(r.library) || C.emptyLibrary('Brand');
    } else if (name === 'project') {
      const r = await call('inflect_loadProject');
      fresh = (r.ok && C.validateLibrary(r.library)) || C.emptyLibrary('Progetto');
    } else {
      const r = await call('inflect_loadUser');
      fresh = (r.ok && C.validateLibrary(r.library)) || C.emptyLibrary('Le mie curve');
    }
    if (name === 'brand' && fresh.locked && !fn.allowLocked) {
      S.brand = fresh; renderLibrary();
      toast('La libreria brand è bloccata. Sbloccala dal menu della sezione.', 'err');
      return false;
    }
    if (fn(fresh) === false) return false;
    fresh.updated = Date.now();
    let res;
    if (name === 'brand') {
      res = await call('inflect_sharedSave', S.shared.active, fresh);
      if (res.ok) { S.brand = fresh; S.brandModified = res.modified; }
    } else if (name === 'project') {
      res = await call('inflect_saveProject', fresh);
      if (res.ok) S.project = fresh;
    } else {
      res = await call('inflect_saveUser', fresh);
      if (res.ok) S.user = fresh;
    }
    if (!res.ok) toast(res.error, 'err');
    renderLibrary();
    return res.ok;
  }

  function upsert(lib, curve) {
    const i = lib.curves.findIndex((c) => c.id === curve.id);
    if (i >= 0) lib.curves[i] = curve; else lib.curves.push(curve);
  }

  /* --------------------------------------------------------- salvataggio -- */

  function openSheet(title, fields, confirmLabel, onOk) {
    const m = $('#modal');
    m.innerHTML = '';
    const sh = document.createElement('form');
    sh.className = 'sheet';
    sh.innerHTML = `<h3></h3>`;
    sh.querySelector('h3').textContent = title;
    const inputs = {};
    fields.forEach((f) => {
      const l = document.createElement('label');
      l.textContent = f.label;
      const inp = document.createElement(f.multiline ? 'textarea' : 'input');
      inp.value = f.value || '';
      if (f.placeholder) inp.placeholder = f.placeholder;
      if (f.list) {
        const id = 'dl_' + f.key;
        inp.setAttribute('list', id);
        const dl = document.createElement('datalist');
        dl.id = id;
        f.list.forEach((o) => { const op = document.createElement('option'); op.value = o; dl.appendChild(op); });
        l.appendChild(dl);
      }
      inputs[f.key] = inp;
      l.appendChild(inp);
      sh.appendChild(l);
    });
    const act = document.createElement('div');
    act.className = 'actions';
    act.innerHTML = `<button type="button" class="btn ghost">Annulla</button><button type="submit" class="btn primary"></button>`;
    act.lastChild.textContent = confirmLabel;
    act.firstChild.addEventListener('click', closeSheet);
    sh.appendChild(act);
    sh.addEventListener('submit', (e) => {
      e.preventDefault();
      const vals = {};
      for (const k in inputs) vals[k] = inputs[k].value.trim();
      closeSheet();
      onOk(vals);
    });
    m.appendChild(sh);
    m.hidden = false;
    setTimeout(() => { const first = sh.querySelector('input, textarea'); if (first) { first.focus(); first.select(); } }, 0);
  }
  function closeSheet() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeSheet(); });

  const BRAND_GROUPS = ['Entrata', 'Uscita', 'Enfasi', 'Transizione', 'Micro-interazione', 'Dati e grafici'];

  function saveTo(libName) {
    if (libName === 'brand' && S.brand.locked) return toast('La libreria brand è bloccata. Sbloccala dal menu della sezione.', 'err');
    const lib = libFor(libName);
    const existing = S.source && S.source.lib === libName ? lib.curves.find((c) => c.id === S.source.id) : null;
    openSheet(
      libName === 'brand' ? 'Salva nel team' : 'Salva nelle mie curve',
      [
        { key: 'name', label: 'Nome', value: S.curve.name === 'Nuova curva' ? '' : S.curve.name, placeholder: 'Es. Entrata decisa' },
        { key: 'group', label: 'Categoria', value: S.curve.group || '', list: BRAND_GROUPS, placeholder: 'Entrata, Uscita, Enfasi…' },
        { key: 'notes', label: 'Quando usarla', value: S.curve.notes || '', multiline: true, placeholder: 'Es. Titoli e card che entrano in scena' },
      ],
      existing ? 'Aggiorna' : 'Salva',
      async (v) => {
        const c = C.clone(S.curve);
        c.name = v.name || 'Senza nome';
        c.group = v.group;
        c.notes = v.notes;
        c.updated = Date.now();
        c.id = existing ? existing.id : C.uid();
        const ok = await mutate(libName, (L) => upsert(L, c));
        if (!ok) return;
        S.curve.name = c.name; S.curve.group = c.group; S.curve.notes = c.notes;
        S.source = { lib: libName, id: c.id };
        toast(libName === 'brand' ? `${c.name} è in ${S.brand.name}.` : `${c.name} salvata.`, libName === 'brand' ? 'brand' : '');
        refreshCurveUI();
      });
  }

  /* ---------------------------------------------------------------- menu -- */

  function openMenu(anchor, items, ev) {
    const m = $('#menu');
    m.innerHTML = '';
    items.forEach((it) => {
      if (it === '-') { m.appendChild(document.createElement('hr')); return; }
      const b = document.createElement('button');
      b.textContent = it.label;
      if (it.danger) b.className = 'danger';
      b.addEventListener('click', () => { closeMenu(); it.run(); });
      m.appendChild(b);
    });
    m.hidden = false;
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let x = ev ? ev.clientX : r.right - mw, y = ev ? ev.clientY : r.bottom + 4;
    x = C.clamp(x, 6, innerWidth - mw - 6);
    if (y + mh > innerHeight - 6) y = Math.max(6, (ev ? ev.clientY : r.top) - mh - 4);
    m.style.left = x + 'px';
    m.style.top = y + 'px';
  }
  function closeMenu() { $('#menu').hidden = true; }
  // Clic fuori, scroll o pannello che perde il focus: il menu si chiude come in After Effects.
  const outsideMenu = (e) => { if (!$('#menu').hidden && !$('#menu').contains(e.target)) closeMenu(); };
  document.addEventListener('mousedown', outsideMenu, true);
  document.addEventListener('wheel', outsideMenu, true);
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);

  function itemMenu(anchor, lib, c, ev) {
    const targets = ['brand', 'project', 'user'].filter((x) => x !== lib);
    const copyLabel = { brand: 'Copia nel team', project: 'Copia nel progetto', user: 'Copia nelle mie curve' };
    openMenu(anchor, [
      { label: 'Applica', run: () => { setCurve(c, { lib, id: c.id }); apply(); } },
      { label: 'Modifica dettagli', run: () => { setCurve(c, { lib, id: c.id }); saveTo(lib); } },
      { label: 'Sostituisci con la curva attuale', run: async () => {
        const n = C.clone(S.curve); n.id = c.id; n.name = c.name; n.group = c.group; n.notes = c.notes; n.updated = Date.now();
        if (await mutate(lib, (L) => upsert(L, n))) { S.source = { lib, id: c.id }; toast(`${c.name} aggiornata.`); }
      } },
      { label: 'Duplica', run: async () => {
        const n = C.clone(c); n.id = C.uid(); n.name = c.name + ' copia';
        await mutate(lib, (L) => { const i = L.curves.findIndex((x) => x.id === c.id); L.curves.splice(i + 1, 0, n); });
      } },
      '-',
      ...targets.map((t) => ({ label: copyLabel[t], run: async () => {
        // Stesso ID: se la curva esiste già nella destinazione viene aggiornata, non duplicata.
        if (await mutate(t, (L) => upsert(L, C.clone(c)))) toast(`${c.name} copiata.`);
      } })),
      '-',
      { label: 'Elimina', danger: true, run: async () => {
        if (await mutate(lib, (L) => { L.curves = L.curves.filter((x) => x.id !== c.id); })) toast(`${c.name} eliminata.`);
      } },
    ], ev);
  }

  function brandMenu(anchor) {
    const sh = S.shared || { libraries: [] };
    const items = [];
    if (sh.libraries.length > 1) {
      sh.libraries.forEach((l) => items.push({
        label: (l.file === sh.active ? '✓ ' : '  ') + `${l.name} (${l.count})`,
        run: async () => { await call('inflect_sharedSetActive', l.file); await loadShared(); toast(`Libreria attiva: ${l.name}.`, 'brand'); },
      }));
      items.push('-');
    }
    items.push({ label: 'Nuova libreria…', run: () => openSheet('Nuova libreria brand', [
      { key: 'name', label: 'Nome del brand o del cliente', value: '', placeholder: 'Es. Inter, Barilla, Studio' },
    ], 'Crea', async (v) => {
      const r = await call('inflect_sharedCreate', v.name || 'Brand');
      if (!r.ok) return toast(r.error, 'err');
      await loadShared();
      toast(`${v.name || 'Brand'} creata.`, 'brand');
    }) });
    items.push({ label: 'Rinomina libreria', run: () => openSheet('Libreria brand', [
      { key: 'name', label: 'Nome del brand', value: S.brand.name },
      { key: 'owner', label: 'Responsabile', value: S.brand.owner || '', placeholder: 'Chi approva le modifiche' },
    ], 'Salva', async (v) => {
      await mutate('brand', (L) => { L.name = v.name || 'Brand'; L.owner = v.owner; });
      await loadShared();
    }) });
    const toggleLock = async (L) => { L.locked = !L.locked; };
    toggleLock.allowLocked = true;
    items.push({ label: S.brand.locked ? 'Sblocca modifiche' : 'Blocca modifiche', run: async () => {
      if (await mutate('brand', toggleLock)) toast(S.brand.locked ? 'Libreria bloccata per tutto il team.' : 'Libreria sbloccata.', 'brand');
    } });
    items.push('-');
    items.push({ label: sh.isDefault ? 'Usa una cartella condivisa…' : 'Cambia cartella condivisa…', run: async () => {
      const r = await call('inflect_sharedChooseFolder');
      if (!r.ok) return toast(r.error, 'err');
      if (r.cancelled) return;
      await loadShared();
      toast(`Ora le curve brand si leggono da ${S.shared.folderName}.`, 'brand');
    } });
    if (!sh.isDefault) items.push({ label: 'Torna alla cartella del plugin', run: async () => { await call('inflect_sharedResetFolder'); await loadShared(); } });
    items.push({ label: 'Mostra la cartella', run: () => call('inflect_revealShared') });
    items.push('-');
    items.push({ label: 'Copia tutte nel progetto', run: async () => {
      const all = S.brand.curves.map(C.clone);
      if (await mutate('project', (L) => all.forEach((c) => upsert(L, c)))) toast(`${all.length} curve copiate nel progetto.`);
    } });
    items.push({ label: 'Esporta file…', run: () => exportLib('brand') });
    items.push({ label: 'Importa file…', run: () => importInto('brand') });
    openMenu(anchor, items);
  }

  function simpleMenu(anchor, lib) {
    const items = [
      { label: 'Esporta file…', run: () => exportLib(lib) },
      { label: 'Importa file…', run: () => importInto(lib) },
    ];
    openMenu(anchor, items);
  }

  async function exportLib(lib) {
    const L = libFor(lib);
    const res = await call('inflect_exportFile', L, (L.name || 'curve').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    if (res.ok && !res.cancelled) toast('Esportato in ' + res.path);
    else if (!res.ok) toast(res.error, 'err');
  }

  async function importInto(lib) {
    const res = await call('inflect_importFile');
    if (!res.ok) return toast(res.error, 'err');
    if (res.cancelled) return;
    const inc = C.validateLibrary(res.library);
    if (!inc) return toast('Il file non contiene curve.', 'err');
    let added = 0, updated = 0;
    const ok = await mutate(lib, (L) => {
      inc.curves.forEach((c) => { if (L.curves.some((x) => x.id === c.id)) updated++; else added++; upsert(L, c); });
      if (lib === 'brand' && inc.name && (!L.curves.length || L.name === 'Brand')) L.name = inc.name;
    });
    if (ok) toast(`${added} curve aggiunte, ${updated} aggiornate.`, lib === 'brand' ? 'brand' : '');
  }

  /* ============================================================ azioni == */

  /*
   * Dal vivo: con il fulmine acceso, ogni modifica della curva (trascinamento, campi, generatori) va subito
   * sui keyframe selezionati. Una sola richiesta per volta: quelle che arrivano nel frattempo si fondono
   * nell'ultima. Tutto il gesto conta come un passo solo per Cmd+Z dal pannello.
   */
  S.live = (() => { try { return localStorage.getItem('mt.live') === '1'; } catch (e) { return false; } })();
  let liveBusy = false, livePending = false;
  function setLive(on, quiet) {
    S.live = !!on;
    try { localStorage.setItem('mt.live', S.live ? '1' : '0'); } catch (e) {}
    const b = $('[data-act="live"]');
    if (b) { b.classList.toggle('is-on', S.live); b.setAttribute('aria-pressed', S.live); b.setAttribute('aria-checked', S.live); }
    if (S.live && !quiet) { toast(S.ae && S.ae.pairs > 0 ? 'Dal vivo: la curva va subito sui keyframe selezionati.' : 'Dal vivo acceso: seleziona dei keyframe e modifica la curva.'); liveApply(); }
  }
  setTimeout(() => setLive(S.live, true), 0);
  async function liveApply() {
    if (!S.live || !S.ae || !(S.ae.pairs > 0) || currentView() !== 'curve') return;
    if (liveBusy) { livePending = true; return; }
    liveBusy = true;
    try {
      const plan = C.toAEPlan(S.curve, S.mode, S.snapFrames);
      plan.live = true;
      lastApplyAt = Date.now();
      const res = await call('inflect_apply', plan);
      lastApplyAt = Date.now();
      if (res.ok) { noteStep('live-curve'); resetSpeedUI(); }
      else if (!livePending) toast(res.error, 'err');
    } finally {
      liveBusy = false;
      if (livePending) { livePending = false; liveApply(); }
    }
  }

  async function apply(curve) {
    const cv = curve || S.curve;
    const plan = C.toAEPlan(cv, S.mode, S.snapFrames);
    lastApplyAt = Date.now();
    const res = await call('inflect_apply', plan);
    lastApplyAt = Date.now();
    if (!res.ok) { toast(res.error, 'err'); return false; }
    const n = res.segments;
    let msg = `${cv.name} applicata a ${n} ${n === 1 ? 'segmento' : 'segmenti'}.`;
    if (res.notes && res.notes.length) msg += ' ' + res.notes[0];
    // Controllo fatto con i valori calcolati da After Effects dopo l'applicazione.
    const chk = res.check || [];
    const fixed = chk.reduce((n, c) => n + (c.fixed || 0), 0);
    const bad = chk.filter((c) => c.worst > 3).sort((x, y) => y.worst - x.worst)[0];
    if (fixed) msg += ` ${fixed} keyframe ${fixed === 1 ? 'intermedio aveva' : 'intermedi avevano'} un valore sbagliato: ${fixed === 1 ? '\u00e8 stato rimesso' : 'sono stati rimessi'} come nella curva.`;
    if (bad) {
      toast(`${msg} Attenzione: su ${bad.prop}${bad.spatial ? ' (percorso)' : ''} la curva in After Effects si scosta del ${bad.worst}% al ${bad.at}% della durata. Clicca per copiare i dettagli e incollali in chat.`, 'err', JSON.stringify({ curva: cv.points, controllo: chk }));
    } else toast(msg);
    resetSpeedUI();
    poll(true);
    // Le curve brand usate vengono copiate nel progetto, così il file resta completo.
    if (false) {
      const c = S.brand.curves.find((x) => x.id === S.source.id);
      const inProject = S.project.curves.find((x) => x.id === S.source.id);
      if (c && (!inProject || !C.sameCurve(c, inProject, 1e-6) || inProject.name !== c.name)) await mutate('project', (L) => upsert(L, C.clone(c)));
    }
    return true;
  }

  /*
   * Incolla curva: un riquadro di testo dove incolli con Cmd+V e premi Importa. Gli appunti non si
   * leggono da soli (in CEP spesso non funziona). Poi scegli la libreria: se l'id c'e' gia', la curva
   * si aggiorna invece di duplicarsi, come con l'import da file.
   */
  function pasteCurves() {
    const m = $('#modal');
    m.innerHTML = '';
    const sh = h('div', { class: 'sheet sheet-wide' });
    const ta = h('textarea', { class: 'pastebox', spellcheck: 'false', placeholder: 'Incolla qui con Cmd+V' });
    const err = h('p', { class: 'paste-err', role: 'alert' });
    const go = h('button', { class: 'btn primary', type: 'button', text: 'Importa' });
    const no = h('button', { class: 'btn ghost', type: 'button', text: 'Annulla' });
    no.addEventListener('click', closeSheet);
    sh.append(
      h('h3', { text: 'Incolla curva' }),
      h('p', { class: 'hint', text: 'Una curva o una libreria in JSON (anche da Inter Motion Lab), un elenco di curve, oppure quattro numeri x1, y1, x2, y2.' }),
      ta, err, h('div', { class: 'actions' }, no, go));
    const step2 = (res) => {
      sh.textContent = '';
      const n = res.curves.length;
      const names = res.curves.slice(0, 4).map((c) => c.name).join(', ') + (n > 4 ? ` e altre ${n - 4}` : '');
      const where = async (lib, label) => {
        if (lib === 'brand' && S.brand.locked) return toast('La libreria brand è bloccata. Sbloccala dal menu della sezione.', 'err');
        closeSheet();
        let added = 0, updated = 0;
        const ok = await mutate(lib, (L) => { res.curves.forEach((c) => { if (L.curves.some((x) => x.id === c.id)) updated++; else added++; upsert(L, C.clone(c)); }); });
        if (!ok) return;
        if (n === 1) setCurve(res.curves[0], { lib, id: res.curves[0].id });
        const parts = [added ? `${added} ${added === 1 ? 'aggiunta' : 'aggiunte'}` : '', updated ? `${updated} ${updated === 1 ? 'aggiornata' : 'aggiornate'}` : ''].filter(Boolean).join(', ');
        toast(`${n === 1 ? res.curves[0].name : n + ' curve'} in ${label}: ${parts}.`, lib === 'brand' ? 'brand' : '');
      };
      const opt = (lib, label, tip) => { const b = h('button', { class: 'btn', type: 'button', text: label, 'data-tip': tip }); b.addEventListener('click', () => where(lib, label)); return b; };
      const back = h('button', { class: 'btn ghost', type: 'button', text: 'Annulla' });
      back.addEventListener('click', closeSheet);
      sh.append(
        h('h3', { text: n === 1 ? 'Curva pronta' : `${n} curve pronte` }),
        h('p', { class: 'hint', text: n === 1 ? `${names}. Dove la metto? Se c’è già una curva con lo stesso id, viene aggiornata.` : `${names}. Dove le metto? Quelle che ci sono già (stesso id) vengono aggiornate.` }),
        h('div', { class: 'paste-dest' },
          opt('user', 'Le mie curve', 'In tutti i progetti, solo su questo computer'),
          opt('brand', 'Brand', 'Libreria del team, condivisa sul NAS'),
          opt('project', 'Progetto', 'Dentro il file .aep: viaggiano con il progetto')),
        h('div', { class: 'actions' }, back));
    };
    const run = () => {
      const res = C.parseCurvesText(ta.value);
      if (res.error) { err.textContent = res.error; ta.focus(); return; }
      step2(res);
    };
    go.addEventListener('click', run);
    ta.addEventListener('input', () => { err.textContent = ''; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } });
    m.appendChild(sh);
    m.hidden = false;
    setTimeout(() => ta.focus(), 0);
  }

  /*
   * Copia e incolla la curva tra keyframe: Copia legge la curva dei keyframe selezionati (come Leggi),
   * Incolla la applica ai keyframe selezionati ora, senza toccare la curva aperta nel pannello.
   */
  let keyClip = null;
  try { keyClip = JSON.parse(localStorage.getItem('mt.keyCurve') || 'null'); } catch (e) {}
  const updKeyClip = () => { const b = $('[data-act="paste-keys"]'); if (b) { b.disabled = !keyClip; b.dataset.tip = keyClip ? `Incolla sui keyframe selezionati la curva copiata da ${keyClip.from}` : 'Prima copia la curva da altri keyframe'; } };
  async function copyKeysCurve() {
    const res = await call('inflect_read');
    if (!res.ok) return toast(res.error, 'err');
    const c = C.fromAEPoints(res.points, { name: `Copiata da ${res.property}` });
    keyClip = { from: res.property, curve: c };
    try { localStorage.setItem('mt.keyCurve', JSON.stringify(keyClip)); } catch (e) {}
    updKeyClip();
    toast(`Curva copiata da ${res.property}${c.points.length > 2 ? ` (${c.points.length} punti)` : ''}. Seleziona altri keyframe e premi Incolla.`);
  }
  async function pasteKeysCurve() {
    if (!keyClip) return toast('Prima copia la curva da altri keyframe.', 'err');
    const ok = await apply(keyClip.curve);
    // Il grafico mostra la curva dei keyframe appena incollata (prima restava quella di prima e sembrava
    // che l'incolla non avesse fatto niente).
    if (ok) { await readFromAE(true); autoReadSig = ''; }
  }
  setTimeout(updKeyClip, 0);

  async function readFromAE(quiet) {
    const res = await call('inflect_read');
    if (!res.ok) { if (!quiet) toast(res.error, 'err'); return; }
    const c = C.fromAEPoints(res.points, { name: `Da ${res.property}` });
    setCurve(c, null);
    if (!quiet) toast(`Curva letta da ${res.property}${res.points.length > 2 ? `, ${res.points.length} keyframe` : ''}.`);
    else $('#selinfo').dataset.tip = `Curva letta in automatico da ${res.property}`;
  }
  /*
   * Lettura automatica: nella scheda Curve, quando selezioni altri keyframe in After Effects, il pannello
   * legge la loro curva. Non subito dopo un'applicazione dal pannello (la selezione cambia da sola) e non
   * mentre stai modificando la curva nel grafico.
   */
  let lastApplyAt = 0, autoReadSig = '';
  function autoRead(st) {
    if (currentView() !== 'curve' || !st || !st.sig || st.keys < 2) return;
    if (st.sig === autoReadSig) return;
    autoReadSig = st.sig;
    // Solo un segmento per proprieta' (due keyframe vicini): con piu' keyframe la lettura diventava una
    // curva multi punto, che applicata poi aggiungeva keyframe in ogni segmento.
    if (!(st.pairs === st.props && st.keys === 2 * st.props)) return;
    if (Date.now() - lastApplyAt < 2500) return;
    if (editor && editor.drag) return;
    readFromAE(true);
  }

  /* ============================================================= analisi == */

  let AN = null, anBusy = false, anComp = '';
  const fmtTime = (t, fps) => {
    const f = Math.round(t * fps), sec = Math.floor(f / fps), fr = f - sec * fps;
    return `0:${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  };

  // Sposta gli elementi della comp attiva dalla cartella vecchia alla nuova, così la vecchia si può eliminare.
  async function consolida() {
    const o = ($('#consOld').value || '').trim(), n = ($('#consNew').value || '').trim();
    if (!o || !n) return toast('Scrivi il nome delle due cartelle.', 'err');
    const r = await call('inflect_consolidate', o, n);
    if (!r.ok) return toast(r.error, 'err');
    if (!r.moved) return toast(`Nessun elemento da spostare: la comp non usa elementi in ${o}.`);
    toast(`Spostati ${r.moved} elementi in ${n}.${r.skipped && r.skipped.length ? ` Non spostati: ${r.skipped.length}.` : ''}`);
  }

  async function analyze() {
    if (anBusy) return;
    anBusy = true;
    $('#anMeta').textContent = 'Analisi in corso…';
    const res = await call('inflect_analyze');
    anBusy = false;
    if (!res.ok) { $('#anMeta').textContent = ''; $('#app').classList.add('an-none'); return toast(res.error, 'err'); }
    AN = res; anComp = res.comp;
    $('#app').classList.remove('an-none');
    renderAnalysis();
    drawNoteRhythm();
  }

  function seek(t) {
    call('inflect_setTime', t);
    if (AN) { AN.time = t; drawChart(); drawNoteRhythm(); }
  }

  function drawChart(hoverX) { drawRhythm($('#anSvg'), hoverX, null); }
  /*
   * Ritmo della comp: barre = keyframe, linea = movimento. Lo stesso disegno serve alla scheda Analisi
   * e alla scheda Note, dove sopra ci vanno anche i marcatori collegati e le note.
   */
  function drawRhythm(svg, hoverX, extra) {
    if (!AN || !svg || !svg.isConnected || !svg.clientWidth) return;
    const W = Math.max(200, svg.clientWidth || 600), H = extra ? 132 : 150, pad = { l: 6, r: 6, t: extra ? 18 : 10, b: extra ? 34 : 18 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, n = AN.bins;
    const kmax = Math.max(1, ...AN.keys), mmax = Math.max(1e-6, ...AN.motion);
    const x = (b) => pad.l + (b / n) * iw, y0 = pad.t + ih;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.textContent = '';
    // Griglia a secondi, con etichette diradate secondo lo spazio disponibile.
    const secs = Math.max(1e-6, AN.duration), every = [1, 2, 5, 10, 15, 30, 60].find((s) => (iw / secs) * s >= 46) || 60;
    for (let t = 0; t <= secs + 1e-6; t += every) {
      const gx = pad.l + (t / secs) * iw;
      svg.append(el('line', { class: 'grid', x1: gx, x2: gx, y1: pad.t, y2: y0 }));
      const lb = el('text', { class: 'tlabel', x: Math.min(W - 18, gx + 3), y: H - 5 });
      lb.textContent = `${t}s`;
      svg.append(lb);
    }
    // Keyframe: barre grigie.
    const bw = Math.max(1, iw / n - (iw / n > 3 ? 1 : 0));
    AN.keys.forEach((k, b) => {
      if (!k) return;
      const hgt = Math.max(1.5, (k / kmax) * ih * 0.9);
      svg.append(el('rect', { class: 'kbar', x: x(b), y: y0 - hgt, width: bw, height: hgt }));
    });
    // Movimento: area sopra le barre.
    let d = '', dl = '';
    AN.motion.forEach((m, b) => {
      const px = x(b + 0.5), py = y0 - (m / mmax) * ih;
      d += (b ? 'L' : `M${x(0)},${y0}L`) + `${px.toFixed(1)},${py.toFixed(1)}`;
      dl += (b ? 'L' : 'M') + `${px.toFixed(1)},${py.toFixed(1)}`;
    });
    d += `L${x(n)},${y0}Z`;
    svg.append(el('path', { class: 'marea', d }), el('path', { class: 'mline', d: dl }));
    if (!extra) (AN.peaks || []).forEach((pk) => {
      svg.append(el('circle', { class: 'peak', cx: x(pk.bin + 0.5), cy: y0 - (pk.motion / mmax) * ih, r: 2.5 }));
    });
    const nx = pad.l + (AN.time / secs) * iw;
    svg.append(el('line', { class: 'now', x1: nx, x2: nx, y1: pad.t - 6, y2: y0 }));
    if (hoverX != null) svg.append(el('line', { class: 'hover', x1: hoverX, x2: hoverX, y1: pad.t, y2: y0 }));
    if (extra) {
      const tx = (t) => pad.l + (C.clamp(t / secs, 0, 1)) * iw;
      (extra.markers || []).forEach((m) => {
        const mx = tx(m.time);
        svg.append(el('line', { class: 'mark', x1: mx, x2: mx, y1: 4, y2: y0 }));
        const lb = el('text', { class: 'mlabel', x: Math.min(W - 40, mx + 4), y: 12 });
        lb.textContent = m.text || '';
        svg.append(lb);
      });
      (extra.notes || []).forEach((nt) => {
        svg.append(el('circle', { class: 'ndot' + (nt.done ? ' done' : ''), cx: tx(nt.time), cy: y0 + 10, r: 4 }));
      });
    }
    svg._geo = { W, pad, iw, n };
  }
  // Ritmo nella scheda Note: marcatori collegati (se la comp aperta e' la principale) e note della comp.
  function drawNoteRhythm(hoverX) {
    const svg = $('#ntSvg');
    if (!svg) return;
    const I = SY.info || {};
    const markers = I.main && I.active && I.main.id === I.active.id ? (I.masters || []) : [];
    const notes = (NT.list || []).filter((x) => NT.scope !== 'project' || x.compId === NT.compId).filter((x) => NT.showDone || !x.done);
    $('#app').classList.toggle('nt-norhythm', !AN);
    drawRhythm(svg, hoverX, { markers, notes });
  }
  (function noteChartEvents() {
    const svg = $('#ntSvg');
    if (!svg) return;
    const f = (e) => { const r = svg.getBoundingClientRect(), g = svg._geo; if (!g || !AN) return null; const vx = ((e.clientX - r.left) / r.width) * g.W; return { vx, f: C.clamp((vx - g.pad.l) / g.iw, 0, 1) }; };
    let drag = false, last = 0;
    svg.addEventListener('mousedown', (e) => { const p = f(e); if (!p) return; drag = true; seek(p.f * AN.duration); drawNoteRhythm(); });
    window.addEventListener('mouseup', () => { drag = false; });
    svg.addEventListener('mousemove', (e) => { const p = f(e); if (!p) return; if (drag && Date.now() - last > 50) { last = Date.now(); seek(p.f * AN.duration); } drawNoteRhythm(p.vx); });
    svg.addEventListener('mouseleave', () => drawNoteRhythm());
    window.addEventListener('resize', () => drawNoteRhythm());
  })();

  (function chartEvents() {
    const svg = $('#anSvg'), tip = $('#anTip');
    if (!svg) return;
    const at = (e) => {
      const r = svg.getBoundingClientRect(), g = svg._geo;
      if (!g || !AN) return null;
      const vx = ((e.clientX - r.left) / r.width) * g.W;
      const f = C.clamp((vx - g.pad.l) / g.iw, 0, 1);
      return { vx, f, b: Math.min(AN.bins - 1, Math.floor(f * AN.bins)), cx: e.clientX - r.left, w: r.width };
    };
    let dragging = false, lastSeek = 0;
    svg.addEventListener('mousedown', (e) => { const p = at(e); if (!p) return; dragging = true; seek(p.f * AN.duration); });
    window.addEventListener('mouseup', () => { dragging = false; });
    svg.addEventListener('mousemove', (e) => {
      const p = at(e);
      if (!p) return;
      if (dragging && Date.now() - lastSeek > 50) { lastSeek = Date.now(); seek(p.f * AN.duration); }
      drawChart(p.vx);
      const k = AN.keys[p.b], m = AN.motion[p.b], mmax = Math.max(1e-6, ...AN.motion);
      tip.textContent = `${fmtTime(p.f * AN.duration, AN.fps)}  ·  ${k} keyframe  ·  movimento ${Math.round((m / mmax) * 100)}%`;
      tip.hidden = false;
      tip.style.left = Math.max(4, Math.min(p.w - tip.offsetWidth - 4, p.cx + 10)) + 'px';
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; drawChart(); });
    window.addEventListener('resize', () => drawChart());
  })();

  function renderAnalysis() {
    const r = AN, T = r.totals;
    $('#anComp').textContent = r.comp;
    $('#anMeta').textContent = `${C.round(r.duration, 2)} s a ${Math.round(r.fps)} fps, ${T.keys} keyframe su ${T.animated} ${T.animated === 1 ? 'layer' : 'layer'}`;
    drawChart();

    const per = r.duration > 0 ? T.keys / r.duration : 0;
    const stats = [
      [T.keys, 'keyframe'],
      [`${T.animated}/${T.layers}`, 'layer animati'],
      [C.round(per, 1), 'keyframe al secondo'],
      [T.expr, T.expr === 1 ? 'espressione' : 'espressioni'],
      [`${Math.round(r.quiet * 100)}%`, 'tempo fermo'],
    ];
    const st = $('#anStats');
    st.textContent = '';
    stats.forEach(([v, l]) => add(st, h('div', { class: 'stat' }, h('b', { text: String(v) }), h('span', { text: l }))));

    const pk = $('#anPeaks');
    pk.textContent = '';
    const mmax = Math.max(1e-6, ...r.motion);
    if (!r.peaks.length) add(pk, h('p', { class: 'hint', text: 'Nessun movimento su posizione, scala, rotazione o opacità.' }));
    r.peaks.slice().sort((a, b) => a.time - b.time).forEach((p) => {
      const bar = h('span', { class: 'barw' }, h('i'));
      bar.firstChild.style.width = Math.round((p.motion / mmax) * 100) + '%';
      const b = h('button', { class: 'li', 'data-tip': 'Sposta qui l’indicatore del tempo' },
        h('span', { class: 'tc', text: fmtTime(p.time, r.fps) }),
        h('span', { class: 'mt', text: `${p.keys} keyframe in quel punto` }), bar);
      b.addEventListener('click', () => seek(p.time));
      add(pk, b);
    });

    const ly = $('#anLayers');
    ly.textContent = '';
    const kmax = Math.max(1, ...r.layers.map((l) => l.keys));
    if (!r.layers.length) add(ly, h('p', { class: 'hint', text: 'Nessun layer ha keyframe.' }));
    r.layers.forEach((l) => {
      const bar = h('span', { class: 'barw' }, h('i'));
      bar.firstChild.style.width = Math.round((l.keys / kmax) * 100) + '%';
      const b = h('button', { class: 'li', 'data-tip': 'Seleziona il layer nella timeline' },
        h('span', { class: 'tc', text: `${l.keys} key` }),
        h('span', { text: l.name }), bar);
      b.addEventListener('click', () => call('inflect_selectLayer', l.index));
      add(ly, b);
    });

    const E = r.easing, tot = Math.max(1, E.linear + E.easy + E.custom + E.hold);
    const parts = [['Curve personalizzate', E.custom, 'var(--hot)'], ['Easy Ease', E.easy, '#8d939c'], ['Lineari', E.linear, '#5d636c'], ['Hold', E.hold, '#3f4247']];
    const ea = $('#anEase');
    ea.textContent = '';
    const bar = h('div', { class: 'easebar' });
    parts.forEach(([, n, col]) => { if (n) { const sp = h('span'); sp.style.width = (n / tot) * 100 + '%'; sp.style.background = col; bar.append(sp); } });
    add(ea, bar);
    const lg = h('div', { class: 'legend' });
    parts.forEach(([l, n, col]) => { const i = h('i'); i.style.background = col; add(lg, i, h('span', { text: l }), h('span', { text: String(n) })); });
    add(ea, lg);
    if (E.linear) add(ea, h('p', { class: 'hint', text: `${E.linear} ${E.linear === 1 ? 'passaggio è lineare' : 'passaggi sono lineari'}: spesso sono quelli che sembrano meccanici.` }));
  }

  async function selectLinear() {
    const r = await call('inflect_selectLinear');
    if (!r.ok) return toast(r.error, 'err');
    toast(r.count ? `${r.count} passaggi lineari selezionati. Applica una curva dalla scheda Curve.` : 'Nessun keyframe lineare.');
  }

  /* ============================================================== vista == */

  const isNarrow = () => innerWidth < 640;
  function showView(name) {
    const tools = ['align', 'utility', 'repeat', 'audit', 'text', 'team', 'notes'].includes(name);
    $('#app').classList.toggle('tools-view', tools);
    $('#app').classList.toggle('audit-view', name === 'audit');
    $('#app').classList.toggle('lib-view', name === 'library');
    $$('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.view === name));
    const onTab = $(`.tab[data-view="${name}"]`);
    if (onTab) requestAnimationFrame(() => { try { onTab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} });
    $$('.view').forEach((v) => v.classList.toggle('is-on', v.dataset.view === name || (!tools && !isNarrow() && v.dataset.view === 'library')));
    if (name === 'curve') requestAnimationFrame(() => { editor.render(); drawSpacing(); });
    if (name === 'utility') { rulerKey = ''; refreshRuler(); }
    if (name === 'repeat') { repShown = null; if (S.ae) renderRepeatState(S.ae.repeat); poll(true); }
    if (name === 'text') { txLastSel = ''; txPoll(true); txGallery(); txKick(); }
    if (name === 'team') { renderTeam(); }
    if (name === 'notes') { renderNoteNew(); NT.key = ''; notesRead(true); SY.key = ''; syncRead(true); if (S.ae && S.ae.comp && (!AN || anComp !== S.ae.comp)) analyze(); else requestAnimationFrame(() => drawNoteRhythm()); }
    if (name === 'align') { gRead(true); groupsKey = ''; groupsRead(true); }
    if (name === 'audit') { if (S.ae && S.ae.comp && (!AN || anComp !== S.ae.comp)) analyze(); else requestAnimationFrame(() => drawChart()); }
    if (S.ae) applyState(S.ae);
    showGroup(name);
    try {
      localStorage.setItem('mt.view', name);
      const g = ($(`.tab[data-view="${name}"]`) || {}).dataset; const m = JSON.parse(localStorage.getItem('mt.groupView') || '{}');
      if (g && g.group) { m[g.group] = name; localStorage.setItem('mt.groupView', JSON.stringify(m)); }
    } catch (e) {}
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  // Gruppi di strumenti: Anima, Disponi, Progetto. La barra mostra solo le schede del gruppo attivo.
  const GROUPS = [['anima', 'Anima', 'curve'], ['disponi', 'Disponi', 'align'], ['progetto', 'Progetto', 'audit']];
  function showGroup(view) {
    const t = $(`.tab[data-view="${view}"]`);
    const g = (t && t.dataset.group) || 'anima';
    $('.tabs').dataset.group = g;
    const gn = GROUPS.find((x) => x[0] === g);
    $$('[data-gsel]').forEach((x) => { const on = x.dataset.gsel === g; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); });
  }
  // Riga dei gruppi: un clic apre l'ultima scheda usata di quel gruppo.
  $$('[data-gsel]').forEach((g) => g.addEventListener('click', () => {
    const id = g.dataset.gsel;
    let last = {};
    try { last = JSON.parse(localStorage.getItem('mt.groupView') || '{}'); } catch (er) {}
    const first = (GROUPS.find((x) => x[0] === id) || [])[2];
    let v = last[id] || first;
    if (v === 'library' && !isNarrow()) v = 'curve';
    showView(v);
  }));
  (function tabsFit() {
    const bar = $('.tabs');
    const fit = () => {
      bar.classList.remove('compact');
      if (bar.scrollWidth > bar.clientWidth + 1) bar.classList.add('compact');
      fade();
    };
    const fade = () => {
      bar.classList.toggle('fade-l', bar.scrollLeft > 2);
      bar.classList.toggle('fade-r', bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2);
    };
    // La rotella scorre le schede in orizzontale.
    bar.addEventListener('wheel', (e) => { if (bar.scrollWidth <= bar.clientWidth) return; e.preventDefault(); bar.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX); }, { passive: false });
    bar.addEventListener('scroll', fade);
    try { new ResizeObserver(fit).observe(bar); } catch (e) { window.addEventListener('resize', fit); }
    fit();
  })();
  addEventListener('resize', () => {
    const cur = $('.tab.is-on').dataset.view;
    showView(cur === 'library' && !isNarrow() ? 'curve' : cur);
  });

  /* ------------------------------------------------------------- toast -- */
  let toastTimer = null;
  // I messaggi passano nella barra di stato in basso, come il pannello Info di After Effects.
  function copyText(s) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    };
    try { navigator.clipboard.writeText(s).catch(fallback); } catch (e) { fallback(); }
  }
  function toast(msg, kind = '', extra = '') {
    const bar = $('#status'), t = $('#toast');
    // Gli errori si copiano con un clic: il testo include la versione (e i dettagli, se ci sono), così basta incollarlo in chat.
    const full = kind === 'err' ? `Motion Tools ${window.MT_VERSION || ''} (build ${window.MT_BUILD || '?'}) · ${msg}${extra ? ' · ' + extra : ''}` : msg;
    t.textContent = msg;
    t.dataset.tip = kind === 'err' ? 'Clic per copiare l’errore' : msg;
    bar.onclick = kind === 'err' ? () => { copyText(full); t.textContent = 'Errore copiato. Incollalo in chat.'; } : null;
    bar.className = 'status msg ' + kind + (kind === 'err' ? ' is-copyable' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { bar.className = 'status'; }, kind === 'err' ? 9000 : 3500);
  }

  /* ------------------------------------------------------- pulsanti -- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    switch (act) {
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'read': readFromAE(); break;
      case 'paste-curve': pasteCurves(); break;
      case 'copy-keys': copyKeysCurve(); break;
      case 'live': setLive(!S.live); break;
      case 'paste-keys': pasteKeysCurve(); break;
      case 'smooth': C.smooth(S.curve); pushHistory(); loadIntoEditor(true); liveApply(); break;
      case 'invert': S.curve.points = C.invert(S.curve).points; pushHistory(); loadIntoEditor(false); liveApply(); break;
      case 'snap': editor.snap = !editor.snap; b.classList.toggle('is-on', editor.snap); b.setAttribute('aria-pressed', editor.snap); break;
      case 'speed': editor.showSpeed = !editor.showSpeed; b.classList.toggle('is-on', editor.showSpeed); b.setAttribute('aria-pressed', editor.showSpeed); editor.render(); break;
      case 'play': play(); break;
      case 'apply': apply(); break;
      case 'save-user': saveTo('user'); break;
      case 'save-brand': saveTo('brand'); break;
      case 'import-brand': importInto('brand'); break;
      case 'brandmenu': teamMenu(b); break;
      case 'projectmenu': simpleMenu(b, 'project'); break;
      case 'usermenu': simpleMenu(b, 'user'); break;
      case 'speed-reset': setSpeed(0); break;
      case 'precomp-fit': utilComp('inflect_precomposeFit'); break;
      case 'comp-fit': utilComp('inflect_fitComp'); break;
      case 'edit-anyway': $('#app').classList.add('edit-anyway'); editor.render(); drawSpacing(); break;
      case 'rep-create': case 'rep-new': case 'rep-back': case 'rep-add-beh': case 'rep-add-fall': case 'rep-menu': case 'rep-recipe':
        e.preventDefault(); repeatAct(act, b); break;
      case 'speed-step': setSpeed(C.clamp(speedValue() + parseFloat(b.dataset.step), -60, 60)); break;
      case 'analyze': analyze(); break;
      case 'select-linear': selectLinear(); break;
      case 'curve-more': openMenu(b, [
        { label: 'Incolla curva da testo\u2026', run: pasteCurves },
        { label: 'Maniglie automatiche', run: () => { C.smooth(S.curve); pushHistory(); loadIntoEditor(true); liveApply(); } },
        { label: 'Inverti entrata e uscita', run: () => { S.curve.points = C.invert(S.curve).points; pushHistory(); loadIntoEditor(false); liveApply(); } },
        '-',
        { label: 'Come si usa il grafico', run: () => toast($('.cbar .help').dataset.tip) },
      ]); break;
      case 'settings': openMenu(b, [
        { label: 'Controlla aggiornamenti', run: () => updateCheck(true, false) },
        { label: 'Aggiornamenti da GitHub\u2026', run: updateSourceSheet },
        { label: 'Cartella degli aggiornamenti\u2026', run: async () => { const r = await call('inflect_updateChooseFolder'); if (r.ok && !r.cancelled) { toast(`Aggiornamenti da ${r.folderName}.`); updateCheck(false, true); } else if (!r.ok) toast(r.error, 'err'); } },
        { label: heldVersion() ? 'Versioni precedenti e aggiornamenti in pausa\u2026' : 'Torna a una versione precedente\u2026', run: () => updateRollback() },
        '-',
        { label: `Motion Tools ${window.MT_VERSION || String(window.MT_BUILD || '').split('-')[0]}`, run: () => toast(`Motion Tools ${window.MT_VERSION || ''}, build ${window.MT_BUILD || '?'}`) },
      ]); break;
    }
  });

  $$('#modeSeg button').forEach((b) => b.addEventListener('click', () => {
    S.mode = b.dataset.mode;
    $$('#modeSeg button').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', x === b); });
    persistSession();
  }));
  $$('#modeSeg button').forEach((x) => x.classList.toggle('is-on', x.dataset.mode === S.mode));

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') { closeMenu(); closeSheet(); return; }
    if (typing) return;
    // Le scorciatoie dell'editor (Cmd+Z sulla curva, Canc su un punto) valgono solo dopo un clic nel grafico.
    // Altrimenti Cmd+Z annulla in After Effects. Invio non applica mai niente: si applica con il pulsante.
    const inEditor = graphFocus && (currentView() === 'curve' || currentView() === 'library');
    if (mod && !e.shiftKey && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'v') && (currentView() === 'curve' || currentView() === 'library')) {
      e.preventDefault();
      if (e.key.toLowerCase() === 'c') copyKeysCurve(); else pasteKeysCurve();
      return;
    }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (inEditor) { e.shiftKey ? redo() : undo(); } else aeUndo(e.shiftKey); return; }
    if (inEditor && (e.key === 'Delete' || e.key === 'Backspace') && editor.selected > 0) { e.preventDefault(); editor.deleteSelected(); }
  });
  let graphFocus = false;
  document.addEventListener('mousedown', (e) => { graphFocus = !!(e.target.closest && e.target.closest('#graph')); }, true);
  window.addEventListener('blur', () => { graphFocus = false; });

  /* ============================================= sincronizzazione AE == */

  let lastProject = null;
  let pollCount = 0;
  let hostBroken = false;
  let polling = false;
  let lastSelSig = '', lastStKey = '';
  let lastActive = Date.now();
  ['mousemove', 'mousedown', 'keydown', 'focus'].forEach((ev) => window.addEventListener(ev, () => { lastActive = Date.now(); }, true));
  /*
   * Il pannello parla con After Effects solo mentre lo usi (mouse sopra o clic negli ultimi secondi).
   * Quando lavori nella comp tace: le chiamate continue interrompevano, per esempio, la selezione
   * del testo con lo strumento Testo. Tornando sul pannello si aggiorna subito.
   */
  const panelLive = () => Date.now() - lastActive < 4000;
  window.addEventListener('blur', () => { lastActive = 0; });
  document.addEventListener('mouseenter', () => { lastActive = Date.now(); poll(true); if (typeof txKick === 'function') txKick(); });

  // Sincronizzazione con After Effects: una sola chiamata leggera, frequente mentre usi il pannello.
  async function poll(force) {
    if (polling) return;
    if (document.hidden && force !== true) return;
    pollCount++;
    // Fuori dal pannello si tace (le chiamate disturbavano lo strumento Testo), tranne nella scheda Curve:
    // li' un controllo al secondo serve a leggere i keyframe che selezioni nella timeline.
    if (force !== true && !panelLive() && !(currentView() === 'curve' && pollCount % 2 === 0)) return;
    if (force === true) lastStKey = ''; // aggiornamento chiesto: si ridisegna comunque
    polling = true;
    try { await pollOnce(); } catch (e) { /* si riprova al prossimo giro */ } finally { polling = false; }
  }

  async function pollOnce() {
    let st = await call('inflect_state', currentView());
    if (!st.ok) {
      const r = await loadHostManually();
      if (r === 'ok') { st = await call('inflect_state', currentView()); loadUser(); }
      if (!st.ok) {
        const el = $('#selinfo');
        el.textContent = 'After Effects non risponde: ' + (r !== 'ok' ? r : st.error);
        el.classList.remove('has');
        el.classList.add('bad');
        el.dataset.tip = el.textContent;
        if (!hostBroken) toast(el.textContent, 'err');
        hostBroken = true;
        return;
      }
    }
    hostBroken = false;
    $('#selinfo').classList.remove('bad');
    if (st.project !== lastProject) {
      lastProject = st.project;
      S.projectName = st.project;
      await loadProject();
    }
    // Ogni pochi secondi controlla se un collega ha modificato la libreria condivisa.
    if (false) {
      const sh = await call('inflect_sharedStat', S.shared.active);
      if (sh.ok && (!sh.exists || sh.modified !== S.brandModified)) await loadShared();
    }
    // Se nulla e' cambiato (stato e scheda) il pannello non ridisegna niente.
    const stKey = currentView() + '|' + JSON.stringify(st);
    if (stKey === lastStKey) return;
    lastStKey = stKey;
    applyState(st);
  }

  function currentView() { const t = $('.tab.is-on'); return t ? t.dataset.view : 'curve'; }

  function applyState(st) {
    S.ae = st;
    const app = $('#app');
    const cv = currentView();
    if (cv === 'notes') { try { ntHead(); } catch (e) {} }
    if (cv === 'align' || cv === 'utility') {
      const n = st.layers || 0, names = st.selNames || [];
      const who = !n ? '' : n === 1 ? (names[0] || '1 layer') : n === 2 && names.length === 2 ? `${names[0]} e ${names[1]}` : `${n} layer selezionati`;
      if (cv === 'align') {
        $('#alSel').textContent = n ? who : 'Seleziona uno o più layer';
        $('#alSub').textContent = alignTarget === 'comp' ? `Rispetto alla composizione${st.comp ? ` ${st.comp}` : ''}` : 'Rispetto ai layer selezionati';
      } else {
        $('#utSel').textContent = n ? who : 'Utility';
        $('#utSub').textContent = n === 2 ? 'Misure tra i due layer, composizione, copia e incolla' : n === 1 ? 'Misure dai bordi, composizione, copia e incolla' : 'Seleziona uno o due layer per le misure';
      }
    }
    if (cv === 'repeat' && !$('#repCreate').hidden) { try { $('#repNewSub').textContent = selLabel(); drawNewPreview(); } catch (e) {} }
    const hasKeys = st.props > 0;
    if (hasKeys) app.classList.remove('edit-anyway');
    app.classList.toggle('no-keys', !hasKeys);
    app.classList.toggle('no-layers', !(st.layers > 0));
    app.classList.toggle('has-repeat', !!st.repeat);

    const el = $('#selinfo');
    const view = currentView();
    const tools = ['align', 'utility', 'repeat', 'audit', 'text', 'team', 'notes'].includes(view);
    app.classList.toggle('no-comp', !st.comp);
    if (view === 'notes') {
      el.textContent = st.comp ? `Note · ${st.comp}` : 'Apri una composizione';
      el.classList.toggle('has', !!st.comp);
    } else if (view === 'text' || view === 'team') {
      el.textContent = view === 'team' ? (teamInfo && !teamInfo.isDefault ? `Libreria di team in ${teamInfo.folderName}` : 'Libreria di team su questo computer') : (st.comp ? st.comp : 'Apri una composizione');
      el.classList.toggle('has', !!st.comp);
    } else if (view === 'audit') {
      el.textContent = st.comp ? `Analisi di ${st.comp}` : 'Apri una composizione';
      el.classList.toggle('has', !!st.comp);
      if (st.comp && st.comp !== anComp && !anBusy) analyze();
    } else if (tools) {
      el.textContent = st.layers > 0 ? `${st.layers} layer ${st.layers === 1 ? 'selezionato' : 'selezionati'} \u00b7 ${st.comp}` : (st.comp ? 'Nessun layer selezionato' : 'Apri una composizione');
      el.classList.toggle('has', st.layers > 0);
    } else if (st.pairs > 0) {
      el.textContent = `${st.pairs} ${st.pairs === 1 ? 'segmento' : 'segmenti'} su ${st.props} propriet\u00e0 \u00b7 ${st.comp}`;
      el.classList.add('has');
    } else {
      el.textContent = hasKeys ? 'Seleziona anche il keyframe vicino' : (st.comp ? 'Nessun keyframe selezionato' : 'Apri una composizione');
      el.classList.remove('has');
    }
    if (st.pairs > 0 && st.duration && !$('#durMs').matches(':focus')) {
      const ms = Math.round(st.duration * 1000);
      if (String(ms) !== $('#durMs').value) { $('#durMs').value = ms; $('#fps').value = Math.round(st.fps); drawSpacing(); }
    }
    setSpeedEnabled(st.pairs > 0);
    if (st.sig !== lastSelSig) { lastSelSig = st.sig; if (st.pairs > 0) syncSpeed(); else showSpeed(0, null); }
    const cs2 = $('#curveSel');
    if (cs2) {
      const seg = `${st.pairs} ${st.pairs === 1 ? 'segmento' : 'segmenti'}`;
      cs2.textContent = !st.comp ? 'Apri una composizione'
        : st.pairs > 0 ? (st.props === 1 && st.propName ? `Su ${st.propName} di ${st.layerName || st.comp}, ${seg}` : `Su ${st.props} proprietà, ${seg}`)
        : hasKeys ? 'Seleziona anche il keyframe vicino' : 'Nessun keyframe selezionato';
    }
    autoRead(st);
    if (view === 'repeat') renderRepeatState(st.repeat);
    if (view === 'utility') refreshRuler();
  }

  /* ============================================================ velocità == */

  const speedInput = () => $('#speed');
  const speedValue = () => parseFloat(speedInput().value) || 0;

  function showSpeed(v, res) {
    speedInput().value = v;
    $('#speedOut').textContent = v <= -100 ? 'lineare' : v >= 100 ? 'max' : (v > 0 ? '+' : '') + v + '%';
    $('#speedbar').classList.toggle('changed', v !== 0);
    const fill = $('#speedFill');
    const pct = (v + 100) / 200 * 100;
    fill.style.left = Math.min(50, pct) + '%';
    fill.style.width = Math.abs(pct - 50) + '%';
    if (res) {
      $('#speedNote').textContent = res.segments
        ? `Picco ${C.round(res.peakBefore, 2)}× → ${C.round(res.peakAfter, 2)}× la velocità media` + (res.limited ? (speedValue() < 0 ? ', ora a velocità costante' : ', al massimo') : '')
        : '';
    }
  }

  function setSpeedEnabled(on) {
    $('#speedbar').classList.toggle('is-disabled', !on);
    speedInput().disabled = !on;
  }

  async function syncSpeed() {
    const r = await call('inflect_speedBegin');
    if (!r.ok) return;
    showSpeed(Math.round(r.pct), null);
    lastSpeedSent = Math.round(r.pct);
    $('#speedNote').textContent = r.segments
      ? (r.linear ? `${r.linear} segmenti lineari restano invariati` : '')
      : r.linear ? 'Keyframe lineari: applica prima una curva, poi regola la velocità' : '';
  }

  function resetSpeedUI() { showSpeed(0, null); $('#speedNote').textContent = ''; lastSelSig = ''; lastSpeedSent = 0; }

  let speedBusy = false, speedQueued = null;
  async function setSpeed(v) {
    showSpeed(v, null);
    if (speedBusy) { speedQueued = v; return; }
    speedBusy = true;
    lastSpeedSent = v;
    await call('inflect_speedBegin');
    const res = await call('inflect_speedSet', v);
    speedBusy = false;
    if (!res.ok) { toast(res.error, 'err'); showSpeed(0, null); lastSpeedSent = 0; return; }
    showSpeed(v, res);
    // Nella scheda Curve il grafico mostra subito la curva nuova dei keyframe.
    if (res.segments && currentView() === 'curve') readFromAE(true);
    if (res.segments) {
      const same = Math.abs(res.peakAfter - res.peakBefore) < 0.01 && v !== 0;
      toast(same
        ? 'Questi segmenti sono già lineari: non si possono rallentare oltre.'
        : `${v <= -100 ? 'Velocit\u00e0 costante (lineare)' : v >= 100 ? 'Velocit\u00e0 al massimo' : `Velocit\u00e0 ${v > 0 ? '+' : ''}${v}%`} su ${res.segments} ${res.segments === 1 ? 'segmento' : 'segmenti'}.`);
    }
    if (speedQueued !== null) { const q = speedQueued; speedQueued = null; setSpeed(q); }
  }

  speedInput().addEventListener('input', () => showSpeed(speedValue(), null));
  // "change" a volte non arriva nei pannelli di After Effects: si applica anche al rilascio.
  let lastSpeedSent = 0;
  const commitSpeed = () => { if (speedValue() !== lastSpeedSent) setSpeed(speedValue()); };
  speedInput().addEventListener('change', commitSpeed);
  speedInput().addEventListener('mouseup', () => setTimeout(commitSpeed, 0));
  speedInput().addEventListener('keyup', commitSpeed);
  speedInput().addEventListener('dblclick', () => setSpeed(0));

  /* ======================================================= assestamento == */



  /* ======================================================= allineamento == */

  const say = (res, okMsg) => {
    if (!res.ok) { toast(res.error, 'err'); return false; }
    toast(res.notes && res.notes.length ? `${okMsg} ${res.notes[0]}` : okMsg);
    return true;
  };
  const nLayers = (n) => `${n} layer`;

  (function buildAnchorGrid() {
    const grid = $('#anchorGrid');
    const names = [['in alto a sinistra', 'in alto al centro', 'in alto a destra'], ['a sinistra', 'al centro', 'a destra'], ['in basso a sinistra', 'in basso al centro', 'in basso a destra']];
    [0, 0.5, 1].forEach((fy, r) => [0, 0.5, 1].forEach((fx, c) => {
      const b = document.createElement('button');
      b.className = 'adot';
      b.style.left = `calc(14px + ${fx} * (100% - 28px))`;
      b.style.top = `calc(14px + ${fy} * (100% - 28px))`;
      b.dataset.tip = `Ancoraggio ${names[r][c]}`;
      b.setAttribute('aria-label', b.dataset.tip);
      b.addEventListener('click', async () => {
        const res = await call('inflect_anchor', fx, fy);
        if (say(res, `Ancoraggio ${names[r][c]} su ${nLayers(res.layers)}.`)) {
          $$('.adot').forEach((x) => x.classList.toggle('is-last', x === b));
        }
      });
      grid.appendChild(b);
    }));
  })();

  let alignTarget = 'comp';
  $$('#alignTarget button').forEach((b) => b.addEventListener('click', () => {
    alignTarget = b.dataset.target;
    $$('#alignTarget button').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
    if (S.ae) applyState(S.ae);
  }));
  $$('[data-align]').forEach((b) => b.addEventListener('click', async () => {
    const edge = b.dataset.align;
    if (edge === 'center') {
      // Anche il centro rispetta "Mantieni le distanze": prima orizzontale, poi verticale, sempre come blocco.
      const grpC = $('#alignGroup').checked;
      const r1 = await call('inflect_align', 'hcenter', 'comp', grpC);
      if (!r1.ok) return toast(r1.error, 'err');
      say(await call('inflect_align', 'vcenter', 'comp', grpC), grpC ? 'Centrato nella composizione come blocco.' : 'Centrato nella composizione.');
    } else {
      const grp = $('#alignGroup').checked;
      const r = await call('inflect_align', edge, alignTarget, grp);
      say(r, grp ? (alignTarget === 'comp' ? 'Allineati alla composizione come un blocco: le distanze restano uguali.' : `${r.units || ''} blocchi allineati tra loro.`) : `Allineati ${alignTarget === 'comp' ? 'alla composizione' : 'tra loro'}.`);
    }
    poll(true);
  }));
  try { $('#alignGroup').checked = localStorage.getItem('mt.alignGroup') === '1'; } catch (e) {}
  $('#alignGroup').addEventListener('change', (e) => { try { localStorage.setItem('mt.alignGroup', e.target.checked ? '1' : '0'); } catch (e2) {} });

  /* gruppi salvati: layer che si riselezionano e si allineano insieme */
  let groupsKey = '';
  async function groupsRead(force) {
    const r = await call('inflect_groupList');
    if (!r.ok) return;
    const key = JSON.stringify(r.groups);
    if (!force && key === groupsKey) return;
    groupsKey = key;
    const box = $('#groupList');
    box.textContent = '';
    if (!r.groups.length) { box.append(h('span', { class: 'faint', text: 'Nessuno' })); return; }
    r.groups.forEach((g) => {
      const b = h('button', { class: 'gchip', text: `${g.name} (${g.count})`, 'data-tip': 'Clic per selezionarlo, Maiusc per aggiungerlo alla selezione, tasto destro per scioglierlo' });
      b.addEventListener('click', async (e) => { const res = await call('inflect_groupSelect', g.name, e.shiftKey); if (!res.ok) toast(res.error, 'err'); poll(true); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); openMenu(b, [{ label: `Sciogli ${g.name}`, danger: true, run: async () => { await call('inflect_groupRemove', g.name); groupsKey = ''; groupsRead(true); toast(`Gruppo ${g.name} sciolto. I layer restano dove sono.`); } }], e); });
      box.append(b);
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-act="group-new"]')) return;
    openSheet('Nuovo gruppo', [{ key: 'name', label: 'Nome', value: '', placeholder: 'Es. Logo e payoff' }], 'Crea', async (v) => {
      const r = await call('inflect_groupCreate', v.name || 'Gruppo');
      if (!r.ok) return toast(r.error, 'err');
      groupsKey = ''; groupsRead(true);
      toast(`Gruppo ${v.name || 'Gruppo'} creato. Con Mantieni le distanze si allinea come un blocco.`);
    });
  });
  setInterval(() => { if (panelLive() && currentView() === 'align') groupsRead(false); }, 1600);

  $$('[data-dist]').forEach((b) => b.addEventListener('click', async () => {
    say(await call('inflect_distribute', b.dataset.dist), 'Distribuiti a distanza uguale.');
  }));

  /* ======================================================== composizione == */

  try { $('#precompOuter').checked = localStorage.getItem('mt.precompOuter') === '1'; } catch (e) {}
  $('#precompOuter').addEventListener('change', (e) => { try { localStorage.setItem('mt.precompOuter', e.target.checked ? '1' : '0'); } catch (e2) {} });

  async function utilComp(fn) {
    const margin = Math.max(0, parseFloat($('#fitMargin').value) || 0);
    const outer = fn === 'inflect_precomposeFit' && $('#precompOuter').checked;
    const res = await call(fn, margin, outer);
    if (!res.ok) return toast(res.error, 'err');
    toast(fn === 'inflect_fitComp'
      ? `Composizione ridimensionata a ${res.width} \u00d7 ${res.height} px.`
      : res.outer
        ? `${res.name}: ${res.width} \u00d7 ${res.height} px, l\u2019animazione \u00e8 sul layer della precomposizione.`
        : `${res.name}: precomposizione di ${res.width} \u00d7 ${res.height} px con keyframe ed effetti.`);
    rulerKey = '';
    poll(true);
  }

  /* ============================================================ righello == */

  const px = (n) => String(C.round(n, 1));
  let rulerBusy = false, rulerKey = '';
  async function refreshRuler() {
    if (rulerBusy) return;
    rulerBusy = true;
    const m = await call('inflect_measure');
    rulerBusy = false;
    if (!m.ok || !m.count) return;
    const key = JSON.stringify(m);
    if (key === rulerKey) return;
    rulerKey = key;
    drawRuler(m);
  }

  function drawRuler(m) {
    const svg = $('#rulerSvg');
    const W = svg.getBoundingClientRect().width || 400, H = 190, pad = 16;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const two = !!m.b;
    // Vista: tutta la composizione con un layer, l'area dei due layer con due.
    let v = { l: 0, t: 0, r: m.comp.w, b: m.comp.h };
    if (two) {
      v = { l: Math.min(m.a.l, m.b.l), t: Math.min(m.a.t, m.b.t), r: Math.max(m.a.r, m.b.r), b: Math.max(m.a.b, m.b.b) };
    } else {
      v = { l: Math.min(0, m.a.l), t: Math.min(0, m.a.t), r: Math.max(m.comp.w, m.a.r), b: Math.max(m.comp.h, m.a.b) };
    }
    const k = Math.min((W - pad * 2) / Math.max(1, v.r - v.l), (H - pad * 2) / Math.max(1, v.b - v.t));
    const ox = (W - (v.r - v.l) * k) / 2, oy = (H - (v.b - v.t) * k) / 2;
    const X = (x) => ox + (x - v.l) * k, Y = (y) => oy + (y - v.t) * k;
    const box = (b, cls) => `<rect class="rbox ${cls}" x="${X(b.l)}" y="${Y(b.t)}" width="${Math.max(1, (b.r - b.l) * k)}" height="${Math.max(1, (b.b - b.t) * k)}" rx="2"/>`;
    const tag = (x, y, txt) => { const w = txt.length * 6.2 + 10; return `<rect class="rtag" x="${x - w / 2}" y="${y - 8}" width="${w}" height="16" rx="3"/><text class="rtagtext" x="${x}" y="${y}">${txt}</text>`; };
    const line = (x1, y1, x2, y2) => `<line class="rline" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    let out = '';
    if (!two) out += `<rect class="rcomp" x="${X(0)}" y="${Y(0)}" width="${m.comp.w * k}" height="${m.comp.h * k}"/>`;
    out += box(m.a, 'a');
    if (two) {
      out += box(m.b, 'b');
      const A = m.a, B = m.b;
      if (m.gapX > 0) {
        const x1 = B.l >= A.r ? A.r : B.r, x2 = B.l >= A.r ? B.l : A.l;
        const y = (Math.max(A.t, B.t) + Math.min(A.b, B.b)) / 2;
        const yy = Y(Math.max(A.t, B.t) <= Math.min(A.b, B.b) ? y : (A.t + A.b) / 2);
        out += line(X(x1), yy, X(x2), yy) + tag((X(x1) + X(x2)) / 2, yy, px(m.gapX));
      }
      if (m.gapY > 0) {
        const y1 = B.t >= A.b ? A.b : B.b, y2 = B.t >= A.b ? B.t : A.t;
        const x = (Math.max(A.l, B.l) + Math.min(A.r, B.r)) / 2;
        const xx = X(Math.max(A.l, B.l) <= Math.min(A.r, B.r) ? x : (A.l + A.r) / 2);
        out += line(xx, Y(y1), xx, Y(y2)) + tag(xx, (Y(y1) + Y(y2)) / 2, px(m.gapY));
      }
    } else {
      const cx = X((m.a.l + m.a.r) / 2), cy = Y((m.a.t + m.a.b) / 2);
      out += line(X(0), cy, X(m.a.l), cy) + tag((X(0) + X(m.a.l)) / 2, cy, px(m.a.l));
      out += line(X(m.a.r), cy, X(m.comp.w), cy) + tag((X(m.a.r) + X(m.comp.w)) / 2, cy, px(m.comp.w - m.a.r));
      out += line(cx, Y(0), cx, Y(m.a.t)) + tag(cx, (Y(0) + Y(m.a.t)) / 2, px(m.a.t));
      out += line(cx, Y(m.a.b), cx, Y(m.comp.h)) + tag(cx, (Y(m.a.b) + Y(m.comp.h)) / 2, px(m.comp.h - m.a.b));
    }
    svg.innerHTML = out;

    const data = $('#rulerData');
    if (isTyping(data)) return; // non interrompere la digitazione
    data.textContent = '';
    const row = (k2, v2) => { const a = document.createElement('span'); a.className = 'k'; a.textContent = k2; const b = document.createElement('span'); b.className = 'v'; if (typeof v2 === 'string') b.textContent = v2; else b.appendChild(v2); data.append(a, b); };
    const gapInput = (axis, val) => {
      const w = document.createElement('span');
      w.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
      const inp = document.createElement('input');
      inp.type = 'number'; inp.step = '1'; inp.value = px(val);
      inp.dataset.tip = 'Scrivi un valore e premi Invio: il secondo layer si sposta per ottenere questo spazio';
      inp.addEventListener('change', async () => {
        const res = await call('inflect_setGap', axis, parseFloat(inp.value) || 0);
        if (!res.ok) return toast(res.error, 'err');
        toast(`${res.moved} spostato: spazio ${axis === 'x' ? 'orizzontale' : 'verticale'} ${inp.value} px.`);
        inp.blur(); rulerKey = ''; refreshRuler();
      });
      w.append(inp, document.createTextNode(val < 0 ? 'px, sovrapposti' : 'px'));
      return w;
    };
    if (two) {
      row('Spazio orizzontale', gapInput('x', m.gapX));
      row('Spazio verticale', gapInput('y', m.gapY));
      row('Tra i centri', `${px(m.dist)} px  (X ${px(m.dx)}, Y ${px(m.dy)})`);
      row(m.a.name, `${px(m.a.r - m.a.l)} \u00d7 ${px(m.a.b - m.a.t)} px`);
      row(m.b.name, `${px(m.b.r - m.b.l)} \u00d7 ${px(m.b.b - m.b.t)} px`);
      const n = document.createElement('span'); n.className = 'note';
      n.textContent = m.count > 2 ? 'Misuro i primi due layer selezionati.' : 'Il primo layer selezionato resta fermo, il secondo si sposta.';
      data.appendChild(n);
    } else {
      row('Dimensioni', `${px(m.a.r - m.a.l)} \u00d7 ${px(m.a.b - m.a.t)} px`);
      row('Da sinistra / destra', `${px(m.a.l)} / ${px(m.comp.w - m.a.r)} px`);
      row('Dall\u2019alto / dal basso', `${px(m.a.t)} / ${px(m.comp.h - m.a.b)} px`);
    }
  }

  /* ============================================================== repeat == */

  const LISTS = {
    dist: ['Lineare', 'Griglia', 'Cerchio', 'Casuale', 'Spirale', 'Tracciato', 'Punto'],
    tipo: ['Stagger', 'Casuale', 'Rumore', 'Oscillatore', 'Valore', 'Lista'],
    dest: ['Posizione X', 'Posizione Y', 'Posizione Z', 'Rotazione', 'Rotazione X', 'Rotazione Y', 'Scala', 'Opacità', 'Tempo', 'Colore'],
    curva: ['Lineare', 'Ease in', 'Ease out', 'Ease in-out'],
    ordine: ['Indice', 'Inverso', 'Dal centro', 'Verso il centro', 'Casuale', 'Asse X', 'Asse Y'],
    forma: ['Cerchio', 'Rettangolo', 'Lineare'],
  };
  const DEST_UNIT = ['px', 'px', 'px', '°', '°', '°', '%', '%', 'fr', '%'];
  const BEH_COLOR = ['#6aa9ff', '#c58af9', '#5fbf6c', '#f2c94c', '#9a9a9a', '#ff7a59'];
  // Valori di partenza sensati per ogni tipo di comportamento.
  const BEH_DEFAULTS = {
    1: { dest: 9, min: 0, max: 20 },
    2: { dest: 4, min: -30, max: 30 },
    3: { dest: 2, min: -40, max: 40 },
    4: { dest: 7, min: -20, max: 20 },
    5: { dest: 7, min: 0, max: -100 },
    6: { dest: 4, min: 0, max: 0 },
  };

  /* --- piccoli costruttori di interfaccia -------------------------------- */

  function h(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    kids.flat(Infinity).forEach((c) => c !== null && c !== undefined && c !== false && n.append(c));
    return n;
  }
  const add = (box, ...items) => items.flat(Infinity).forEach((c) => c !== null && c !== undefined && c !== false && box.append(c));
  const row = (label, ...ctrls) => h('div', { class: 'prow' }, h('span', { class: 'plabel', text: label }), ...ctrls);
  const unit = (u) => h('span', { class: 'unit', text: u });

  /** Campo numerico trascinabile collegato a una funzione di salvataggio (dal vivo durante il trascinamento). */
  function hot(value, onSet, opts = {}) {
    const inp = h('input', { type: 'number', step: opts.step || 1, min: opts.min, max: opts.max, 'data-tip': opts.tip });
    inp.value = Math.round((value || 0) * 1000) / 1000;
    let timer = null, last = null, sent = 0;
    const fire = () => { const v = parseFloat(inp.value); if (isNaN(v) || v === last) return; last = v; sent = Date.now(); onSet(v); };
    // Mentre trascini il valore arriva ad After Effects al massimo ogni 60 ms, senza aspettare che ti fermi.
    // Le richieste uguali si fondono in setParam, quindi After Effects riceve sempre l'ultimo valore.
    inp.addEventListener('input', () => {
      if (!scrubbing) return;
      clearTimeout(timer);
      const wait = 60 - (Date.now() - sent);
      if (wait <= 0) fire(); else timer = setTimeout(fire, wait);
    });
    inp.addEventListener('change', () => { clearTimeout(timer); fire(); });
    return inp;
  }
  function select(options, value, onSet, opts = {}) {
    const s = h('select', { class: 'select sel-sm', 'data-tip': opts.tip });
    options.forEach((o, ix) => {
      const val = Array.isArray(o) ? o[0] : ix + 1;
      const lab = Array.isArray(o) ? o[1] : o;
      s.append(h('option', { value: val, text: lab }));
    });
    s.value = String(value);
    s.addEventListener('change', () => { s.blur(); onSet(s.value); });
    return s;
  }
  function segc(options, value, onSet) {
    const box = h('div', { class: 'seg' });
    options.forEach(([val, lab, tip]) => {
      const b = h('button', { class: String(val) === String(value) ? 'is-on' : '', 'data-tip': tip, text: lab });
      b.addEventListener('click', () => { $$('button', box).forEach((x) => x.classList.toggle('is-on', x === b)); onSet(val); });
      box.append(b);
    });
    return box;
  }
  // Campo colore: selettore di sistema piu' le palette del team. onSet riceve "#RRGGBB".
  /*
   * Campo colore. Il selettore di colore di Chromium dentro CEP spesso non si apre, quindi il campione
   * apre un riquadro con: codice esadecimale, selettore di After Effects ($.colorPicker), colori usati
   * di recente e palette del team.
   */
  function colorField(value, onSet, opts = {}) {
    let cur = String(value || '#FF5A1F').toUpperCase();
    const sw = h('button', { class: 'txcolor cswatch', 'data-tip': opts.tip || 'Scegli un colore' });
    const paint = () => { sw.style.background = cur; };
    paint();
    const set = (hex) => { cur = String(hex).toUpperCase(); paint(); rememberColor(cur); onSet(cur); };
    sw.disabled = !!opts.disabled;
    sw.addEventListener('click', (e) => { e.stopPropagation(); colorPopover(sw, set, cur); });
    const box = h('span', { class: 'cfield' }, sw);
    box.setDisabled = (d) => { sw.disabled = d; };
    box.input = { get value() { return cur; }, set value(v) { cur = String(v).toUpperCase(); paint(); } };
    return box;
  }
  /*
   * Selettore di colore disegnato nel pannello (saturazione e luminosita' nel quadrato, tinta nella
   * barra): non dipende da finestre di sistema, che chiamate dal pannello possono bloccare After Effects.
   */
  function hsvPicker(start, onChange) {
    const toRgb = (hh, ss, vv) => { const f = (n) => { const k = (n + hh / 60) % 6; return vv - vv * ss * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };
    const toHex = (c) => '#' + c.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
    const fromHex = (hx) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hx || '');
      if (!m) return [0, 0, 1];
      const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let hh = 0;
      if (d) { hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
      return [hh, mx ? d / mx : 0, mx];
    };
    let [H, S, V] = fromHex(start);
    const sq = h('div', { class: 'hsv-sq' }), dot = h('span', { class: 'hsv-dot' }), bar = h('div', { class: 'hsv-hue' }), knob = h('span', { class: 'hsv-knob' });
    sq.append(dot); bar.append(knob);
    const paint = () => {
      sq.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${H}, 100%, 50%))`;
      dot.style.left = `${S * 100}%`; dot.style.top = `${(1 - V) * 100}%`; knob.style.left = `${H / 360 * 100}%`;
    };
    const emit = () => { paint(); onChange(toHex(toRgb(H, S, V))); };
    const drag = (el, fn) => el.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const mv = (ev) => { const r = el.getBoundingClientRect(); fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))); emit(); };
      const up = () => { document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true); };
      document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true); mv(e);
    });
    drag(sq, (x, y) => { S = x; V = 1 - y; });
    drag(bar, (x) => { H = x * 360; });
    paint();
    return h('div', { class: 'hsv' }, sq, bar);
  }
  const recentColors = () => { try { return JSON.parse(localStorage.getItem('mt.recentColors') || '[]'); } catch (e) { return []; } };
  function rememberColor(hex) {
    try { const r = recentColors().filter((c) => c !== hex); r.unshift(hex); localStorage.setItem('mt.recentColors', JSON.stringify(r.slice(0, 16))); } catch (e) {}
  }
  function colorPopover(anchor, pick, cur, extra) {
    $$('.cpop').forEach((x) => x.remove());
    const pop = h('div', { class: 'cpop' });
    const done = (hex) => { pick(hex); pop.remove(); };
    const chip = (c) => { const b = h('button', { class: 'cpchip', 'data-tip': c }); b.style.background = c; b.addEventListener('click', (e) => { e.stopPropagation(); done(String(c).toUpperCase()); }); return b; };
    // Codice esadecimale e selettore di After Effects.
    const hex = h('input', { type: 'text', class: 'txinput cphex', value: cur || '', spellcheck: 'false', 'data-tip': 'Codice del colore, per esempio FF5A1F' });
    const okHex = () => { const v = hex.value.trim().replace(/^#/, ''); const f = /^[0-9a-f]{3}$/i.test(v) ? v.split('').map((x) => x + x).join('') : v; if (/^[0-9a-f]{6}$/i.test(f)) done('#' + f.toUpperCase()); else hex.classList.add('bad'); };
    hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); okHex(); } });
    hex.addEventListener('input', () => hex.classList.remove('bad'));
    const okb = h('button', { class: 'btn sm primary', text: 'Usa' });
    okb.addEventListener('click', (e) => { e.stopPropagation(); okHex(); });
    pop.append(hsvPicker(cur || '#FF5A1F', (hx) => { hex.value = hx; hex.classList.remove('bad'); }));
    pop.append(h('div', { class: 'cprow' }, hex, okb));
    if (extra) { const xb = h('button', { class: 'btn sm', text: extra.label }); xb.addEventListener('click', (e) => { e.stopPropagation(); pop.remove(); extra.run(); }); pop.append(h('div', { class: 'cprow' }, xb)); }
    const rec = recentColors();
    if (rec.length) pop.append(h('div', { class: 'cpname', text: 'Recenti' }), h('div', { class: 'cpsw' }, rec.map(chip)));
    const pals = (TEAM && TEAM.palettes) || [];
    pals.forEach((p) => { pop.append(h('div', { class: 'cpname', text: p.name }), h('div', { class: 'cpsw' }, (p.colors || []).map(chip))); });
    if (!pals.length) pop.append(h('p', { class: 'hint', text: 'Le palette del team compaiono qui. Creale nella scheda Team.' }));
    document.body.append(pop);
    const r = anchor.getBoundingClientRect(), W = pop.offsetWidth, H = pop.offsetHeight;
    pop.style.left = `${Math.max(6, Math.min(window.innerWidth - W - 6, r.right - W))}px`;
    pop.style.top = `${r.bottom + H + 6 > window.innerHeight ? Math.max(6, r.top - H - 4) : r.bottom + 4}px`;
    const close = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { pop.remove(); document.removeEventListener('keydown', esc); } });
  }
  function check(label, value, onSet, tip) {
    const inp = h('input', { type: 'checkbox' });
    inp.checked = !!value;
    inp.addEventListener('change', () => onSet(inp.checked ? 1 : 0));
    return h('label', { class: 'check', 'data-tip': tip }, inp, h('span', { text: label }));
  }
  function vec(labels, values, onSet, opts = {}) {
    const v = values.slice();
    return h('span', { class: 'vec' }, labels.map((ax, k) => [
      h('span', { class: 'ax', text: ax }),
      hot(v[k], (x) => { v[k] = x; onSet(v.slice()); }, opts),
    ]));
  }

  /* --- keyframe come in After Effects ------------------------------------ */

  function animState(target, idx, name) {
    if (!RP || !RP.anim) return [0, 0];
    const m = target === 'ctrl' ? RP.anim.ctrl : target === 'ctrlT' ? RP.anim.ctrlT : (RP.anim.fall[idx] || {});
    return m[name] || [0, 0];
  }
  function kf(target, idx, name) {
    const [a, k] = animState(target, idx, name);
    const tip = !a ? 'Anima: crea un keyframe al tempo corrente' : k ? 'Togli il keyframe al tempo corrente' : 'Aggiungi un keyframe al tempo corrente';
    const b = h('button', { class: 'kf' + (a ? ' on' : '') + (k ? ' at' : ''), 'data-tip': tip, 'aria-label': tip });
    b.innerHTML = '<svg viewBox="0 0 10 10"><path d="M5 1.2 8.8 5 5 8.8 1.2 5z"/></svg>';
    b.addEventListener('click', async (e) => {
      e.preventDefault();
      const r = await setParam('inflect_repeatKey', target, idx, name);
      if (r.ok) toast(`Keyframe ${r.state} su ${name.replace(/^B\d+ /, '')}. ${r.keys ? r.keys + ' keyframe in totale.' : 'Animazione tolta.'}`);
      readRepeat(true);
    });
    return b;
  }
  const krow = (key, label, ...ctrls) => h('div', { class: 'prow k' }, key || h('span', { class: 'kfsp' }), h('span', { class: 'plabel', text: label }), ...ctrls);

  /* --- nuovo Cloner ------------------------------------------------------- */

  const N = { mode: 2, count: 8, cols: 5, rows: 4, levels: 3, threeD: false, pick: 'cycle', front: 'last', hide: true };
  try { Object.assign(N, JSON.parse(localStorage.getItem('mt.newrepeat') || '{}')); } catch (e) {}
  // Ogni Cloner nuovo parte in 2D e al centro della composizione: il 3D si sceglie di volta in volta.
  N.threeD = false;
  if (!N.place) N.place = 'comp';
  const saveN = () => { try { localStorage.setItem('mt.newrepeat', JSON.stringify(N)); } catch (e) {} };

  // Segni delle distribuzioni, come nel disegno: punti su una griglia di 24.
  const DIST_GLYPH = (() => {
    const pts = {
      1: [[3, 12], [9, 12], [15, 12], [21, 12]],
      2: [[4, 7], [12, 7], [20, 7], [4, 15], [12, 15], [20, 15]],
      3: [0, 1, 2, 3, 4, 5].map((a) => [12 + 8 * Math.cos(a * Math.PI / 3), 12 + 8 * Math.sin(a * Math.PI / 3)]),
      4: [[5, 6], [15, 4], [20, 13], [8, 16], [14, 20], [3, 20]],
      5: [1.5, 3.5, 5.5, 7.5, 9.5].map((r) => [12 + r * Math.cos(r * 0.9), 12 + r * Math.sin(r * 0.9)]),
      6: [[3, 18], [8, 10], [13, 8], [18, 11], [21, 18]],
      7: [[12, 12], [10, 10], [14, 11], [11, 14], [13, 13]],
    };
    const out = {};
    Object.keys(pts).forEach((k) => {
      const extra = +k === 6 ? '<path d="M3 18C6 8 17 4 21 18" fill="none" stroke="currentColor" stroke-width="1" opacity=".35"/>' : '';
      out[k] = `<svg viewBox="0 0 24 24" aria-hidden="true">${extra}${pts[k].map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="currentColor"/>`).join('')}</svg>`;
    });
    return out;
  })();
  function distTiles(cur, onPick) {
    const g = h('div', { class: 'disttiles', role: 'radiogroup', 'aria-label': 'Distribuzione' });
    LISTS.dist.forEach((name, i) => {
      const b = h('button', { role: 'radio', 'aria-checked': cur === i + 1 ? 'true' : 'false', class: cur === i + 1 ? 'is-on' : '' });
      b.innerHTML = DIST_GLYPH[i + 1];
      b.append(h('span', { text: name }));
      b.addEventListener('click', () => onPick(i + 1));
      g.append(b);
    });
    return g;
  }
  function selLabel() {
    const n = (S.ae && S.ae.layers) || 0, names = (S.ae && S.ae.selNames) || [];
    if (!n) return 'Seleziona i layer da ripetere';
    if (n === 1 && names[0]) return `Da ${names[0]}, il layer selezionato`;
    if (n === 2 && names.length === 2) return `Da ${names[0]} e ${names[1]}, i layer selezionati`;
    return `Da ${n} layer selezionati`;
  }

  function renderRepeatNew() {
    const box = $('#repNewBody');
    if (isTyping(box) || scrubbing) return;
    box.textContent = '';
    const upd = () => { saveN(); drawNewPreview(); };
    const nsel = (S.ae && S.ae.layers) || 0;
    $('#repNewSub').textContent = selLabel();
    const back = $('#repBack');
    back.hidden = !(repForceNew && S.ae && S.ae.repeat);
    if (!back.hidden) back.textContent = `Torna a ${S.ae.repeat.name}`;
    add(box, distTiles(N.mode, (v) => { N.mode = v; saveN(); renderRepeatNew(); }));
    const two = (...r) => h('div', { class: 'pgrid2' }, ...r.filter(Boolean));
    add(box,
      N.mode === 2
        ? two(row('Colonne', hot(N.cols, (v) => { N.cols = Math.max(1, Math.round(v)); upd(); }, { min: 1 })),
              row('Righe', hot(N.rows, (v) => { N.rows = Math.max(1, Math.round(v)); upd(); }, { min: 1 })),
              N.threeD ? row('Livelli', hot(N.levels, (v) => { N.levels = Math.max(1, Math.round(v)); upd(); }, { min: 1, tip: 'Strati in profondità' })) : null)
        : row('Quantità', hot(N.count, (v) => { N.count = Math.max(1, Math.round(v)); upd(); }, { min: 1 })),
      nsel > 1 ? row('Sorgenti', segc([['cycle', 'Alternate', 'Le copie usano i layer selezionati a turno'], ['random', 'Casuali', 'Ogni copia sceglie uno dei layer a caso']], N.pick, (v) => { N.pick = v; saveN(); drawNewPreview(); })) : null,
      row('Posizione', segc([['comp', 'Centro della comp', 'Il Cloner nasce al centro della composizione'], ['layer', 'Primo layer', 'Il Cloner nasce dove si trova il primo layer selezionato']], N.place, (v) => { N.place = v; saveN(); })),
      row('Davanti', segc([['last', 'Ultima copia', 'L’ultima copia sta sopra le altre'], ['first', 'Prima', 'La prima copia sta sopra le altre']], N.front, (v) => { N.front = v; saveN(); })),
      row('', check('Copie in 3D', N.threeD, (v) => { N.threeD = !!v; saveN(); renderRepeatNew(); }, 'Controllo e copie diventano layer 3D')),
      row('', check('Nascondi i layer di partenza', N.hide, (v) => { N.hide = !!v; saveN(); }, 'Spegne i layer di partenza')),
    );
    drawNewPreview();
  }

  function newPoints() {
    const pts = [];
    const n = N.mode === 2 ? N.cols * N.rows * (N.threeD ? N.levels : 1) : N.count;
    const lim = Math.min(n, 400);
    for (let i = 0; i < lim; i++) {
      if (N.mode === 2) {
        const per = N.cols * N.rows, z = Math.floor(i / per), r = i % per;
        pts.push([(r % N.cols) - (N.cols - 1) / 2, Math.floor(r / N.cols) - (N.rows - 1) / 2, N.threeD ? z - ((N.threeD ? N.levels : 1) - 1) / 2 : 0]);
      } else if (N.mode === 3) { const a = (i / n) * Math.PI * 2; pts.push([Math.sin(a), -Math.cos(a), 0]); }
      else if (N.mode === 5) { const a = i * 2.39996, r = Math.sqrt((i + 0.5) / n); pts.push([Math.sin(a) * r, -Math.cos(a) * r, 0]); }
      else if (N.mode === 4) { const x = Math.sin(i * 12.9898) * 43758.5453, y = Math.sin(i * 78.233) * 12543.123; pts.push([x - Math.floor(x) - 0.5, y - Math.floor(y) - 0.5, 0]); }
      else if (N.mode === 6) { pts.push([i / Math.max(1, n - 1) - 0.5, Math.sin((i / Math.max(1, n - 1)) * Math.PI * 2) * 0.25, 0]); }
      else if (N.mode === 7) { pts.push([0, 0, 0]); }
      else pts.push([i - (n - 1) / 2, 0, 0]);
    }
    return pts;
  }

  function drawNewPreview() {
    const svg = $('#repPreview');
    if (!svg) return;
    const W = Math.max(200, Math.round(svg.getBoundingClientRect().width) || 316), H = 168, pad = 24, padB = 36;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pts = newPoints().map((p) => [p[0] + p[2] * 0.45, p[1] - p[2] * 0.3]);
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    pts.forEach((p) => { l = Math.min(l, p[0]); r = Math.max(r, p[0]); t = Math.min(t, p[1]); b = Math.max(b, p[1]); });
    const k = Math.min((W - pad * 2) / Math.max(0.001, r - l), (H - pad - padB) / Math.max(0.001, b - t), 60);
    const cx = (l + r) / 2, cy = (t + b) / 2 + (padB - pad) / 2 / Math.max(k, 0.001);
    const n = pts.length, sz = n > 160 ? 3 : n > 60 ? 5 : n > 24 ? 8 : 12;
    const srcs = Math.max(1, Math.min(3, (S.ae && S.ae.layers) || 1));
    const rnd = (i) => { const x = Math.sin(i * 91.17) * 43758.5; return x - Math.floor(x); };
    svg.innerHTML = pts.map((p, i) => {
      const x = (W / 2 + (p[0] - cx) * k), y = (H / 2 + (p[1] - cy) * k);
      const s = srcs > 1 ? (N.pick === 'random' ? Math.floor(rnd(i) * srcs) : i % srcs) : 0;
      return s === 1 ? `<circle class="s1" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${sz / 2}"/>`
        : `<rect class="s${s}" x="${(x - sz / 2).toFixed(1)}" y="${(y - sz / 2).toFixed(1)}" width="${sz}" height="${sz}" rx="${Math.max(1, sz / 4)}"/>`;
    }).join('');
    const tot = N.mode === 2 ? N.cols * N.rows * (N.threeD ? N.levels : 1) : N.count;
    const cap = $('#repNewCap');
    if (cap) cap.textContent = `${tot} ${tot === 1 ? 'copia' : 'copie'}${srcs > 1 ? ` da ${(S.ae && S.ae.layers) || srcs} layer` : ''}`;
  }

  async function repeatCreate() {
    const o = { mode: N.mode, count: N.count, cols: N.cols, rows: N.rows, levels: N.threeD ? N.levels : 1, threeD: N.threeD, pick: N.pick, front: N.front, hide: N.hide, place: N.place };
    const n = N.mode === 2 ? o.cols * o.rows * o.levels : o.count;
    if (n > 400) return toast(`Troppe copie (${n}). Il massimo è 400.`, 'err');
    toast('Creo le copie…');
    const res = await call('inflect_repeatCreate', o);
    if (!res.ok) return toast(res.error, 'err');
    toast(`${res.name} creato con ${res.count} copie.`);
    RP = null; repDataKey = ''; repForceNew = false; repShown = null;
    poll(true);
  }

  /* --- modifica del Cloner selezionato ------------------------------------ */

  let RP = null, repDataKey = '', repLastRead = 0, repBusy = false;
  // Si aspetta a ridisegnare solo mentre scrivi in un campo: pulsanti e menu non bloccano l'aggiornamento.
  // Si aspetta solo se stai davvero scrivendo: un tasto nel campo negli ultimi 2 secondi.
  let repKeyAt = 0;
  document.addEventListener('keydown', (e) => { if (e.target && e.target.closest && e.target.closest('#repEdit')) repKeyAt = Date.now(); }, true);
  const repTyping = () => isTyping($('#repEdit')) && Date.now() - repKeyAt < 2000;

  let repAgain = false;
  async function readRepeat(force) {
    // Una rilettura chiesta mentre un'altra e' in corso parte subito dopo (prima si perdeva e l'editor restava vecchio).
    if (repBusy) { if (force) repAgain = true; return; }
    if (!force && (Date.now() - repLastRead < 1200 || scrubbing || repTyping())) return;
    repBusy = true;
    const r = await call('inflect_repeatRead');
    repBusy = false;
    repLastRead = Date.now();
    if (repAgain) { repAgain = false; setTimeout(() => readRepeat(true), 0); }
    if (!r.ok) { if (r.error !== repLastErr) toast(`Cloner: ${r.error}`, 'err'); repLastErr = r.error; return; }
    repLastErr = '';
    const key = JSON.stringify(r.repeat);
    if (key === repDataKey && !force) return;
    repDataKey = key;
    RP = r.repeat;
    if (RP) renderRepeatEditor(!!force);
  }
  let repLastErr = '';
  // Il Cloner si rilegge da solo mentre usi il pannello (anche se la selezione non cambia),
  // e un ridisegno rimasto in attesa parte appena puo'.
  setInterval(() => {
    if (!panelLive() || currentView() !== 'repeat' || !RP) return;
    if (repRenderPending && !scrubbing && !repTyping()) renderRepeatEditor(true);
    else readRepeat(false);
  }, 1200);
  let repRenderPending = false;
  const repFlush = () => setTimeout(() => { if (repRenderPending && !scrubbing && !repTyping()) renderRepeatEditor(true); }, 0);
  $('#repEdit').addEventListener('focusout', repFlush);
  window.addEventListener('mouseup', repFlush);

  /*
   * Le modifiche arrivano ad After Effects una alla volta, nell'ordine in cui le fai.
   * Trascinando un valore, se un invio per lo stesso parametro aspetta ancora, si aggiorna il suo
   * valore invece di metterne in coda un altro: meno ricalcoli, pannello piu' fluido.
   * Ogni gesto (un trascinamento, un clic) ricorda quanti passi ha fatto in After Effects:
   * Cmd+Z dal pannello li annulla tutti insieme.
   */
  let setChain = Promise.resolve();
  const setPending = new Map();
  const UNDO = [], REDO = [];
  const SAME = ['inflect_repeatSet', 'inflect_falloffSet', 'inflect_repeatTSet'];
  function noteStep(key) {
    const now = Date.now(), top = UNDO[UNDO.length - 1];
    if (key && top && top.key === key && now - top.t < 1500) { top.count++; top.t = now; }
    else { UNDO.push({ key, count: 1, t: now }); if (UNDO.length > 80) UNDO.shift(); }
    REDO.length = 0;
  }
  function setParam(fn, ...args) {
    const key = SAME.includes(fn) ? fn + '|' + JSON.stringify(args.slice(0, -1)) : null;
    if (key && setPending.has(key)) { const job = setPending.get(key); job.args = args; return job.promise; }
    const job = { args };
    if (key) setPending.set(key, job);
    job.promise = setChain.then(async () => {
      if (key) setPending.delete(key);
      let res;
      try { res = await call(fn, ...job.args); } catch (e) { res = { ok: false, error: String(e) }; }
      if (!res || typeof res !== 'object') res = { ok: false, error: `Risposta inattesa da After Effects: ${res}` };
      if (res.ok && fn !== 'inflect_repeatRead' && fn !== 'inflect_falloffSelect' && fn !== 'inflect_repeatSelect') noteStep(key);
      if (!res.ok) toast(res.error || 'Errore sconosciuto', 'err');
      return res;
    });
    // La coda non resta mai bloccata, anche se un passaggio fallisce.
    setChain = job.promise.catch(() => {});
    return job.promise;
  }
  // Annulla o ripeti in After Effects l'ultimo gesto fatto dal pannello, poi rilegge tutto.
  async function aeUndo(redo) {
    const from = redo ? REDO : UNDO, to = redo ? UNDO : REDO;
    let g = from.pop();
    // Un gesto vecchio puo' avere sopra delle modifiche fatte a mano in After Effects: allora si
    // annulla un passo solo, come Cmd+Z in After Effects, per non tornare indietro troppo.
    if (g && Date.now() - g.t > 30000) { from.length = 0; g = null; }
    const n = g ? g.count : 1;
    const r = await call('inflect_aeUndo', !!redo, n);
    if (!r.ok) return toast(r.error, 'err');
    if (g) { g.t = Date.now(); to.push(g); }
    toast(`${redo ? 'Ripetuto' : 'Annullato'} in After Effects${n > 1 ? ` (${n} passi di un solo gesto)` : ''}.`);
    refreshAll();
  }
  function refreshAll() {
    lastStKey = ''; repDataKey = '';
    poll(true);
    if (currentView() === 'repeat') readRepeat(true);
    if (currentView() === 'text' && typeof txPoll === 'function') { txLastSel = ''; txPoll(true); }
  }
  const P = (name) => (v) => {
    if (RP) RP.params[name] = v;
    return setParam('inflect_repeatSet', name, v).then((res) => {
      if (res && res.ok && ['Quantità', 'Colonne', 'Righe', 'Livelli', 'Distribuzione'].includes(name)) { readRepeat(true); }
    });
  };
  const BP = (k, name) => (v) => setParam('inflect_repeatSet', `B${k} ${name}`, v).then(() => { repLastRead = 0; });
  const FP = (index, name) => (v) => setParam('inflect_falloffSet', index, name, v);

  function renderRepeatEditor(forced) {
    if (!RP) return;
    // Dopo una tua modifica si ridisegna sempre. Solo i giri automatici aspettano mentre scrivi o trascini.
    if (!forced && (scrubbing || repTyping())) { repRenderPending = true; return; }
    repRenderPending = false;
    try { renderRepeatBody(); } catch (e) { toast(`Errore nel pannello Cloner: ${e.message}`, 'err'); }
  }
  function renderRepeatBody() {
    const p = RP.params, m = Math.round(p['Distribuzione']);
    const td = RP.threeD;
    $('#repName').textContent = RP.name;
    const DN = ['in linea', 'in griglia', 'in cerchio', 'sparse', 'a spirale', 'su tracciato', 'su un punto'];
    $('#repMeta').textContent = `${RP.clones} ${RP.clones === 1 ? 'copia' : 'copie'} ${DN[m - 1] || ''}, ${td ? '3D' : '2D'}`;
    $('#repDistName').textContent = LISTS.dist[m - 1] || '';
    const setN = (id, n) => { const el = $(id); if (el) el.textContent = n ? String(n) : ''; };
    setN('#repFallN', (RP.falloffs || []).length);
    setN('#repBehN', (RP.behaviours || []).filter((b) => !isFallLink(b)).length);
    setN('#repSrcN', ((RP.inputs || RP.sources || []).length));

    /* Distribuzione */
    const dist = $('#repDistBody');
    dist.textContent = '';
    const axes = td ? ['X', 'Y', 'Z'] : ['X', 'Y'];
    const st = p['Passo'] || [0, 0, 0];
    const setVec = (name, cur) => (vals) => P(name)(td ? vals : [vals[0], vals[1], (cur || [0, 0, 0])[2] || 0]);
    add(dist,
      distTiles(m, (v) => P('Distribuzione')(+v)),
      krow(null, 'Spazio', segc([[0, '2D'], [1, '3D', 'Controllo, copie e falloff collegati diventano 3D']], td ? 1 : 0, (v) => setParam('inflect_repeatSet', 'threeD', +v).then(() => readRepeat(true)))),
    );
    if (m === 2) {
      add(dist, 
        krow(kf('ctrl', 0, 'Colonne'), 'Colonne', hot(p['Colonne'], P('Colonne'), { min: 1 })),
        krow(kf('ctrl', 0, 'Righe'), 'Righe', hot(p['Righe'], P('Righe'), { min: 1 })),
        td ? krow(kf('ctrl', 0, 'Livelli'), 'Livelli', hot(p['Livelli'], P('Livelli'), { min: 1 })) : null,
      );
    } else {
      add(dist, krow(kf('ctrl', 0, 'Quantità'), 'Quantità', hot(p['Quantità'], P('Quantità'), { min: 1, tip: 'Numero di copie' })));
    }
    if (m === 1 || m === 2) {
      const mm = Math.round(p['Modo misura']) || 1;
      const reload = () => readRepeat(true);
      add(dist,
        krow(null, 'Misura', segc([[3, 'Distanza', 'Spazio tra i bordi delle copie: il passo tiene conto della loro dimensione'], [1, 'Passo', 'Distanza da centro a centro'], [2, 'Adatta', 'Le copie si distribuiscono dentro questa dimensione totale']], mm, (v) => P('Modo misura')(+v).then(reload))));
      if (mm === 3) {
        const sp = p['Distanza'] || [0, 0, 0], dc = p['Dimensione copia'] || [100, 100, 100];
        const vert = Math.round(p['Direzione griglia']) === 2;
        if (m === 1) {
          add(dist,
            krow(null, 'Direzione', segc([[1, 'Orizzontale'], [2, 'Verticale']], vert ? 2 : 1, (v) => P('Direzione griglia')(+v).then(reload))),
            krow(kf('ctrl', 0, 'Distanza'), 'Distanza', hot(vert ? sp[1] : sp[0], (x) => { const a = sp.slice(); a[vert ? 1 : 0] = x; P('Distanza')(a).then(reload); }, { tip: 'Spazio tra il bordo di una copia e quello della successiva. Negativo: si sovrappongono' }), unit('px')));
        } else {
          add(dist, krow(kf('ctrl', 0, 'Distanza'), 'Distanza', vec(axes, sp, (vals) => P('Distanza')(td ? vals : [vals[0], vals[1], sp[2] || 0]).then(reload)), unit('px')));
        }
        const bMis = h('button', { class: 'btn sm', text: 'Rimisura', 'data-tip': 'Rileggi la dimensione delle sorgenti, se le hai cambiate o scalate' });
        bMis.addEventListener('click', async () => { const r = await setParam('inflect_repeatMeasure'); if (r.ok) { toast(`Copie di ${r.size[0]} \u00d7 ${r.size[1]} px.`); reload(); } });
        add(dist, krow(null, 'Copia', h('span', { class: 'hint', text: `${dc[0]} \u00d7 ${dc[1]} px` }), bMis));
      } else {
        add(dist, krow(kf('ctrl', 0, 'Passo'), mm === 2 ? 'Dimensione' : 'Passo', vec(axes, st, (vals) => setVec('Passo', st)(vals).then(reload))));
      }
      // Misure vere nella composizione: quello che vedi, con scala del Cloner e delle copie.
      const M = RP.measure || {};
      const fmt = (x) => (x == null ? '-' : `${Math.round(x)} px`);
      const line = (lab, q) => (q ? `${lab}: ${fmt(q.center)} da centro a centro, ${fmt(q.gap)} tra i bordi` : null);
      const txt = [line(m === 2 ? 'Orizzontale' : 'Tra le copie', M.h), m === 2 ? line('Verticale', M.v) : null].filter(Boolean).join('. ');
      if (txt) add(dist, krow(null, 'Misure', h('span', { class: 'hint repmeasure', text: txt, 'data-tip': 'Misure reali nella composizione, nel fotogramma corrente' })));
      if (m === 2) {
        add(dist, 
          krow(null, 'Ordine', segc([[1, 'Per righe'], [2, 'Per colonne']], Math.round(p['Direzione griglia']), (v) => P('Direzione griglia')(+v))),
          krow(kf('ctrl', 0, 'Sfalsa righe'), 'Sfalsa righe', hot(p['Sfalsa righe'], P('Sfalsa righe'), { tip: 'Sposta in orizzontale una riga sì e una no' }), unit('px')),
        );
      }
      add(dist, krow(null, 'Centra', check('Attorno al controllo', p['Centra'], P('Centra'))));
    }
    if (m === 3 || m === 5) {
      add(dist, 
        krow(kf('ctrl', 0, 'Raggio'), 'Raggio', hot(p['Raggio'], P('Raggio')), unit('px')),
        krow(kf('ctrl', 0, 'Angolo iniziale'), 'Angolo iniziale', hot(p['Angolo iniziale'], P('Angolo iniziale')), unit('°')),
        m === 3 ? krow(kf('ctrl', 0, 'Arco'), 'Arco', hot(p['Arco'], P('Arco'), { tip: '360 per un cerchio completo' }), unit('°')) : null,
        m === 3 ? krow(kf('ctrl', 0, 'Scorrimento'), 'Scorrimento', hot(p['Scorrimento'], P('Scorrimento'), { tip: 'Fa scorrere le copie lungo il cerchio. Animalo per farle girare' }), unit('%')) : null,
        td ? krow(null, 'Piano', segc([[1, 'XY'], [2, 'XZ', 'Sul pavimento'], [3, 'YZ']], Math.round(p['Piano']), (v) => P('Piano')(+v))) : null,
        krow(null, 'Orienta', check('Ruota verso l’esterno', p['Orienta'], P('Orienta'))),
        krow(null, 'Senso', check('Antiorario', p['Inverti senso'], P('Inverti senso'))),
      );
    }
    if (m === 4) {
      const ar = p['Area'] || [0, 0, 0];
      add(dist, krow(kf('ctrl', 0, 'Area'), 'Area', vec(axes, ar, setVec('Area', ar))), krow(kf('ctrl', 0, 'Seme'), 'Seme', hot(p['Seme'], P('Seme'), { min: 0 })));
    }
    if (m === 6) {
      const opts = [[0, 'Nessuno']].concat(RP.paths.map((l) => [l.index, l.name]));
      add(dist, 
        krow(null, 'Tracciato', select(opts, p['Tracciato'] || 0, (v) => P('Tracciato')(+v), { tip: 'Un layer con una maschera o un livello forma con un tracciato' })),
        krow(kf('ctrl', 0, 'Scorrimento'), 'Scorrimento', hot(p['Scorrimento'], P('Scorrimento'), { tip: 'Animalo per far scorrere le copie lungo il tracciato' }), unit('%')),
        krow(null, 'Orienta', check('Segui il tracciato', p['Orienta'], P('Orienta'))),
      );
      if (!RP.paths.length) add(dist, h('p', { class: 'hint', text: 'Disegna una maschera su un layer o un tracciato con lo strumento penna, poi sceglilo qui.' }));
    }

    /* Sorgenti */
    const src = $('#repSrcBody');
    src.textContent = '';
    add(src, inputList());
    const ins = RP.inputs || RP.sources.map((n) => ({ name: n, copies: 0 }));
    if (ins.length > 1) {
      const pk = String(RP.pick || 'cycle'), only = /^only:(\d+)$/.exec(pk);
      const setPick = async (v) => { const r = await setParam('inflect_repeatSet', 'pick', JSON.stringify(v)); if (r.ok) readRepeat(true); };
      add(src, krow(null, 'Uso', select([['cycle', 'A turno'], ['random', 'Casuale'], ['pingpong', 'Avanti e indietro'], ['stretch', 'A blocchi'], ['only', 'Solo uno']], only ? 'only' : pk,
        (v) => setPick(v === 'only' ? 'only:0' : v), { tip: 'Come ogni copia sceglie il suo input. A blocchi: il primo input per le prime copie, poi il secondo, e cos\u00ec via' })));
      if (only) add(src, krow(null, 'Input', select(ins.map((x, ix) => [ix, `${ix + 1}. ${x.name}`]), +only[1], (v) => setPick('only:' + v), { tip: 'Tutte le copie usano questo input' })));
    }
    add(src, 
      krow(null, 'In primo piano', segc([['last', 'Ultima'], ['first', 'Prima']], RP.front, (v) => setParam('inflect_repeatSet', 'front', v))),
      krow(null, 'Allinea', segc([[1, 'Centro', 'Ogni copia si posa sul punto con il centro del suo contenuto'], [2, 'Ancoraggio', 'Ogni copia si posa sul punto con il suo punto di ancoraggio']], Math.round(p['Allinea copie'] || 1), (v) => P('Allinea copie')(+v))),
      krow(kf('ctrl', 0, 'Seme'), 'Seme', hot(p['Seme'], P('Seme'), { min: 0, tip: 'Cambia tutte le scelte casuali: posizioni, sorgenti, comportamenti' })),
    );

    /* Trasforma */
    const tr = $('#repTrBody');
    tr.textContent = '';
    const tp = p['Trasforma posizione'] || [0, 0, 0];
    add(tr, 
      krow(kf('ctrl', 0, 'Trasforma posizione'), 'Posizione', vec(axes, tp, setVec('Trasforma posizione', tp))),
      krow(kf('ctrl', 0, 'Trasforma scala'), 'Scala', hot(p['Trasforma scala'], P('Trasforma scala')), unit('%')),
      krow(kf('ctrl', 0, 'Trasforma rotazione'), 'Rotazione', hot(p['Trasforma rotazione'], P('Trasforma rotazione')), unit('°')),
      krow(kf('ctrl', 0, 'Trasforma opacità'), 'Opacità', hot(p['Trasforma opacità'], P('Trasforma opacità'), { min: 0, max: 100 }), unit('%')),
      h('p', { class: 'hint', text: 'Questi valori cambiano ogni copia. Animali con il rombo: uno Stagger sul Tempo li fa partire una copia dopo l\u2019altra.' }),
    );
    const G = RP.group || {};
    const GS = (name) => (v) => setParam('inflect_repeatTSet', 'ctrlT', 0, name, v).then(() => { repLastRead = 0; });
    add(tr, h('div', { class: 'subhead', text: 'Gruppo' }),
      td ? krow(kf('ctrlT', 0, 'Rotazione X'), 'Inclinazione X', hot(G['Rotazione X'], GS('Rotazione X'), { tip: 'Inclina tutto il Cloner in avanti o indietro' }), unit('\u00b0')) : null,
      td ? krow(kf('ctrlT', 0, 'Rotazione Y'), 'Rotazione Y', hot(G['Rotazione Y'], GS('Rotazione Y'), { tip: 'Fa girare tutto il Cloner attorno all\u2019asse verticale. Animalo per un anello che ruota' }), unit('\u00b0')) : null,
      krow(kf('ctrlT', 0, 'Rotazione Z'), td ? 'Rotazione Z' : 'Rotazione', hot(G['Rotazione Z'], GS('Rotazione Z'), { tip: 'Ruota tutto il Cloner' }), unit('\u00b0')),
      krow(kf('ctrlT', 0, 'Scala'), 'Scala', hot(G['Scala'], GS('Scala'), { tip: 'Scala tutto il Cloner' }), unit('%')),
      h('div', { class: 'prow k top' }, h('span', { class: 'kfsp' }), h('span', { class: 'plabel', text: 'Ancoraggio', 'data-tip': 'Il punto attorno a cui ruota e scala tutto il Cloner. Le copie non si spostano' }), clonerAnchorGrid(),
        h('div', { class: 'anchoracts' }, (() => { const b = h('button', { class: 'btn sm', text: 'Centra nella composizione', 'data-tip': 'Ancoraggio al centro delle copie e Cloner al centro della composizione' }); b.addEventListener('click', async () => { const r = await setParam('inflect_clonerCenter', true); if (r.ok) { toast('Cloner al centro della composizione.'); readRepeat(true); } }); return b; })())),
    );

    /* Comportamenti */
    const bb = $('#repBehBody');
    bb.textContent = '';
    const own = RP.behaviours.filter((b) => !isFallLink(b));
    if (!own.length) add(bb, h('p', { class: 'none', text: 'Nessun comportamento. Usa + per aggiungerne uno: Stagger, Casuale, Rumore, Oscillatore.' }));
    own.forEach((b) => add(bb, behaviourBlock(b)));

    /* Falloff */
    const fb = $('#repFallBody');
    fb.textContent = '';
    if (!RP.falloffs.length) add(fb, h('p', { class: 'none', text: 'Nessun falloff. Usa + per crearne uno: le copie nella sua area cambiano scala, opacità, colore o posizione.' }));
    RP.falloffs.forEach((f) => add(fb, falloffBlock(f)));
    renderRepeatLists();
  }

  function behaviourBlock(b) {
    const k = b.k, typ = Math.round(b['Tipo']), dst = Math.round(b['Destinazione']), u = DEST_UNIT[dst - 1] || '';
    const block = h('div', { class: 'beh' + (b['Attivo'] ? '' : ' off') });
    const on = h('input', { type: 'checkbox', 'data-tip': 'Attiva o disattiva' });
    on.checked = !!b['Attivo'];
    on.addEventListener('change', () => { block.classList.toggle('off', !on.checked); BP(k, 'Attivo')(on.checked ? 1 : 0); });
    const rm = h('button', { class: 'ibtn sm', 'data-tip': 'Togli questo comportamento' });
    rm.innerHTML = '<svg viewBox="0 0 16 16"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>';
    rm.addEventListener('click', async () => { await setParam('inflect_repeatRemoveBehaviour', k); readRepeat(true); });
    add(block, h('div', { class: 'beh-head' },
      h('span', { class: 'beh-tag', style: `background:${BEH_COLOR[typ - 1]}` }),
      h('label', { class: 'check' }, on),
      select(LISTS.tipo, typ, (v) => BP(k, 'Tipo')(+v).then(() => readRepeat(true)), { tip: 'Tipo di comportamento' }),
      h('span', { class: 'arrow', text: '→' }),
      select(LISTS.dest, dst, (v) => BP(k, 'Destinazione')(+v).then(() => readRepeat(true)), { tip: 'Cosa modifica nelle copie' }),
      h('span', { class: 'grow' }),
      rm,
    ));
    if (dst === 10) {
      // Destinazione Colore: il colore che le copie prendono, con forza data dal valore (in %).
      add(block, krow(null, 'Colore', colorField(rgbToHex(b['Colore']), (hex) => BP(k, 'Colore')(hexToRgba(hex)), { tip: 'Colore che le copie prendono' })));
    }
    if (typ === 6) {
      add(block, h('div', { class: 'prow k top' }, h('span', { class: 'kfsp' }), h('span', { class: 'plabel', text: 'Valori' }),
        listEditor(`B${k}`, 'number', (RP.data || {})[`B${k}`], `Es. 0, 90, 180 (${u})`)));
    } else if (typ === 5) {
      add(block, krow(kf('ctrl', 0, `B${k} Max`), 'Valore', hot(b['Max'], BP(k, 'Max')), unit(u)));
    } else {
      add(block, krow(kf('ctrl', 0, `B${k} Min`), typ === 1 ? 'Da' : 'Min', hot(b['Min'], BP(k, 'Min')), unit(u)), krow(kf('ctrl', 0, `B${k} Max`), typ === 1 ? 'A' : 'Max', hot(b['Max'], BP(k, 'Max')), unit(u)));
    }
    if (typ === 1) {
      add(block, 
        krow(null, 'Ordine', select(LISTS.ordine, Math.round(b['Ordine']), (v) => BP(k, 'Ordine')(+v), { tip: 'In che ordine le copie vanno dal primo al secondo valore' })),
        krow(null, 'Curva', select(LISTS.curva, Math.round(b['Curva']), (v) => BP(k, 'Curva')(+v), { tip: 'Come si distribuiscono i valori tra le copie' })),
      );
    }
    if (typ === 3) {
      add(block, 
        krow(kf('ctrl', 0, `B${k} Frequenza`), 'Variazione', hot(b['Frequenza'], BP(k, 'Frequenza'), { step: 0.1, tip: 'Quanto cambia il rumore da una copia all’altra' })),
        row('Velocità', hot(b['Fase'], BP(k, 'Fase'), { tip: 'Velocità dell’animazione del rumore' })),
      );
    }
    if (typ === 4) {
      add(block, 
        krow(kf('ctrl', 0, `B${k} Frequenza`), 'Frequenza', hot(b['Frequenza'], BP(k, 'Frequenza'), { step: 0.1 }), unit('Hz')),
        krow(kf('ctrl', 0, `B${k} Fase`), 'Sfasamento', hot(b['Fase'], BP(k, 'Fase'), { tip: 'Ritardo dell’onda tra una copia e la successiva' }), unit('°')),
      );
    }
    if (typ === 2 || typ === 3 || (typ === 1 && Math.round(b['Ordine']) === 5)) add(block, krow(null, 'Seme', hot(b['Seme'], BP(k, 'Seme'), { min: 0 })));
    const fopts = [[0, 'Nessuno']].concat(RP.falloffs.map((f) => [f.index, f.name])).concat([['new', 'Nuovo falloff…']]);
    add(block, krow(null, 'Falloff', select(fopts, b['Falloff'] || 0, async (v) => {
      if (v === 'new') { const r = await setParam('inflect_falloffCreate', 1, k); if (r.ok) toast(`${r.name} creato e collegato. Spostalo nella composizione.`); readRepeat(true); }
      else { await BP(k, 'Falloff')(+v); readRepeat(true); }
    }, { tip: 'Limita il comportamento all’area di un falloff' })));
    return block;
  }

  // Input del Cloner, come la lista Input Shapes di Cavalry: ogni riga si seleziona, si sposta, si sostituisce o si toglie.
  // Scelta dei layer nella composizione: il Cloner resta fissato finche' confermi o annulli.
  let repPick = null;
  async function startPick(action, ix) {
    const r = await call('inflect_repeatPin', true);
    if (!r.ok) return toast(r.error, 'err');
    repPick = { action, ix };
    repDataKey = ''; readRepeat(true);
  }
  async function endPick() { repPick = null; await call('inflect_repeatPin', false); repDataKey = ''; readRepeat(true); }
  function inputList() {
    const ins = RP.inputs || RP.sources.map((n) => ({ name: n, copies: 0 }));
    const box = h('div', { class: 'inlist' });
    const act = async (action, ix, okMsg) => {
      const r = await setParam('inflect_repeatInput', action, ix);
      if (r.ok) { repPick = null; if (okMsg) toast(okMsg(r)); }
      readRepeat(true);
    };
    const ib = (path, tip, fn, dis) => { const b = h('button', { class: 'ibtn sm', 'data-tip': tip }); b.innerHTML = `<svg viewBox="0 0 16 16"><path d="${path}"/></svg>`; if (dis) b.disabled = true; b.addEventListener('click', fn); return b; };
    ins.forEach((x, ix) => {
      const nm = h('button', { class: 'in-name', text: x.name, 'data-tip': x.missing ? 'Questo layer non c\u2019\u00e8 pi\u00f9: sostituiscilo o toglilo' : 'Seleziona il layer nella composizione, per modificarlo' });
      nm.addEventListener('click', async () => { const r = await call('inflect_repeatInput', 'select', ix); if (r.ok) toast(r.hidden ? `${r.name} selezionato. \u00c8 nascosto: le copie lo seguono quando lo modifichi e fai Aggiorna copie.` : `${r.name} selezionato.`); else toast(r.error, 'err'); });
      add(box, h('div', { class: 'in-row' + (x.missing ? ' missing' : '') },
        h('span', { class: 'in-id', text: String(ix + 1) }), nm,
        h('span', { class: 'in-count', text: x.copies ? `${x.copies}` : '', 'data-tip': 'Copie che usano questo input' }),
        ib('M8 12.5v-9M4.5 7 8 3.5 11.5 7', 'Sposta su', () => act('up', ix), ix === 0),
        ib('M8 3.5v9M4.5 9 8 12.5 11.5 9', 'Sposta gi\u00f9', () => act('down', ix), ix === ins.length - 1),
        ib('M3.5 6.5a4.5 4.5 0 0 1 8.3-1.8M12.5 9.5a4.5 4.5 0 0 1-8.3 1.8M12 2.5v2.4H9.6M4 13.5v-2.4h2.4', 'Sostituisci con un altro layer', () => startPick('replace', ix)),
        ib('m4.5 4.5 7 7M11.5 4.5l-7 7', 'Togli questo input', () => act('remove', ix, () => 'Input tolto.'), ins.length <= 1),
      ));
      // Scala dell'input e, per forme e testi, il suo colore.
      const IP = (name) => (v) => setParam('inflect_repeatSet', `I${ix + 1} ${name}`, v);
      const sub = h('div', { class: 'in-sub' },
        kf('ctrl', 0, `I${ix + 1} Scala`), h('span', { class: 'in-lab', text: 'Scala' }),
        hot(x.scale === undefined ? 100 : x.scale, IP('Scala'), { min: 0, tip: 'Grandezza delle copie di questo input. Con la misura Distanza lo spazio tra le copie si adatta' }), unit('%'));
      if (x.vector) {
        let col = null;
        const on = check('Colore', x.colorOn, async (v) => { await IP('Colora')(v); if (col) col.setDisabled(!v); });
        col = colorField(rgbToHex(x.color), (hex) => IP('Colore')(hexToRgba(hex)), { disabled: !x.colorOn, tip: 'Colore delle copie di questo input' });
        add(sub, h('span', { class: 'grow' }), on, col);
      }
      add(box, sub);
    });
    if (repPick) {
      const rp = repPick, isAdd = rp.action === 'add';
      const ok = h('button', { class: 'btn sm primary', text: isAdd ? 'Aggiungi' : 'Sostituisci' });
      ok.addEventListener('click', () => act(rp.action, rp.ix, (r) => isAdd ? `${r.added === 1 ? 'Un input aggiunto' : r.added + ' input aggiunti'}: ora sono ${r.inputs}.` : 'Input sostituito, copie rifatte.'));
      const no = h('button', { class: 'btn sm', text: 'Annulla' });
      no.addEventListener('click', endPick);
      add(box, h('div', { class: 'in-pick' },
        h('p', { text: isAdd ? 'Seleziona nella composizione i layer da aggiungere, poi premi Aggiungi. Il pannello resta su questo Cloner.' : `Seleziona nella composizione il layer che prende il posto di ${(ins[rp.ix] || {}).name || 'questo input'}, poi premi Sostituisci.` }),
        h('div', { class: 'btnrow' }, ok, no)));
    } else {
      const addb = h('button', { class: 'btn sm in-add', text: '+ Aggiungi input', 'data-tip': 'Scegli nella composizione uno o pi\u00f9 layer: diventano input del Cloner e vengono nascosti' });
      addb.addEventListener('click', () => startPick('add', 0));
      add(box, addb);
    }
    return box;
  }

  function falloffBlock(f) {
    const ix = f.index;
    const FT = (name) => (v) => setParam('inflect_repeatTSet', 'fallT', ix, name, v).then((r) => { repLastRead = 0; return r; });
    const block = h('div', { class: 'beh' });
    const name = h('button', { class: 'fall-name', text: f.name, 'data-tip': 'Seleziona il layer del falloff nella composizione' });
    name.addEventListener('click', () => setParam('inflect_falloffSelect', ix));
    add(block, h('div', { class: 'beh-head' }, h('span', { class: 'beh-tag', style: 'background:#6aa9ff' }), name, h('span', { class: 'grow' }),
      segc([[1, 'Cerchio'], [2, 'Rettangolo'], [3, 'Lineare', 'Pieno a sinistra, vuoto a destra']], Math.round(f['Forma']), (v) => FP(ix, 'Forma')(+v))));
    const sz = f['Dimensione'] || [500, 500];
    // Dimensione collegata: cambi la larghezza e l'altezza segue in proporzione (lucchetto per scollegarle).
    let linked = true;
    try { linked = localStorage.getItem('mt.fallLink') !== '0'; } catch (e) {}
    const lock = h('button', { class: 'ibtn sm lockbtn' + (linked ? ' is-on' : ''), 'data-tip': 'Larghezza e altezza collegate' });
    lock.innerHTML = '<svg viewBox="0 0 16 16"><path d="M6.5 9.5 9.5 6.5"/><path d="M7 4.5 8.6 2.9a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5l-1.6 1.6a2.5 2.5 0 0 1-3.5-3.5L5.5 8"/></svg>';
    let szIn = null;
    const setSize = (v) => {
      let w = v[0], hh = v[1];
      if (lock.classList.contains('is-on')) {
        const r = sz[0] ? sz[1] / sz[0] : 1;
        if (w !== sz[0]) hh = Math.round(w * r * 10) / 10; else if (hh !== sz[1]) w = Math.round((r ? hh / r : hh) * 10) / 10;
        const ins = szIn ? szIn.querySelectorAll('input') : [];
        if (ins[0]) ins[0].value = w; if (ins[1]) ins[1].value = hh;
      }
      sz[0] = w; sz[1] = hh;
      return FP(ix, 'Dimensione')([w, hh]);
    };
    lock.addEventListener('click', () => { const on = !lock.classList.contains('is-on'); lock.classList.toggle('is-on', on); try { localStorage.setItem('mt.fallLink', on ? '1' : '0'); } catch (e) {} });
    szIn = vec(['L', 'A'], sz, setSize);
    add(block, 
      krow(kf('fallT', ix, 'Posizione'), 'Posizione', vec(f.threeD ? ['X', 'Y', 'Z'] : ['X', 'Y'], f['Posizione'] || [0, 0, 0], (v) => setParam('inflect_repeatTSet', 'fallT', ix, 'Posizione', v).then(() => { repLastRead = 0; }), { tip: f.threeD ? 'In 3D, una Z negativa porta il falloff verso la camera' : '' })),
      ...(f.threeD
        ? ['X', 'Y', 'Z'].map((ax) => krow(kf('fallT', ix, `Rotazione ${ax}`), `Rotazione ${ax}`, hot(f[`Rotazione ${ax}`] || 0, FT(`Rotazione ${ax}`)), unit('\u00b0')))
        : [krow(kf('fallT', ix, 'Rotazione Z'), 'Rotazione', hot(f['Rotazione Z'] || 0, FT('Rotazione Z'), { tip: 'Ruota il falloff: utile con il Rettangolo e il Lineare' }), unit('\u00b0'))]),
      krow(kf('fall', ix, 'Dimensione'), 'Dimensione', szIn, lock),
      f.threeD ? krow(kf('fall', ix, 'Profondit\u00e0'), 'Profondit\u00e0', hot(f['Profondit\u00e0'] || 0, FP(ix, 'Profondit\u00e0'), { min: 0, tip: 'Profondit\u00e0 del falloff lungo Z. Con 0 \u00e8 uguale alla larghezza' }), unit('px')) : null,
      krow(kf('fall', ix, 'Morbidezza'), 'Sfumatura', hot(f['Morbidezza'], FP(ix, 'Morbidezza'), { min: 0, max: 400, tip: 'Quanto si allarga l\u2019effetto fuori dall\u2019area, in % della dimensione. Le copie in questa fascia ricevono un po\u2019 di effetto' }), unit('%')),
      krow(kf('fall', ix, 'Intensit\u00e0'), 'Intensit\u00e0', hot(f['Intensit\u00e0'], FP(ix, 'Intensit\u00e0'), { tip: 'Moltiplica la forza dei comportamenti collegati' }), unit('%')),
      krow(null, 'Opzioni', check('Inverti', f['Inverti'], FP(ix, 'Inverti')), check('Probabilità', f['Probabilità'], FP(ix, 'Probabilità'), 'Ogni copia è accesa o spenta a caso, con probabilità pari al peso del falloff')),
      f['Probabilit\u00e0'] ? krow(null, 'Seme', hot(f['Seme'], FP(ix, 'Seme'), { min: 0 })) : null,
      krow(null, 'Vista', check('Contorno visibile', f.outline, async (v) => { const r = await setParam('inflect_falloffOutline', ix, !!v); if (r.ok) readRepeat(true); },
        'Mostra il cerchio del falloff nella composizione. Nell\u2019export non c\u2019\u00e8 mai: \u00e8 un livello guida e di regolazione')),
    );
    // Agisce su: cosa cambia nelle copie dentro il falloff. Ogni voce e' un comportamento Valore collegato.
    add(block, h('div', { class: 'subhead', text: 'Agisce su' }));
    const links = RP.behaviours.filter((b) => isFallLink(b) && +b['Falloff'] === ix);
    if (!links.length) add(block, h('p', { class: 'hint', text: 'Ancora niente: scegli qui sotto cosa cambia nelle copie dentro il falloff.' }));
    links.forEach((b) => add(block, fallLinkRow(b)));
    const used = links.map((b) => Math.round(b['Destinazione']));
    // In 3D (Cloner o falloff) il falloff agisce anche su rotazione X e Y e sulla profondita'.
    const td3 = !!(RP.threeD || f.threeD);
    const adds = FALL_TARGETS.filter((t) => (!used.includes(t.dest) || t.dest === 10) && (!t.only3D || td3)).map((t) => {
      const lab = td3 && t.label3 ? t.label3 : t.label;
      const bt = h('button', { class: 'chipbtn', text: `+ ${lab}`, 'data-tip': t.tip });
      bt.addEventListener('click', async () => {
        const r = await setParam('inflect_falloffLink', ix, t.dest, t.amount, t.dest === 10 ? hexToRgba('#FF5A1F') : null);
        if (r.ok) fallReport(r.check, f.name, lab);
        readRepeat(true);
      });
      return bt;
    });
    add(block, h('div', { class: 'chiprow' }, ...adds));
    return block;
  }
  // Collegamenti rapidi del falloff: destinazione, quanto cambia al centro, unita'.
  const FALL_TARGETS = [
    { dest: 7, label: 'Scala', amount: 100, unit: '%', tip: 'Al centro del falloff le copie si ingrandiscono (+100: il doppio). Le posizioni restano dove sono. Con un valore negativo si rimpiccioliscono' },
    { dest: 8, label: 'Opacità', amount: -100, unit: '%', tip: 'Al centro del falloff le copie diventano trasparenti' },
    { dest: 10, label: 'Colore', amount: 100, unit: '%', tip: 'Le copie nel falloff prendono un colore' },
    { dest: 4, label: 'Rotazione', label3: 'Rotazione Z', amount: 90, unit: '°', tip: 'Le copie nel falloff ruotano' },
    { dest: 5, label: 'Rotazione X', amount: 90, unit: '°', only3D: true, tip: 'In 3D, le copie nel falloff si ribaltano in avanti' },
    { dest: 6, label: 'Rotazione Y', amount: 90, unit: '°', only3D: true, tip: 'In 3D, le copie nel falloff girano su se stesse' },
    { dest: 1, label: 'Posizione X', amount: 100, unit: 'px', tip: 'Le copie nel falloff si spostano a destra' },
    { dest: 2, label: 'Posizione Y', amount: -100, unit: 'px', tip: 'Le copie nel falloff si alzano' },
    { dest: 3, label: 'Posizione Z', amount: -300, unit: 'px', only3D: true, tip: 'In 3D, le copie nel falloff vengono verso la camera' },
  ];
  // Cosa ha calcolato After Effects dopo il collegamento: quante copie cambiano, o l'errore vero.
  function fallReport(c, fname, label) {
    const what = label.toLowerCase();
    if (!c) { toast(`${fname} ora cambia ${what} delle copie.`); return; }
    if (c.error) { toast(`Il falloff non agisce: After Effects segnala "${c.error}". Clicca per copiare l'errore.`, 'err'); return; }
    if (c.affected > 0) { toast(`${fname} cambia ${what} di ${c.affected} copie su ${c.total}.`); return; }
    if (c.weight > 0) { toast(`Il falloff tocca le copie ma il valore non arriva (dati: ${JSON.stringify(c)}). Clicca per copiare e incollalo in chat.`, 'err'); return; }
    toast(`${fname} è collegato, ma nessuna copia è dentro il falloff. Spostalo sopra le copie o ingrandiscilo.`);
  }
  // Un comportamento Valore con un falloff e' un collegamento del falloff: si mostra li'.
  const isFallLink = (b) => Math.round(b['Tipo']) === 5 && +b['Falloff'] > 0;
  function fallLinkRow(b) {
    const k = b.k, dst = Math.round(b['Destinazione']), t0 = FALL_TARGETS.find((x) => x.dest === dst) || { label: (LISTS.dest || [])[dst - 1] || 'Valore', unit: DEST_UNIT[dst - 1] || '' };
    const t = RP && RP.threeD && t0.label3 ? Object.assign({}, t0, { label: t0.label3 }) : t0;
    const rm = h('button', { class: 'ibtn sm', 'data-tip': 'Togli questo effetto del falloff' });
    rm.innerHTML = '<svg viewBox="0 0 16 16"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>';
    rm.addEventListener('click', async () => { await setParam('inflect_repeatRemoveBehaviour', k); readRepeat(true); });
    const ck = h('button', { class: 'ibtn sm', 'data-tip': 'Verifica in After Effects quante copie cambia' });
    ck.innerHTML = '<svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7"/></svg>';
    ck.addEventListener('click', async () => {
      const r = await call('inflect_falloffCheck', k);
      if (r && r.ok) fallReport(r.check, 'Il falloff', t.label); else toast((r && r.error) || 'Verifica non riuscita.', 'err');
    });
    const ctrls = [hot(b['Max'], BP(k, 'Max'), { tip: dst === 10 ? 'Quanto si vede il colore al centro del falloff' : 'Quanto cambia al centro del falloff' }), unit(t.unit)];
    if (dst === 10) ctrls.push(colorField(rgbToHex(b['Colore']), (hex) => BP(k, 'Colore')(hexToRgba(hex)), { tip: 'Colore che le copie prendono nel falloff' }));

    const main = h('div', { class: 'prow k fall-link' }, kf('ctrl', 0, `B${k} Max`), h('span', { class: 'plabel', text: t.label }), ...ctrls, h('span', { class: 'grow' }), ck, rm);
    if (dst !== 7) return main;
    // Scala: le copie che crescono spingono via le vicine, cosi' le distanze restano quelle della griglia.
    const keep = h('div', { class: 'prow fall-sub' }, h('span', { class: 'plabel' }),
      check('Mantieni le distanze', b['Mantieni spazi'], async (v) => { await BP(k, 'Mantieni spazi')(v); readRepeat(true); }, 'Le copie che crescono spingono via le vicine, così non si toccano'));
    return h('div', {}, main, keep);
  }
  const rgbToHex = (c) => { const a = Array.isArray(c) ? c : [1, 0.35, 0.12]; return '#' + a.slice(0, 3).map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const hexToRgba = (hx) => { const f = String(hx).replace('#', ''); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255).concat([1]); };

  async function addBehaviour(anchor) {
    openMenu(anchor, LISTS.tipo.map((t, ix) => ({
      label: t,
      run: async () => {
        const d = BEH_DEFAULTS[ix + 1];
        const r = await setParam('inflect_repeatAddBehaviour', { tipo: ix + 1, dest: d.dest, min: d.min, max: d.max });
        if (r.ok) toast(`Comportamento ${t} aggiunto: scegli cosa modifica.`);
        readRepeat(true);
      },
    })));
  }

  async function addFalloff(anchor) {
    openMenu(anchor, LISTS.forma.map((t, ix) => ({
      label: t,
      run: async () => {
        const r = await setParam('inflect_falloffCreate', ix + 1, 0);
        if (r.ok) toast(`${r.name} creato. Collegalo a un comportamento.`);
        readRepeat(true);
      },
    })));
  }

  function clonerAnchorGrid() {
    const g = h('div', { class: 'minigrid', role: 'group', 'aria-label': 'Punto di ancoraggio del Cloner' });
    const names = [['in alto a sinistra', 'in alto', 'in alto a destra'], ['a sinistra', 'al centro', 'a destra'], ['in basso a sinistra', 'in basso', 'in basso a destra']];
    [0, 0.5, 1].forEach((fy, r) => [0, 0.5, 1].forEach((fx, c) => {
      const b = h('button', { class: 'mdot', 'data-tip': `Ancoraggio ${names[r][c]} delle copie` });
      b.addEventListener('click', async () => {
        const res = await setParam('inflect_clonerAnchor', fx, fy);
        if (res.ok) { $$('.mdot', g).forEach((x) => x.classList.toggle('is-on', x === b)); toast(`Ancoraggio del Cloner ${names[r][c]}.`); }
      });
      g.append(b);
    }));
    return g;
  }

  function repeatMenu(anchor) {
    openMenu(anchor, [
      { label: 'Seleziona controllo', run: () => setParam('inflect_repeatSelect', 'ctrl') },
      { label: 'Seleziona copie', run: () => setParam('inflect_repeatSelect', 'clones') },
      '-',
      { label: 'Centra nella composizione', run: async () => { const r = await setParam('inflect_clonerCenter', true); if (r.ok) { toast('Cloner al centro della composizione.'); readRepeat(true); } } },
      { label: 'Aggiorna copie dalle sorgenti', run: async () => {
        const r = await setParam('inflect_repeatRebuild');
        if (r.ok) { toast(`${r.count} copie rifatte dalle sorgenti.`); readRepeat(true); }
      } },
      '-',
      { label: 'Elimina Cloner', danger: true, run: async () => {
        const r = await setParam('inflect_repeatRemove');
        if (r.ok) { toast(`${r.name} eliminato.`); RP = null; repDataKey = ''; poll(true); }
      } },
    ]);
  }

  // Animazioni pronte: partono dal tempo corrente e usano gli stessi strumenti del pannello.
  function recipeMenu(anchor) {
    const items = [
      ['cascata', 'Entrata a cascata', 'Le copie compaiono una dopo l\u2019altra'],
      ['pop', 'Pop casuale', 'Compaiono in ordine casuale con un piccolo rimbalzo'],
      ['onda', 'Onda', 'Un\u2019onda continua che attraversa le copie'],
      ['anello', 'Anello 3D che gira', 'Anello inclinato in rotazione, le copie davanti si ingrandiscono'],
    ];
    openMenu(anchor, items.map(([id, label]) => ({
      label,
      run: async () => {
        const r = await setParam('inflect_repeatRecipe', id);
        if (r.ok) toast(`${label} creata dal tempo corrente. Regolala da Comportamenti e Trasforma.`);
        readRepeat(true);
      },
    })));
  }

  let repShown = null;
  let repForceNew = false;
  function renderRepeatState(rp) {
    // "Nuovo" nell'intestazione: si torna al modulo di creazione anche con un Cloner selezionato.
    if (repForceNew && rp && S.ae && S.ae.layers > 0) rp = null;
    if (repForceNew && !(S.ae && S.ae.layers > 0)) repForceNew = false;
    const has = !!rp;
    $('#repEdit').hidden = !has;
    $('#repCreate').hidden = has;
    if (!has) {
      const key = 'new' + ((S.ae && S.ae.layers) || 0);
      if (repShown !== key) { repShown = key; renderRepeatNew(); }
      RP = null; repDataKey = '';
      return;
    }
    if (repShown !== rp.name + rp.index) { repShown = rp.name + rp.index; readRepeat(true); }
    else if (currentView() === 'repeat') readRepeat(false);
  }

  async function repeatAct(act, el) {
    switch (act) {
      case 'rep-create': return repeatCreate();
      case 'rep-add-beh': return addBehaviour(el);
      case 'rep-add-fall': return addFalloff(el);
      case 'rep-menu': return repeatMenu(el);
      case 'rep-recipe': return recipeMenu(el);
      case 'rep-refresh': repDataKey = ''; return readRepeat(true);
      case 'rep-back': repForceNew = false; repShown = null; return renderRepeatState(S.ae ? S.ae.repeat : null);
      case 'rep-new': {
        repForceNew = true; repShown = null;
        // Se era rimasto fissato un Cloner (scelta degli input), lo si libera.
        await call('inflect_repeatPin', false);
        renderRepeatState(S.ae ? S.ae.repeat : null);
        if (!(S.ae && S.ae.layers > 0)) toast('Seleziona nella composizione i layer da ripetere, poi premi Crea Cloner.');
        return;
      }
    }
  }


  /* ============================================================== tema == */

  // Usa gli stessi grigi del pannello di After Effects e si aggiorna se cambia la luminosità.
  function applyTheme() {
    if (!cs) return;
    try {
      const skin = cs.getHostEnvironment().appSkinInfo;
      const c = skin.panelBackgroundColor.color;
      const base = [c.red, c.green, c.blue].map(Math.round);
      const lum = (base[0] * 0.299 + base[1] * 0.587 + base[2] * 0.114);
      const dark = lum < 128;
      const shift = (d) => '#' + base.map((v) => Math.max(0, Math.min(255, v + d)).toString(16).padStart(2, '0')).join('');
      const root = document.documentElement.style;
      const k = dark ? 1 : -1;
      // Stesse relazioni del tema di After Effects: campi pi\u00f9 scuri del pannello, pulsanti pi\u00f9 chiari.
      root.setProperty('--bg', shift(0));
      root.setProperty('--well', shift(-8 * k));
      root.setProperty('--hover', shift(7 * k));
      root.setProperty('--raised', shift(11 * k));
      root.setProperty('--line-soft', shift(9 * k));
      root.setProperty('--line', shift(23 * k));
      root.setProperty('--bar', shift(-6 * k));
      // Tre ruoli di testo, tutti sopra 4,5:1 sui fondi del pannello.
      root.setProperty('--text', dark ? '#dcdce0' : '#262629');
      root.setProperty('--strong', dark ? '#ececef' : '#111113');
      root.setProperty('--muted', dark ? '#a5a5ad' : '#55555c');
      root.setProperty('--faint', dark ? '#8e8e97' : '#66666e');
      root.setProperty('--hot', dark ? '#ececef' : '#111113');
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    } catch (e) { /* resta il grigio di default */ }
  }
  applyTheme();
  if (cs) cs.addEventListener('com.adobe.csxs.events.ThemeColorChanged', applyTheme);

  /* =========================================================== tooltip == */

  // Nei pannelli di After Effects i tooltip nativi (title) spesso non compaiono: ne disegniamo uno noi.
  const tipEl = $('#tip');
  let tipTimer = null, tipTarget = null;
  function tipText(el) {
    if (el.hasAttribute('title')) { el.dataset.tip = el.getAttribute('title'); el.removeAttribute('title'); }
    return el.dataset.tip;
  }
  function hideTip() { clearTimeout(tipTimer); tipEl.hidden = true; tipTarget = null; }
  function showTip(el) {
    const txt = tipText(el);
    if (!txt) return;
    tipEl.textContent = txt;
    tipEl.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    let y = r.bottom + 6;
    if (y + h > innerHeight - 4) y = r.top - h - 6;
    tipEl.style.left = C.clamp(x, 4, innerWidth - w - 4) + 'px';
    tipEl.style.top = Math.max(4, y) + 'px';
  }
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip],[title]');
    if (el === tipTarget) return;
    hideTip();
    if (!el || el.closest('#graph')) return;
    tipText(el);
    tipTarget = el;
    tipTimer = setTimeout(() => showTip(el), 450);
  });
  document.addEventListener('mousedown', hideTip, true);
  document.addEventListener('scroll', hideTip, true);
  document.addEventListener('mouseleave', hideTip);

  /* =================================================== valori trascinabili == */

  // Come i valori blu di After Effects: trascina in orizzontale per cambiarli, clic per scriverli.
  // Shift va 10 volte pi\u00f9 veloce, Cmd/Ctrl 10 volte pi\u00f9 fine.
  var scrubbing = false;
  document.addEventListener('mousedown', (e) => {
    const inp = e.target.closest && e.target.closest('input[type="number"]');
    if (!inp || inp.disabled || document.activeElement === inp || e.button !== 0) return;
    e.preventDefault();
    hideTip();
    const startX = e.clientX;
    const start = parseFloat(inp.value) || 0;
    const step = parseFloat(inp.step) || 1;
    const min = inp.min !== '' ? parseFloat(inp.min) : -Infinity;
    const max = inp.max !== '' ? parseFloat(inp.max) : Infinity;
    const decimals = (String(step).split('.')[1] || '').length;
    let moved = false, last = start;
    const move = (ev) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      if (!moved) { moved = true; scrubbing = true; document.body.classList.add('scrubbing'); }
      const mult = ev.shiftKey ? 10 : (ev.metaKey || ev.ctrlKey) ? 0.1 : 1;
      let v = start + Math.round(dx / 3) * step * mult;
      v = Math.min(max, Math.max(min, v));
      v = Number(v.toFixed(Math.max(decimals, mult < 1 ? decimals + 1 : decimals)));
      if (v !== last) { last = v; inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    };
    let ended = false;
    const up = () => {
      if (ended) return;
      ended = true;
      window.removeEventListener('mousemove', move, true);
      window.removeEventListener('mouseup', up, true);
      document.body.classList.remove('scrubbing');
      scrubbing = false;
      if (moved) inp.dispatchEvent(new Event('change', { bubbles: true }));
      else { inp.focus(); inp.select(); }
    };
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
    // Rilascio fuori dal pannello (per esempio sopra la comp): il trascinamento si chiude lo stesso.
    const leave = (ev) => { if (!ev.relatedTarget) { document.removeEventListener('mouseleave', leave); window.removeEventListener('blur', leave); up(); } };
    document.addEventListener('mouseleave', leave);
    window.addEventListener('blur', leave);
  }, true);
  // Invio conferma ed esce dal campo, Esc annulla.
  document.addEventListener('keydown', (e) => {
    const inp = document.activeElement;
    if (!inp || inp.tagName !== 'INPUT' || inp.type !== 'number') return;
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); inp.blur(); }
    if (e.key === 'Escape') { e.stopPropagation(); inp.value = inp.defaultValue; inp.blur(); }
  }, true);
  document.addEventListener('focusin', (e) => { if (e.target.type === 'number') e.target.defaultValue = e.target.value; });

  /* ======================================================== sezioni aperte == */

  // Le sezioni a scomparsa ricordano se le hai aperte o chiuse.
  (function rememberSections() {
    let st = {};
    try { st = JSON.parse(localStorage.getItem('mt.sections') || '{}'); } catch (e) {}
    $$('details[data-sec]').forEach((d) => {
      if (d.dataset.sec in st) d.open = !!st[d.dataset.sec];
      d.addEventListener('toggle', () => {
        st[d.dataset.sec] = d.open;
        try { localStorage.setItem('mt.sections', JSON.stringify(st)); } catch (e) {}
        if (d.closest('.view-curve')) requestAnimationFrame(() => { editor.render(); drawSpacing(); });
      });
    });
    // I menu dentro le intestazioni non devono aprire o chiudere la sezione.
    $$('summary .ibtn').forEach((b) => b.addEventListener('click', (e) => e.preventDefault()));
  })();

  /* =============================================================== team == */
  /*
   * Libreria di team: un file nella cartella condivisa con curve, animazioni di testo,
   * palette e liste. Ogni modifica rilegge il file prima di scriverlo, così non si
   * sovrascrive il lavoro dei colleghi.
   */
  let TEAM = null, teamModified = 0, teamInfo = null, teamOffline = false;

  /*
   * Cartelle di rete (NAS). Le controlla Node, che lavora a parte: se il NAS e' lento o spento
   * After Effects non si blocca. Solo se la cartella risponde entro pochi secondi la si legge.
   */
  const NODE = (() => {
    try {
      const req = (window.cep_node && window.cep_node.require) || window.require;
      if (!req) return null;
      return { fs: req('fs'), path: req('path'), os: req('os') };
    } catch (e) { return null; }
  })();
  function mtSettings() {
    if (!NODE) return null;
    try {
      const home = NODE.os.homedir();
      const base = (typeof process !== 'undefined' && process.platform === 'win32') ? (process.env.APPDATA || NODE.path.join(home, 'AppData', 'Roaming')) : NODE.path.join(home, 'Library', 'Application Support');
      return JSON.parse(NODE.fs.readFileSync(NODE.path.join(base, 'Motion Tools', 'settings.json'), 'utf8'));
    } catch (e) { return {}; }
  }
  function withTimeout(p, ms, fallback) {
    return Promise.race([p, new Promise((res) => setTimeout(() => res(fallback), ms))]);
  }
  // true se la cartella risponde entro ms; senza Node si considera raggiungibile (comportamento di prima).
  function reachable(dir, ms) {
    if (!NODE || !dir) return Promise.resolve(true);
    return withTimeout(NODE.fs.promises.access(dir).then(() => true, () => false), ms || 2500, false);
  }
  function teamPath() { const st = mtSettings(); return st && st.teamFolder ? st.teamFolder : null; }
  function updatePath() {
    const st = mtSettings();
    if (!st) return null;
    if (st.updateFolder) return st.updateFolder;
    return st.teamFolder ? NODE.path.join(st.teamFolder, 'Aggiornamenti') : null;
  }
  const teamNorm = (T) => {
    T = T && typeof T === 'object' ? T : {};
    T.format = 'motion-tools-team'; T.version = 1; T.name = T.name || 'Team';
    ['curves', 'text', 'palettes', 'lists'].forEach((k) => { if (!Array.isArray(T[k])) T[k] = []; });
    const L = C.validateLibrary({ curves: T.curves });
    T.curves = L ? L.curves : [];
    return T;
  };
  function teamToBrand() {
    S.brand = { format: 'inflect-library', version: 1, name: 'Team', owner: '', locked: false, curves: TEAM ? TEAM.curves : [], updated: Date.now() };
  }
  async function loadTeam() {
    const dir = teamPath();
    if (dir && !(await reachable(dir))) {
      if (!teamOffline) toast(`Non raggiungo la cartella del team (${dir.split(/[\\/]/).pop()}). Riprovo da solo quando torna.`);
      teamOffline = true;
      return;
    }
    teamOffline = false;
    const r = await call('inflect_teamLoad');
    if (!r.ok) return toast(r.error, 'err');
    TEAM = teamNorm(r.library); teamModified = r.modified;
    teamInfo = { folder: r.folder, folderName: r.folderName, isDefault: r.isDefault };
    S.shared = { folder: r.folder, folderName: r.folderName, isDefault: r.isDefault };
    teamToBrand();
    renderLibrary(); renderTeam(); txGallery();
  }
  async function mutateTeam(fn) {
    if (teamOffline || !(await reachable(teamPath()))) { teamOffline = true; toast('La cartella del team non risponde: riprova quando il NAS \u00e8 raggiungibile.', 'err'); return false; }
    const r = await call('inflect_teamLoad');
    if (!r.ok) { toast(r.error, 'err'); return false; }
    const fresh = teamNorm(r.library);
    if (fn(fresh) === false) return false;
    fresh.updated = Date.now();
    const s = await call('inflect_teamSave', fresh);
    if (!s.ok) { toast(s.error, 'err'); return false; }
    TEAM = fresh; teamModified = s.modified;
    teamToBrand();
    renderLibrary(); renderTeam(); txGallery();
    return true;
  }
  // Modifiche dei colleghi alla libreria: Node guarda la data del file, After Effects non viene toccato.
  setInterval(async () => {
    if (!inCEP || document.hidden) return;
    const dir = teamPath();
    if (!NODE || !dir) { if (TEAM) { const st = await call('inflect_teamStat'); if (st.ok && st.modified && st.modified !== teamModified) loadTeam(); } return; }
    const f = NODE.path.join(dir, 'motion-tools-team.json');
    const m = await withTimeout(NODE.fs.promises.stat(f).then((x) => x.mtimeMs, () => 0), 2500, -1);
    if (m === -1) { teamOffline = true; return; }
    if (teamOffline || !TEAM) { loadTeam(); return; }
    if (m && Math.floor(m / 1000) !== Math.floor(teamModified / 1000)) loadTeam();
  }, 15000);

  const parseColors = (s) => String(s || '').split(/[\s,;]+/).map((x) => x.trim().replace(/^#/, '')).filter((x) => /^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(x)).map((x) => '#' + (x.length === 3 ? x.split('').map((c) => c + c).join('') : x).toUpperCase());
  const parseValues = (s, kind) => {
    if (kind === 'color') return parseColors(s);
    if (kind === 'text') return String(s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    return String(s || '').split(/[\s,;]+/).map((x) => x.replace(',', '.')).filter((x) => x !== '' && !isNaN(parseFloat(x))).map(Number);
  };

  function chips(colors, onClick, tipFor) {
    return h('div', { class: 'chips' }, colors.map((c) => {
      const b = h('button', { class: 'chip', 'data-tip': tipFor ? tipFor(c) : c });
      b.style.background = c;
      if (onClick) b.addEventListener('click', () => onClick(c)); else b.disabled = true;
      return b;
    }));
  }

  function paletteSheet(pal) {
    openSheet(pal ? 'Modifica palette' : 'Nuova palette', [
      { key: 'name', label: 'Nome', value: pal ? pal.name : '', placeholder: 'Es. Inter, Campagna estate' },
      { key: 'colors', label: 'Colori (esadecimali, separati da virgola o a capo)', value: pal ? pal.colors.join(', ') : '', multiline: true, placeholder: '#0A84FF, #FFD60A, #FF3B30' },
    ], pal ? 'Salva' : 'Crea', async (v) => {
      const colors = parseColors(v.colors);
      if (!colors.length) return toast('Scrivi almeno un colore, per esempio #0A84FF.', 'err');
      const p = { id: pal ? pal.id : C.uid(), name: v.name || 'Palette', colors };
      if (await mutateTeam((T) => { const i = T.palettes.findIndex((x) => x.id === p.id); if (i >= 0) T.palettes[i] = p; else T.palettes.push(p); })) toast(`${p.name} salvata nel team.`);
    });
  }

  async function applyColor(c) {
    const r = await call('inflect_listApply', { kind: 'color', values: [c], mode: 'cycle' });
    if (!r.ok) return toast(r.error, 'err');
    toast(`${c} applicato a ${r.count} layer.`);
  }

  function renderTeam() {
    if (!$('#tmColors')) return;
    const T = TEAM || teamNorm({});
    $('#tmName').textContent = T.name || 'Team';
    $('#tmFolder').textContent = teamInfo ? (teamInfo.isDefault ? 'Solo su questo computer, scegli una cartella condivisa' : `Cartella ${teamInfo.folderName}`) : 'Libreria condivisa con il team';
    $('#tmFolder').dataset.tip = teamInfo ? teamInfo.folder : '';
    const tn = (id, n) => { const el = $(id); if (el) el.textContent = n ? String(n) : ''; };
    tn('#tmNColors', (T.palettes || []).length); tn('#tmNText', (T.text || []).length); tn('#tmNCurves', (T.curves || []).length); tn('#tmNLists', (T.lists || []).length);

    const pc = $('#tmColors');
    pc.textContent = '';
    if (!T.palettes.length) add(pc, h('p', { class: 'hint', text: 'Nessuna palette. Creane una con i colori del cliente: un clic su un colore lo applica ai layer selezionati.' }));
    T.palettes.forEach((p) => {
      const more = h('button', { class: 'ibtn sm', 'data-tip': 'Altre azioni' });
      more.innerHTML = '<svg viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/></svg>';
      more.addEventListener('click', () => openMenu(more, [
        { label: 'Applica in ordine ai layer selezionati', run: async () => { const r = await call('inflect_listApply', { kind: 'color', values: p.colors, mode: 'cycle' }); if (!r.ok) return toast(r.error, 'err'); toast(`${p.name} distribuita su ${r.count} layer.`); } },
        { label: 'Usa come colori del Cloner', run: () => repeatListFromTeam('colori', { v: p.colors, m: 'cycle', s: 1 }, p.name) },
        { label: 'Usa nella lista di Utility', run: () => { LI.kind = 'color'; LI.text.color = p.colors.join(', '); saveLI(); renderListsUI(); showView('utility'); } },
        '-',
        { label: 'Modifica', run: () => paletteSheet(p) },
        { label: 'Elimina', danger: true, run: () => mutateTeam((T2) => { T2.palettes = T2.palettes.filter((x) => x.id !== p.id); }) },
      ]));
      add(pc, h('div', { class: 'palrow' }, h('div', { class: 'palhead' }, h('span', { class: 'palname', text: p.name }), h('span', { class: 'grow' }), more),
        chips(p.colors, applyColor, (c) => `${c}: clic per applicarlo ai layer selezionati`)));
    });
    const np = h('button', { class: 'btn sm', text: 'Nuova palette' });
    np.addEventListener('click', () => paletteSheet(null));
    add(pc, h('div', { class: 'btnrow' }, np));

    const tx = $('#tmText');
    tx.textContent = '';
    if (!T.text.length) add(tx, h('p', { class: 'hint', text: 'Nessuna animazione. Dalla scheda Testo usa Salva nel team.' }));
    T.text.forEach((p) => {
      const open = h('button', { class: 'li', 'data-tip': 'Apri nella scheda Testo' }, h('span', { class: 'tc', text: TX_UNIT_LABEL[p.unit] || '' }), h('span', { text: p.name }), h('span'));
      open.addEventListener('click', () => { txLoad(C.clone ? JSON.parse(JSON.stringify(p)) : p, 'team'); showView('text'); });
      open.addEventListener('contextmenu', (e) => { e.preventDefault(); openMenu(open, [{ label: 'Elimina', danger: true, run: () => mutateTeam((T2) => { T2.text = T2.text.filter((x) => x.id !== p.id); }) }], e); });
      add(tx, open);
    });

    const cv = $('#tmCurves');
    cv.textContent = '';
    add(cv, h('p', { class: 'hint', text: T.curves.length ? `${T.curves.length} ${T.curves.length === 1 ? 'curva' : 'curve'} del team: le trovi nella libreria della scheda Curve, sezione Team.` : 'Nessuna curva. Nella scheda Curve, dal menu di una curva, scegli Copia nel team.' }));
    const go = h('button', { class: 'btn sm', text: 'Apri le curve' });
    go.addEventListener('click', () => showView('curve'));
    add(cv, h('div', { class: 'btnrow' }, go));

    const ls = $('#tmLists');
    ls.textContent = '';
    if (!T.lists.length) add(ls, h('p', { class: 'hint', text: 'Nessuna lista. In Utility, sezione Liste, usa Salva nel team.' }));
    T.lists.forEach((l) => {
      const b = h('button', { class: 'li', 'data-tip': 'Apri in Utility' }, h('span', { class: 'tc', text: { color: 'Colori', number: 'Numeri', text: 'Testi' }[l.kind] || '' }), h('span', { text: `${l.name} (${l.values.length})` }), h('span'));
      b.addEventListener('click', () => { LI.kind = l.kind; LI.text[l.kind] = l.kind === 'text' ? l.values.join('\n') : l.values.join(', '); saveLI(); renderListsUI(); showView('utility'); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); openMenu(b, [{ label: 'Elimina', danger: true, run: () => mutateTeam((T2) => { T2.lists = T2.lists.filter((x) => x.id !== l.id); }) }], e); });
      add(ls, b);
    });
  }

  /* --------------------------------------------------- aggiornamenti -- */

  const extPath = () => (cs ? cs.getSystemPath(SystemPath.EXTENSION) : '.');
  let UPD = null;
  // Versione con cui e' caricato questo pannello: quella letta alla prima verifica, prima di installare.
  let LOADED = null;
  /* --- aggiornamenti da GitHub --------------------------------------------------
   * Sorgente: update.json accanto al pannello ({"github":"utente/repo","channel":"stable"}),
   * che si puo' cambiare per questo computer dalle impostazioni (settings.json: githubRepo, updateChannel).
   * Senza repository resta il controllo nella cartella condivisa (NAS).
   */
  const NODE_NET = (() => {
    try {
      const req = (window.cep_node && window.cep_node.require) || window.require;
      return req ? { https: req('https'), zlib: req('zlib'), crypto: req('crypto'), fs: req('fs'), path: req('path'), os: req('os') } : null;
    } catch (e) { return null; }
  })();
  function appSupport() {
    if (!NODE) return null;
    const home = NODE.os.homedir();
    const base = (typeof process !== 'undefined' && process.platform === 'win32') ? (process.env.APPDATA || NODE.path.join(home, 'AppData', 'Roaming')) : NODE.path.join(home, 'Library', 'Application Support');
    return NODE.path.join(base, 'Motion Tools');
  }
  function updateSource() {
    let shipped = {};
    try { shipped = JSON.parse(NODE.fs.readFileSync(NODE.path.join(extPath(), 'update.json'), 'utf8')); } catch (e) {}
    const st = mtSettings() || {};
    const repo = window.MTUpdate ? window.MTUpdate.normRepo(st.githubRepo || shipped.github || '') : '';
    return { repo, channel: st.updateChannel || shipped.channel || 'stable' };
  }
  function diskVersion() {
    try { return window.MTUpdate.manifestInfo(NODE.fs.readFileSync(NODE.path.join(extPath(), 'CSXS', 'manifest.xml'), 'utf8')).version; } catch (e) { return ''; }
  }
  let UPD_BUSY = false;
  async function updateCheck(install, quiet) {
    const src = (NODE_NET && window.MTUpdate) ? updateSource() : { repo: '' };
    if (!src.repo) return updateCheckNas(install, quiet);
    if (UPD_BUSY) return;
    UPD_BUSY = true;
    try { await updateCheckGithub(src, install, quiet); }
    catch (e) { if (!quiet) toast(String(e.message || e), 'err'); }
    finally { UPD_BUSY = false; }
  }
  async function updateCheckGithub(src, install, quiet) {
    const U = window.MTUpdate;
    // Dopo un ritorno a una versione precedente gli aggiornamenti automatici restano in pausa finche' non li riprendi.
    const held = heldVersion();
    if (held && quiet) return;
    if (held && !quiet) { setHeld(''); toast('Aggiornamenti automatici ripresi.'); }
    if (LOADED === null) LOADED = String(window.MT_BUILD || '').split('-')[0] || diskVersion();
    window.MT_VERSION = LOADED;
    const onDisk = diskVersion() || LOADED;
    const rel = await U.latest(NODE_NET, src.repo, src.channel);
    UPD = { current: onDisk, version: rel ? rel.version : onDisk, available: !!rel && U.verCmp(rel.version, onDisk) > 0, source: 'github', repo: src.repo };
    renderTeam();
    // Gia' installata sul disco ma non ancora caricata: basta ricaricare.
    if (U.verCmp(onDisk, LOADED) > 0) return updateReady(onDisk, install);
    if (!rel || !UPD.available) { if (!quiet) toast(`Hai già l’ultima versione (${onDisk}).`); return; }
    if (!quiet) toast(`Scarico Motion Tools ${rel.version}…`);
    const base = appSupport();
    const got = await U.download(NODE_NET, rel, NODE.path.join(base, 'updates'), 'tools.inflect.panel');
    const res = await call('inflect_updateInstallFrom', extPath(), got.pkg, NODE.path.join(base, 'backup', onDisk), false);
    pruneBackups();
    if (!res.ok) throw new Error(res.error);
    if (!res.installed) { if (!quiet) toast(`Hai già l’ultima versione (${res.version}).`); return; }
    UPD = Object.assign(UPD, { current: res.version, available: false, backup: res.backup, notes: rel.notes });
    try { localStorage.setItem('mt.prevVersion', res.from || ''); } catch (e) {}
    if (res.restart || !window.MT_LOADER) {
      showUpdateBanner(res.version, 'Chiudi After Effects e riaprilo per usarla', null);
      return;
    }
    updateReady(res.version, install);
  }
  // Appena aperto il pannello si ricarica da solo (non si perde niente); a pannello in uso chiede prima.
  function updateReady(version, auto) {
    let tried = null;
    try { tried = sessionStorage.getItem('mt.tried'); } catch (e) {}
    if (auto && tried !== version) { toast(`Carico Motion Tools ${version}…`); setTimeout(() => reloadPanel(version), 900); return; }
    showUpdateBanner(version, 'Ricarica il pannello per usarla', () => reloadPanel(version));
  }
  function showUpdateBanner(version, sub, onReload) {
    const b = $('#updBanner');
    if (!b) return toast(`Motion Tools ${version} installato. ${sub}.`);
    $('#updTitle').textContent = `Versione ${version} installata`;
    $('#updSub').textContent = sub;
    const go = $('#updGo');
    go.hidden = !onReload;
    go.onclick = onReload;
    $('#updLater').onclick = () => { b.hidden = true; };
    b.hidden = false;
  }
  const heldVersion = () => { try { return localStorage.getItem('mt.heldVersion') || ''; } catch (e) { return ''; } };
  const setHeld = (v) => { try { if (v) localStorage.setItem('mt.heldVersion', v); else localStorage.removeItem('mt.heldVersion'); } catch (e) {} };
  // Versioni salvate prima di ogni aggiornamento: backup/<versione>, si tengono le tre piu' recenti.
  function listBackups() {
    const base = appSupport();
    if (!base) return [];
    const root = NODE.path.join(base, 'backup');
    let names = [];
    try { names = NODE.fs.readdirSync(root); } catch (e) { return []; }
    const out = [];
    names.forEach((n) => {
      const dir = NODE.path.join(root, n);
      try {
        const v = window.MTUpdate.manifestInfo(NODE.fs.readFileSync(NODE.path.join(dir, 'CSXS', 'manifest.xml'), 'utf8')).version;
        if (v) out.push({ dir, version: v });
      } catch (e) {}
    });
    return out.sort((x, y) => window.MTUpdate.verCmp(y.version, x.version));
  }
  function pruneBackups() {
    const keep = 3;
    const seen = new Set();
    listBackups().forEach((b) => {
      if (seen.has(b.version) || seen.size >= keep) { try { (NODE.fs.rmSync || NODE.fs.rmdirSync)(b.dir, { recursive: true, force: true }); } catch (e) {} return; }
      seen.add(b.version);
    });
  }
  function updateRollback(anchor) {
    const cur = diskVersion();
    const list = listBackups().filter((b) => b.version !== cur);
    const items = list.map((b) => ({ label: `Torna alla ${b.version}`, run: () => rollbackTo(b) }));
    if (heldVersion()) items.push('-', { label: 'Riprendi gli aggiornamenti automatici', run: () => { setHeld(''); toast('Aggiornamenti automatici ripresi.'); updateCheck(true, false); } });
    if (!items.length) return toast('Non ci sono versioni precedenti salvate su questo computer. Si salvano a ogni aggiornamento da GitHub.');
    openMenu(anchor || $('[data-act="settings"]'), items);
  }
  async function rollbackTo(b) {
    const base = appSupport(), cur = diskVersion();
    // Anche la versione che lasci viene salvata, cosi' puoi tornarci.
    const res = await call('inflect_updateInstallFrom', extPath(), b.dir, cur ? NODE.path.join(base, 'backup', cur) : '', true);
    if (!res.ok) return toast(res.error, 'err');
    pruneBackups();
    setHeld(b.version);
    try { sessionStorage.removeItem('mt.tried'); } catch (e) {}
    toast(`Torno alla ${b.version}. Gli aggiornamenti automatici sono in pausa: li riprendi dalle Impostazioni.`);
    setTimeout(() => reloadPanel(b.version), 1400);
  }
  async function updateSourceSheet() {
    const cur = updateSource();
    openSheet('Aggiornamenti da GitHub', [
      { key: 'repo', label: 'Repository (utente/nome), vuoto per usare la cartella condivisa', value: cur.repo },
      { key: 'channel', label: 'Canale: stable oppure beta', value: cur.channel },
    ], 'Salva', async (v) => {
      const repo = window.MTUpdate.normRepo(v.repo);
      const channel = String(v.channel || '').trim() === 'beta' ? 'beta' : 'stable';
      const r = await call('inflect_settingSet', 'githubRepo', repo);
      await call('inflect_settingSet', 'updateChannel', channel);
      if (!r.ok) return toast(r.error, 'err');
      toast(repo ? `Aggiornamenti da github.com/${repo}, canale ${channel}.` : 'Aggiornamenti dalla cartella condivisa.');
      updateCheck(false, false);
    });
  }
  async function updateCheckNas(install, quiet) {
    const dir = updatePath();
    if (dir && !(await reachable(dir))) { if (!quiet) toast('La cartella degli aggiornamenti non risponde. Controlla di essere collegato al NAS.', 'err'); return; }
    const r = await call('inflect_updateCheck', extPath());
    if (!r.ok) { if (!quiet) toast(r.error, 'err'); return; }
    // Versione del codice che sta girando davvero (scritta da build.js), non quella del manifest su disco.
    if (LOADED === null) LOADED = String(window.MT_BUILD || '').split('-')[0] || r.current;
    window.MT_VERSION = LOADED;
    UPD = r;
    renderTeam();
    // Su disco c'e' una versione diversa da quella in uso: con il caricatore basta ricaricare il pannello.
    const pending = () => {
      let tried = null;
      try { tried = sessionStorage.getItem('mt.tried'); } catch (e) {}
      // Una sola ricarica per versione: se non basta, niente giri infiniti.
      if (window.MT_LOADER && install && tried !== r.current) { toast(`Carico Motion Tools ${r.current}\u2026`); setTimeout(() => reloadPanel(r.current), 900); return; }
      toast(window.MT_LOADER ? `Motion Tools ${r.current} \u00e8 installato: fai Controlla aggiornamenti per caricarlo.` : `Motion Tools ${r.current} \u00e8 installato: chiudi After Effects del tutto e riaprilo per usarlo.`);
    };
    if (!r.available) {
      // Solo se su disco c'e' davvero una versione piu' nuova di quella in uso.
      if (/^\d+(\.\d+)*$/.test(String(r.current)) && verCmp(r.current, LOADED) > 0) return pending();
      if (!quiet) toast(r.found ? `Hai gi\u00e0 l\u2019ultima versione (${r.current}).` : `Nessun aggiornamento in ${r.folderName}.`);
      return;
    }
    if (!install) { toast(`Motion Tools ${r.version} \u00e8 pronto: fai Controlla aggiornamenti per installarlo.`); return; }
    const res = await call('inflect_updateInstall', extPath());
    if (!res.ok) return toast(res.error, 'err');
    if (!res.installed) { if (/^\d+(\.\d+)*$/.test(String(r.current)) && verCmp(r.current, LOADED) > 0) return pending(); if (!quiet) toast(`Hai gi\u00e0 l\u2019ultima versione (${r.current}).`); return; }
    // Il manifest cambiato (raro) o il pannello senza caricatore (prima di questa versione) chiedono di riaprire After Effects.
    if (res.restart || !window.MT_LOADER) {
      toast(`Motion Tools aggiornato alla ${res.version}. Chiudi After Effects del tutto e riaprilo: da questa versione in poi non servir\u00e0 pi\u00f9.`);
      return;
    }
    toast(`Motion Tools aggiornato alla ${res.version}. Ricarico il pannello\u2026`);
    setTimeout(() => reloadPanel(res.version), 1200);
  }
  const verCmp = (a, b) => { const x = String(a).split('.'), y = String(b).split('.'); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (+x[i] || 0) - (+y[i] || 0); if (d) return d; } return 0; };
  // Ricarica: il caricatore legge di nuovo panel.html, stili e script dal disco; host.jsx si ricarica all'avvio.
  function reloadPanel(target) {
    try { sessionStorage.setItem('mt.reloaded', LOADED || ''); sessionStorage.setItem('mt.tried', target || ''); } catch (e) {}
    location.reload();
  }
  // Dopo una ricarica per aggiornamento: conferma con la versione che gira davvero.
  try {
    const was = sessionStorage.getItem('mt.reloaded');
    if (was !== null) {
      sessionStorage.removeItem('mt.reloaded');
      const now = String(window.MT_BUILD || '').split('-')[0];
      setTimeout(() => toast(now && now !== was ? `Motion Tools ${now} caricato.` : `Il pannello si \u00e8 ricaricato ma usa ancora la ${now}. Chiudi After Effects e riaprilo.`, now && now !== was ? '' : 'err'), 600);
    }
  } catch (e) {}
  // All'apertura installa la versione nuova, se c'\u00e8; poi controlla ogni mezz'ora e avvisa.
  setTimeout(() => updateCheck(true, true), 8000);
  setInterval(() => updateCheck(false, true), 30 * 60 * 1000);

  function teamMenu(anchor) {
    openMenu(anchor, [
      { label: 'Controlla aggiornamenti', run: () => updateCheck(true, false) },
      { label: 'Aggiornamenti da GitHub\u2026', run: updateSourceSheet },
      { label: heldVersion() ? 'Versioni precedenti e aggiornamenti in pausa\u2026' : 'Torna a una versione precedente\u2026', run: () => updateRollback() },
      { label: 'Cartella degli aggiornamenti\u2026', run: async () => { const r = await call('inflect_updateChooseFolder'); if (r.ok && !r.cancelled) { toast(`Aggiornamenti da ${r.folderName}.`); updateCheck(false, true); } else if (!r.ok) toast(r.error, 'err'); } },
      '-',
      { label: 'Scegli la cartella condivisa…', run: async () => { const r = await call('inflect_teamChoose'); if (r.ok && !r.cancelled) { await loadTeam(); toast(`Libreria di team in ${r.folderName}.`); } else if (!r.ok) toast(r.error, 'err'); } },
      { label: 'Mostra la cartella', run: () => call('inflect_teamReveal') },
      { label: 'Rinomina…', run: () => openSheet('Libreria di team', [{ key: 'name', label: 'Nome del team o del cliente', value: TEAM ? TEAM.name : '' }], 'Salva', (v) => mutateTeam((T) => { T.name = v.name || 'Team'; })) },
      '-',
      { label: 'Esporta tutto…', run: () => call('inflect_fileSave', TEAM, 'motion-tools-team.json', 'Esporta la libreria di team') },
      { label: 'Importa…', run: async () => {
        const r = await call('inflect_fileOpen', 'Importa nella libreria di team');
        if (!r.ok) return toast(r.error, 'err');
        if (r.cancelled) return;
        const d = r.data || {};
        await mutateTeam((T) => {
          const merge = (key, arr) => (arr || []).forEach((x) => { if (!x) return; x.id = x.id || C.uid(); const i = T[key].findIndex((y) => y.id === x.id); if (i >= 0) T[key][i] = x; else T[key].push(x); });
          if (d.format === 'motion-tools-text' || (d.in || d.out)) merge('text', [d]);
          else if (Array.isArray(d.presets)) merge('text', d.presets);
          merge('text', d.text); merge('palettes', d.palettes); merge('lists', d.lists);
          const cl = C.validateLibrary({ curves: d.curves || [] }); if (cl) merge('curves', cl.curves);
        });
        toast(`${r.name} importato nel team.`);
      } },
    ]);
  }

  /* ============================================================== testo == */

  const TX_UNIT_LABEL = { chars: 'Lettere', words: 'Parole', lines: 'Righe' };
  const TX_EASES = [
    ['Apple', [0.19, 1, 0.22, 1]], ['Esponenziale', [0.16, 1, 0.3, 1]], ['Morbida', [0.22, 1, 0.36, 1]], ['Decisa', [0.2, 0.9, 0.1, 1]],
    ['Con rimbalzo', [0.34, 1.56, 0.64, 1]], ['In-out', [0.65, 0, 0.35, 1]], ['Accelera', [0.64, 0, 0.78, 0]], ['Lineare', [0, 0, 1, 1]],
  ];
  const bz = (a, b2, c, d) => ['bezier', [a, b2, c, d]];
  const ph = (dur, stg, ease, from, extra = {}) => Object.assign({ dur, stg, delay: 0, ord: 0, spread: 0, seed: 1, ease: ease[0] === 'spring' ? { type: 'spring', bounce: ease[1] } : { type: 'bezier', v: ease[1] }, from }, extra);
  // Preset in stile Apple: movimenti brevi, tempi lunghi, curve che rallentano a lungo. Valori pensati per un corpo di 100 px.
  const EXPO = [0.16, 1, 0.3, 1], SOFT = [0.19, 1, 0.22, 1], QUART = [0.25, 1, 0.5, 1], OUTQ = [0.7, 0, 0.84, 0];
  const R = (o) => Object.assign({ ref: 100 }, o);
  const TX_BUILTIN = [
    R({ id: 'b-words', name: 'Parola per parola', unit: 'words', in: ph(1.1, 0.085, bz(...EXPO), { opacity: 0, y: 38 }) }),
    R({ id: 'b-words-slow', name: 'Parole lente', unit: 'words', in: ph(1.7, 0.14, bz(...SOFT), { opacity: 0, y: 55 }) }),
    R({ id: 'b-reveal', name: 'Rivelazione', unit: 'words', clip: true, in: ph(1.05, 0.07, bz(...EXPO), { y: 115 }) }),
    R({ id: 'b-lines-reveal', name: 'Righe rivelate', unit: 'lines', clip: true, in: ph(1.2, 0.13, bz(...SOFT), { y: 120 }) }),
    R({ id: 'b-lines', name: 'Riga dal basso', unit: 'lines', in: ph(1.4, 0.16, bz(...EXPO), { opacity: 0, y: 48 }) }),
    R({ id: 'b-gradient', name: 'Sfumatura', unit: 'chars', in: ph(1, 0.032, bz(0.45, 0, 0.25, 1), { opacity: 0 }) }),
    R({ id: 'b-gradient-up', name: 'Sfumatura che sale', unit: 'chars', in: ph(1.25, 0.03, bz(...EXPO), { opacity: 0, y: 16 }) }),
    R({ id: 'b-settle', name: 'Titolo che si posa', unit: 'lines', in: ph(1.8, 0.12, bz(...EXPO), { opacity: 0, scale: 94, tracking: 40 }) }),
    R({ id: 'b-track', name: 'Spaziatura che si chiude', unit: 'chars', in: ph(2, 0, bz(...EXPO), { opacity: 0, tracking: 180 }) }),
    R({ id: 'b-tilt', name: 'Parole inclinate', unit: 'words', in: ph(1.3, 0.09, bz(...EXPO), { opacity: 0, y: 45, rotation: 6 }) }),
    R({ id: 'b-center', name: 'Dal centro', unit: 'words', in: ph(1.3, 0.1, bz(...QUART), { opacity: 0, y: 30 }, { ord: 2 }) }),
    R({ id: 'b-spring', name: 'Molla leggera', unit: 'words', in: ph(1.1, 0.08, ['spring', 0.12], { opacity: 0, y: 50 }) }),
    R({ id: 'b-inout', name: 'Entra ed esce', unit: 'words', in: ph(1.1, 0.085, bz(...EXPO), { opacity: 0, y: 38 }), out: ph(0.7, 0.05, bz(...OUTQ), { opacity: 0, y: -24 }) }),
    R({ id: 'b-reveal-out', name: 'Rivela e nasconde', unit: 'words', clip: true, in: ph(1.05, 0.07, bz(...EXPO), { y: 115 }), out: ph(0.75, 0.05, bz(...OUTQ), { y: -115 }) }),
  ];


  const TX = { cur: null, src: null, phase: 'in', state: null, user: [], folders: [], dragId: null, sample: '', live: true, bound: false, applyTimer: null, players: [] };
  try { TX.live = localStorage.getItem('mt.txLive') !== '0'; } catch (e) {}
  const fpsNow = () => (TX.state && TX.state.fps) || (S.ae && S.ae.fps) || 25;
  const deep = (o) => JSON.parse(JSON.stringify(o));

  /* --- motore di anteprima: la stessa matematica dell'espressione in After Effects --- */

  function txBz(x, a, b, c, d) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let k = 0; k < 10; k++) {
      const cx = 3 * a * t * (1 - t) * (1 - t) + 3 * c * t * t * (1 - t) + t * t * t - x;
      const dx = 3 * a * (1 - t) * (1 - t) + 6 * (c - a) * t * (1 - t) + 3 * (1 - c) * t * t;
      if (Math.abs(cx) < 1e-5 || Math.abs(dx) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - cx / dx));
    }
    return 3 * b * t * (1 - t) * (1 - t) + 3 * d * t * t * (1 - t) + t * t * t;
  }
  function txSpring(s, T, bo) {
    if (s <= 0) return 0;
    const w = 2 * Math.PI / T, z = Math.max(0.05, 1 - bo);
    if (s > T * (1 + 3 * bo) * 1.5) return 1;
    if (z >= 1) return 1 - Math.exp(-w * s) * (1 + w * s);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s));
  }
  const txEase = (P, s) => {
    const e = P.ease || {};
    if (e.type === 'spring') return txSpring(s, Math.max(0.001, P.dur), e.bounce || 0);
    if (e.type === 'lut') {
      const L = e.v || [0, 1], x = s / Math.max(0.001, P.dur);
      if (x <= 0) return 0; if (x >= 1) return L[L.length - 1];
      const f = x * (L.length - 1), k = Math.floor(f);
      return L[k] + (L[k + 1] - L[k]) * (f - k);
    }
    const v = e.v || [0.22, 1, 0.36, 1];
    return txBz(s / Math.max(0.001, P.dur), v[0], v[1], v[2], v[3]);
  };
  function txDelays(P, n) {
    const out = [], ord = P.ord || 0;
    let mx = Math.max(0, n - 1), perm = null;
    if (ord === 2 || ord === 3) mx = (n - 1) / 2;
    if (ord === 4) {
      let s = (P.seed || 1) * 9301 + 49297;
      const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      perm = [...Array(n).keys()];
      for (let k = n - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [perm[k], perm[j]] = [perm[j], perm[k]]; }
    }
    for (let i = 0; i < n; i++) {
      let r = i;
      if (ord === 1) r = n - 1 - i;
      else if (ord === 2) r = Math.abs(i - (n - 1) / 2);
      else if (ord === 3) r = (n - 1) / 2 - Math.abs(i - (n - 1) / 2);
      else if (ord === 4) r = perm[i];
      let u = mx > 0 ? r / mx : 0;
      if (P.spread === 1) u = u * u; else if (P.spread === 2) u = 1 - (1 - u) * (1 - u);
      out.push(u * mx * (P.stg || 0));
    }
    return { d: out, span: mx * (P.stg || 0) };
  }
  // Come in After Effects: lo sfalsamento riparte a ogni parola o riga, con wstg tra un gruppo e l'altro.
  const txRestart = (Pr, Q) => {
    const r = Q.restart !== undefined ? Q.restart : Pr.restart, unit = Pr.unit || 'chars';
    if (unit === 'lines') return '';
    if (r === 'words' && unit !== 'words') return 'words';
    return r === 'lines' ? 'lines' : '';
  };
  function txDelaysG(Pr, Q, units) {
    const n = units.length, rs = txRestart(Pr, Q);
    if (!rs) return txDelays(Q, n);
    const gid = units.map((u) => (rs === 'words' ? u._w : u._l));
    const keys = [...new Set(gid)], d = new Array(n).fill(0);
    let mg = 0;
    keys.forEach((g, gi) => {
      const idx = gid.map((x, i) => (x === g ? i : -1)).filter((i) => i >= 0);
      mg = Math.max(mg, idx.length);
      const dd = txDelays(Q, idx.length).d;
      idx.forEach((i, j) => { d[i] = dd[j] + gi * (Q.wstg || Q.wordStg || 0); });
    });
    return { d, span: (keys.length - 1) * (Q.wstg || Q.wordStg || 0) + Math.max(0, mg - 1) * (Q.stg || 0) };
  }
  const txLen = (P, n, span) => {
    const tail = P.ease && P.ease.type === 'spring' ? P.dur * (1 + 3 * (P.ease.bounce || 0)) * 1.5 : P.dur;
    return (P.delay || 0) + (span !== undefined ? span : txDelays(P, n).span) + tail;
  };
  // Colore dell'anteprima: dal colore del testo verso quello scelto.
  const txMix = (base, hex, a) => {
    const m = String(base).match(/\d+(\.\d+)?/g) || [255, 255, 255];
    const hx = String(hex).replace('#', ''), f = hx.length === 3 ? hx.split('').map((c) => c + c).join('') : hx;
    const c = [0, 2, 4].map((k) => parseInt(f.slice(k, k + 2), 16));
    return `rgb(${c.map((x, i) => Math.round(+m[i] + (x - m[i]) * a)).join(',')})`;
  };
  function txStyle(el, F, a, k) {
    const op = F.opacity !== undefined ? F.opacity : 100;
    el.style.opacity = C.clamp(1 + (op / 100 - 1) * a, 0, 1);
    const sc = 1 + ((F.scale !== undefined ? F.scale : 100) / 100 - 1) * a;
    el.style.transform = `translate(${((F.x || 0) * a * k).toFixed(2)}px,${((F.y || 0) * a * k).toFixed(2)}px) rotate(${((F.rotation || 0) * a).toFixed(2)}deg) scale(${Math.max(0, sc).toFixed(3)})`;
    const b = (F.blur || 0) * a * k;
    el.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : '';
    el.style.marginRight = F.tracking ? `${((F.tracking * a) / 1000).toFixed(3)}em` : '';
    if (F.fill && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(F.fill)) {
      if (!el._base) { el.style.color = ''; el._base = getComputedStyle(el).color; }
      el.style.color = a > 0.001 ? txMix(el._base, F.fill, Math.min(1, a)) : '';
    } else if (el.style.color) el.style.color = '';
  }
  function txBuild(box, text, unit) {
    box.textContent = '';
    const units = [], chars = [];
    box._chars = chars;
    let wi = 0;
    text.split(/\r\n|\r|\n/).forEach((ln, li) => {
      const line = h('span', { class: 'txl' });
      if (unit === 'lines') { const u = h('span', { class: 'txu', text: ln || ' ' }); u._l = li; u._w = wi++; line.append(u); units.push(u); }
      else ln.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { line.append(document.createTextNode(part)); return; }
        const w0 = wi++;
        if (unit === 'words') {
          // Lettere dentro la parola: servono al blocco colore, che va per lettere.
          const u = h('span', { class: 'txu' }); u._l = li; u._w = w0;
          [...part].forEach((ch) => { const c = h('span', { class: 'txc', text: ch }); c._l = li; c._w = w0; u.append(c); chars.push(c); });
          line.append(u); units.push(u); return;
        }
        const w = h('span', { class: 'txw' });
        [...part].forEach((ch) => { const u = h('span', { class: 'txu', text: ch }); u._l = li; u._w = w0; w.append(u); units.push(u); chars.push(u); });
        line.append(w);
      });
      box.append(line);
    });
    return units;
  }
  function txPlayer(box, P, text, kFont) {
    const k = kFont / (P.ref || (TX.state && TX.state.size) || 90);
    box.classList.toggle('clip', !!P.clip);
    const sample = P.unit === 'lines' && !/\n/.test(text) && text.includes(' ') ? text.replace(/ (?=[^ ]*$)/, '\n').replace(/^(\S+) /, '$1\n') : text;
    const units = txBuild(box, sample, P.unit || 'chars');
    const n = units.length;
    const gIn = P.in ? txDelaysG(P, P.in, units) : null, gOut = P.out ? txDelaysG(P, P.out, units) : null;
    const dIn = gIn ? gIn.d : null, dOut = gOut ? gOut.d : null;
    const inLen = P.in ? txLen(P.in, n, gIn.span) : 0, outLen = P.out ? txLen(P.out, n, gOut.span) : 0;
    // Blocco colore: animatore a parte, di solito per lettere anche se il movimento va per parole.
    const FB = P.fill, fu = FB ? (FB.unit || 'chars') : '';
    const fTargets = !FB ? [] : (fu === (P.unit || 'chars') ? units : (fu === 'chars' ? (box._chars || []) : []));
    const gF = FB && fTargets.length ? txDelaysG({ unit: fu, restart: FB.restart }, FB, fTargets) : null;
    const fCol = FB ? ((FB.to && FB.to.fill) || (FB.from && FB.from.fill)) : null;
    const fLen = gF ? txLen(FB, fTargets.length, gF.span) : 0;
    const total = Math.max(inLen, fLen) + 1.1 + outLen + 0.6;
    return { box, units, P, k, start: performance.now(), total, inLen: Math.max(inLen, fLen), dIn, dOut,
      draw(now) {
        const t = ((now - this.start) / 1000) % this.total;
        const outStart = this.inLen + 1.1;
        units.forEach((u, i) => {
          if (P.out && t >= outStart) {
            const s = t - outStart - (P.out.delay || 0) - dOut[i];
            txStyle(u, P.out.from || {}, t > outStart + outLen ? 1 : txEase(P.out, s), k);
          } else if (P.in) {
            const s = t - (P.in.delay || 0) - dIn[i];
            txStyle(u, P.in.from || {}, 1 - txEase(P.in, s), k);
          } else txStyle(u, {}, 0, k);
        });
        if (gF && fCol) fTargets.forEach((c, i) => {
          if (!c._base) { c.style.color = ''; c._base = getComputedStyle(c).color; }
          const e = txEase(FB, t - (FB.delay || 0) - gF.d[i]);
          const a = FB.to ? e : 1 - e;
          c.style.color = a > 0.001 ? txMix(c._base, fCol, Math.min(1, Math.max(0, a))) : '';
        });
      } };
  }
  /*
   * Anteprime: quella dell'editor si anima sempre, quelle della galleria solo con il mouse sopra
   * (altrimenti mostrano un fotogramma fermo). 30 fotogrammi al secondo, e tutto fermo quando
   * non usi il pannello: cosi' il pannello non toglie potenza ad After Effects.
   */
  let txRAF = 0, txLast = 0;
  function txLoop(now) {
    txRAF = 0;
    if (currentView() !== 'text' && currentView() !== 'team') return;
    if (!panelLive() || document.hidden) return; // riparte con txKick quando torni sul pannello
    if (now - txLast >= 32) {
      txLast = now;
      TX.players.forEach((p) => { if (p.box.isConnected && (!p.card || p.hot)) p.draw(now); });
      TX.players = TX.players.filter((p) => p.box.isConnected);
    }
    txRAF = requestAnimationFrame(txLoop);
  }
  const txKick = () => { if (!txRAF) txRAF = requestAnimationFrame(txLoop); };

  /* --- galleria --- */

  const txSampleText = () => (TX.state && TX.state.text ? TX.state.text : 'Nuova collezione');
  function txCard(P, src) {
    const prev = h('div', { class: 'txprev' });
    const card = h('button', { class: 'txcard' + (TX.cur && TX.cur.id === P.id ? ' is-on' : ''), 'data-tip': 'Clic per modificarla, doppio clic per applicarla' }, prev, h('span', { class: 'txname', text: P.name }));
    card.addEventListener('click', () => { txLoad(deep(P), src); $$('.txcard').forEach((c) => c.classList.toggle('is-on', c === card)); });
    card.addEventListener('dblclick', () => { txLoad(deep(P), src); txApply(); });
    if (src === 'user') {
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        TX.dragId = P.id;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', P.name || 'preset'); } catch (err) {}
        card.classList.add('is-drag');
      });
      card.addEventListener('dragend', () => { TX.dragId = null; card.classList.remove('is-drag'); $$('.txfolder.is-drop').forEach((x) => x.classList.remove('is-drop')); });
    }
    if (src !== 'builtin') card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openMenu(card, [
        { label: 'Rinomina…', run: () => txRename(P, src) },
        { label: 'Esporta…', run: () => txExport(P) },
        src === 'user' ? { label: 'Copia nel team', run: () => mutateTeam((T) => { const c = deep(P); const i = T.text.findIndex((x) => x.id === c.id); if (i >= 0) T.text[i] = c; else T.text.push(c); }).then((ok) => ok && toast(`${P.name} è nel team.`)) } : null,
        '-',
        { label: 'Elimina', danger: true, run: () => src === 'team' ? mutateTeam((T) => { T.text = T.text.filter((x) => x.id !== P.id); }) : txSaveUser((L) => L.filter((x) => x.id !== P.id)) },
      ].filter(Boolean), e);
    });
    const text = TX_SAMPLE;
    requestAnimationFrame(() => {
      const pl = txPlayer(prev, P, text, 11);
      pl.card = true; pl.hot = false;
      // Fotogramma fermo a meta' entrata: si capisce l'effetto senza animare tutte le card.
      pl.still = () => pl.draw(pl.start + Math.max(0.05, pl.inLen * 0.45) * 1000);
      pl.still();
      card.addEventListener('mouseenter', () => { pl.hot = true; pl.start = performance.now(); txKick(); });
      card.addEventListener('mouseleave', () => { pl.hot = false; pl.still(); });
      TX.players.push(pl);
    });
    return card;
  }
  // Galleria: una scheda alla volta (Preset, I miei, Team). Ricorda l'ultima scelta.
  const TX_SAMPLE = 'Ciao a te';
  function txGallery() {
    const g = $('#txGal');
    if (!g) return;
    TX.players = TX.players.filter((p) => !g.contains(p.box));
    g.textContent = '';
    const team = (TEAM && TEAM.text) || [];
    let tab = TX.galTab || (localStorage.getItem('mt.txTab') || 'builtin');
    const tabs = [['builtin', 'Preset', TX_BUILTIN.length], ['user', 'I miei', TX.user.length], ['team', 'Team', team.length]];
    const seg = $('#txTabs');
    if (seg) {
      seg.textContent = '';
      tabs.forEach(([k, lab, n]) => {
        const b = h('button', { role: 'radio', class: k === tab ? 'is-on' : '', 'aria-checked': k === tab ? 'true' : 'false' }, lab, h('span', { class: 'segn', text: String(n) }));
        b.addEventListener('click', () => { TX.galTab = k; try { localStorage.setItem('mt.txTab', k); } catch (e) {} txGallery(); });
        seg.append(b);
      });
    }
    const readBtn = txReadButton();
    if (readBtn) add(g, readBtn);
    if (tab === 'user') return txUserSection(g);
    const list = tab === 'team' ? team : TX_BUILTIN;
    if (!list.length) { add(g, h('p', { class: 'hint', text: 'Nessuna animazione del team. Aprine una e scegli Salva nel team, sotto Modifica.' })); return; }
    add(g, h('div', { class: 'txgrid' }, list.map((P) => txCard(P, tab))));
  }

  /* --- cartelle dei preset personali: si creano, si rinominano e ci si trascinano i preset --- */

  function txUserSection(g) {
    const head = h('div', { class: 'txsub' }, h('span', { class: 'faint', text: TX.user.length ? 'Trascina i preset nelle cartelle' : 'Salva un’animazione per trovarla qui' }), h('button', { class: 'txfolderadd', text: '+ Cartella', 'data-tip': 'Crea una cartella e trascinaci dentro i preset' }));
    head.querySelector('.txfolderadd').addEventListener('click', txFolderNew);
    const zone = (folder, list) => {
      const box = h('div', { class: 'txfolder' + (folder ? '' : ' is-root') });
      if (folder) {
        const hd = h('div', { class: 'txfolderhead' }, h('span', { class: 'txfname', text: folder }), h('span', { class: 'txfcount', text: String(list.length) }));
        hd.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          openMenu(hd, [
            { label: 'Rinomina', run: () => txFolderRename(folder) },
            '-',
            { label: 'Elimina cartella', danger: true, run: () => txFolderDelete(folder) },
          ], e);
        });
        box.append(hd);
      }
      const grid = h('div', { class: 'txgrid' }, list.map((P) => txCard(P, 'user')));
      if (!list.length) grid.append(h('span', { class: 'hint txdrop', text: folder ? 'Trascina qui i preset' : 'Nessun preset fuori dalle cartelle' }));
      box.append(grid);
      txDropTarget(box, folder);
      return box;
    };
    const names = TX.folders.filter((n) => n);
    const inFolder = (n) => TX.user.filter((p) => p.folder === n);
    const loose = TX.user.filter((p) => !p.folder || names.indexOf(p.folder) < 0);
    add(g, head, zone('', loose), names.map((n) => zone(n, inFolder(n))));
  }

  function txDropTarget(box, folder) {
    box.addEventListener('dragover', (e) => { if (!TX.dragId) return; e.preventDefault(); box.classList.add('is-drop'); });
    box.addEventListener('dragleave', (e) => { if (!box.contains(e.relatedTarget)) box.classList.remove('is-drop'); });
    box.addEventListener('drop', (e) => {
      if (!TX.dragId) return;
      e.preventDefault();
      box.classList.remove('is-drop');
      const id = TX.dragId; TX.dragId = null;
      txMove(id, folder);
    });
  }

  async function txMove(id, folder) {
    const p = TX.user.find((x) => x.id === id);
    if (!p || (p.folder || '') === (folder || '')) return;
    await txSaveUser((L) => { const q = L.find((x) => x.id === id); if (q) { if (folder) q.folder = folder; else delete q.folder; } return L; });
  }

  function txFolderNew() {
    openSheet('Nuova cartella', [{ key: 'name', label: 'Nome', value: '', placeholder: 'Es. Titoli' }], 'Crea', async (v) => {
      const n = (v.name || '').trim();
      if (!n) return;
      if (TX.folders.indexOf(n) >= 0) return toast('Esiste già una cartella con questo nome.', 'err');
      await txSaveUser((L, F) => { F.push(n); return L; });
    });
  }

  function txFolderRename(old) {
    openSheet('Rinomina cartella', [{ key: 'name', label: 'Nome', value: old }], 'Rinomina', async (v) => {
      const n = (v.name || '').trim();
      if (!n || n === old) return;
      if (TX.folders.indexOf(n) >= 0) return toast('Esiste già una cartella con questo nome.', 'err');
      await txSaveUser((L, F) => {
        const i = F.indexOf(old); if (i >= 0) F[i] = n;
        L.forEach((p) => { if (p.folder === old) p.folder = n; });
        return L;
      });
    });
  }

  // Eliminare una cartella non cancella i preset: tornano fuori dalle cartelle.
  async function txFolderDelete(name) {
    await txSaveUser((L, F) => {
      const i = F.indexOf(name); if (i >= 0) F.splice(i, 1);
      L.forEach((p) => { if (p.folder === name) delete p.folder; });
      return L;
    });
    toast(`Cartella ${name} eliminata. I preset sono rimasti.`);
  }

  async function txLoadUser() {
    const r = await call('inflect_dataLoad', 'text-presets');
    const d = (r.ok && r.data) || {};
    TX.user = Array.isArray(d.presets) ? d.presets : [];
    TX.folders = Array.isArray(d.folders) ? d.folders : [];
    txGallery();
  }
  // fn riceve la lista dei preset e le cartelle, e restituisce la lista (o niente se la modifica sul posto).
  async function txSaveUser(fn) {
    const r = await call('inflect_dataLoad', 'text-presets');
    const d = (r.ok && r.data) || {};
    let list = Array.isArray(d.presets) ? d.presets : [];
    const folders = Array.isArray(d.folders) ? d.folders : TX.folders.slice();
    list = fn(list, folders) || list;
    const s = await call('inflect_dataSave', 'text-presets', { format: 'motion-tools-text-library', version: 1, presets: list, folders });
    if (!s.ok) { toast(s.error, 'err'); return false; }
    TX.user = list; TX.folders = folders; txGallery();
    return true;
  }
  function txExport(P) {
    const out = deep(P); out.format = 'motion-tools-text'; out.version = 1;
    call('inflect_fileSave', out, `${(P.name || 'testo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mt-testo.json`, 'Esporta animazione di testo')
      .then((r) => { if (!r.ok) toast(r.error, 'err'); else if (!r.cancelled) toast('Animazione esportata.'); });
  }
  async function txImport() {
    const r = await call('inflect_fileOpen', 'Importa animazione di testo');
    if (!r.ok) return toast(r.error, 'err');
    if (r.cancelled) return;
    const d = r.data || {};
    const list = Array.isArray(d.presets) ? d.presets : Array.isArray(d.text) ? d.text : [d];
    const ok = list.filter((p) => p && (p.in || p.out));
    if (!ok.length) return toast('Il file non contiene animazioni di testo di Motion Tools.', 'err');
    ok.forEach((p) => { p.id = p.id && !String(p.id).startsWith('b-') ? p.id : C.uid(); p.name = p.name || 'Importata'; });
    if (await txSaveUser((L) => { ok.forEach((p) => { const i = L.findIndex((x) => x.id === p.id); if (i >= 0) L[i] = p; else L.push(p); }); return L; })) {
      txLoad(deep(ok[0]), 'user');
      toast(ok.length === 1 ? `${ok[0].name} importata nei tuoi preset.` : `${ok.length} animazioni importate.`);
    }
  }

  /* --- editor --- */

  function txLoad(P, src) {
    TX.cur = P; TX.src = src; TX.phase = P.in ? 'in' : (P.out ? 'out' : 'fill');
    txEditor();
  }
  function txDefaultOut(P) {
    const i = P.in || ph(0.6, 0.04, bz(0.22, 1, 0.36, 1), { opacity: 0, y: 30 });
    const f = deep(i.from || {});
    if (f.y) f.y = -f.y; if (f.x) f.x = -f.x;
    return ph(Math.max(0.2, i.dur * 0.7), (i.stg || 0) * 0.6, bz(0.64, 0, 0.78, 0), f, { ord: i.ord || 0 });
  }
  function txChanged(rebuild) {
    if (rebuild) txEditor(); else txPreview();
    if (TX.live && TX.bound) {
      clearTimeout(TX.applyTimer);
      TX.applyTimer = setTimeout(() => txApply(true), 450);
    }
  }
  function txPreview() {
    const stage = $('#txStage');
    if (!stage) return;
    $('#txStageEmpty').hidden = !!TX.cur;
    if (!TX.cur) { stage.textContent = ''; TX.players = TX.players.filter((p) => p.box !== stage); return; }
    TX.players = TX.players.filter((p) => p.box !== stage);
    TX.players.push(txPlayer(stage, TX.cur, TX.previewText || txSampleText(), 30));
    txKick();
  }
  function txEditor() {
    const box = $('#txEdit');
    if (!box) return;
    box.textContent = '';
    const P = TX.cur;
    if (!P) { add(box, h('p', { class: 'hint', text: 'Scegli un’animazione qui sopra per modificarla.' })); txPreview(); return; }
    $('#txEditName').textContent = P.name ? `· ${P.name}` : '';
    const fps = fpsNow();
    const fr = (s) => Math.round((s || 0) * fps * 10) / 10;
    const sec = (f) => Math.max(0, f) / fps;

    const pt = h('input', { type: 'text', class: 'txinput', placeholder: 'Testo di prova (di base quello del layer selezionato)', value: TX.previewText || '' });
    pt.addEventListener('input', () => { TX.previewText = pt.value; txPreview(); });
    add(box, row('Anteprima', pt));

    add(box, row('Anima', segc([['chars', 'Lettere'], ['words', 'Parole'], ['lines', 'Righe']], P.unit || 'chars', (v) => { P.unit = v; txChanged(true); })));
    add(box, row('Ritaglio', check('Nascondi fuori dalla riga', P.clip, (on) => { P.clip = !!on; txChanged(false); }, 'Il testo entra da sotto una linea invisibile, come se uscisse da una fessura. Usa uno spostamento Y di circa 110')));
    if (!P.ref) P.ref = 100;

    const hasOut = !!P.out, hasIn = !!P.in;
    const hasFill = !!P.fill, isFill = TX.phase === 'fill';
    // Un pallino sulle fasi in uso: si vede subito se il layer o il preset usano anche MT Colore.
    const on = (k, lab) => (P[k] ? `${lab} \u2022` : lab);
    add(box, row('Fase', segc([['in', on('in', 'Entrata'), 'Animatore MT Entrata'], ['out', on('out', 'Uscita'), 'Animatore MT Uscita'], ['fill', on('fill', 'Colore'), 'Animatore MT Colore: il colore con la sua unità e i suoi tempi, per esempio per lettere mentre le parole si muovono']], TX.phase, (v) => { TX.phase = v; txEditor(); }),
      check('Attiva', isFill ? hasFill : (TX.phase === 'in' ? hasIn : hasOut), (on) => {
        const key = TX.phase;
        if (key === 'fill') {
          if (on) {
            const ws = P.in && (P.unit || 'chars') === 'words' ? (P.in.stg || 0.08) : 0.08;
            P.fill = ph(0.6, 0.03, bz(0.22, 1, 0.36, 1), { fill: '#FF5A1F' }, { unit: 'chars', restart: 'words', wordStg: ws });
          } else delete P.fill;
        } else if (on) P[key] = key === 'out' ? txDefaultOut(P) : ph(0.7, 0.04, bz(0.22, 1, 0.36, 1), { opacity: 0, y: 30, blur: 10 });
        else { if (key === 'in' && !P.out) return txEditor(); P[key] = null; }
        txChanged(true);
      }, isFill ? 'Il colore parte dal punto di attacco del layer' : (TX.phase === 'out' ? 'L’uscita finisce sul punto di stacco del layer' : 'L’entrata parte dal punto di attacco del layer'))));

    const Q = P[TX.phase];
    if (!Q) {
      add(box, h('p', { class: 'hint', text: isFill ? 'Nessun colore animato: le lettere restano del loro colore.' : (TX.phase === 'out' ? 'Nessuna uscita: il testo resta in scena fino alla fine del layer.' : 'Nessuna entrata: il testo è già in scena.') }));
    } else {
      if (isFill) add(box, row('Colora', segc([['chars', 'Lettere'], ['words', 'Parole']], Q.unit || 'chars', (v) => { Q.unit = v; if (v === 'words' && Q.restart === 'words') delete Q.restart; txChanged(true); })));
      const F = Q.from = Q.from || {};
      add(box, h('div', { class: 'subhead', text: 'Tempi' }));
      add(box,
        row('Durata', hot(fr(Q.dur), (v) => { Q.dur = Math.max(0.001, sec(v)); txChanged(); }, { min: 0, step: 1, tip: 'Quanto dura l’animazione di ogni lettera, parola o riga' }), unit('fr')),
        row('Sfalsamento', hot(fr(Q.stg), (v) => { Q.stg = sec(v); txChanged(); }, { min: 0, step: 0.5, tip: 'Ritardo tra un elemento e il successivo' }), unit('fr')),
        row('Ritardo', hot(fr(Q.delay), (v) => { Q.delay = sec(v); txChanged(); }, { min: 0, tip: TX.phase === 'in' ? 'Attesa dopo il punto di attacco del layer' : 'Anticipo rispetto al punto di stacco del layer' }), unit('fr')),
        row('Ordine', select([[0, 'In avanti'], [1, 'Al contrario'], [2, 'Dal centro'], [3, 'Dai lati'], [4, 'Casuale']], Q.ord || 0, (v) => { Q.ord = +v; txChanged(true); })),
        row('Ritmo', segc([[0, 'Costante'], [1, 'Accelera', 'I ritardi si stringono verso la fine'], [2, 'Rallenta', 'I ritardi si allargano verso la fine']], Q.spread || 0, (v) => { Q.spread = +v; txChanged(); })),
      );
      if ((Q.ord || 0) === 4) add(box, row('Seme', hot(Q.seed || 1, (v) => { Q.seed = Math.max(1, Math.round(v)); txChanged(); }, { min: 1 })));
      // Lo sfalsamento riparte a ogni parola (animando lettere) o a ogni riga (lettere o parole).
      const unitNow = isFill ? (Q.unit || 'chars') : (P.unit || 'chars');
      if (unitNow !== 'lines') {
        const optsR = unitNow === 'words' ? [['', 'Mai'], ['lines', 'A ogni riga']] : [['', 'Mai'], ['words', 'A ogni parola'], ['lines', 'A ogni riga']];
        const curR = txRestart(isFill ? { unit: unitNow } : P, Q);
        add(box, row('Riparte', select(optsR, curR, (v) => { if (v) Q.restart = v; else delete Q.restart; delete P.restart; txChanged(true); }, { tip: 'Lo sfalsamento ricomincia dalla prima lettera di ogni parola, o dal primo elemento di ogni riga' })));
        if (curR) add(box, row(curR === 'words' ? 'Tra parole' : 'Tra righe', hot(fr(Q.wstg || Q.wordStg || 0), (v) => { const x = sec(v); delete Q.wordStg; if (x) Q.wstg = x; else delete Q.wstg; txChanged(); }, { min: 0, step: 0.5, tip: isFill ? 'Ritardo tra una parola e la successiva. Uguale allo sfalsamento delle parole in Entrata, ogni parola si colora quando entra' : 'Ritardo tra una parola (o riga) e la successiva. Con 0 partono tutte insieme' }), unit('fr')));
      }

      add(box, h('div', { class: 'subhead', text: 'Movimento' }));
      const E = Q.ease = Q.ease || { type: 'bezier', v: [0.22, 1, 0.36, 1] };
      add(box, row('Curva', segc([['bezier', 'Curva'], ['spring', 'Molla', 'Come le animazioni di iOS: si regola con il rimbalzo']], E.type || 'bezier', (v) => {
        if (v === 'spring') Q.ease = { type: 'spring', bounce: 0.2 }; else Q.ease = { type: 'bezier', v: [0.22, 1, 0.36, 1] };
        txChanged(true);
      })));
      if (E.type === 'spring') {
        add(box, row('Rimbalzo', hot(Math.round((E.bounce || 0) * 100), (v) => { E.bounce = C.clamp(v, 0, 90) / 100; txChanged(); }, { min: 0, max: 90 }), unit('%')));
      } else {
        // Curve pronte, le tue, quelle del team e del progetto (anche a più punti) e quella dell'editor.
        const libs = [['user', 'Le mie', S.user.curves], ['brand', 'Team', S.brand.curves], ['project', 'Progetto', S.project.curves]];
        const opts = TX_EASES.map(([n], i) => [`e:${i}`, n]);
        libs.forEach(([lib, label, list]) => (list || []).forEach((c) => opts.push([`c:${lib}:${c.id}`, `${label} · ${c.name}`])));
        opts.push(['editor', 'Curva nella scheda Curve'], ['custom', 'Personalizzata']);
        let cur = 'custom';
        if (E.src) cur = `c:${E.src.lib}:${E.src.id}`;
        else if (E.type === 'bezier' && E.v) { const i = TX_EASES.findIndex(([, e]) => e.every((x, k) => Math.abs(x - E.v[k]) < 1e-3)); if (i >= 0) cur = `e:${i}`; }
        const fromCurve = (c, src) => {
          if (C.isSimple(c)) Q.ease = { type: 'bezier', v: C.toCubic(c).map((x) => C.round(x, 4)), src, name: c.name };
          else Q.ease = { type: 'lut', v: Array.from({ length: 81 }, (_, k) => C.round(C.evaluate(c, k / 80), 5)), src, name: c.name };
        };
        add(box, row('Tipo', select(opts, cur, (val) => {
          if (val.startsWith('e:')) Q.ease = { type: 'bezier', v: TX_EASES[+val.slice(2)][1].slice() };
          else if (val.startsWith('c:')) {
            const [, lib, id] = val.split(':');
            const c = (libFor(lib).curves || []).find((x) => x.id === id);
            if (c) fromCurve(c, { lib, id });
          } else if (val === 'editor') fromCurve(S.curve, null);
          else if (val === 'custom') Q.ease = { type: 'bezier', v: (E.type === 'bezier' && E.v) ? E.v.slice() : [0.19, 1, 0.22, 1] };
          txChanged(true);
        })));
        const E2 = Q.ease;
        if (E2.type === 'lut') {
          add(box, row('Curva', txCurveThumb(E2.v), h('span', { class: 'hint', text: `${E2.name || 'Curva'} a più punti` })));
        } else {
          const v = E2.v = E2.v || [0.19, 1, 0.22, 1];
          add(box, row('Valori', h('span', { class: 'vec' }, ['x1', 'y1', 'x2', 'y2'].map((ax, i) => [h('span', { class: 'ax', text: ax }), hot(v[i], (x) => { v[i] = i % 2 === 0 ? C.clamp(x, 0, 1) : x; delete E2.src; txChanged(); }, { step: 0.01 })]))));
        }
      }

      if (isFill) {
        // Colore: parte da questo colore e arriva a quello del testo, o il contrario.
        add(box, h('div', { class: 'subhead', text: 'Colore' }));
        const dir = Q.to && Q.to.fill ? 'to' : 'from';
        const curC = (Q.to && Q.to.fill) || (Q.from && Q.from.fill) || '#FF5A1F';
        add(box, row('Direzione', segc([['from', 'Parte dal colore', 'Le lettere partono da questo colore e arrivano al loro'], ['to', 'Arriva al colore', 'Le lettere partono dal loro colore e arrivano a questo']], dir, (v) => {
          if (v === 'to') { Q.to = { fill: curC }; Q.from = {}; } else { Q.from = { fill: curC }; delete Q.to; }
          txChanged(true);
        })));
        add(box, row('Colore', colorField(curC, (hex) => { if (Q.to && Q.to.fill) Q.to.fill = hex; else Q.from = { fill: hex }; txChanged(); }, { tip: 'Colore di riempimento. Vale per il testo con il riempimento attivo' })));
      } else {
      add(box, h('div', { class: 'subhead', text: TX.phase === 'in' ? 'Parte da' : 'Arriva a' }));
      const fv = (key, def) => (F[key] !== undefined ? F[key] : def);
      const setF = (key, def) => (x) => { if (x === def) delete F[key]; else F[key] = x; txChanged(); };
      add(box,
        row('Opacità', hot(fv('opacity', 100), setF('opacity', 100), { min: 0, max: 100 }), unit('%')),
        row('Spostamento', vec(['X', 'Y'], [fv('x', 0), fv('y', 0)], (a) => { a[0] ? F.x = a[0] : delete F.x; a[1] ? F.y = a[1] : delete F.y; txChanged(); }), unit('px'), h('span', { class: 'unit', text: 'su 100 px', 'data-tip': 'Spostamenti e sfocatura sono pensati per un testo da 100 px e si adattano alla dimensione del layer' })),
        row('Scala', hot(fv('scale', 100), setF('scale', 100), { min: 0 }), unit('%')),
        row('Rotazione', hot(fv('rotation', 0), setF('rotation', 0)), unit('°')),
        row('Sfocatura', hot(fv('blur', 0), setF('blur', 0), { min: 0 }), unit('px')),
        row('Spaziatura', hot(fv('tracking', 0), setF('tracking', 0), { tip: 'Spazio tra le lettere, come la crenatura nel pannello Carattere' })),
      );
      // Colore di riempimento insieme al movimento: le lettere partono (o arrivano) da questo colore.
      const col = colorField(F.fill, (hex) => { F.fill = hex; txChanged(); }, { disabled: !F.fill, tip: 'Colore di riempimento. Vale per il testo con il riempimento attivo' });
      add(box, row('Colore', check('Cambia colore', !!F.fill, (on) => { if (on) F.fill = (col.input.value || '#FF5A1F').toUpperCase(); else delete F.fill; col.setDisabled(!on); txChanged(); }), col));
      add(box, h('p', { class: 'hint', text: 'Per un colore che va per lettere mentre il movimento va per parole, usa la fase Colore.' }));
      }
    }

    add(box, h('div', { class: 'subhead', text: 'Salva' }));
    const live = check('Aggiorna il layer mentre modifichi', TX.live, (on) => { TX.live = !!on; try { localStorage.setItem('mt.txLive', on ? '1' : '0'); } catch (e) {} }, 'Se il layer selezionato ha già un’animazione di Motion Tools, le modifiche arrivano subito in After Effects');
    add(box, row('Dal vivo', live));
    // Il preset da cui sei partito (anche se l'hai riaperto da un layer): si aggiorna con un clic.
    const origin = txOrigin(P);
    const btns = [];
    if (origin) {
      const bUpd = h('button', { class: 'btn', text: `Aggiorna ${P.name || 'preset'}`, 'data-tip': origin === 'team' ? 'Salva le modifiche nel preset del team' : 'Salva le modifiche nel tuo preset' });
      bUpd.addEventListener('click', () => txUpdate(origin));
      btns.push(bUpd);
    }
    const bTeam = h('button', { class: 'btn', text: 'Salva nel team' });
    bTeam.addEventListener('click', () => txSaveAs('team', true));
    const bExp = h('button', { class: 'btn', text: 'Esporta' });
    bExp.addEventListener('click', () => txExport(TX.cur));
    btns.push(bTeam, bExp);
    add(box, h('div', { class: 'btnrow' }, ...btns));
    txPreview();
  }
  function txCurveThumb(L) {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 60 30'); svg.setAttribute('class', 'txthumb');
    const lo = Math.min(0, ...L), hi = Math.max(1, ...L), y = (v) => 27 - (v - lo) / (hi - lo) * 24;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', L.map((v, k) => `${k ? 'L' : 'M'}${(3 + k / (L.length - 1) * 54).toFixed(1)},${y(v).toFixed(1)}`).join(''));
    svg.append(path);
    return svg;
  }
  // Rinomina un preset tuo o del team; se e' aperto nell'editor si aggiorna anche li'.
  function txRename(P, src) {
    openSheet('Rinomina preset', [{ key: 'name', label: 'Nome', value: P.name || '' }], 'Rinomina', async (v) => {
      const name = String(v.name || '').trim();
      if (!name || name === P.name) return;
      const set = (list) => { const x = list.find((y) => y.id === P.id); if (x) x.name = name; return list; };
      const ok = src === 'team' ? await mutateTeam((T) => { set(T.text); }) : await txSaveUser((L) => set(L));
      if (!ok) return;
      if (TX.cur && TX.cur.id === P.id) { TX.cur.name = name; txEditor(); }
      txGallery();
      toast(`Preset rinominato in ${name}.`);
    });
  }
  // Dove sta il preset aperto: nei tuoi, nel team, o da nessuna parte (preset di base o nuovo).
  function txOrigin(P) {
    if (!P || !P.id || String(P.id).startsWith('b-')) return null;
    if ((TX.user || []).some((x) => x.id === P.id)) return 'user';
    if (TEAM && (TEAM.text || []).some((x) => x.id === P.id)) return 'team';
    return null;
  }
  async function txUpdate(where) {
    const c = deep(TX.cur);
    const ok = where === 'team'
      ? await mutateTeam((T) => { const i = T.text.findIndex((x) => x.id === c.id); if (i >= 0) T.text[i] = c; else T.text.push(c); })
      : await txSaveUser((L) => { const i = L.findIndex((x) => x.id === c.id); if (i >= 0) L[i] = c; else L.push(c); return L; });
    if (ok) { txGallery(); toast(`${c.name || 'Preset'} aggiornata${where === 'team' ? ' nel team' : ''}.`); }
  }
  function txSaveAs(where, asNew) {
    const P = TX.cur;
    if (!P) return;
    const same = !asNew && TX.src === where && !String(P.id).startsWith('b-');
    openSheet(where === 'team' ? 'Salva nel team' : 'Salva nei tuoi preset', [{ key: 'name', label: 'Nome', value: P.name || '', placeholder: 'Es. Titolo campagna' }], same ? 'Aggiorna' : 'Salva', async (v) => {
      const c = deep(P);
      c.name = v.name || P.name || 'Animazione';
      if (!same) c.id = C.uid();
      const ok = where === 'team'
        ? await mutateTeam((T) => { const i = T.text.findIndex((x) => x.id === c.id); if (i >= 0) T.text[i] = c; else T.text.push(c); })
        : await txSaveUser((L) => { const i = L.findIndex((x) => x.id === c.id); if (i >= 0) L[i] = c; else L.push(c); return L; });
      if (ok) { TX.cur = c; TX.src = where; txEditor(); txGallery(); toast(`${c.name} salvata${where === 'team' ? ' nel team' : ''}.`); }
    });
  }
  async function txApply(quiet) {
    if (!TX.cur) return toast('Scegli prima un preset.', 'err');
    const P = deep(TX.cur);
    if (!P.in && !P.out && !P.fill) return toast('Attiva almeno una fase: entrata, uscita o colore.', 'err');
    const r = await call('inflect_textApply', P);
    if (!r.ok) return toast(r.error, 'err');
    TX.bound = true;
    if (!quiet) toast(`${P.name || 'Animazione'} applicata a ${r.count} ${r.count === 1 ? 'layer' : 'layer'} di testo. Sposta il layer per spostare l’animazione.`);
  }
  async function txRemove() {
    const r = await call('inflect_textRemove');
    if (!r.ok) return toast(r.error, 'err');
    TX.bound = false;
    toast('Animazione tolta.');
  }

  let txLastSel = '';
  async function txPoll(force) {
    const st = await call('inflect_textState', !!force);
    if (!st.ok || st.same) return;
    TX.state = st;
    const el = $('#txSel');
    if (el) el.textContent = st.count ? (st.count === 1 ? st.name : `${st.count} layer di testo`) : 'Seleziona un layer di testo';
    const sub = $('#txSub');
    if (sub) sub.textContent = !st.count ? 'Poi scegli un’animazione e premi Applica'
      : st.applied ? `Layer di testo, ha già ${st.applied.name || 'un’animazione di Motion Tools'}`
      : 'Layer di testo, nessuna animazione di Motion Tools';
    $('#app').classList.toggle('no-text', !st.count);
    const key = `${st.id || ''}|${st.count}|${st.text || ''}`;
    if (key === txLastSel) return;
    const textChanged = txLastSel.split('|')[2] !== (st.text || '');
    txLastSel = key;
    TX.bound = !!st.applied;
    // Il layer dice quali fasi usa: l'editor si apre sulla prima in uso (anche solo Colore).
    if (st.applied) { TX.cur = st.applied; TX.src = 'layer'; TX.phase = st.applied.in ? 'in' : (st.applied.out ? 'out' : 'fill'); txEditor(); }
    else if (textChanged) { txPreview(); }
    txGallery();
  }

  // Un layer animato a mano (senza il plugin) si può leggere: legge i keyframe e apre l'editor.
  function txReadButton() {
    const st = TX.state;
    if (!st || !st.count || st.applied) return null;
    const b = h('button', { class: 'btn txreadbtn', text: 'Leggi l’animazione di questo layer', 'data-tip': 'Legge i keyframe messi a mano sugli animatori e li apre nell’editor per salvarli' });
    b.addEventListener('click', txReadKeys);
    return b;
  }
  async function txReadKeys() {
    const r = await call('inflect_textReadKeys');
    if (!r.ok) { toast(r.error, 'err'); return false; }
    TX.cur = deep(r.preset); TX.src = 'layer'; TX.phase = 'in'; TX.bound = false;
    txEditor();
    const notes = [].concat(r.read || [], r.assumed || []).join(', ');
    toast(`Animazione letta: ${notes}.`);
    return true;
  }
  // Pulsante in alto: con un'animazione del plugin salva quella; con una fatta a mano la legge e poi salva.
  async function txFromLayer() {
    if (!TX.state || !TX.state.count) return toast('Seleziona un layer di testo.', 'err');
    if (TX.state.applied) { TX.cur = deep(TX.state.applied); TX.src = 'layer'; return txSaveAs('user'); }
    if (await txReadKeys()) txSaveAs('user');
  }
  setInterval(() => { const a = document.activeElement; if (panelLive() && currentView() === 'text' && !(a && /INPUT|TEXTAREA/.test(a.tagName))) txPoll(false); }, 900);
  // Quando torni sul pannello rilegge il testo del layer (magari l'hai appena cambiato in After Effects).
  window.addEventListener('focus', () => { if (currentView() === 'text') txPoll(true); });
  document.addEventListener('mouseenter', () => { if (currentView() === 'text') txPoll(true); });

  /* ============================================================== guide == */

  const G = { comp: null, w: 1920, h: 1080, guides: [], sel: -1, ori: 1, unit: 'px', pos: 0, dist: 100, count: 1, edges: 1, centers: 1, margin: 0, cols: 12, rows: 0, gm: 80, gutter: 20, key: '' };
  try { Object.assign(G, JSON.parse(localStorage.getItem('mt.guides') || '{}'), { guides: [], sel: -1, key: '' }); } catch (e) {}
  const saveG = () => { try { const { comp, guides, sel, key, ...rest } = G; localStorage.setItem('mt.guides', JSON.stringify(rest)); } catch (e) {} };

  async function gRead(force) {
    const r = await call('inflect_guidesRead');
    if (!r.ok) return;
    const key = JSON.stringify([r.comp, r.width, r.height, r.guides]);
    if (!force && key === G.key) return;
    G.key = key; G.comp = r.comp; G.w = r.width || G.w; G.h = r.height || G.h; G.guides = r.guides || []; G.supported = r.supported !== false;
    if (G.sel >= G.guides.length) G.sel = -1;
    const body = $('#gBody');
    if (body && isTyping(body)) { gDraw(); return; }
    gRender();
  }
  async function gAdd(list, msg) {
    if (!list.length) return;
    const r = await call('inflect_guidesAdd', list.map((g) => ({ o: g.o, p: C.round(g.p, 2) })));
    if (!r.ok) return toast(r.error, 'err');
    toast(r.added ? `${r.added} ${r.added === 1 ? 'guida aggiunta' : 'guide aggiunte'}${msg ? ' ' + msg : ''}.` : 'Quelle guide ci sono già.');
    G.key = ''; gRead(true);
  }
  function gDraw() {
    const svg = $('#gSvg');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const pad = Math.max(G.w, G.h) * 0.04;
    svg.setAttribute('viewBox', `${-pad} ${-pad} ${G.w + 2 * pad} ${G.h + 2 * pad}`);
    svg.textContent = '';
    const sw = Math.max(G.w, G.h) / 400;
    svg.append(el('rect', { class: 'gcomp', x: 0, y: 0, width: G.w, height: G.h, 'stroke-width': sw }));
    G.guides.forEach((g) => {
      const v = g.o === 1, on = g.i === G.sel;
      const a = v ? { x1: g.p, x2: g.p, y1: -pad, y2: G.h + pad } : { x1: -pad, x2: G.w + pad, y1: g.p, y2: g.p };
      svg.append(el('line', Object.assign({ class: 'gline' + (on ? ' is-on' : ''), 'stroke-width': sw * (on ? 2 : 1) }, a)));
      const hit = el('line', Object.assign({ class: 'ghit', 'stroke-width': sw * 10 }, a));
      hit.addEventListener('click', () => { G.sel = g.i; gRender(); });
      svg.append(hit);
    });
  }
  function gRender() {
    const body = $('#gBody');
    if (!body) return;
    body.textContent = '';
    if (!G.comp) { add(body, h('p', { class: 'hint', text: 'Apri una composizione per vedere e creare le guide.' })); return; }
    if (G.supported === false) { add(body, h('p', { class: 'hint', text: 'Questa versione di After Effects non permette di creare guide da script.' })); return; }
    add(body, h('div', { class: 'gview' }, (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.id = 'gSvg'; return s; })()));
    gDraw();
    const W = () => (G.ori === 1 ? G.w : G.h);
    const toPx = (v) => (G.unit === '%' ? (v / 100) * W() : v);

    // Copia e incolla tra composizioni: le guide restano negli appunti del pannello (non in quelli di sistema).
    let clip = null;
    try { clip = JSON.parse(localStorage.getItem('mt.guideClip') || 'null'); } catch (e) {}
    const cp = h('button', { class: 'btn sm', text: G.guides.length ? `Copia (${G.guides.length})` : 'Copia', 'data-tip': 'Copia le guide di questa composizione' });
    cp.disabled = !G.guides.length;
    cp.addEventListener('click', () => {
      const c2 = { comp: G.comp, w: G.w, h: G.h, guides: G.guides.map((g) => ({ o: g.o, p: g.p })) };
      try { localStorage.setItem('mt.guideClip', JSON.stringify(c2)); } catch (e) {}
      toast(`${c2.guides.length} ${c2.guides.length === 1 ? 'guida copiata' : 'guide copiate'} da ${G.comp}. Apri l\u2019altra composizione e premi Incolla.`);
      gRender();
    });
    const sameSize = clip && clip.w === G.w && clip.h === G.h;
    const paste = (prop) => {
      if (!clip || !clip.guides.length) return;
      const L = clip.guides.map((g) => ({ o: g.o, p: prop ? g.p * (g.o === 1 ? G.w / clip.w : G.h / clip.h) : g.p }));
      gAdd(L, `da ${clip.comp}${prop ? ', in proporzione' : ''}`);
    };
    const ps = h('button', { class: 'btn sm', text: 'Incolla', 'data-tip': clip ? `${clip.guides.length} guide da ${clip.comp} (${clip.w}\u00d7${clip.h}), alla stessa distanza in pixel` : 'Prima copia le guide da un\u2019altra composizione' });
    ps.disabled = !clip || !clip.guides.length;
    ps.addEventListener('click', () => paste(false));
    const pp = h('button', { class: 'btn sm', text: 'In proporzione', 'data-tip': clip ? `Adatta le guide da ${clip.w}\u00d7${clip.h} a ${G.w}\u00d7${G.h}` : '' });
    pp.addEventListener('click', () => paste(true));
    add(body, row('Tra comp', h('div', { class: 'btnrow' }, cp, ps, clip && !sameSize ? pp : null)));
    if (clip && clip.guides.length) add(body, h('p', { class: 'hint', text: `Negli appunti: ${clip.guides.length} guide da ${clip.comp}${sameSize ? '' : ` (${clip.w}\u00d7${clip.h}: con \u201cIn proporzione\u201d si adattano a questa composizione)`}.` }));

    const addBtn = h('button', { class: 'btn sm', text: 'Aggiungi' });
    addBtn.addEventListener('click', () => gAdd([{ o: G.ori, p: toPx(G.pos) }]));
    add(body,
      row('Direzione', segc([[1, 'Verticale', 'Una linea dall’alto in basso, a una certa X'], [0, 'Orizzontale', 'Una linea da sinistra a destra, a una certa Y']], G.ori, (v) => { G.ori = +v; saveG(); })),
      row('Posizione', hot(G.pos, (v) => { G.pos = v; saveG(); }, { tip: 'Dal bordo sinistro per le verticali, da quello in alto per le orizzontali' }), segc([['px', 'px'], ['%', '%']], G.unit, (v) => { G.unit = v; saveG(); }), addBtn),
    );

    const sg = G.guides.find((g) => g.i === G.sel);
    const dBtn = h('button', { class: 'btn sm', text: 'Aggiungi' });
    dBtn.disabled = !sg;
    dBtn.addEventListener('click', () => {
      if (!sg) return;
      const L = [];
      for (let j = 1; j <= Math.max(1, Math.round(G.count)); j++) L.push({ o: sg.o, p: sg.p + G.dist * j });
      gAdd(L, `a ${G.dist} px l’una dall’altra`);
    });
    add(body, h('div', { class: 'subhead', text: sg ? `Dalla guida ${sg.o === 1 ? 'verticale' : 'orizzontale'} a ${C.round(sg.p, 1)} px` : 'Dalla guida selezionata' }),
      row('Distanza', hot(G.dist, (v) => { G.dist = v; saveG(); }, { tip: 'Negativa per andare a sinistra o in alto' }), unit('px'), h('span', { class: 'unit', text: '×' }), hot(G.count, (v) => { G.count = Math.max(1, Math.round(v)); saveG(); }, { min: 1, tip: 'Quante guide creare, sempre alla stessa distanza' }), dBtn));
    if (!sg) add(body, h('p', { class: 'hint', text: 'Clicca una guida nello schema o nell’elenco per selezionarla.' }));

    const lBtn = h('button', { class: 'btn sm', text: 'Crea' });
    lBtn.addEventListener('click', async () => {
      const r = await call('inflect_guideBounds');
      if (!r.ok) return toast(r.error, 'err');
      const L = [], m = G.margin;
      r.bounds.forEach((b) => {
        if (G.edges) L.push({ o: 1, p: b.l - m }, { o: 1, p: b.r + m }, { o: 0, p: b.t - m }, { o: 0, p: b.b + m });
        if (G.centers) L.push({ o: 1, p: (b.l + b.r) / 2 }, { o: 0, p: (b.t + b.b) / 2 });
      });
      gAdd(L, 'dai layer');
    });
    add(body, h('div', { class: 'subhead', text: 'Dai layer selezionati' }),
      row('Linee', check('Bordi', G.edges, (v) => { G.edges = v; saveG(); }), check('Centro', G.centers, (v) => { G.centers = v; saveG(); })),
      row('Margine', hot(G.margin, (v) => { G.margin = v; saveG(); }, { tip: 'Distanza delle guide dai bordi del layer' }), unit('px'), lBtn));

    const grid = h('button', { class: 'btn sm', text: 'Crea griglia' });
    grid.addEventListener('click', () => {
      const L = [], m = G.gm, g = G.gutter;
      const lines = (n, size, o) => {
        if (n < 1) return;
        const cw = (size - 2 * m - (n - 1) * g) / n;
        if (cw <= 0) return toast('Margini e spaziature non ci stanno nella composizione.', 'err');
        for (let j = 0; j < n; j++) { L.push({ o, p: m + j * (cw + g) }); L.push({ o, p: m + j * (cw + g) + cw }); }
      };
      lines(Math.round(G.cols), G.w, 1);
      lines(Math.round(G.rows), G.h, 0);
      gAdd(L, 'della griglia');
    });
    const ctr = h('button', { class: 'btn sm', text: 'Centro' });
    ctr.addEventListener('click', () => gAdd([{ o: 1, p: G.w / 2 }, { o: 0, p: G.h / 2 }]));
    const safe = h('button', { class: 'btn sm', text: 'Area sicura', 'data-tip': 'Margini al 5% (azione) e al 10% (titoli)' });
    safe.addEventListener('click', () => gAdd([0.05, 0.1, 0.9, 0.95].flatMap((f) => [{ o: 1, p: G.w * f }, { o: 0, p: G.h * f }])));
    add(body, h('div', { class: 'subhead', text: 'Griglia' }),
      row('Colonne', hot(G.cols, (v) => { G.cols = Math.max(0, Math.round(v)); saveG(); }, { min: 0 }), h('span', { class: 'unit', text: 'righe' }), hot(G.rows, (v) => { G.rows = Math.max(0, Math.round(v)); saveG(); }, { min: 0 })),
      row('Margine', hot(G.gm, (v) => { G.gm = v; saveG(); }, { min: 0 }), unit('px'), h('span', { class: 'unit', text: 'spazio' }), hot(G.gutter, (v) => { G.gutter = v; saveG(); }, { min: 0, tip: 'Spazio tra le colonne e tra le righe' }), unit('px')),
      h('div', { class: 'btnrow' }, grid, ctr, safe));

    add(body, h('div', { class: 'subhead', text: G.guides.length ? `Guide nella composizione (${G.guides.length})` : 'Nessuna guida nella composizione' }));
    const list = h('div', { class: 'glist' });
    G.guides.slice().sort((a, b) => a.o - b.o || a.p - b.p).forEach((g) => {
      const rm = h('button', { class: 'ibtn sm', 'data-tip': 'Togli questa guida' });
      rm.innerHTML = '<svg viewBox="0 0 16 16"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>';
      rm.addEventListener('click', async () => { const r = await call('inflect_guidesRemove', [g.i]); if (!r.ok) return toast(r.error, 'err'); G.sel = -1; G.key = ''; gRead(true); });
      const r = h('div', { class: 'grow-row' + (g.i === G.sel ? ' is-on' : '') },
        h('span', { class: 'gico', text: g.o === 1 ? '│' : '─', 'data-tip': g.o === 1 ? 'Verticale' : 'Orizzontale' }),
        hot(g.p, async (v) => { const res = await call('inflect_guideSet', g.i, v); if (!res.ok) toast(res.error, 'err'); G.key = ''; gRead(true); }, { step: 1 }), unit('px'),
        h('span', { class: 'grow' }), rm);
      r.addEventListener('mousedown', (e) => { if (e.target.tagName !== 'INPUT' && !e.target.closest('button')) { G.sel = g.i; gRender(); } });
      list.append(r);
    });
    add(body, list);
    const flip = h('button', { class: 'btn sm', text: 'Verticali e orizzontali sono invertite?', 'data-tip': 'Alcune versioni di After Effects scambiano le due direzioni: questo le rimette a posto e se lo ricorda' });
    flip.addEventListener('click', async () => { const r = await call('inflect_guidesFlip'); if (!r.ok) return toast(r.error, 'err'); G.key = ''; gRead(true); toast('Direzioni invertite. Le prossime guide escono giuste.'); });
    add(body, h('div', { class: 'btnrow' }, flip));
    if (G.guides.length) {
      const clr = h('button', { class: 'btn sm', text: 'Togli tutte' });
      clr.addEventListener('click', async () => { const r = await call('inflect_guidesRemove', 'all'); if (!r.ok) return toast(r.error, 'err'); G.sel = -1; G.key = ''; gRead(true); toast('Guide tolte.'); });
      add(body, h('div', { class: 'btnrow' }, clr));
    }
  }
  setInterval(() => { if (panelLive() && currentView() === 'align') gRead(false); }, 1500);

  /* ==================================================== copia e tempo == */

  const fmtTC = (t, fps) => {
    const f = Math.round(t * fps), neg = f < 0, a = Math.abs(f), fr = a % Math.round(fps), s = Math.floor(a / Math.round(fps));
    return `${neg ? '-' : ''}0:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  };
  const CP = { info: '', moment: null };
  function renderCopy() {
    const body = $('#cpBody');
    if (!body) return;
    body.textContent = '';
    const b = (label, tip, fn, cls = 'btn') => { const x = h('button', { class: cls, text: label, 'data-tip': tip }); x.addEventListener('click', fn); return x; };
    add(body,
      h('div', { class: 'btnrow' },
        b('Copia', 'Keyframe selezionati, oppure i valori delle proprietà selezionate, oppure posizione, scala, rotazione e opacità dei layer selezionati', clipCopy),
        b('Incolla allo stesso momento', 'Anche dentro un’altra precomposizione: i keyframe finiscono nello stesso istante del video', () => clipPaste('same')),
        b('All’indicatore', 'Incolla partendo dall’indicatore del tempo', () => clipPaste('cti'))),
      h('p', { class: 'hint', text: CP.info || 'Non serve premere Copia: Motion Tools ricorda gli ultimi keyframe che hai selezionato. Entra nella precomposizione, seleziona il layer e premi Incolla allo stesso momento.' }),
      h('div', { class: 'subhead', text: 'Momento' }),
      h('div', { class: 'btnrow' },
        b('Prendi', 'Ricorda l’istante dell’indicatore del tempo in questa composizione', momentTake),
        b('Vai al momento', 'Porta l’indicatore del tempo nello stesso istante, anche dentro una precomposizione', momentGo),
        b('Marker', 'Aggiunge un marker in quel momento sui layer selezionati, o sulla composizione', momentMarker)),
      h('p', { class: 'hint', text: CP.moment ? `${fmtTC(CP.moment.t, CP.moment.fps)} in ${CP.moment.name}` : 'Nessun momento preso.' }),
    );
  }
  async function clipCopy() {
    const r = await call('inflect_clipCopy');
    if (!r.ok) return toast(r.error, 'err');
    const what = r.mode === 'keys' ? `${r.keys} keyframe` : r.mode === 'values' ? `${r.props} ${r.props === 1 ? 'valore' : 'valori'}` : `trasformazioni di ${r.layers} layer`;
    CP.info = `Copiati ${what} (${r.names.join(', ')}${r.props > r.names.length ? '…' : ''}) da ${r.comp}${r.mode === 'keys' ? ` a ${fmtTC(r.t0, r.fps)}` : ''}.`;
    CP.moment = { t: r.t0, fps: r.fps, name: r.comp };
    toast(CP.info);
    renderCopy();
  }
  async function clipPaste(where) {
    const r = await call('inflect_clipPaste', where);
    if (!r.ok) return toast(r.error, 'err');
    let msg = r.mode === 'keys' ? `Incollati ${r.props} gruppi di keyframe${r.auto ? ` (gli ultimi selezionati in ${r.from})` : ''} a ${fmtTC(r.base, r.fps)}.` : `Incollati ${r.props} valori.`;
    if (r.notes && r.notes.length) msg += ' ' + r.notes.join(' ');
    toast(msg, r.notes && r.notes.length ? 'err' : '');
    poll(true);
  }
  async function momentTake() {
    const r = await call('inflect_momentTake');
    if (!r.ok) return toast(r.error, 'err');
    CP.moment = { t: r.t, fps: r.fps, name: r.name };
    toast(`Momento preso: ${fmtTC(r.t, r.fps)} in ${r.name}.`);
    renderCopy();
  }
  async function momentGo() {
    const r = await call('inflect_momentGo');
    if (!r.ok) return toast(r.error, 'err');
    toast(r.outside ? `Lo stesso momento cade a ${fmtTC(r.time, r.fps)}, fuori dalla durata di ${r.comp}.` : `${r.comp}: ${fmtTC(r.time, r.fps)}.${r.loose ? ' Il layer della precomposizione non è attivo in quel momento.' : ''}`, r.outside ? 'err' : '');
  }
  async function momentMarker() {
    const r = await call('inflect_momentMarker');
    if (!r.ok) return toast(r.error, 'err');
    toast(`Marker a ${fmtTC(r.time, r.fps)}${r.layers ? ` su ${r.layers} layer` : ' sulla composizione'}.`);
  }

  /* sposta animazione */
  const OF = { step: 10, dx: 0, dy: 0 };
  try { Object.assign(OF, JSON.parse(localStorage.getItem('mt.offset') || '{}')); } catch (e) {}
  const saveOF = () => { try { localStorage.setItem('mt.offset', JSON.stringify(OF)); } catch (e) {} };
  async function offsetBy(dx, dy) {
    const r = await call('inflect_offsetAnim', { dx, dy });
    if (!r.ok) return toast(r.error, 'err');
    toast(`Animazione spostata di ${dx ? `X ${dx > 0 ? '+' : ''}${dx}` : ''}${dx && dy ? ', ' : ''}${dy ? `Y ${dy > 0 ? '+' : ''}${dy}` : ''} px su ${r.keys} keyframe. I tempi non cambiano.`);
    rulerKey = '';
  }
  function renderOffset() {
    const body = $('#ofBody');
    if (!body) return;
    body.textContent = '';
    const arrow = (label, tip, dx, dy) => { const b = h('button', { class: 'btn sm arrowbtn', text: label, 'data-tip': tip }); b.addEventListener('click', (e) => { const m = e.shiftKey ? 10 : 1; offsetBy(dx() * m, dy() * m); }); return b; };
    const go = h('button', { class: 'btn', text: 'Sposta' });
    go.addEventListener('click', () => { if (!OF.dx && !OF.dy) return toast('Scrivi di quanto spostare in X o in Y.', 'err'); offsetBy(OF.dx, OF.dy); });
    add(body,
      row('Di', vec(['X', 'Y'], [OF.dx, OF.dy], (v) => { OF.dx = v[0]; OF.dy = v[1]; saveOF(); }), unit('px'), go),
      row('A passi', hot(OF.step, (v) => { OF.step = Math.abs(v) || 1; saveOF(); }, { min: 0, tip: 'Con Maiusc il passo diventa 10 volte più grande' }), unit('px'),
        h('span', { class: 'arrows' },
          arrow('←', 'A sinistra', () => -OF.step, () => 0), arrow('→', 'A destra', () => OF.step, () => 0),
          arrow('↑', 'Su', () => 0, () => -OF.step), arrow('↓', 'Giù', () => 0, () => OF.step))),
      h('p', { class: 'hint', text: 'Sposta la posizione dei layer selezionati su tutti i keyframe insieme, senza cambiare tempi ed easing. Se selezioni delle proprietà (per esempio Scala), sposta quelle.' }),
    );
  }

  /* stagger dei layer */
  const ST = { step: 3, order: 'sel', curve: 0, from: 'first', seed: 1 };
  try { Object.assign(ST, JSON.parse(localStorage.getItem('mt.stagger') || '{}')); } catch (e) {}
  const saveST = () => { try { localStorage.setItem('mt.stagger', JSON.stringify(ST)); } catch (e) {} };
  function renderStagger() {
    const body = $('#stBody');
    if (!body) return;
    body.textContent = '';
    const go = h('button', { class: 'btn', text: 'Sfalsa' });
    go.addEventListener('click', async () => {
      const r = await call('inflect_staggerLayers', ST);
      if (!r.ok) return toast(r.error, 'err');
      toast(`${r.count} layer sfalsati su ${r.span} frame.`);
    });
    add(body,
      row('Passo', hot(ST.step, (v) => { ST.step = v; saveST(); }, { step: 0.5, tip: 'Frame tra un layer e il successivo (negativo per invertire)' }), unit('fr')),
      row('Ordine', select([['sel', 'Ordine di selezione'], ['top', 'Dall’alto della timeline'], ['bottom', 'Dal basso della timeline'], ['left', 'Da sinistra'], ['right', 'Da destra'], ['up', 'Dall’alto della scena'], ['down', 'Dal basso della scena'], ['center', 'Dal centro'], ['random', 'Casuale']], ST.order, (v) => { ST.order = v; saveST(); renderStagger(); })),
      ST.order === 'random' ? row('Seme', hot(ST.seed, (v) => { ST.seed = Math.max(1, Math.round(v)); saveST(); }, { min: 1 })) : null,
      row('Ritmo', select([[0, 'Costante'], [1, 'Accelera'], [2, 'Rallenta'], [3, 'Morbido']], ST.curve, (v) => { ST.curve = +v; saveST(); })),
      row('Parti da', segc([['first', 'Primo layer', 'Il primo layer resta dov’è'], ['cti', 'Indicatore', 'Il primo layer parte dall’indicatore del tempo']], ST.from, (v) => { ST.from = v; saveST(); })),
      h('div', { class: 'btnrow' }, go),
      h('p', { class: 'hint', text: 'Sposta i layer nella timeline con tutti i loro keyframe. Puoi rifarlo con altri valori: riparte sempre dal primo.' }),
    );
  }

  /* liste */
  const LI = { kind: 'color', mode: 'cycle', target: 'rotation', add: 0, seed: 1, text: { color: '#0A84FF, #FFD60A, #FF3B30', number: '0, 15, 30, 45', text: 'Milano\nRoma\nNapoli' } };
  try { const s = JSON.parse(localStorage.getItem('mt.lists') || '{}'); Object.assign(LI, s, { text: Object.assign({}, LI.text, s.text || {}) }); } catch (e) {}
  const saveLI = () => { try { localStorage.setItem('mt.lists', JSON.stringify(LI)); } catch (e) {} };
  const LI_MODES = [['cycle', 'A turno'], ['pingpong', 'Avanti e indietro'], ['stretch', 'Distribuita', 'Dal primo all’ultimo valore lungo tutti i layer'], ['random', 'Casuale']];
  function renderListsUI() {
    const body = $('#liBody');
    if (!body) return;
    body.textContent = '';
    const ta = h('textarea', { class: 'txarea', rows: LI.kind === 'text' ? 4 : 2, placeholder: LI.kind === 'color' ? '#0A84FF, #FFD60A' : LI.kind === 'text' ? 'Un testo per riga' : '0, 15, 30' });
    ta.value = LI.text[LI.kind] || '';
    const preview = h('div');
    const refresh = () => {
      preview.textContent = '';
      const v = parseValues(ta.value, LI.kind);
      if (LI.kind === 'color') add(preview, chips(v));
      add(preview, h('span', { class: 'hint', text: `${v.length} ${v.length === 1 ? 'valore' : 'valori'}` }));
    };
    ta.addEventListener('input', () => { LI.text[LI.kind] = ta.value; saveLI(); refresh(); });
    refresh();
    add(body, row('Tipo', segc([['color', 'Colori'], ['number', 'Numeri'], ['text', 'Testi']], LI.kind, (v) => { LI.kind = v; saveLI(); renderListsUI(); })));
    if (LI.kind === 'color' && TEAM && TEAM.palettes.length) {
      add(body, row('Palette', select([['', 'Dal team…']].concat(TEAM.palettes.map((p) => [p.id, p.name])), '', (id) => {
        const p = TEAM.palettes.find((x) => x.id === id); if (!p) return;
        LI.text.color = p.colors.join(', '); saveLI(); renderListsUI();
      })));
    }
    add(body, h('div', { class: 'prow top' }, h('span', { class: 'plabel', text: 'Valori' }), ta), h('div', { class: 'prow' }, h('span', { class: 'plabel' }), preview));
    if (LI.kind === 'number') {
      add(body, row('Su', select([['rotation', 'Rotazione'], ['opacity', 'Opacità'], ['scale', 'Scala'], ['x', 'Posizione X'], ['y', 'Posizione Y'], ['time', 'Tempo (frame)']], LI.target, (v) => { LI.target = v; saveLI(); }),
        check('Somma', LI.add, (v) => { LI.add = v; saveLI(); }, 'Aggiunge il valore a quello attuale invece di sostituirlo')));
    }
    add(body, row('Ordine', segc(LI_MODES, LI.mode, (v) => { LI.mode = v; saveLI(); renderListsUI(); })));
    if (LI.mode === 'random') add(body, row('Seme', hot(LI.seed, (v) => { LI.seed = Math.max(1, Math.round(v)); saveLI(); }, { min: 1 })));
    const go = h('button', { class: 'btn', text: 'Applica ai layer selezionati' });
    go.addEventListener('click', async () => {
      const values = parseValues(ta.value, LI.kind);
      const r = await call('inflect_listApply', { kind: LI.kind, values, mode: LI.mode, seed: LI.seed, target: LI.kind === 'text' ? 'text' : LI.target, add: !!LI.add });
      if (!r.ok) return toast(r.error, 'err');
      toast(`Lista applicata a ${r.count} layer${r.skipped ? `, ${r.skipped} saltati perché non adatti` : ''}.`);
    });
    const save = h('button', { class: 'btn', text: 'Salva nel team' });
    save.addEventListener('click', () => {
      const values = parseValues(ta.value, LI.kind);
      if (!values.length) return toast('La lista è vuota.', 'err');
      openSheet('Salva la lista nel team', [{ key: 'name', label: 'Nome', value: '', placeholder: 'Es. Città del tour' }], 'Salva', (v) => {
        if (LI.kind === 'color') mutateTeam((T) => { T.palettes.push({ id: C.uid(), name: v.name || 'Palette', colors: values }); }).then((ok) => ok && toast('Palette salvata nel team.'));
        else mutateTeam((T) => { T.lists.push({ id: C.uid(), name: v.name || 'Lista', kind: LI.kind, values }); }).then((ok) => ok && toast('Lista salvata nel team.'));
      });
    });
    add(body, h('div', { class: 'btnrow' }, go, save),
      h('p', { class: 'hint', text: 'Ogni layer selezionato prende un valore, nell’ordine in cui li hai selezionati. Nel Cloner le liste si usano dal comportamento Lista e dalla sezione Colori e testi.' }));
  }

  /* ------------------------------------------------- liste nel Cloner -- */

  async function repeatListFromTeam(key, data, name) {
    if (!RP) { toast('Seleziona prima un Cloner.', 'err'); return showView('repeat'); }
    const r = await setParam('inflect_repeatListSet', key, data);
    if (r.ok) { toast(`${name} sulle copie di ${RP.name}.`); readRepeat(true); }
  }
  function listEditor(key, kind, D, hint) {
    D = D || { v: [], m: 'cycle', s: 1 };
    const wrap = h('div', { class: 'listed' });
    const ta = h('textarea', { class: 'txarea', rows: kind === 'text' ? 3 : 1, placeholder: hint });
    ta.value = kind === 'text' ? D.v.join('\n') : D.v.join(', ');
    let timer = null;
    const commit = () => { const v = parseValues(ta.value, kind); setParam('inflect_repeatListSet', key, v.length ? { v, m: D.m || 'cycle', s: D.s || 1 } : null).then(() => { repDataKey = ''; readRepeat(true); }); };
    ta.addEventListener('change', commit);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); } });
    add(wrap, ta);
    if (kind === 'color') {
      // Colori della lista: clic su un colore per cambiarlo o toglierlo, + per aggiungerne uno qualsiasi.
      const save = (v) => setParam('inflect_repeatListSet', key, v.length ? { v, m: D.m || 'cycle', s: D.s || 1 } : null).then(() => { repDataKey = ''; readRepeat(true); });
      const row2 = h('div', { class: 'chips' });
      D.v.forEach((c, ix) => {
        const b = h('button', { class: 'chip', 'data-tip': `${c}: clic per cambiarlo o toglierlo` });
        b.style.background = c;
        b.addEventListener('click', (e) => { e.stopPropagation(); colorPopover(b, (hex) => { const v = D.v.slice(); v[ix] = hex; rememberColor(hex); save(v); }, c, { label: 'Togli dalla lista', run: () => save(D.v.filter((_, j) => j !== ix)) }); });
        add(row2, b);
      });
      const plus = h('button', { class: 'chip chip-add', text: '+', 'data-tip': 'Aggiungi un colore: codice, selettore di After Effects o palette' });
      plus.addEventListener('click', (e) => { e.stopPropagation(); colorPopover(plus, (hex) => { rememberColor(hex); save(D.v.concat([hex])); }, D.v[D.v.length - 1] || '#FFFFFF'); });
      add(row2, plus);
      add(wrap, row2);
    }
    add(wrap, segc(LI_MODES, D.m || 'cycle', (m) => { D.m = m; if (D.v.length) setParam('inflect_repeatListSet', key, D); }));
    clearTimeout(timer);
    return wrap;
  }
  function renderRepeatLists() {
    const box = $('#repListBody');
    if (!box || !RP) return;
    box.textContent = '';
    const data = RP.data || {};
    add(box, h('div', { class: 'prow top' }, h('span', { class: 'plabel', text: 'Colori' }), listEditor('colori', 'color', data.colori, '#0A84FF, #FFD60A, #FF3B30')));
    if (TEAM && TEAM.palettes.length) add(box, row('', select([['', 'Palette del team…']].concat(TEAM.palettes.map((p) => [p.id, p.name])), '', (id) => {
      const p = TEAM.palettes.find((x) => x.id === id); if (p) repeatListFromTeam('colori', { v: p.colors, m: (data.colori && data.colori.m) || 'cycle', s: 1 }, p.name);
    })));
    add(box, h('div', { class: 'prow top' }, h('span', { class: 'plabel', text: 'Testi' }), listEditor('testi', 'text', data.testi, 'Un testo per riga (solo per copie di layer di testo)')));
    add(box, h('p', { class: 'hint', text: 'Ogni copia prende un valore dalla lista. I colori riempiono la copia, i testi sostituiscono quello del layer. Conferma con Cmd+Invio o uscendo dal campo.' }));
  }


  /* =============================================================== note == */

  const NT = { author: '', scope: 'comp', showDone: false, onLayer: false, draft: '', key: '', list: [] };
  try { Object.assign(NT, JSON.parse(localStorage.getItem('mt.notes') || '{}'), { key: '', list: [] }); } catch (e) {}
  const saveNT = () => { try { const { key, list, ...rest } = NT; localStorage.setItem('mt.notes', JSON.stringify(rest)); } catch (e) {} };

  function renderNoteNew() {
    const box = $('#ntNew');
    if (!box || isTyping(box)) return;
    box.textContent = '';
    const sign = h('input', { type: 'text', class: 'txinput', placeholder: 'Il tuo nome', value: NT.author || '' });
    sign.addEventListener('input', () => { NT.author = sign.value.trim(); saveNT(); });
    const ta = h('textarea', { class: 'txarea', rows: 3, placeholder: 'Es. Il logo entra 4 frame troppo tardi' });
    ta.value = NT.draft || '';
    ta.addEventListener('input', () => { NT.draft = ta.value; saveNT(); });
    const addN = async () => {
      const text = ta.value.trim();
      if (!text) return toast('Scrivi il testo della nota.', 'err');
      if (!NT.author) { sign.focus(); return toast('Metti la firma, così il team sa chi ha scritto la nota.', 'err'); }
      const r = await call('inflect_noteAdd', { text, author: NT.author, onLayer: !!NT.onLayer });
      if (!r.ok) return toast(r.error, 'err');
      NT.draft = ''; saveNT(); ta.value = '';
      toast(`Nota aggiunta a ${fmtTC(r.time, (S.ae && S.ae.fps) || 25)}${r.layer ? ` su ${r.layer}` : ''}.`);
      NT.key = ''; notesRead();
    };
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addN(); } });
    const btn = h('button', { class: 'btn primary', text: 'Aggiungi al tempo attuale', 'data-tip': 'Cmd+Invio dal campo di testo' });
    btn.addEventListener('click', addN);
    sign.setAttribute('aria-label', 'Firma'); ta.setAttribute('aria-label', 'Nota');
    sign.classList.add('ntsign');
    const mac = /Mac/i.test(navigator.platform || '');
    add(box,
      ta,
      h('div', { class: 'ntline' }, sign, segc([[0, 'Sulla comp', 'Marcatore sulla composizione'], [1, 'Sul layer', 'Marcatore sul layer selezionato: si sposta insieme al layer']], NT.onLayer ? 1 : 0, (v) => { NT.onLayer = +v === 1; saveNT(); })),
      h('div', { class: 'ntline' }, h('span', { class: 'faint ntkeys' }, h('span', { class: 'kc', text: mac ? '⌘' : 'Ctrl' }), h('span', { class: 'kc', text: '↵' }), ' dal testo'), h('span', { class: 'grow' }), btn),
    );
  }

  async function notesRead(force) {
    const r = await call('inflect_notesList', NT.scope);
    if (!r.ok) return;
    const key = JSON.stringify([r.notes, NT.scope, NT.showDone]);
    if (!force && key === NT.key) return;
    NT.key = key; NT.list = r.notes; NT.compId = r.compId;
    renderNotes();
    drawNoteRhythm();
  }

  function renderNotes() {
    const box = $('#ntList');
    if (!box) return;
    if (isTyping(box)) return;
    box.textContent = '';
    const all = NT.list.slice().sort((a, b) => (a.compId - b.compId) || (a.time - b.time));
    const open = all.filter((n) => !n.done), done = all.filter((n) => n.done);
    $('#ntCount').textContent = all.length ? `${open.length} da fare${done.length ? `, ${done.length} ${done.length === 1 ? 'fatta' : 'fatte'}` : ''}` : '';
    NT.open = open.length; ntHead();
    add(box, h('div', { class: 'ntline' },
      segc([['comp', 'Questa comp'], ['project', 'Progetto']], NT.scope, (v) => { NT.scope = v; saveNT(); NT.key = ''; notesRead(true); }),
      h('span', { class: 'grow' }),
      check('Mostra le fatte', NT.showDone, (v) => { NT.showDone = !!v; saveNT(); renderNotes(); })));
    const list = NT.showDone ? all : open;
    if (!list.length) {
      add(box, h('p', { class: 'hint', text: all.length ? 'Tutte le note sono fatte.' : 'Nessuna nota. Le note sono marcatori: le vede chiunque apra il progetto, anche senza Motion Tools.' }));
      return;
    }
    let lastComp = null;
    list.forEach((n) => {
      if (NT.scope === 'project' && n.comp !== lastComp) { lastComp = n.comp; add(box, h('div', { class: 'subhead', text: n.comp })); }
      const ref = { compId: n.compId, layerId: n.layerId, time: n.time };
      const chk = h('input', { type: 'checkbox', 'data-tip': n.done ? 'Segna da fare' : 'Segna come fatta' });
      chk.checked = n.done;
      chk.addEventListener('change', async () => { const r = await call('inflect_noteSet', ref, { done: chk.checked, author: NT.author }); if (!r.ok) return toast(r.error, 'err'); NT.key = ''; notesRead(true); });
      const rm = h('button', { class: 'ibtn sm', 'data-tip': 'Elimina la nota' });
      rm.innerHTML = '<svg viewBox="0 0 16 16"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>';
      rm.addEventListener('click', async () => { const r = await call('inflect_noteSet', ref, { remove: true }); if (!r.ok) return toast(r.error, 'err'); toast('Nota eliminata.'); NT.key = ''; notesRead(true); });
      const ed = h('button', { class: 'ibtn sm', 'data-tip': 'Modifica il testo' });
      ed.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 13l1-3 6.5-6.5 2 2L6 12z"/></svg>';
      ed.addEventListener('click', () => openSheet('Modifica nota', [{ key: 'text', label: 'Nota', value: n.text, multiline: true }], 'Salva', async (v) => {
        const r = await call('inflect_noteSet', ref, { text: v.text, author: NT.author }); if (!r.ok) return toast(r.error, 'err'); NT.key = ''; notesRead(true);
      }));
      const body = h('button', { class: 'ntbody', 'data-tip': 'Vai a questo momento' },
        h('span', { class: 'ntmeta' }, h('span', { class: 'tc', text: fmtTC(n.time, n.fps) }), h('span', { class: 'ntauth', text: n.author || 'Marcatore' }), n.layer ? h('span', { class: 'faint', text: n.layer }) : null),
        h('span', { class: 'nttext', text: n.text }));
      body.addEventListener('click', () => call('inflect_noteGo', ref));
      add(box, h('div', { class: 'ntrow' + (n.done ? ' done' : '') }, h('label', { class: 'check' }, chk), body, h('span', { class: 'ntacts' }, ed, rm)));
    });
  }

  // Intestazione: la comp e quante note restano da fare.
  function ntHead() {
    const t = $('#ntComp'), sub = $('#ntSub');
    if (!t) return;
    t.textContent = (S.ae && S.ae.comp) || 'Note';
    if (!(S.ae && S.ae.comp)) { sub.textContent = 'Apri una composizione'; return; }
    const n = NT.open || 0, m = (SY.info && SY.info.masters || []).length;
    const parts = [n ? `${n} ${n === 1 ? 'nota' : 'note'} da fare` : 'Nessuna nota da fare'];
    if (m) parts.push(`${m} ${m === 1 ? 'marcatore collegato' : 'marcatori collegati'}`);
    sub.textContent = parts.join(', ');
  }

  /* marcatori collegati tra composizioni */
  const SY = { info: null, draft: '', key: '' };
  async function syncRead(force) {
    const r = await call('inflect_mainGet');
    if (!r.ok) return;
    const key = JSON.stringify(r);
    if (!force && key === SY.key) return;
    SY.key = key; SY.info = r;
    renderSync();
    drawNoteRhythm();
  }
  function renderSync() {
    const box = $('#ntSync');
    if (!box || isTyping(box)) return;
    box.textContent = '';
    const I = SY.info || {};
    ntHead();
    const nm = $('#ntSyncN'); if (nm) nm.textContent = (I.masters || []).length ? String(I.masters.length) : '';
    const setMain = h('button', { class: 'btn sm ghost', text: I.main && I.active && I.main.id === I.active.id ? 'È questa' : 'Imposta questa', 'data-tip': 'La composizione di riferimento: i marcatori collegati partono da qui' });
    setMain.disabled = !I.active || (I.main && I.main.id === I.active.id);
    setMain.addEventListener('click', async () => { const r = await call('inflect_mainSet'); if (!r.ok) return toast(r.error, 'err'); toast(`${r.main.name} è la composizione principale.`); SY.key = ''; syncRead(true); });
    add(box, h('div', { class: 'ntline' }, h('span', { class: 'ntmain' }, h('span', { class: 'faint', text: 'Comp principale ' }), h('span', { class: I.main ? 'ntauth' : 'faint', text: I.main ? I.main.name : 'nessuna' })), h('span', { class: 'grow' }), setMain));
    if (!I.main) { add(box, h('p', { class: 'hint', text: 'Apri la composizione finale (quella che esporti) e premi Usa questa composizione. I marcatori collegati che aggiungi finiscono in tutte le precomposizioni, nello stesso istante del video.' })); return; }
    const inp = h('input', { type: 'text', class: 'txinput', placeholder: 'Es. Drop, Cambio scena, Logo', value: SY.draft || '' });
    inp.addEventListener('input', () => { SY.draft = inp.value; });
    const addS = async () => {
      const text = inp.value.trim();
      if (!text) return toast('Scrivi il testo del marcatore.', 'err');
      const r = await call('inflect_syncAdd', { text, author: NT.author || '' });
      if (!r.ok) return toast(r.error, 'err');
      SY.draft = ''; inp.value = '';
      toast(`Marcatore a ${fmtTC(r.time, r.fps)} in ${r.main} e in ${r.copies} ${r.copies === 1 ? 'composizione collegata' : 'composizioni collegate'}.${r.skipped.length ? ` Saltato in ${r.skipped.join(', ')}: c’era già un marcatore.` : ''}`, r.skipped.length ? 'err' : '');
      SY.key = ''; syncRead(true);
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addS(); } });
    const b = h('button', { class: 'btn', text: 'Aggiungi ovunque', 'data-tip': 'Al tempo attuale, anche se sei dentro una precomposizione' });
    b.addEventListener('click', addS);
    const rows = [];
    (I.masters || []).slice().sort((a, c) => a.time - c.time).forEach((m) => {
      const rm = h('button', { class: 'ibtn sm', 'data-tip': 'Toglie il marcatore da tutte le composizioni' });
      rm.innerHTML = '<svg viewBox="0 0 16 16"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>';
      rm.addEventListener('click', async () => { const r = await call('inflect_syncRemove', m.id); if (!r.ok) return toast(r.error, 'err'); toast(`${m.text} tolto da tutte le composizioni.`); SY.key = ''; syncRead(true); });
      const go = h('button', { class: 'ntbody', 'data-tip': 'Vai a questo momento nella composizione aperta' },
        h('span', { class: 'ntmeta' }, h('span', { class: 'tc', text: fmtTC(m.time, I.fps || 25) }), m.author ? h('span', { class: 'faint', text: m.author }) : null),
        h('span', { class: 'nttext', text: m.text }));
      go.addEventListener('click', () => call('inflect_syncGo', m.id));
      rows.push(h('div', { class: 'ntrow' }, h('span', { class: 'syncdot' }), go, h('span', { class: 'ntacts' }, rm)));
    });
    add(box, ...rows, h('div', { class: 'ntline' }, inp, b));
    const upd = h('button', { class: 'btn sm ghost', text: 'Riallinea le comp', 'data-tip': 'Dopo aver spostato, accorciato o stirato i layer delle precomposizioni' });
    upd.addEventListener('click', async () => { const r = await call('inflect_syncAll'); if (!r.ok) return toast(r.error, 'err'); toast(`${r.masters} marcatori riallineati in ${r.comps.length} composizioni.${r.skipped.length ? ' Saltati dove c’era già un altro marcatore.' : ''}`); SY.key = ''; syncRead(true); });
    if ((I.masters || []).length) add(box, h('div', { class: 'btnrow' }, upd));
  }
  // Le note di tutto il progetto si rileggono ogni 10 secondi (scorrere ogni comp pesa); quelle della comp ogni 2,5.
  let ntTick = 0;
  setInterval(() => {
    if (!panelLive() || currentView() !== 'notes') return;
    ntTick++;
    if (NT.scope !== 'project' || ntTick % 4 === 0) notesRead(false);
    if (ntTick % 2 === 0) syncRead(false);
  }, 2500);
  // Composizioni nuove dentro la principale (anche precomposizioni di precomposizioni): ricevono da sole i marcatori collegati.
  // Spento di default: su progetti con molte comp il controllo continuo pesa.
  let syncAutoOn = false;
  try { syncAutoOn = localStorage.getItem('mt.syncAuto') === '1'; } catch (e) {}
  const syncAutoBox = $('#syncAutoOn');
  if (syncAutoBox) {
    syncAutoBox.checked = syncAutoOn;
    syncAutoBox.addEventListener('change', (e) => {
      syncAutoOn = e.target.checked;
      try { localStorage.setItem('mt.syncAuto', syncAutoOn ? '1' : '0'); } catch (e2) {}
      toast(syncAutoOn ? 'Marcatori collegati: le comp nuove li riceveranno in automatico.' : 'Marcatori collegati: aggiunta automatica spenta.');
    });
  }
  setInterval(async () => {
    if (!syncAutoOn || !inCEP || !S.ae || !S.ae.comp || document.hidden) return;
    const r = await call('inflect_syncAuto');
    if (r.ok && r.added) {
      toast(`Marcatori collegati aggiunti in ${r.comps.join(', ')}.`);
      if (currentView() === 'notes') { SY.key = ''; syncRead(true); }
    }
  }, 15000);

  /* ============================================================ avvio extra == */

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'tx-fromlayer': txFromLayer(); break;
      case 'tx-save': if (TX.cur) txSaveAs('user', true); else txFromLayer(); break;
      case 'tx-replay': txPreview(); break;
      case 'tx-more': openMenu(b, [
        TX.state && TX.state.count && !TX.state.applied ? { label: 'Leggi l’animazione del layer', run: txReadKeys } : null,
        { label: 'Salva l’animazione del layer come preset', run: txFromLayer },
        { label: 'Importa da file…', run: txImport },
        '-',
        { label: 'Togli l’animazione dai layer', danger: true, run: txRemove },
      ].filter(Boolean)); break;
      case 'consolida': consolida(); break;
      case 'tx-apply': txApply(); break;
      case 'tx-remove': txRemove(); break;
      case 'tx-import': txImport(); break;
      case 'tm-menu': teamMenu(b); break;
      case 'tm-folder': call('inflect_teamChoose').then((r) => { if (r.ok && !r.cancelled) { loadTeam(); toast(`Libreria di team in ${r.folderName}.`); } else if (!r.ok) toast(r.error, 'err'); }); break;
      default: break;
    }
  });
  // Comportamenti da pagina web che in un pannello non servono: menu del browser, zoom, file trascinati.
  document.addEventListener('contextmenu', (e) => { if (!e.defaultPrevented && !e.target.closest('input, textarea')) e.preventDefault(); });
  window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('dragover', (e) => { if (!e.defaultPrevented) e.preventDefault(); });
  document.addEventListener('drop', (e) => { if (!e.defaultPrevented) e.preventDefault(); });
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['=', '+', '-', '0'].includes(e.key)) e.preventDefault(); });
  renderCopy(); renderOffset(); renderStagger(); renderListsUI();
  loadTeam(); txLoadUser();

  // Avvio
  loadIntoEditor(false);
  loadUser();
  let startView = 'curve';
  try { startView = localStorage.getItem('mt.view') || 'curve'; } catch (e) {}
  if (!$(`.view[data-view="${startView}"]`) || (startView === 'library' && !isNarrow())) startView = 'curve';
  showView(startView);
  checkBuild();
  poll(true);
  setInterval(poll, 500);
  if (cs) {
    // Senza questa registrazione After Effects si tiene Canc, Invio e Cmd+Z per sé.
    try {
      const mac = navigator.platform.indexOf('Mac') === 0;
      const keys = mac
        ? [{ keyCode: 51 }, { keyCode: 117 }, { keyCode: 36 }, { keyCode: 76 }, { keyCode: 53 },
           { keyCode: 6, metaKey: true }, { keyCode: 6, metaKey: true, shiftKey: true },
           // Cmd+V, Cmd+C, Cmd+X, Cmd+A: restano al pannello, cosi' si incolla nei campi di testo.
           { keyCode: 9, metaKey: true }, { keyCode: 8, metaKey: true }, { keyCode: 7, metaKey: true }, { keyCode: 0, metaKey: true }]
        : [{ keyCode: 8 }, { keyCode: 46 }, { keyCode: 13 }, { keyCode: 27 },
           { keyCode: 90, ctrlKey: true }, { keyCode: 90, ctrlKey: true, shiftKey: true },
           { keyCode: 86, ctrlKey: true }, { keyCode: 67, ctrlKey: true }, { keyCode: 88, ctrlKey: true }, { keyCode: 65, ctrlKey: true }];
      cs.registerKeyEventsInterest(JSON.stringify(keys));
    } catch (e) { /* versioni di CEP senza questa funzione */ }
    // Riprende i colori e lo stato quando il pannello torna visibile.
    cs.addEventListener('com.adobe.csxs.events.WindowVisibilityChanged', () => poll(true));
  }
  window.InflectApp = { S, editor, apply, setCurve, analyze };
})();
