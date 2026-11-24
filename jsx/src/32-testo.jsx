/* ============================================================== testo == */
/*
 * Animazioni del testo con gli animatori nativi di After Effects.
 * Ogni fase (entrata, uscita) e' un animatore "MT Entrata" / "MT Uscita" con:
 *  - le proprieta' nello stato di partenza (opacita', posizione, scala, rotazione, sfocatura, spaziatura)
 *  - un selettore di espressione che per ogni lettera, parola o riga calcola quanto e' animata,
 *    con ritardo, ordine e curva (bezier o molla).
 * Il preset completo e' scritto in testa all'espressione: il pannello lo rilegge per modificarlo.
 * Gli animatori seguono il punto di attacco e di stacco del layer: spostando il layer si sposta tutto.
 */

var MT_TEXT_UNIT = { chars: 2, charsAll: 1, words: 3, lines: 4 };
var MT_TEXT_ANCHOR = { chars: 1, charsAll: 1, words: 2, lines: 3 };

function mt_isText(layer) {
    try { return !!layer.property("ADBE Text Properties"); } catch (e) { return false; }
}

function mt_textLayers(comp) {
    var out = [], sel = comp.selectedLayers;
    for (var i = 0; i < sel.length; i++) if (mt_isText(sel[i])) out.push(sel[i]);
    return out;
}

