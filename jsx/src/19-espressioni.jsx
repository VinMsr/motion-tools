/* ------------------------------------------------------- espressioni -- */

var MT_X = {};

MT_X.head = [
    'var C = thisComp.layer(@C@);',
    'var g = function (nm) { return C.effect(nm)(1).value; };',
    'var i = effect("MT Indice")(1).value;',
    'var m = Math.round(g("Distribuzione"));',
    // Copie in uso adesso: con Quantita', Colonne o Righe animate cambia nel tempo (le copie in piu' si nascondono).
    'var n = m == 2 ? Math.max(1, Math.round(g("Colonne"))) * Math.max(1, Math.round(g("Righe"))) * Math.max(1, Math.round(g("Livelli"))) : Math.max(1, Math.round(g("Quantit\u00e0")));'
];

/* Angolo sul cerchio o sulla spirale per la copia i. */
MT_X.angle = [
    'var mtAngle = function () {',
    '  var dir = g("Inverti senso") == 1 ? -1 : 1;',
    '  if (m == 5) return g("Angolo iniziale") + dir * i * 137.50776;',
    '  var arc = g("Arco"), full = Math.abs(arc) >= 360;',
    '  var k = n > 1 ? i / (full ? n : n - 1) : 0;',
    '  return g("Angolo iniziale") + dir * arc * (k + g("Scorrimento") / 100);',
    '};'
];

/* Tracciato: maschera 1 del layer scelto, oppure il primo tracciato di un livello forma. */
MT_X.path = [
    'var mtPath = function () {',
    '  var P = null;',
    '  try { P = C.effect("Tracciato")(1); } catch (e0) { P = null; }',
    '  if (!P) return null;',
    '  var pth = null;',
    '  try { pth = P.mask(1).maskPath; } catch (e1) { try { pth = P.content(1).content(1).path; } catch (e2) { pth = null; } }',
    '  if (!pth) return null;',
    '  var closed = false;',
    '  try { closed = pth.isClosed(); } catch (e3) {}',
    '  var u = (n > 1 ? i / (closed ? n : n - 1) : 0) + g("Scorrimento") / 100;',
    '  u = closed ? u - Math.floor(u) : clamp(u, 0, 1);',
    '  return { L: P, p: pth, u: u };',
    '};'
];

/*
 * Passo effettivo. Passo: da centro a centro. Adatta: dimensione totale. Distanza: spazio tra i bordi,
 * sommata alla dimensione delle copie (scalata da Trasforma scala). In Lineare con Spazio la riga va
 * in orizzontale, o in verticale con "Per colonne".
 */
MT_X.step = [
    'var mm = Math.round(g("Modo misura")), fit = mm == 2, st = g("Passo");',
    'if (mm == 3) {',
    '  var gp = [0, 0, 0], dc = [100, 100, 100];',
    '  try { gp = g("Distanza"); dc = g("Dimensione copia"); } catch (eS) {}',
    '  var ks = Math.abs(C.effect("Trasforma scala")(1).value) / 100;',
    '  if (m == 1) st = Math.round(g("Direzione griglia")) == 2 ? [0, dc[1] * ks + gp[1], 0] : [dc[0] * ks + gp[0], 0, 0];',
    '  else st = [dc[0] * ks + gp[0], dc[1] * ks + gp[1], dc[2] * ks + gp[2]];',
    '}'
];

