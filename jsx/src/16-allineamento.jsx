/* --------------------------------------------------- allineamento -- */
/* Matrici affini 2D: x' = a*x + b*y + tx, y' = c*x + d*y + ty. */

function inflect_mIdentity() { return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }; }

function inflect_mMul(A, B) {
    return {
        a: A.a * B.a + A.b * B.c, b: A.a * B.b + A.b * B.d,
        c: A.c * B.a + A.d * B.c, d: A.c * B.b + A.d * B.d,
        tx: A.a * B.tx + A.b * B.ty + A.tx, ty: A.c * B.tx + A.d * B.ty + A.ty
    };
}

function inflect_layerPos(layer, t) {
    var tr = layer.property("ADBE Transform Group");
    var pos = tr.property("ADBE Position");
    if (pos.dimensionsSeparated) {
        return [tr.property("ADBE Position_0").valueAtTime(t, false), tr.property("ADBE Position_1").valueAtTime(t, false)];
    }
    return pos.valueAtTime(t, false);
}

function inflect_layerLinear(layer, t) {
    var tr = layer.property("ADBE Transform Group");
    var s = tr.property("ADBE Scale").valueAtTime(t, false);
    var r = tr.property("ADBE Rotate Z").valueAtTime(t, false) * Math.PI / 180;
    var cs = Math.cos(r), sn = Math.sin(r), sx = s[0] / 100, sy = s[1] / 100;
    return { a: cs * sx, b: -sn * sy, c: sn * sx, d: cs * sy };
}

function inflect_layerMat(layer, t) {
    var L = inflect_layerLinear(layer, t);
    var an = layer.property("ADBE Transform Group").property("ADBE Anchor Point").valueAtTime(t, false);
    var pos = inflect_layerPos(layer, t);
    return { a: L.a, b: L.b, c: L.c, d: L.d, tx: pos[0] - (L.a * an[0] + L.b * an[1]), ty: pos[1] - (L.c * an[0] + L.d * an[1]) };
}

function inflect_parentMat(layer, t) {
    var M = inflect_mIdentity(), cur = layer.parent, guard = 0;
    var chain = [];
    while (cur && guard < 200) { chain.push(cur); cur = cur.parent; guard++; }
    for (var i = chain.length - 1; i >= 0; i--) {
        try { M = inflect_mMul(M, inflect_layerMat(chain[i], t)); } catch (e) {}
    }
    return M;
}

function inflect_offsetProp(p, delta) {
    var add = function (v) {
        if (v instanceof Array) {
            var out = [];
            for (var i = 0; i < v.length; i++) out.push(v[i] + (i < delta.length ? delta[i] : 0));
            return out;
        }
        return v + delta[0];
    };
    if (p.numKeys > 0) {
        for (var k = 1; k <= p.numKeys; k++) p.setValueAtKey(k, add(p.keyValue(k)));
    } else {
        p.setValue(add(p.value));
    }
}

/** Sposta il layer di un delta espresso nello spazio del suo genitore. */
function inflect_movePos(layer, dx, dy) {
    var tr = layer.property("ADBE Transform Group");
    var pos = tr.property("ADBE Position");
    if (pos.dimensionsSeparated) {
        inflect_offsetProp(tr.property("ADBE Position_0"), [dx]);
        inflect_offsetProp(tr.property("ADBE Position_1"), [dy]);
    } else {
        inflect_offsetProp(pos, [dx, dy, 0]);
    }
}

/*
 * Layer con un contenuto visibile: video, solidi, precomp, testo, forme, nulli.
 * Negli script i layer di testo e di forma non risultano "AVLayer", per questo
 * si escludono solo camere e luci invece di cercare un tipo preciso.
 */
function inflect_isVisual(l) {
    try {
        if (l instanceof CameraLayer || l instanceof LightLayer) return false;
    } catch (e) {}
    try { return typeof l.sourceRectAtTime === "function" || l instanceof AVLayer || l instanceof TextLayer || l instanceof ShapeLayer; }
    catch (e2) { return true; }
}