function mt_textExpr(P, ph, headP) {
    var F = ph.from || {};
    var head = "// MT_TEXT " + inflect_stringify(headP || P);
    var p = {
        ph: ph === P.out ? 1 : 0,
        iv: ph.to ? 1 : 0,
        dur: Math.max(0.001, ph.dur || 0.6), stg: ph.stg || 0, delay: ph.delay || 0,
        ord: ph.ord || 0, seed: ph.seed || 1,
        et: ph.ease && ph.ease.type === "spring" ? 1 : (ph.ease && ph.ease.type === "lut" ? 2 : 0),
        e: (ph.ease && ph.ease.v && ph.ease.type !== "lut") ? ph.ease.v : [0.22, 1, 0.36, 1],
        L: (ph.ease && ph.ease.type === "lut" && ph.ease.v) ? ph.ease.v : [0, 1],
        b: (ph.ease && ph.ease.bounce !== undefined) ? ph.ease.bounce : 0.2,
        sp: ph.spread || 0,
        // Sfalsamento che riparte a ogni parola (1) o riga (2); ws: ritardo tra un gruppo e il successivo.
        rs: mt_textRestart(P, ph), ws: ph.wstg || ph.wordStg || 0, u: MT_TEXT_UNIT[P.unit || "chars"] || 2
    };
    return [
        head,
        "var P = " + inflect_stringify(p) + ";",
        "function bz(x, a, b, c, d) {",
        "  if (x <= 0) return 0; if (x >= 1) return 1;",
        "  var t = x;",
        "  for (var k = 0; k < 10; k++) {",
        "    var cx = 3 * a * t * (1 - t) * (1 - t) + 3 * c * t * t * (1 - t) + t * t * t - x;",
        "    var dx = 3 * a * (1 - t) * (1 - t) + 6 * (c - a) * t * (1 - t) + 3 * (1 - c) * t * t;",
        "    if (Math.abs(cx) < 1e-5 || Math.abs(dx) < 1e-6) break;",
        "    t = Math.min(1, Math.max(0, t - cx / dx));",
        "  }",
        "  return 3 * b * t * (1 - t) * (1 - t) + 3 * d * t * t * (1 - t) + t * t * t;",
        "}",
        "function lut(x, L) {",
        "  if (x <= 0) return 0; if (x >= 1) return L[L.length - 1];",
        "  var f = x * (L.length - 1), k = Math.floor(f);",
        "  return L[k] + (L[k + 1] - L[k]) * (f - k);",
        "}",
        "function spring(s, T, bo) {",
        "  if (s <= 0) return 0;",
        "  var w = 2 * Math.PI / T, z = Math.max(0.05, 1 - bo);",
        "  if (s > T * (1 + 3 * bo) * 1.5) return 1;",
        "  if (z >= 1) return 1 - Math.exp(-w * s) * (1 + w * s);",
        "  var wd = w * Math.sqrt(1 - z * z);",
        "  return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s));",
        "}",
        "var n = textTotal, i = textIndex - 1, gofs = 0, span = -1;",
        // Gruppi (parole o righe): ogni unita' sa in che gruppo sta e in che posizione.
        "if (P.rs > 0) {",
        "  var s = String(thisLayer.text.sourceText), gi = [], g = 0, cnt = 0, pend = false, inW = false;",
        "  for (var c = 0; c < s.length; c++) {",
        "    var ch = s.charAt(c), br = (ch == '\\r' || ch == '\\n' || ch == '\\u0003');",
        "    if (br) { if (cnt > 0) pend = true; inW = false; continue; }",
        "    if (/\\s/.test(ch)) { if (P.rs == 1 && cnt > 0) pend = true; inW = false; if (P.u == 1) gi.push(g); continue; }",
        "    if (pend) { g++; pend = false; cnt = 0; }",
        "    if (P.u == 3) { if (!inW) { gi.push(g); cnt++; } } else { gi.push(g); cnt++; }",
        "    inW = true;",
        "  }",
        "  if (gi.length == n && n > 0) {",
        "    var my = gi[i], j = 0, gl = 0, NG = 0, cn = {}, mg = 0;",
        "    for (var c = 0; c < n; c++) { var q = gi[c]; cn[q] = (cn[q] || 0) + 1; if (q == my) { if (c < i) j++; gl++; } NG = Math.max(NG, q + 1); }",
        "    for (var q in cn) mg = Math.max(mg, cn[q]);",
        "    n = gl; i = j; gofs = my * P.ws; span = (NG - 1) * P.ws + Math.max(0, mg - 1) * P.stg;",
        "  }",
        "}",
        "var r = i, mx = Math.max(0, n - 1);",
        "if (P.ord == 1) r = n - 1 - i;",
        "else if (P.ord == 2) { r = Math.abs(i - (n - 1) / 2); mx = (n - 1) / 2; }",
        "else if (P.ord == 3) { r = (n - 1) / 2 - Math.abs(i - (n - 1) / 2); mx = (n - 1) / 2; }",
        "else if (P.ord == 4) {",
        "  seedRandom(P.seed, true);",
        "  var a = []; for (var k = 0; k < n; k++) a.push(k);",
        "  for (var k = n - 1; k > 0; k--) { var j = Math.floor(random(k + 1)); var tmp = a[k]; a[k] = a[j]; a[j] = tmp; }",
        "  r = a[i];",
        "}",
        // Distribuzione dei ritardi: uniforme, che accelera o che rallenta.
        "var u = mx > 0 ? r / mx : 0;",
        "if (P.sp == 1) u = u * u; else if (P.sp == 2) u = 1 - (1 - u) * (1 - u);",
        "var dl = u * mx * P.stg + gofs;",
        "if (span < 0) span = mx * P.stg;",
        "var t0 = P.ph == 0 ? inPoint + P.delay : outPoint - P.delay - P.dur - span;",
        "var s = time - t0 - dl;",
        "var e = P.et == 1 ? spring(s, P.dur, P.b) : (P.et == 2 ? lut(s / P.dur, P.L) : bz(s / P.dur, P.e[0], P.e[1], P.e[2], P.e[3]));",
        "var v = P.ph == 0 ? (P.iv == 1 ? 100 * e : 100 * (1 - e)) : 100 * e;",
        "[v, v, v]"
    ].join("\n");
}

/* Riparte a ogni parola (1) o riga (2). Si legge dalla fase o, se manca, dal preset. Solo se ha senso per l'unita'. */
function mt_textRestart(P, ph) {
    var r = ph.restart !== undefined ? ph.restart : P.restart, unit = P.unit || "chars";
    if (unit === "lines") return 0;
    if (r === "words" && unit !== "words") return 1;
    if (r === "lines") return 2;
    return 0;
}

/* "#RRGGBB" o "#RGB" -> [r, g, b] da 0 a 1, o null. */
function mt_hexColor(hex) {
    var h = String(hex || "").replace(/^#/, "");
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.substring(0, 2), 16) / 255, parseInt(h.substring(2, 4), 16) / 255, parseInt(h.substring(4, 6), 16) / 255];
}