MT_X.base = [].concat(MT_X.head, MT_X.angle, MT_X.path, MT_X.step, [
    'var ctr = g("Centra") == 1 ? 1 : 0;',
    'var p = [0, 0, 0];',
    'if (m == 1) {',
    '  var k = fit ? (n > 1 ? i / (n - 1) : 0) : i;',
    '  var c = fit ? 0.5 : (n - 1) / 2;',
    '  p = [st[0] * (k - ctr * c), st[1] * (k - ctr * c), st[2] * (k - ctr * c)];',
    '} else if (m == 2) {',
    '  var cols = Math.max(1, Math.round(g("Colonne"))), rows = Math.max(1, Math.round(g("Righe"))), lev = Math.max(1, Math.round(g("Livelli")));',
    '  var per = cols * rows, z = Math.floor(i / per), r = i % per, cx, cy;',
    '  if (Math.round(g("Direzione griglia")) == 2) { cx = Math.floor(r / rows); cy = r % rows; } else { cy = Math.floor(r / cols); cx = r % cols; }',
    '  var sx = fit ? (cols > 1 ? st[0] / (cols - 1) : 0) : st[0];',
    '  var sy = fit ? (rows > 1 ? st[1] / (rows - 1) : 0) : st[1];',
    '  var sz = fit ? (lev > 1 ? st[2] / (lev - 1) : 0) : st[2];',
    '  var off = (cy % 2 == 1) ? g("Sfalsa righe") : 0;',
    '  p = [sx * (cx - ctr * (cols - 1) / 2) + off, sy * (cy - ctr * (rows - 1) / 2), sz * (z - ctr * (lev - 1) / 2)];',
    '} else if (m == 3 || m == 5) {',
    '  var a = degreesToRadians(mtAngle());',
    '  var rad = m == 5 ? g("Raggio") * Math.sqrt((i + 0.5) / n) : g("Raggio");',
    '  var s = Math.sin(a) * rad, co = Math.cos(a) * rad, pl = Math.round(g("Piano"));',
    '  p = pl == 2 ? [s, 0, -co] : (pl == 3 ? [0, -co, s] : [s, -co, 0]);',
    '} else if (m == 4) {',
    '  seedRandom(Math.round(g("Seme")) * 1000 + i, true);',
    '  var A = g("Area");',
    '  p = [random(-0.5, 0.5) * A[0], random(-0.5, 0.5) * A[1], random(-0.5, 0.5) * A[2]];',
    '} else if (m == 6) {',
    '  var T = mtPath();',
    '  if (T) {',
    '    var q = C.fromWorld(T.L.toWorld(T.p.pointOnPath(T.u)));',
    '    p = [q[0], q[1], q.length > 2 ? q[2] : 0];',
    '  }',
    '}',
    'p'
]);

MT_X.orient = [].concat(MT_X.head, MT_X.angle, MT_X.path, [
    'var o = [0, 0, 0];',
    'if (g("Orienta") == 1) {',
    '  if (m == 3 || m == 5) {',
    '    var ang = mtAngle(), pl = Math.round(g("Piano"));',
    '    if (pl == 2) o[1] = -ang; else if (pl == 3) o[0] = ang; else o[2] = ang;',
    '  } else if (m == 6) {',
    '    var T = mtPath();',
    '    if (T) { var tg = T.p.tangentOnPath(T.u); o[2] = radiansToDegrees(Math.atan2(tg[1], tg[0])); }',
    '  }',
    '}',
    'o'
]);

/* Espressioni che leggono le liste dal marker del controllo. */
MT_X.lists = [
    'var mtLists = function () {',
    '  try {',
    '    var M = C.marker;',
    '    for (var q = 1; q <= M.numKeys; q++) {',
    '      var cm = M.key(q).comment;',
    '      if (cm.indexOf("MT_LISTS ") == 0) { var s = cm.substr(9); try { return JSON.parse(s); } catch (eJ) { return eval("(" + s + ")"); } }',
    '    }',
    '  } catch (e) {}',
    '  return {};',
    '};',
    'var mtPick = function (D, i, n) {',
    '  var len = D.v.length, md = D.m || "cycle";',
    '  if (md == "random") { seedRandom((D.s || 1) * 1000 + i, true); return Math.floor(random(len)); }',
    '  if (md == "pingpong") { if (len == 1) return 0; var p = i % (2 * len - 2); return p < len ? p : 2 * len - 2 - p; }',
    '  if (md == "stretch") return n > 1 ? Math.round(i / (n - 1) * (len - 1)) : 0;',
    '  return i % len;',
    '};'
];

/*
 * Falloff come un'area: dentro la forma l'effetto e' pieno; fuori sfuma fino a sparire, su una
 * fascia larga Morbidezza % del raggio. Cosi' anche una copia appena fuori riceve un po' di effetto.
 * Lineare: pieno a sinistra, vuoto a destra.
 */
