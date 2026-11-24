/* -------------------------------------------------- composizione -- */

/*
 * Riquadro che contiene i layer in tutti i frame in cui sono visibili.
 * Si misura il contenuto senza far calcolare gli effetti (con gli effetti ogni misura e' un render,
 * e alcuni effetti dichiarano ingombri enormi): al massimo 48 campioni piu' i tempi dei keyframe.
 * Gli effetti allargano il riquadro solo in tre momenti e al massimo di MT_FX_PAD px per lato.
 */
var MT_FX_PAD = 300;

function mt_sampleTimes(L, t0, t1, fd) {
    var out = [], frames = Math.max(1, Math.round((t1 - t0) / fd)), steps = Math.min(48, frames), s, k;
    for (s = 0; s <= steps; s++) out.push(t0 + (t1 - t0) * s / steps);
    // Anche i keyframe della trasformazione: li' il layer e' spesso nel punto piu' lontano.
    try {
        var tr = L.property("ADBE Transform Group");
        for (var i = 1; i <= tr.numProperties; i++) {
            var p = tr.property(i);
            if (!p || !p.numKeys) continue;
            for (k = 1; k <= p.numKeys; k++) { var kt = p.keyTime(k); if (kt >= t0 && kt <= t1) out.push(kt); }
        }
    } catch (e) {}
    for (s = 0; s < out.length; s++) if (out[s] >= t1 && t1 > t0) out[s] = t1 - fd / 2;
    return out;
}

function mt_hasEffects(L) {
    try { return L.property("ADBE Effect Parade").numProperties > 0; } catch (e) { return false; }
}

function mt_boundsOverTime(layers, comp) {
    var B = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 };
    var grow = function (b) { if (b.l < B.l) B.l = b.l; if (b.r > B.r) B.r = b.r; if (b.t < B.t) B.t = b.t; if (b.b > B.b) B.b = b.b; };
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!inflect_isVisual(L)) continue;
        var t0 = Math.max(0, L.inPoint), t1 = Math.min(comp.duration, L.outPoint);
        if (t1 < t0) { t0 = 0; t1 = 0; }
        var T = mt_sampleTimes(L, t0, t1, comp.frameDuration);
        for (var s = 0; s < T.length; s++) { try { grow(inflect_bounds(L, T[s], false)); } catch (e) {} }
        if (mt_hasEffects(L)) {
            var tm = [t0, (t0 + t1) / 2, Math.max(t0, t1 - comp.frameDuration / 2)];
            for (var q = 0; q < 3; q++) {
                try {
                    var c = inflect_bounds(L, tm[q], false), e2 = inflect_bounds(L, tm[q], true);
                    grow({ l: Math.max(e2.l, c.l - MT_FX_PAD), r: Math.min(e2.r, c.r + MT_FX_PAD), t: Math.max(e2.t, c.t - MT_FX_PAD), b: Math.min(e2.b, c.b + MT_FX_PAD) });
                } catch (eF) {}
            }
        }
    }
    return B.l <= B.r ? B : null;
}

/* Lato massimo ragionevole per la precomposizione: oltre, After Effects rallenta molto o va in crash. */
function mt_maxSide(comp) { return Math.max(4096, 3 * Math.max(comp.width, comp.height)); }

/** Sposta tutti i layer senza genitore (camere e luci comprese) di dx, dy in pixel della composizione. */
function mt_shiftAll(comp, dx, dy, onlyLayers) {
    var list = [], i;
    if (onlyLayers) list = onlyLayers; else for (i = 1; i <= comp.numLayers; i++) list.push(comp.layer(i));
    for (i = 0; i < list.length; i++) {
        var L = list[i];
        try { if (L.parent) continue; } catch (eP) {}
        var wasLocked = L.locked;
        if (wasLocked) L.locked = false;
        try {
            inflect_movePos(L, dx, dy);
            if (L instanceof CameraLayer || L instanceof LightLayer) {
                var poi = L.property("ADBE Transform Group").property("ADBE Anchor Point");
                if (poi) inflect_offsetProp(poi, [dx, dy, 0]);
            }
        } catch (e) {}
        if (wasLocked) L.locked = true;
    }
}