/** Aggiunge un animatore: le proprieta' si aggiungono una alla volta e si rileggono per nome. */
function mt_textAnimator(layer, name, P, ph, unit, k, headP) {
    var F0 = ph.to || ph.from || {}, F = {};
    for (var key in F0) if (F0.hasOwnProperty(key)) F[key] = F0[key];
    // I preset sono pensati per un corpo di 100 px: spostamenti e sfocatura seguono la dimensione del testo.
    k = k || 1;
    if (F.x) F.x *= k; if (F.y) F.y *= k; if (F.z) F.z *= k; if (F.blur) F.blur *= k;
    var anims = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    var a = anims.addProperty("ADBE Text Animator");
    a.name = name;
    var get = function () { return layer.property("ADBE Text Properties").property("ADBE Text Animators").property(name); };
    var addP = function (mn, v) {
        var pr = get().property("ADBE Text Animator Properties").addProperty(mn);
        pr = get().property("ADBE Text Animator Properties").property(mn);
        pr.setValue(v);
    };
    if (F.opacity !== undefined && F.opacity !== 100) addP("ADBE Text Opacity", F.opacity);
    if (F.x || F.y || F.z) addP("ADBE Text Position 3D", [F.x || 0, F.y || 0, F.z || 0]);
    if (F.scale !== undefined && F.scale !== 100) addP("ADBE Text Scale 3D", [F.scale, F.scale, 100]);
    if (F.rotation) addP("ADBE Text Rotation", F.rotation);
    if (F.blur) addP("ADBE Text Blur", [F.blur, F.blur]);
    if (F.tracking) addP("ADBE Text Tracking Amount", F.tracking);
    if (F.skew) addP("ADBE Text Skew", F.skew);
    var fc = mt_hexColor(F.fill);
    if (fc) {
        // Colore di riempimento: vale per le lettere che hanno il riempimento attivo.
        var pf = get().property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");
        pf = get().property("ADBE Text Animator Properties").property("ADBE Text Fill Color");
        try { pf.setValue([fc[0], fc[1], fc[2], 1]); } catch (eF) { pf.setValue(fc); }
    }
    get().property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
    var sel = get().property("ADBE Text Selectors").property(1);
    try { sel.property("ADBE Text Range Type2").setValue(MT_TEXT_UNIT[unit] || 2); } catch (eU) {}
    sel.property("ADBE Text Expressible Amount").expression = mt_textExpr(P, ph, headP);
}

function mt_textClear(layer) {
    var anims = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    for (var i = anims.numProperties; i >= 1; i--) {
        var n = anims.property(i).name;
        if (n === "MT Entrata" || n === "MT Uscita" || n === "MT Colore") anims.property(i).remove();
    }
    var masks = layer.property("ADBE Mask Parade");
    for (var m = masks.numProperties; m >= 1; m--) { if (masks.property(m).name.indexOf("MT Ritaglio") === 0) masks.property(m).remove(); }
}

/* Numero di lettere, parole o righe del testo, per sapere quando l'entrata e' finita. */
function mt_textUnits(txt, unit) {
    var s = String(txt);
    if (unit === "lines") return s.split(/\r\n|\r|\n/).length;
    if (unit === "words") { var w = s.replace(/^\s+|\s+$/g, "").split(/\s+/); return w.length; }
    return s.replace(/\s/g, "").length;
}

/*
 * Ritaglio: una maschera per riga, grande quanto la riga a fine entrata. Il testo che sale
 * da sotto resta nascosto finche' non entra nella sua riga, come dietro una linea invisibile.
 */
function mt_textClip(layer, P, txt) {
    var lines = String(txt).split(/\r\n|\r|\n/).length;
    var ph = P["in"] || P.out, n = mt_textUnits(txt, P.unit || "chars");
    var T = (ph.delay || 0) + (ph.stg || 0) * Math.max(0, n - 1) + (ph.dur || 0.6) * (ph.ease && ph.ease.type === "spring" ? 2.5 : 1) + 0.05;
    var masks = layer.property("ADBE Mask Parade");
    for (var i = 0; i < lines; i++) {
        var nm = "MT Ritaglio " + (i + 1);
        masks.addProperty("ADBE Mask Atom").name = nm;
        var M = layer.property("ADBE Mask Parade").property(nm);
        M.property("ADBE Mask Shape").expression = [
            "var t = Math.min(inPoint + " + T + ", (inPoint + outPoint) / 2);",
            "var r = sourceRectAtTime(t, false), n = " + lines + ", i = " + i + ";",
            "var h = r.height / n, pad = h * 0.08, side = Math.max(r.width * 0.15, h);",
            "var top = r.top + h * i - (i == 0 ? pad * 2 : 0), bot = r.top + h * (i + 1) + (i == n - 1 ? pad : 0);",
            "createPath([[r.left - side, top], [r.left + r.width + side, top], [r.left + r.width + side, bot], [r.left - side, bot]], [], [], true)"
        ].join("\n");
    }
}