MT_X.fall = [
    'var mtFallInfo = function (F, wp) {',
    '  var fx = function (nm) { return F.effect(nm)(1).value; };',
    '  var l = F.fromWorld(wp), a = F.transform.anchorPoint.value;',
    '  var sz = fx("Dimensione"), form = Math.round(fx("Forma"));',
    '  var hw = Math.max(0.001, Math.abs(sz[0]) / 2), hh = Math.max(0.001, Math.abs(sz[1]) / 2);',
    '  var dx = l[0] - a[0], dy = l[1] - a[1];',
    '  var dz = (l.length > 2 && a.length > 2) ? l[2] - a[2] : 0;',
    // In 3D la profondita' del falloff (0 = uguale alla larghezza).
    '  var dp = 0;',
    '  try { dp = Math.abs(fx("Profondit\u00e0")); } catch (eP) { dp = 0; }',
    '  var hd = dp > 0.001 ? dp / 2 : hw;',
    '  var r = form == 2 ? Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh, Math.abs(dz) / hd) : Math.sqrt(dx * dx / (hw * hw) + dy * dy / (hh * hh) + dz * dz / (hd * hd));',
    '  return { fx: fx, form: form, r: r, dx: dx, hw: hw, s: Math.max(0.001, fx("Morbidezza") / 100), inv: fx("Inverti") == 1, gain: fx("Intensità") / 100, prob: fx("Probabilità") == 1 };',
    '};',
    'var mtFallT = function (I, r) {',
    '  var t = I.form == 3 ? clamp(0.5 - I.dx / (2 * I.hw), 0, 1) : (r <= 1 ? 1 : clamp(1 - (r - 1) / I.s, 0, 1));',
    '  t = t * t * (3 - 2 * t);',
    '  return I.inv ? 1 - t : t;',
    '};',
    'var mtFall = function (F, wp, k) {',
    '  var w = 0;',
    '  try {',
    '    var I = mtFallInfo(F, wp), t = mtFallT(I, I.r);',
    '    if (I.prob) { seedRandom(Math.round(I.fx("Seme")) * 1000 + i * 31 + k, true); t = random() < t ? 1 : 0; }',
    '    w = t * I.gain;',
    '  } catch (e) { w = 0; }',
    '  return w;',
    '};',
    // Spinta che mantiene le distanze quando la scala cresce: ogni copia si allontana dal centro del
    // falloff di quanto sono cresciute le copie tra lei e il centro (peso medio lungo il raggio).
    // A: quanto cresce la scala (1 = +100%). rho: dimensione della copia diviso il passo.
    'var mtPush = function (F, wp, A, rho) {',
    '  try {',
    '    var I = mtFallInfo(F, wp);',
    '    if (I.form == 3 || I.prob) return [0, 0, 0];',
    '    var cw = F.toWorld(F.transform.anchorPoint.value);',
    '    var d = [wp[0] - cw[0], wp[1] - cw[1], (wp.length > 2 && cw.length > 2) ? wp[2] - cw[2] : 0];',
    '    var sum = 0, N = 12;',
    '    for (var j = 0; j < N; j++) sum += mtFallT(I, I.r * (j + 0.5) / N);',
    '    var mul = A * rho * I.gain * sum / N;',
    '    return [d[0] * mul, d[1] * mul, d[2] * mul];',
    '  } catch (e) { return [0, 0, 0]; }',
    '};'
];