function inflect_alignLayers(comp) {
    var out = [], sel = comp.selectedLayers;
    for (var i = 0; i < sel.length; i++) {
        if (!inflect_isVisual(sel[i])) continue; // niente camere e luci
        out.push(sel[i]);
    }
    return out;
}

/** Sposta il punto di ancoraggio (fx, fy da 0 a 1 sul riquadro del layer) senza muovere il layer. */
function inflect_anchor(fx, fy) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona un layer.");
    var layers = inflect_alignLayers(comp);
    if (!layers.length) return inflect_err("Seleziona uno o pi\u00f9 layer.");
    var t = comp.time, done = 0, notes = [];
    mt_begin("Motion Tools: punto di ancoraggio");
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        try {
            var rect = layer.sourceRectAtTime(t, false);
            if (!rect || (rect.width === 0 && rect.height === 0)) { notes.push(layer.name + ": layer vuoto."); continue; }
            var ap = layer.property("ADBE Transform Group").property("ADBE Anchor Point");
            var cur = ap.valueAtTime(t, false);
            var dx = rect.left + fx * rect.width - cur[0], dy = rect.top + fy * rect.height - cur[1];
            if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { done++; continue; }
            var L = inflect_layerLinear(layer, t);
            inflect_offsetProp(ap, [dx, dy, 0]);
            inflect_movePos(layer, L.a * dx + L.b * dy, L.c * dx + L.d * dy);
            done++;
        } catch (e) { notes.push(layer.name + ": " + (layer.locked ? "\u00e8 bloccato." : e.toString())); }
    }
    mt_end();
    if (!done) return inflect_err(notes.length ? notes[0] : "Nessun layer modificato.");
    return inflect_ok({ layers: done, notes: notes });
}

function inflect_bounds(layer, t, extents) {
    var rect = layer.sourceRectAtTime(t, !!extents);
    var M = inflect_mMul(inflect_parentMat(layer, t), inflect_layerMat(layer, t));
    var xs = [rect.left, rect.left + rect.width], ys = [rect.top, rect.top + rect.height];
    var b = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 };
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
        var x = M.a * xs[i] + M.b * ys[j] + M.tx, y = M.c * xs[i] + M.d * ys[j] + M.ty;
        if (x < b.l) b.l = x; if (x > b.r) b.r = x; if (y < b.t) b.t = y; if (y > b.b) b.b = y;
    }
    return b;
}

/** Sposta il layer di un delta in pixel della composizione, tenendo conto dei genitori. */
function inflect_moveComp(layer, t, Dx, Dy) {
    var P = inflect_parentMat(layer, t);
    var det = P.a * P.d - P.b * P.c;
    if (Math.abs(det) < 1e-9) return;
    inflect_movePos(layer, (P.d * Dx - P.b * Dy) / det, (-P.c * Dx + P.a * Dy) / det);
}

/** edge: left | hcenter | right | top | vcenter | bottom; target: comp | selection. */
/* Gruppo salvato di un layer (nel suo commento, "MT_G=nome"), o "" se non ne ha. */
function mt_groupOf(layer) {
    try { var m = String(layer.comment).match(/MT_G=([^|\n]+)/); return m ? m[1] : ""; } catch (e) { return ""; }
}

/*
 * Allinea. Con group = true i layer si muovono a blocchi: tutta la selezione insieme
 * (verso la composizione) oppure ogni gruppo salvato insieme (tra loro). Le distanze dentro
 * un blocco restano uguali. Si somma lo stesso scarto a tutti i keyframe di posizione,
 * quindi l'animazione resta identica.
 */