/*
 * Rilegge il preset dal layer. MT Entrata e MT Uscita portano il preset completo in testa all'espressione.
 * MT Colore porta il suo blocco; se manca nel preset (o c'e' solo lui) si aggiunge. Un MT Colore fatto
 * da un altro script, senza preset in testa, si legge dal colore e dall'unita' del selettore.
 */
function mt_textHead(a) {
    try {
        var ex = a.property("ADBE Text Selectors").property(1).property("ADBE Text Expressible Amount").expression;
        var line = ex.split("\n")[0];
        if (line.indexOf("// MT_TEXT ") === 0) return inflect_parse(line.substring(11));
    } catch (e) {}
    return null;
}
function mt_textFillFrom(a) {
    var fill = null, head = mt_textHead(a);
    if (head && head.fill) return head.fill;
    if (head && head["in"]) { fill = head["in"]; if (!fill.unit) fill.unit = head.unit || "chars"; if (!fill.restart && head.restart) fill.restart = head.restart; return fill; }
    // Senza preset in testa: colore dalla proprieta', unita' dal selettore.
    try {
        var v = a.property("ADBE Text Animator Properties").property("ADBE Text Fill Color").value;
        var hx = function (x) { var n = Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16); return n.length < 2 ? "0" + n : n; };
        var unit = "chars";
        try { var rt = a.property("ADBE Text Selectors").property(1).property("ADBE Text Range Type2").value; unit = rt === 3 ? "words" : (rt === 1 ? "charsAll" : "chars"); } catch (eU) {}
        fill = { unit: unit, dur: 0.6, stg: 0.03, delay: 0, ord: 0, spread: 0, seed: 1, ease: { type: "bezier", v: [0.22, 1, 0.36, 1] }, from: { fill: ("#" + hx(v[0]) + hx(v[1]) + hx(v[2])).toUpperCase() } };
    } catch (e2) {}
    return fill;
}
function mt_textRead(layer) {
    var anims = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    var P = null, colorAnim = null;
    for (var i = 1; i <= anims.numProperties; i++) {
        var a = anims.property(i);
        if (a.name === "MT Colore") { colorAnim = a; continue; }
        if (a.name !== "MT Entrata" && a.name !== "MT Uscita") continue;
        if (!P) P = mt_textHead(a);
    }
    if (colorAnim) {
        // Preset completo in testa a MT Colore (versioni nuove): vale anche se c'e' solo il colore.
        var hp = mt_textHead(colorAnim);
        if (!P && hp && hp.fill) P = hp;
        var f = mt_textFillFrom(colorAnim);
        if (f) {
            if (!P) P = { name: "Colore", unit: f.unit || "chars", ref: 100 };
            if (!P.fill) P.fill = f;
        }
    }
    return P;
}

/*
 * Legge un'animazione di testo fatta a mano con i keyframe dell'animatore.
 * Letto con sicurezza: valori di partenza, durata, curva del primo segmento, unita'.
 * Stimato: lo sfasamento tra le lettere (stagger), che dipende dal selettore di intervallo.
 */
var MT_READ_UNIT = { 1: "chars", 2: "chars", 3: "words", 4: "lines" };
var MT_READ_STAG = { chars: 0.03, charsAll: 0.03, words: 0.085, lines: 0.16 };