/* Somma dei comportamenti con destinazione tra @LO@ e @LO@+2. */
MT_X.behave = [].concat(MT_X.head, MT_X.fall, MT_X.lists, [
    'var LS = null;',
    'var out = [0, 0, 0];',
    'var nb = 0;',
    'try { nb = Math.round(g("Comportamenti")); } catch (e0) { nb = 0; }',
    'if (nb > 0) {',
    '  var b = effect("MT Base")(1).value, wp = null;',
    MT_X.step.join("\n"),
    '  var ctr = g("Centra") == 1;',
    '  var e = [0, 0, 0], c = [0, 0, 0];',
    '  if (m == 1) { var L1 = fit ? 1 : Math.max(1, n - 1); e = [Math.abs(st[0]) * L1 / 2, Math.abs(st[1]) * L1 / 2, Math.abs(st[2]) * L1 / 2]; if (!ctr) c = [st[0] * L1 / 2, st[1] * L1 / 2, st[2] * L1 / 2]; }',
    '  else if (m == 2) {',
    '    var cl = Math.max(1, Math.round(g("Colonne"))), rw = Math.max(1, Math.round(g("Righe"))), lv = Math.max(1, Math.round(g("Livelli")));',
    '    var Lx = fit ? 1 : Math.max(1, cl - 1), Ly = fit ? 1 : Math.max(1, rw - 1), Lz = fit ? 1 : Math.max(1, lv - 1);',
    '    e = [Math.abs(st[0]) * Lx / 2, Math.abs(st[1]) * Ly / 2, Math.abs(st[2]) * Lz / 2];',
    '    if (!ctr) c = [st[0] * Lx / 2, st[1] * Ly / 2, st[2] * Lz / 2];',
    '  }',
    '  else if (m == 3 || m == 5) { var R = Math.abs(g("Raggio")); e = [R, R, R]; }',
    '  else if (m == 4) { var Ar = g("Area"); e = [Math.abs(Ar[0]) / 2, Math.abs(Ar[1]) / 2, Math.abs(Ar[2]) / 2]; }',
    '  var el = Math.max(0.001, Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]));',
    '  for (var k = 1; k <= nb; k++) {',
    '    var pre = "B" + k + " ";',
    '    if (C.effect(pre + "Attivo")(1).value != 1) continue;',
    '    var dst = Math.round(C.effect(pre + "Destinazione")(1).value);',
    // Scala con "Mantieni spazi": nella posizione, le copie si allargano attorno al falloff.
    '    if (@LO@ == 1 && dst == 7) {',
    '      var pf = 0, Fp = null;',
    '      try { pf = C.effect(pre + "Mantieni spazi")(1).value; } catch (eP) { pf = 0; }',
    '      try { Fp = C.effect(pre + "Falloff")(1); } catch (eF2) { Fp = null; }',
    '      if (pf == 1 && Fp && Fp.index && Math.round(C.effect(pre + "Tipo")(1).value) == 5) {',
    '        var dcs = [100, 100, 100];',
    '        try { dcs = g("Dimensione copia"); } catch (eD) {}',
    '        var ksc = Math.abs(C.effect("Trasforma scala")(1).value) / 100, dd = 1, DD = 1;',
    '        if (m == 1) {',
    '          var sl = Math.sqrt(st[0] * st[0] + st[1] * st[1] + st[2] * st[2]);',
    '          dd = (Math.abs(st[1]) > Math.abs(st[0]) ? Math.abs(dcs[1]) : Math.abs(dcs[0])) * ksc;',
    '          DD = fit ? sl / Math.max(1, n - 1) : sl;',
    '        } else if (m == 2) {',
    '          var c2 = Math.max(1, Math.round(g("Colonne"))), r2 = Math.max(1, Math.round(g("Righe")));',
    '          dd = (Math.abs(dcs[0]) + Math.abs(dcs[1])) / 2 * ksc;',
    '          DD = ((fit ? Math.abs(st[0]) / Math.max(1, c2 - 1) : Math.abs(st[0])) + (fit ? Math.abs(st[1]) / Math.max(1, r2 - 1) : Math.abs(st[1]))) / 2;',
    '        }',
    '        var rho = DD > 0.001 ? clamp(dd / DD, 0, 1.5) : 1;',
    '        if (!wp) { try { wp = C.toWorld(b); } catch (eW2) { wp = C.toWorld([b[0], b[1]]); } }',
    '        var dv = mtPush(Fp, wp, C.effect(pre + "Max")(1).value / 100, rho);',
    '        var w2 = wp.length > 2 ? [wp[0] + dv[0], wp[1] + dv[1], wp[2] + dv[2]] : [wp[0] + dv[0], wp[1] + dv[1]];',
    '        var q0 = C.fromWorld(wp), q1 = C.fromWorld(w2);',
    '        out[0] += q1[0] - q0[0]; out[1] += q1[1] - q0[1];',
    '        if (q0.length > 2 && q1.length > 2) out[2] += q1[2] - q0[2];',
    '      }',
    '      continue;',
    '    }',
    '    if (dst < @LO@ || dst > @LO@ + 2) continue;',
    '    var typ = Math.round(C.effect(pre + "Tipo")(1).value);',
    '    var mn = C.effect(pre + "Min")(1).value, mx = C.effect(pre + "Max")(1).value;',
    '    var sd = Math.round(C.effect(pre + "Seme")(1).value);',
    '    var v = 0;',
    '    if (typ == 1) {',
    '      var ord = Math.round(C.effect(pre + "Ordine")(1).value);',
    '      var t = n > 1 ? i / (n - 1) : 0;',
    '      if (ord == 2) t = 1 - t;',
    '      else if (ord == 3 || ord == 4) {',
    '        var ddx = b[0] - c[0], ddy = b[1] - c[1], ddz = b[2] - c[2];',
    '        t = clamp(Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) / el, 0, 1);',
    '        if (ord == 4) t = 1 - t;',
    '      }',
    '      else if (ord == 5) { seedRandom(sd * 1000 + i * 13 + k * 101, true); t = random(); }',
    '      else if (ord == 6) t = clamp(((b[0] - c[0]) / Math.max(0.001, e[0]) + 1) / 2, 0, 1);',
    '      else if (ord == 7) t = clamp(((b[1] - c[1]) / Math.max(0.001, e[1]) + 1) / 2, 0, 1);',
    '      var cv = Math.round(C.effect(pre + "Curva")(1).value);',
    '      if (cv == 2) t = t * t; else if (cv == 3) t = 1 - (1 - t) * (1 - t); else if (cv == 4) t = t * t * (3 - 2 * t);',
    '      v = mn + (mx - mn) * t;',
    '    } else if (typ == 2) {',
    '      seedRandom(sd * 1000 + i * 7 + k * 101, true);',
    '      v = mn + (mx - mn) * random();',
    '    } else if (typ == 3) {',
    '      var fq = C.effect(pre + "Frequenza")(1).value, sp = C.effect(pre + "Fase")(1).value;',
    '      var nz = noise([i * fq * 0.15 + sd * 17.3, time * sp / 60 + k * 3.1]);',
    '      v = mn + (mx - mn) * (nz + 1) / 2;',
    '    } else if (typ == 4) {',
    '      var hz = C.effect(pre + "Frequenza")(1).value, ph = C.effect(pre + "Fase")(1).value;',
    '      v = (mn + mx) / 2 + (mx - mn) / 2 * Math.sin(2 * Math.PI * hz * time - degreesToRadians(ph) * i);',
    '    } else if (typ == 6) {',
    '      if (!LS) LS = mtLists();',
    '      var D = LS["B" + k];',
    '      v = (D && D.v && D.v.length) ? (parseFloat(D.v[mtPick(D, Math.round(i), n)]) || 0) : 0;',
    '    } else {',
    '      v = mx;',
    '    }',
    '    var F = null;',
    '    try { F = C.effect(pre + "Falloff")(1); } catch (eF) { F = null; }',
    '    if (F && F.index) {',
    '      if (!wp) { try { wp = C.toWorld(b); } catch (eW) { wp = C.toWorld([b[0], b[1]]); } }',
    '      v *= mtFall(F, wp, k);',
    '    }',
    '    out[dst - @LO@] += v;',
    '  }',
    '}',
    'out'
]);