function inflect_align(edge, target, group) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona i layer.");
    // La selezione di partenza resta attiva dopo l'allineamento: si puo' riallineare subito.
    var keepSel = [];
    try { keepSel = comp.selectedLayers.slice(); } catch (eK) {}
    var layers = inflect_alignLayers(comp);
    if (!layers.length) return inflect_err("Seleziona uno o più layer.");
    var t = comp.time, i, items = [], notes = [];
    for (i = 0; i < layers.length; i++) {
        try { items.push({ layer: layers[i], b: inflect_bounds(layers[i], t) }); } catch (e) { notes.push(layers[i].name + ": " + e.toString()); }
    }
    // Un layer il cui genitore e' anche selezionato si muove gia' con lui.
    var isSel = function (L) { for (var q = 0; q < items.length; q++) if (items[q].layer === L) return true; return false; };
    for (i = 0; i < items.length; i++) {
        var par = null, child = false, guard = 0;
        try { par = items[i].layer.parent; } catch (eP) {}
        while (par && guard++ < 50) { if (isSel(par)) { child = true; break; } try { par = par.parent; } catch (eQ) { par = null; } }
        items[i].child = child;
    }
    // Blocchi: gruppi di layer che si muovono insieme.
    var units = [], byName = {};
    for (i = 0; i < items.length; i++) {
        var key = null;
        if (group) key = target === "selection" ? (mt_groupOf(items[i].layer) || null) : "tutti";
        var u;
        if (key !== null && byName[key]) u = byName[key];
        else { u = { items: [], b: { l: 1e12, r: -1e12, t: 1e12, b: -1e12 } }; units.push(u); if (key !== null) byName[key] = u; }
        u.items.push(items[i]);
        var bb0 = items[i].b;
        if (bb0.l < u.b.l) u.b.l = bb0.l; if (bb0.r > u.b.r) u.b.r = bb0.r; if (bb0.t < u.b.t) u.b.t = bb0.t; if (bb0.b > u.b.b) u.b.b = bb0.b;
    }
    if (target === "selection" && units.length < 2) return inflect_err(group ? "Per allineare tra loro servono almeno due blocchi: due gruppi salvati, o un gruppo e un layer." : "Per allineare tra loro servono almeno due layer. Con uno solo scegli Composizione.");
    var ref = { l: 0, r: comp.width, t: 0, b: comp.height };
    if (target === "selection") {
        ref = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 };
        for (i = 0; i < units.length; i++) {
            var b = units[i].b;
            if (b.l < ref.l) ref.l = b.l; if (b.r > ref.r) ref.r = b.r; if (b.t < ref.t) ref.t = b.t; if (b.b > ref.b) ref.b = b.b;
        }
    }
    var done = 0;
    mt_begin("Motion Tools: allinea");
    for (var g = 0; g < units.length; g++) {
        var bb = units[g].b, Dx = 0, Dy = 0;
        if (edge === "left") Dx = ref.l - bb.l;
        else if (edge === "hcenter") Dx = (ref.l + ref.r) / 2 - (bb.l + bb.r) / 2;
        else if (edge === "right") Dx = ref.r - bb.r;
        else if (edge === "top") Dy = ref.t - bb.t;
        else if (edge === "vcenter") Dy = (ref.t + ref.b) / 2 - (bb.t + bb.b) / 2;
        else if (edge === "bottom") Dy = ref.b - bb.b;
        for (i = 0; i < units[g].items.length; i++) {
            var it = units[g].items[i];
            if (it.child) continue;
            try { inflect_moveComp(it.layer, t, Dx, Dy); done++; }
            catch (e2) { notes.push(it.layer.name + ": " + (it.layer.locked ? "è bloccato." : e2.toString())); }
        }
    }
    mt_end();
    for (var ks = 0; ks < keepSel.length; ks++) { try { keepSel[ks].selected = true; } catch (eS) {} }
    if (!done) return inflect_err(notes.length ? notes[0] : "Nessun layer spostato.");
    return inflect_ok({ layers: done, units: units.length, notes: notes });
}

