/* ------------------------------------------------------ selezione -- */

var INFLECT_SPANS = [];  // curve multi punto applicate: { id, t0, t1, inner: [tempi] }
var INFLECT_TAILS = [];  // assestamenti applicati, per poterli aggiornare o togliere

function inflect_propId(p) {
    var path = [], cur = p;
    try { while (cur && cur.parentProperty) { path.push(cur.propertyIndex); cur = cur.parentProperty; } } catch (e) {}
    var layer = p.propertyGroup(p.propertyDepth);
    var cid = 0;
    try { cid = layer.containingComp.id; } catch (e2) {}
    return cid + ":" + (layer ? layer.index : 0) + ":" + path.join(".");
}

function inflect_keyAt(p, t) {
    if (p.numKeys < 1) return 0;
    var idx = p.nearestKeyIndex(t);
    return Math.abs(p.keyTime(idx) - t) < 1e-4 ? idx : 0;
}

function inflect_captureSel(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
        var times = [];
        for (var j = 0; j < list[i].keys.length; j++) times.push(list[i].prop.keyTime(list[i].keys[j]));
        out.push({ prop: list[i].prop, times: times });
    }
    return out;
}

/** Riseleziona i keyframe di prima, piu' quelli inseriti da una curva multi punto tra di loro. */
function inflect_restoreSel(sel) {
    for (var i = 0; i < sel.length; i++) {
        var p = sel[i].prop, times = sel[i].times.slice(0), id = "";
        try { id = inflect_propId(p); } catch (e0) {}
        for (var s = 0; s < INFLECT_SPANS.length; s++) {
            var sp = INFLECT_SPANS[s];
            if (sp.id !== id) continue;
            var has0 = false, has1 = false;
            for (var q = 0; q < times.length; q++) {
                if (Math.abs(times[q] - sp.t0) < 1e-4) has0 = true;
                if (Math.abs(times[q] - sp.t1) < 1e-4) has1 = true;
            }
            if (has0 && has1) for (var w = 0; w < sp.inner.length; w++) times.push(sp.inner[w]);
        }
        for (var j = 0; j < times.length; j++) {
            try { var idx = inflect_keyAt(p, times[j]); if (idx) p.setSelectedAtKey(idx, true); } catch (e) {}
        }
    }
}

function inflect_collapseSpans(p, keys) {
    var id = inflect_propId(p), times = [], i, j;
    for (i = 0; i < keys.length; i++) times.push(p.keyTime(keys[i]));
    var find = function (t) {
        for (var q = 0; q < times.length; q++) if (Math.abs(times[q] - t) < 1e-4) return q;
        return -1;
    };
    var changed = false;
    for (i = INFLECT_SPANS.length - 1; i >= 0; i--) {
        var s = INFLECT_SPANS[i];
        if (s.id !== id) continue;
        if (find(s.t0) < 0 || find(s.t1) < 0) continue;
        for (j = s.inner.length - 1; j >= 0; j--) {
            var idx = inflect_keyAt(p, s.inner[j]);
            if (idx) { p.removeKey(idx); changed = true; }
            var q2 = find(s.inner[j]);
            if (q2 >= 0) times.splice(q2, 1);
        }
        INFLECT_SPANS.splice(i, 1);
    }
    if (!changed) return keys;
    var out = [];
    for (i = 0; i < times.length; i++) { var k = inflect_keyAt(p, times[i]); if (k) out.push(k); }
    out.sort(inflect_sortNum);
    return out;
}