// Converte la curva temporale di un keyframe in maniglie cubiche (x1,y1,x2,y2) normalizzate.
function mt_keyBezier(prop, k, dim) {
    var out = prop.keyOutTemporalEase(k);
    var inn = prop.keyInTemporalEase(k + 1);
    var dt = prop.keyTime(k + 1) - prop.keyTime(k);
    var v1 = prop.keyValue(k), v2 = prop.keyValue(k + 1);
    if (dim !== undefined) { v1 = v1[dim]; v2 = v2[dim]; }
    var dv = v2 - v1;
    if (!dt || !dv) return null;
    var x1 = out[dim || 0].influence / 100, x2 = 1 - inn[dim || 0].influence / 100;
    var s1 = out[dim || 0].speed * dt / dv, s2 = inn[dim || 0].speed * dt / dv;
    var y1 = s1 * x1, y2 = 1 - s2 * (inn[dim || 0].influence / 100);
    return [C_clampX(x1), y1, C_clampX(x2), y2];
}
function C_clampX(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

function inflect_textReadKeys() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var L = mt_textLayers(comp);
    if (!L.length) return inflect_err("Seleziona un layer di testo.");
    var layer = L[0];
    var tp = layer.property("ADBE Text Properties");
    var size = 100;
    try { size = tp.property("ADBE Text Document").value.fontSize; } catch (eS) {}
    var k = size / 100;
    var anims = tp.property("ADBE Text Animators");
    if (!anims || anims.numProperties < 1) return inflect_err("Questo layer non ha animatori di testo.");

    var read = [], assumed = [];
    var unit = "chars", from = {}, tStart = null, tEnd = null, ease = null, keyed = 0;

    for (var i = 1; i <= anims.numProperties; i++) {
        var a = anims.property(i);
        try {
            var rt = a.property("ADBE Text Selectors").property(1).property("ADBE Text Range Type2").value;
            if (MT_READ_UNIT[rt]) unit = MT_READ_UNIT[rt];
        } catch (eU) {}
        var pg = a.property("ADBE Text Animator Properties");
        for (var j = 1; j <= pg.numProperties; j++) {
            var p = pg.property(j), mn = p.matchName, key = null, dim;
            if (mn === "ADBE Text Opacity") key = "opacity";
            else if (mn === "ADBE Text Position" || mn === "ADBE Text Position 3D") { key = "pos"; dim = 2; }
            else if (mn === "ADBE Text Scale" || mn === "ADBE Text Scale 3D") key = "scale";
            else if (mn === "ADBE Text Rotation") key = "rotation";
            else if (mn === "ADBE Text Tracking Amount") key = "tracking";
            if (!key || p.numKeys < 2) continue;
            keyed++;
            var n = p.numKeys;
            var first = p.keyTime(1), last = p.keyTime(n);
            tStart = tStart === null ? first : Math.min(tStart, first);
            tEnd = tEnd === null ? last : Math.max(tEnd, last);
            var v0 = p.keyValue(1);
            if (key === "pos") {
                // Posizione: offset rispetto alla posizione di riposo, in unita' a 100 px.
                from.x = Math.round(((v0[0] - p.keyValue(n)[0]) / k) * 10) / 10;
                from.y = Math.round(((v0[1] - p.keyValue(n)[1]) / k) * 10) / 10;
                read.push("posizione");
            } else if (key === "opacity") { from.opacity = Math.round(v0 * 10) / 10; read.push("opacita'"); }
            else if (key === "scale") { from.scale = Math.round((v0[0] !== undefined ? v0[0] : v0) * 10) / 10; read.push("scala"); }
            else if (key === "rotation") { from.rotation = Math.round(v0 * 10) / 10; read.push("rotazione"); }
            else if (key === "tracking") { from.tracking = Math.round(v0); read.push("spaziatura"); }
            if (!ease) {
                var bz = null;
                try { bz = mt_keyBezier(p, 1, key === "pos" ? 0 : undefined); } catch (eB) {}
                if (bz) ease = ["bezier", bz];
            }
        }
    }

    if (!keyed || tStart === null) return inflect_err("Nessun keyframe trovato sugli animatori di questo layer. Anima Posizione, Opacita' o Scala.");
    var dur = Math.round((tEnd - tStart) * 100) / 100;
    if (dur <= 0) return inflect_err("La durata dei keyframe e' zero.");
    if (!ease) { ease = ["bezier", [0.22, 1, 0.36, 1]]; assumed.push("curva: non leggibile, uso Morbida"); }
    else read.push("curva del primo segmento");
    assumed.push("sfasamento tra " + unit + ": stimato");
    read.push("durata " + dur.toFixed(2) + " s");

    var P = {};
    P.id = "r-" + new Date().getTime();
    P.name = "Da layer";
    P.ref = 100;
    P.unit = unit;
    var easeObj = (ease[0] === "spring") ? { type: "spring", bounce: ease[1] } : { type: "bezier", v: ease[1] };
    var inPhase = {};
    inPhase.dur = dur;
    inPhase.stg = MT_READ_STAG[unit] || 0.05;
    inPhase.delay = 0;
    inPhase.ord = 0;
    inPhase.spread = 0;
    inPhase.seed = 1;
    inPhase.ease = easeObj;
    inPhase.from = from;
    P["in"] = inPhase;
    return inflect_ok({ preset: P, read: read, assumed: assumed, fps: 1 / comp.frameDuration });
}