function inflect_groupCreate(name) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var sel = comp.selectedLayers;
    if (sel.length < 2) return inflect_err("Seleziona almeno due layer da tenere insieme.");
    name = String(name || "").replace(/[|\n]/g, " ");
    if (!name) return inflect_err("Dai un nome al gruppo.");
    mt_begin("Motion Tools: crea gruppo");
    try {
        for (var i = 0; i < sel.length; i++) {
            var c = String(sel[i].comment || "").replace(/\|?\s*MT_G=[^|\n]+/g, "");
            sel[i].comment = (c ? c + "|" : "") + "MT_G=" + name;
        }
        mt_end();
        return inflect_groupList();
    } catch (e) { mt_end(); return inflect_err(e.toString()); }
}

function inflect_groupList() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_ok({ groups: [] });
    var map = {}, out = [];
    for (var i = 1; i <= comp.numLayers; i++) { var g = mt_groupOf(comp.layer(i)); if (g) map[g] = (map[g] || 0) + 1; }
    for (var k in map) if (map.hasOwnProperty(k)) out.push({ name: k, count: map[k] });
    out.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return inflect_ok({ groups: out });
}

/** add = true aggiunge il gruppo alla selezione (Maiusc). */
function inflect_groupSelect(name, add) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var n = 0;
    for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i), inG = mt_groupOf(L) === name;
        if (inG) { L.selected = true; n++; } else if (!add) L.selected = false;
    }
    return inflect_ok({ count: n });
}

function inflect_groupRemove(name) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    mt_begin("Motion Tools: sciogli gruppo");
    for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        if (mt_groupOf(L) === name) L.comment = String(L.comment).replace(/\|?\s*MT_G=[^|\n]+/g, "");
    }
    mt_end();
    return inflect_groupList();
}

/** Distribuisce i centri a distanza uguale. axis: h | v. */
function inflect_distribute(axis) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona i layer.");
    var layers = inflect_alignLayers(comp);
    if (layers.length < 3) return inflect_err("Per distribuire servono almeno tre layer.");
    var t = comp.time, items = [], i, notes = [];
    for (i = 0; i < layers.length; i++) {
        try {
            var b = inflect_bounds(layers[i], t);
            items.push({ layer: layers[i], c: axis === "h" ? (b.l + b.r) / 2 : (b.t + b.b) / 2 });
        } catch (e) { notes.push(layers[i].name + ": " + e.toString()); }
    }
    items.sort(function (x, y) { return x.c - y.c; });
    var first = items[0].c, step = (items[items.length - 1].c - first) / (items.length - 1), done = 0;
    mt_begin("Motion Tools: distribuisci");
    for (i = 1; i < items.length - 1; i++) {
        var delta = first + step * i - items[i].c;
        try { inflect_moveComp(items[i].layer, t, axis === "h" ? delta : 0, axis === "h" ? 0 : delta); done++; }
        catch (e2) { notes.push(items[i].layer.name + ": " + (items[i].layer.locked ? "\u00e8 bloccato." : e2.toString())); }
    }
    mt_end();
    return inflect_ok({ layers: items.length, notes: notes });
}


/**
 * Solo lettura, per l'anteprima della scheda Allinea: misura della comp e riquadri
 * dei layer selezionati in questo istante (al massimo 40). Non cambia niente nel progetto.
 */
function inflect_layoutRead() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_ok({ comp: null, layers: [] });
        var layers = inflect_alignLayers(comp), t = comp.time, out = [];
        for (var i = 0; i < layers.length && i < 40; i++) {
            var b;
            try { b = inflect_bounds(layers[i], t); } catch (eB) { continue; }
            out.push({ name: layers[i].name, l: b.l, t: b.t, r: b.r, b: b.b });
        }
        return inflect_ok({ comp: { name: comp.name, w: comp.width, h: comp.height }, layers: out, total: layers.length });
    } catch (e) { return inflect_err(e); }
}