/**
 * Precomponi e ritaglia: i layer selezionati passano, con keyframe ed effetti, in una
 * precomposizione grande quanto il loro contenuto durante tutta l'animazione.
 * Nella composizione di partenza il risultato resta esattamente dov'era.
 */
/* Copia l'animazione (keyframe, interpolazioni, easing, tangenti, espressione) da una proprieta' a un'altra. */
function mt_copyAnim(src, dst) {
    if (!src || !dst) return;
    try { if (src.expression) dst.expression = src.expression; } catch (eX) {}
    if (src.numKeys === 0) { dst.setValue(src.value); return; }
    var k, spatial = false;
    try { spatial = src.isSpatial; } catch (eS) {}
    for (k = 1; k <= src.numKeys; k++) dst.setValueAtTime(src.keyTime(k), src.keyValue(k));
    for (k = 1; k <= src.numKeys; k++) {
        var j = dst.nearestKeyIndex(src.keyTime(k));
        try { dst.setInterpolationTypeAtKey(j, src.keyInInterpolationType(k), src.keyOutInterpolationType(k)); } catch (e1) {}
        try { dst.setTemporalEaseAtKey(j, src.keyInTemporalEase(k), src.keyOutTemporalEase(k)); } catch (e2) {}
        if (spatial) {
            try { dst.setSpatialTangentsAtKey(j, src.keyInSpatialTangent(k), src.keyOutSpatialTangent(k)); } catch (e3) {}
            try { dst.setSpatialAutoBezierAtKey(j, src.keySpatialAutoBezier(k)); dst.setSpatialContinuousAtKey(j, src.keySpatialContinuous(k)); } catch (e4) {}
            try { dst.setRovingAtKey(j, src.keyRoving(k)); } catch (e5) {}
        }
        try { dst.setTemporalContinuousAtKey(j, src.keyTemporalContinuous(k)); dst.setTemporalAutoBezierAtKey(j, src.keyTemporalAutoBezier(k)); } catch (e6) {}
    }
}

function mt_clearAnim(p, v) {
    if (!p) return;
    try { p.expression = ""; } catch (e) {}
    while (p.numKeys > 0) p.removeKey(1);
    if (v !== undefined) p.setValue(v);
}

/*
 * Variante "animazione sulla composizione": il contenuto resta fermo e centrato nella
 * precomposizione, mentre posizione, scala, rotazione e opacita' (con i loro keyframe)
 * passano al layer della precomposizione. Comoda per animare il blocco come un tutt'uno.
 */