MT_X.position = [
    'var C = thisComp.layer(@C@);',
    'var b = effect("MT Base")(1).value, q = effect("MT Pos")(1).value, x = effect("MT Extra")(1).value;',
    'var t = time - x[2] * thisComp.frameDuration;',
    'var o = C.effect("Trasforma posizione")(1).valueAtTime(t);',
    'var g0 = [0, 0, 0];',
    'try { g0 = effect("MT Origine")(1).value; } catch (e0) {}',
    'var v = value.length > 2 ? value : [value[0], value[1], 0];',
    'var p = [b[0] + q[0] + o[0] + v[0] - g0[0], b[1] + q[1] + o[1] + v[1] - g0[1], b[2] + q[2] + o[2] + v[2] - g0[2]];',
    // Centro del contenuto: ogni copia si posa sul punto con il suo centro visivo, qualunque sia il suo ancoraggio.
    'var al = 2;',
    'try { al = Math.round(C.effect("Allinea copie")(1).value); } catch (eA) { al = 2; }',
    'if (al == 1) {',
    '  try {',
    '    var rr = sourceRectAtTime(inPoint + (outPoint - inPoint) / 2, false), ap = anchorPoint, sc = scale;',
    '    var dx = (ap[0] - (rr.left + rr.width / 2)) * sc[0] / 100, dy = (ap[1] - (rr.top + rr.height / 2)) * sc[1] / 100;',
    '    var an = degreesToRadians(rotation), cs = Math.cos(an), sn = Math.sin(an);',
    '    p[0] += dx * cs - dy * sn; p[1] += dx * sn + dy * cs;',
    '  } catch (eR) {}',
    '}',
    'value.length > 2 ? p : [p[0], p[1]]'
];

