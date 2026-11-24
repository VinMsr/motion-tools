/* ======================================================= tempo e copia == */
/*
 * Il "momento" e' un istante di una composizione. Si puo' ritrovare in qualsiasi altra
 * composizione collegata (precomposizioni dentro, composizioni che la contengono, sorelle)
 * seguendo i layer che le collegano: tempo di inizio, stiramento e rimappatura del tempo.
 */

function mt_compEdges() {
    var E = [];
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!(it instanceof CompItem)) continue;
        for (var l = 1; l <= it.numLayers; l++) {
            var L = it.layer(l);
            try { if (L.source && (L.source instanceof CompItem)) E.push({ p: it.id, c: L.source.id, L: L }); } catch (e) {}
        }
    }
    return E;
}

function mt_layerRange(L) { return [Math.min(L.inPoint, L.outPoint), Math.max(L.inPoint, L.outPoint)]; }

/* Tempo del figlio a partire dal tempo del genitore. */
function mt_toChild(L, t) {
    if (L.timeRemapEnabled) { try { return L.property("ADBE Time Remapping").valueAtTime(t, false); } catch (e) {} }
    return (t - L.startTime) * 100 / (L.stretch || 100);
}

/* Tempo del genitore a partire dal tempo del figlio (con la rimappatura si cerca frame per frame). */
function mt_toParent(L, t) {
    if (L.timeRemapEnabled) {
        try {
            var tr = L.property("ADBE Time Remapping"), R = mt_layerRange(L), fd = L.containingComp.frameDuration, best = null, bd = 1e9;
            for (var x = R[0]; x <= R[1]; x += fd) { var d = Math.abs(tr.valueAtTime(x, false) - t); if (d < bd) { bd = d; best = x; } }
            if (best !== null) return best;
        } catch (e) {}
    }
    return L.startTime + t * (L.stretch || 100) / 100;
}

/** Cerca il percorso piu' corto tra le due composizioni, preferendo i layer attivi in quell'istante. */
function mt_mapTime(fromId, t, toId) {
    if (fromId === toId) return { t: t, hops: 0, strict: true };
    var E = mt_compEdges();
    var run = function (strict) {
        var Q = [{ id: fromId, t: t, hops: 0 }], seen = {};
        seen[fromId] = true;
        while (Q.length) {
            var cur = Q.shift();
            for (var k = 0; k < E.length; k++) {
                var e = E[k], nid = null, nt = 0, R = mt_layerRange(e.L);
                if (e.p === cur.id) {
                    if (strict && (cur.t < R[0] - 1e-6 || cur.t > R[1] + 1e-6)) continue;
                    nid = e.c; nt = mt_toChild(e.L, cur.t);
                } else if (e.c === cur.id) {
                    nt = mt_toParent(e.L, cur.t);
                    if (strict && (nt < R[0] - 1e-6 || nt > R[1] + 1e-6)) continue;
                    nid = e.p;
                } else continue;
                if (seen[nid]) continue;
                seen[nid] = true;
                var nx = { id: nid, t: nt, hops: cur.hops + 1 };
                if (nid === toId) return nx;
                Q.push(nx);
            }
        }
        return null;
    };
    var r = run(true);
    if (r) { r.strict = true; return r; }
    r = run(false);
    if (r) r.strict = false;
    return r;
}

function inflect_momentTake() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    $.global.MT_MOMENT = { id: comp.id, name: comp.name, t: comp.time, fps: 1 / comp.frameDuration };
    return inflect_ok($.global.MT_MOMENT);
}

function inflect_momentGo() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var M = $.global.MT_MOMENT;
    if (!M) return inflect_err("Prima prendi un momento con Prendi.");
    var r = mt_mapTime(M.id, M.t, comp.id);
    if (!r) return inflect_err(comp.name + " non \u00e8 collegata a " + M.name + ": nessuna delle due contiene l'altra.");
    var t = inflect_frameRound(comp, r.t);
    try { comp.time = Math.max(0, Math.min(comp.duration, t)); } catch (e) {}
    return inflect_ok({ time: t, comp: comp.name, outside: t < 0 || t > comp.duration, loose: !r.strict, fps: 1 / comp.frameDuration });
}

function inflect_momentMarker() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var M = $.global.MT_MOMENT, t = comp.time;
    if (M) { var r = mt_mapTime(M.id, M.t, comp.id); if (r) t = inflect_frameRound(comp, r.t); }
    var label = M ? M.name : "Momento";
    mt_begin("Motion Tools: marker");
    try {
        var sel = comp.selectedLayers, n = 0;
        if (sel.length) {
            for (var i = 0; i < sel.length; i++) { sel[i].property("ADBE Marker").setValueAtTime(t, new MarkerValue(label)); n++; }
        } else {
            comp.markerProperty.setValueAtTime(t, new MarkerValue(label));
        }
        mt_end();
        return inflect_ok({ time: t, layers: n, fps: 1 / comp.frameDuration });
    } catch (e) { mt_end(); return inflect_err("Marker non creato: " + e.toString()); }
}