function mt_precompKeepOuter(comp, layer, margin) {
    var name = layer.name;
    // Misura prima di precomporre: se il risultato e' sproporzionato ci si ferma senza toccare nulla.
    var B = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 };
    var ta = Math.max(0, layer.inPoint), tb = Math.min(comp.duration, layer.outPoint);
    var TT = mt_sampleTimes(layer, ta, tb, comp.frameDuration);
    for (var s = 0; s < TT.length; s++) {
        try {
            var r = layer.sourceRectAtTime(TT[s], false);
            if (r.left < B.l) B.l = r.left; if (r.left + r.width > B.r) B.r = r.left + r.width;
            if (r.top < B.t) B.t = r.top; if (r.top + r.height > B.b) B.b = r.top + r.height;
        } catch (eR) {}
    }
    if (B.l > B.r) throw new Error("Non riesco a misurare il contenuto.");
    if (mt_hasEffects(layer)) { B.l -= Math.min(MT_FX_PAD, margin + 40); B.t -= Math.min(MT_FX_PAD, margin + 40); B.r += Math.min(MT_FX_PAD, margin + 40); B.b += Math.min(MT_FX_PAD, margin + 40); }
    var W = Math.max(4, Math.ceil(B.r - B.l + 2 * margin)), H = Math.max(4, Math.ceil(B.b - B.t + 2 * margin)), mx = mt_maxSide(comp);
    if (W > mx || H > mx) throw new Error("il contenuto occuperebbe " + W + " x " + H + " px, troppo per After Effects. Controlla se il layer ha un ingombro enorme (per esempio un tracciato o un testo a paragrafo molto grande).");
    var pc = comp.layers.precompose([layer.index], name, true);
    var O = null, i;
    for (i = 1; i <= comp.numLayers; i++) {
        try { if (comp.layer(i).source && comp.layer(i).source.id === pc.id) { O = comp.layer(i); break; } } catch (e) {}
    }
    var L = pc.layer(1);
    var trL = L.property("ADBE Transform Group");
    pc.width = W; pc.height = H;
    var ap = trL.property("ADBE Anchor Point").value;
    var cx = (B.l + B.r) / 2, cy = (B.t + B.b) / 2;
    var inner = [W / 2 + ap[0] - cx, H / 2 + ap[1] - cy];
    var trO = O.property("ADBE Transform Group");
    if (L.threeDLayer) O.threeDLayer = true;
    // L'animazione passa fuori, il layer interno resta fermo con il contenuto centrato.
    var pairs = [["ADBE Position", null], ["ADBE Scale", null], ["ADBE Rotate Z", null], ["ADBE Opacity", null]];
    if (L.threeDLayer) pairs.push(["ADBE Rotate X", null], ["ADBE Rotate Y", null], ["ADBE Orientation", null]);
    var posL = trL.property("ADBE Position");
    if (posL.dimensionsSeparated) posL.dimensionsSeparated = false;
    trO.property("ADBE Anchor Point").setValue([inner[0], inner[1], 0]);
    for (i = 0; i < pairs.length; i++) {
        var pL = trL.property(pairs[i][0]), pO = trO.property(pairs[i][0]);
        if (!pL || !pO) continue;
        mt_copyAnim(pL, pO);
    }
    mt_clearAnim(trL.property("ADBE Position"), L.threeDLayer ? [inner[0], inner[1], 0] : [inner[0], inner[1]]);
    mt_clearAnim(trL.property("ADBE Scale"), L.threeDLayer ? [100, 100, 100] : [100, 100]);
    mt_clearAnim(trL.property("ADBE Rotate Z"), 0);
    mt_clearAnim(trL.property("ADBE Opacity"), 100);
    if (L.threeDLayer) {
        mt_clearAnim(trL.property("ADBE Rotate X"), 0);
        mt_clearAnim(trL.property("ADBE Rotate Y"), 0);
        mt_clearAnim(trL.property("ADBE Orientation"), [0, 0, 0]);
        L.threeDLayer = false;
    }
    for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    O.selected = true;
    return { name: pc.name, width: W, height: H };
}