/*
 * Il pannello lo chiama spesso: se la selezione non e' cambiata non legge il testo,
 * cosi' non disturba After Effects mentre scrivi dentro un layer di testo.
 */
function inflect_textState(force) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_ok({ count: 0 });
    var L = mt_textLayers(comp);
    if (!L.length) { $.global.MT_TXSIG = ""; return inflect_ok({ count: 0, fps: 1 / comp.frameDuration }); }
    var sig = comp.id + ":";
    for (var q = 0; q < L.length; q++) sig += L[q].id + ",";
    if (!force && $.global.MT_TXSIG === sig) return inflect_ok({ same: true, count: L.length, id: L[0].id });
    $.global.MT_TXSIG = sig;
    var txt = "", size = 80, applied = null;
    try {
        var doc = L[0].property("ADBE Text Properties").property("ADBE Text Document").value;
        txt = String(doc.text).substring(0, 160);
        size = doc.fontSize;
    } catch (e) {}
    try { applied = mt_textRead(L[0]); } catch (e2) {}
    return inflect_ok({ count: L.length, text: txt, size: size, applied: applied, id: L[0].id, fps: 1 / comp.frameDuration, name: L[0].name });
}

function inflect_textApply(presetJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var L = mt_textLayers(comp);
    if (!L.length) return inflect_err("Seleziona uno o pi\u00f9 layer di testo.");
    var P;
    try { P = inflect_parse(presetJSON); } catch (e0) { return inflect_err("Preset non valido."); }
    var unit = P.unit || "chars";
    mt_begin("Motion Tools: animazione testo");
    try {
        for (var i = 0; i < L.length; i++) {
            var layer = L[i], k = 1, txt = "";
            try {
                var doc = layer.property("ADBE Text Properties").property("ADBE Text Document").value;
                txt = doc.text;
                if (P.ref) k = doc.fontSize / P.ref;
            } catch (eD) {}
            mt_textClear(layer);
            if (P["in"]) mt_textAnimator(layer, "MT Entrata", P, P["in"], unit, k);
            if (P.out) mt_textAnimator(layer, "MT Uscita", P, P.out, unit, k);
            // Colore: animatore a parte, con la sua unita' (di solito le lettere) e i suoi tempi.
            if (P.fill) {
                var Pf = { unit: P.fill.unit || "chars", ref: P.ref, restart: P.fill.restart };
                Pf["in"] = P.fill;
                mt_textAnimator(layer, "MT Colore", Pf, P.fill, Pf.unit, k, P);
            }
            if (P.clip) mt_textClip(layer, P, txt);
            // Scala e rotazione attorno al centro di ogni lettera, parola o riga.
            try {
                var mo = layer.property("ADBE Text Properties").property("ADBE Text More Options");
                mo.property("ADBE Text Anchor Point Option").setValue(MT_TEXT_ANCHOR[unit] || 1);
                mo.property("ADBE Text Anchor Point Align").setValue([0, -50]);
            } catch (eM) {}
        }
        mt_end();
        return inflect_ok({ count: L.length, name: P.name || "" });
    } catch (e) {
        mt_end();
        return inflect_err("Animazione non applicata: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
}

function inflect_textRemove() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var L = mt_textLayers(comp);
    if (!L.length) return inflect_err("Seleziona uno o pi\u00f9 layer di testo.");
    mt_begin("Motion Tools: togli animazione testo");
    for (var i = 0; i < L.length; i++) mt_textClear(L[i]);
    mt_end();
    return inflect_ok({ count: L.length });
}