MT_X.scale = [
    'var C = thisComp.layer(@C@);',
    'var x = effect("MT Extra")(1).value;',
    'var t = time - x[2] * thisComp.frameDuration;',
    // Scala dell'input da cui viene la copia (I<n> Scala sul controllo).
    'var si = 0, isc = 1;',
    'try { si = Math.round(effect("MT Input")(1).value); } catch (eI) { si = 0; }',
    'try { isc = C.effect("I" + (si + 1) + " Scala")(1).valueAtTime(t) / 100; } catch (eS) { isc = 1; }',
    'var s = C.effect("Trasforma scala")(1).valueAtTime(t) / 100 * Math.max(0, 100 + x[0]) / 100 * isc;',
    'var out = [];',
    'for (var d = 0; d < value.length; d++) out.push(value[d] * s);',
    'out'
];

MT_X.rotation = [
    'var C = thisComp.layer(@C@);',
    'var x = effect("MT Extra")(1).value, r = effect("MT Rot")(1).value, o = effect("MT Orient")(1).value;',
    'var t = time - x[2] * thisComp.frameDuration;',
    'value + C.effect("Trasforma rotazione")(1).valueAtTime(t) + o[2] + r[0]'
];

MT_X.rotationX = ['value + effect("MT Orient")(1).value[0] + effect("MT Rot")(1).value[1]'];
MT_X.rotationY = ['value + effect("MT Orient")(1).value[1] + effect("MT Rot")(1).value[2]'];

MT_X.opacity = [].concat(MT_X.head, [
    'var x = effect("MT Extra")(1).value;',
    'var t = time - x[2] * thisComp.frameDuration;',
    // Copia oltre il numero di adesso (colonne o righe animate): nascosta, come in Cavalry.
    'i >= n ? 0 : value * C.effect("Trasforma opacit\u00e0")(1).valueAtTime(t) / 100 + x[1]'
]);

MT_X.timeRemap = [
    'var x = effect("MT Extra")(1).value;',
    'valueAtTime(Math.max(inPoint, time - x[2] * thisComp.frameDuration))'
];

/*
 * Colore dei comportamenti (destinazione Colore): media dei colori pesata dalla forza di ciascuno
 * (Valore in %, per il falloff), in [r, g, b, peso]. Il peso decide quanto si vede il colore.
 */
MT_X.fcolor = (function () {
    var out = [], L = MT_X.behave;
    for (var q = 0; q < L.length; q++) {
        var ln = L[q];
        if (ln === 'var out = [0, 0, 0];') ln = 'var out = [0, 0, 0], col = [0, 0, 0], sw = 0;';
        else if (ln === '    out[dst - @LO@] += v;') ln = '    var wv = clamp(v / 100, 0, 1), cc = [1, 0.35, 0.12, 1];\n    try { cc = C.effect(pre + "Colore")(1).value; } catch (eC) {}\n    col[0] += cc[0] * wv; col[1] += cc[1] * wv; col[2] += cc[2] * wv; sw += wv;';
        else if (ln === 'out') ln = 'sw > 0 ? [col[0] / sw, col[1] / sw, col[2] / sw, Math.min(1, sw)] : [0, 0, 0, 0]';
        out.push(ln);
    }
    return out;
})();

/*
 * Prova del falloff per una copia, senza try/catch che nascondono l'errore: serve solo a farsi dire
 * da After Effects cosa non va. Restituisce [peso, indice del falloff, 1].
 */
MT_X.fallTest = (function () {
    var f = [];
    for (var q = 0; q < MT_X.fall.length; q++) f.push(MT_X.fall[q] === '  } catch (e) { w = 0; }' ? '  } catch (e) { throw e; }' : MT_X.fall[q]);
    return [].concat(MT_X.head, f, [
        'var b = effect("MT Base")(1).value;',
        'var F = C.effect("B@K@ Falloff")(1);',
        'var wp = C.toWorld(b);',
        '[mtFall(F, wp, @K@), F.index, 1]'
    ]);
})();

function mt_sub(s, key, val) { return s.split(key).join(val); }

function mt_expr(kind, ctrlName, lo) {
    var s = MT_X[kind].join("\n");
    s = mt_sub(s, "@C@", inflect_quote(ctrlName));
    if (lo) s = mt_sub(s, "@LO@", String(lo));
    if (kind === "fallTest") s = mt_sub(s, "@K@", String(lo));
    return s;
}