function inflect_precomposeFit(margin, keepOuter) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona i layer.");
    var sel = comp.selectedLayers, layers = [], i;
    for (i = 0; i < sel.length; i++) if (inflect_isVisual(sel[i])) layers.push(sel[i]);
    if (!layers.length) return inflect_err("Seleziona i layer da precomporre.");
    for (i = 0; i < layers.length; i++) {
        try { if (layers[i].parent) return inflect_err(layers[i].name + " \u00e8 imparentato a un altro layer: togli il genitore prima di precomporlo."); } catch (eP) {}
    }
    margin = Math.max(0, margin || 0);
    var idx = [];
    for (i = 0; i < layers.length; i++) idx.push(layers[i].index);
    idx.sort(inflect_sortNum);
    var name = layers.length === 1 ? layers[0].name : layers[0].name + " e altri";

    if (keepOuter && layers.length === 1) {
        mt_begin("Motion Tools: precomponi con animazione fuori");
        try {
            var res = mt_precompKeepOuter(comp, layers[0], margin);
            mt_end();
            res.outer = true;
            return inflect_ok(res);
        } catch (eO) {
            mt_end();
            return inflect_err("Precomposizione non riuscita: " + eO.toString() + (eO.line ? " (riga " + eO.line + ")" : ""));
        }
    }

    // Misura nella composizione di partenza, prima di precomporre: la precomp ha le stesse coordinate.
    var B = mt_boundsOverTime(layers, comp);
    if (!B) return inflect_err("Non riesco a misurare il contenuto dei layer selezionati.");
    var l = Math.floor(B.l - margin), t = Math.floor(B.t - margin);
    var W = Math.max(4, Math.ceil(B.r + margin) - l);
    var H = Math.max(4, Math.ceil(B.b + margin) - t);
    var mx = mt_maxSide(comp);
    if (W > mx || H > mx) return inflect_err("La precomposizione verrebbe di " + W + " x " + H + " px, troppo per After Effects: si bloccherebbe o andrebbe in crash. Di solito succede con un layer che arriva da molto lontano o con un ingombro enorme. Precomponi quel layer a parte, o accorcia il movimento. Non ho cambiato niente.");

    mt_begin("Motion Tools: precomponi e ritaglia");
    try {
        var pc = comp.layers.precompose(idx, name, true);
        var pcLayer = null;
        for (i = 1; i <= comp.numLayers; i++) {
            var L = comp.layer(i);
            try { if (L.source && L.source.id === pc.id) { pcLayer = L; break; } } catch (eS) {}
        }
        var inner = [];
        for (i = 1; i <= pc.numLayers; i++) inner.push(pc.layer(i));
        mt_shiftAll(pc, -l, -t, inner);
        pc.width = W;
        pc.height = H;
        if (pcLayer) {
            var tr = pcLayer.property("ADBE Transform Group");
            tr.property("ADBE Anchor Point").setValue([W / 2, H / 2, 0]);
            var pos = tr.property("ADBE Position");
            if (pos.dimensionsSeparated) {
                tr.property("ADBE Position_0").setValue(l + W / 2);
                tr.property("ADBE Position_1").setValue(t + H / 2);
            } else {
                pos.setValue([l + W / 2, t + H / 2, 0]);
            }
            for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
            pcLayer.selected = true;
        }
        mt_end();
        return inflect_ok({ name: pc.name, width: W, height: H });
    } catch (e) {
        mt_end();
        return inflect_err("Precomposizione non riuscita: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
}

/** Ridimensiona la composizione attorno ai layer selezionati, come sono nel frame corrente. */
function inflect_fitComp(margin) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona un layer.");
    var sel = comp.selectedLayers, B = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 }, i, n = 0;
    for (i = 0; i < sel.length; i++) {
        if (!inflect_isVisual(sel[i])) continue;
        try {
            var b = inflect_bounds(sel[i], comp.time, true);
            if (b.l < B.l) B.l = b.l; if (b.r > B.r) B.r = b.r; if (b.t < B.t) B.t = b.t; if (b.b > B.b) B.b = b.b;
            n++;
        } catch (e) {}
    }
    if (!n || B.l > B.r) return inflect_err("Seleziona il layer attorno a cui ridimensionare la composizione.");
    margin = Math.max(0, margin || 0);
    var l = Math.floor(B.l - margin), t = Math.floor(B.t - margin);
    var W = Math.max(4, Math.min(30000, Math.ceil(B.r + margin) - l));
    var H = Math.max(4, Math.min(30000, Math.ceil(B.b + margin) - t));
    mt_begin("Motion Tools: adatta la composizione");
    try {
        mt_shiftAll(comp, -l, -t, null);
        comp.width = W;
        comp.height = H;
        mt_end();
        return inflect_ok({ width: W, height: H });
    } catch (e) {
        mt_end();
        return inflect_err("Ridimensionamento non riuscito: " + e.toString());
    }
}

