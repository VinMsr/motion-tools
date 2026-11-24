/* --------------------------------------------------- copia e incolla -- */

function mt_pathOf(p) {
    var path = [], q = p;
    while (q && q.parentProperty) {
        path.unshift({ mn: q.matchName, name: q.name, ix: q.propertyIndex });
        q = q.parentProperty;
    }
    return path;
}

function mt_resolvePath(layer, path) {
    var q = layer;
    for (var i = 0; i < path.length; i++) {
        var s = path[i], nx = null;
        try { nx = q.property(s.name); if (nx && nx.matchName !== s.mn) nx = null; } catch (e) { nx = null; }
        if (!nx) { try { nx = q.property(s.mn); } catch (e2) { nx = null; } }
        if (!nx) { try { nx = q.property(s.ix); if (nx && nx.matchName !== s.mn) nx = null; } catch (e3) { nx = null; } }
        if (!nx) return null;
        q = nx;
    }
    return (q && q.propertyType === PropertyType.PROPERTY) ? q : null;
}

function mt_fitValue(v, dst) {
    if (!(v instanceof Array)) return v;
    var cur = dst.value;
    if (!(cur instanceof Array) || cur.length === v.length) return v;
    var out = [];
    for (var i = 0; i < cur.length; i++) out.push(i < v.length ? v[i] : cur[i]);
    return out;
}

/* Costruisce gli appunti dai keyframe: entries = [{ prop, keys: [indici] }]. */
function mt_keysClip(entries) {
    var items = [], layerIds = [], t0 = 1e12;
    var lix = function (L) { for (var a = 0; a < layerIds.length; a++) if (layerIds[a] === L.id) return a; layerIds.push(L.id); return layerIds.length - 1; };
    for (var i = 0; i < entries.length; i++) {
        var p = entries[i].prop, sk = entries[i].keys, keys = [], spatial = false;
        try { spatial = p.isSpatial; } catch (eS) {}
        for (var k = 0; k < sk.length; k++) {
            var j = sk[k], K = { t: p.keyTime(j), v: p.keyValue(j) };
            try { K.ii = p.keyInInterpolationType(j); K.oi = p.keyOutInterpolationType(j); } catch (e1) {}
            try { K.ie = p.keyInTemporalEase(j); K.oe = p.keyOutTemporalEase(j); } catch (e2) {}
            try { K.tc = p.keyTemporalContinuous(j); K.ta = p.keyTemporalAutoBezier(j); } catch (e3) {}
            if (spatial) { try { K.ist = p.keyInSpatialTangent(j); K.ost = p.keyOutSpatialTangent(j); K.sc = p.keySpatialContinuous(j); K.sa = p.keySpatialAutoBezier(j); K.rv = p.keyRoving(j); } catch (e4) {} }
            keys.push(K);
            if (K.t < t0) t0 = K.t;
        }
        if (!keys.length) continue;
        items.push({ path: mt_pathOf(p), name: p.name, layer: lix(p.propertyGroup(p.propertyDepth)), keys: keys, spatial: spatial });
    }
    return { items: items, layers: layerIds.length, t0: t0 };
}

/* Ricorda in silenzio gli ultimi keyframe selezionati: "Incolla" li usa anche senza premere Copia. */
function mt_autoClip(comp, list) {
    if (!list.length) return;
    var refs = [];
    for (var i = 0; i < list.length; i++) {
        var times = [];
        for (var k = 0; k < list[i].keys.length; k++) times.push(list[i].prop.keyTime(list[i].keys[k]));
        refs.push({ ref: mt_propRef(list[i].prop), times: times });
    }
    $.global.MT_AUTOCLIP = { comp: comp.id, compName: comp.name, refs: refs, stamp: new Date().getTime() };
}

function mt_resolveAuto(A) {
    var entries = [];
    for (var i = 0; i < A.refs.length; i++) {
        var p = mt_propGet(A.refs[i].ref);
        if (!p) continue;
        var keys = [];
        for (var k = 0; k < A.refs[i].times.length; k++) { var ix = inflect_keyAt(p, A.refs[i].times[k]); if (ix) keys.push(ix); }
        if (keys.length) entries.push({ prop: p, keys: keys });
    }
    if (!entries.length) return null;
    var c = mt_keysClip(entries);
    return { mode: "keys", items: c.items, layers: c.layers, comp: A.comp, compName: A.compName, t0: c.t0, stamp: A.stamp, auto: true };
}

function inflect_clipCopy() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var props = comp.selectedProperties, items = [], layerIds = [], mode = "keys", t0 = 1e12, i, k;
    var lix = function (L) { for (var a = 0; a < layerIds.length; a++) if (layerIds[a] === L.id) return a; layerIds.push(L.id); return layerIds.length - 1; };
    var kc = mt_keysClip(inflect_selectedKeyedProps(comp));
    if (kc.items.length) { items = kc.items; t0 = kc.t0; for (i = 0; i < kc.layers; i++) layerIds.push(i); }
    if (!items.length) {
        mode = "values";
        for (i = 0; i < props.length; i++) {
            var q = props[i];
            if (q.propertyType !== PropertyType.PROPERTY) continue;
            try { if (q.propertyValueType === PropertyValueType.NO_VALUE) continue; } catch (e5) {}
            var Lq = q.propertyGroup(q.propertyDepth);
            try { items.push({ path: mt_pathOf(q), name: q.name, layer: lix(Lq), v: q.valueAtTime(comp.time, true) }); } catch (e6) {}
        }
    }
    if (!items.length) {
        mode = "transform";
        var sel = comp.selectedLayers;
        if (!sel.length) return inflect_err("Seleziona dei keyframe, delle propriet\u00e0 o dei layer da copiare.");
        var mns = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity"];
        for (i = 0; i < sel.length; i++) {
            var tr = sel[i].property("ADBE Transform Group");
            for (k = 0; k < mns.length; k++) {
                var pp = tr.property(mns[k]);
                if (!pp) continue;
                try { if (pp.dimensionsSeparated) continue; } catch (e7) {}
                items.push({ path: mt_pathOf(pp), name: pp.name, layer: lix(sel[i]), v: pp.valueAtTime(comp.time, true) });
            }
        }
    }
    if (mode !== "keys") t0 = comp.time;
    $.global.MT_CLIP = { mode: mode, items: items, layers: layerIds.length, comp: comp.id, compName: comp.name, t0: t0, stamp: new Date().getTime() };
    $.global.MT_MOMENT = { id: comp.id, name: comp.name, t: t0, fps: 1 / comp.frameDuration };
    var nk = 0, names = [];
    for (i = 0; i < items.length; i++) { if (items[i].keys) nk += items[i].keys.length; if (names.length < 3) names.push(items[i].name); }
    return inflect_ok({ mode: mode, props: items.length, keys: nk, layers: layerIds.length, names: names, comp: comp.name, t0: t0, fps: 1 / comp.frameDuration });
}

/** where: "same" (stesso momento, anche in un'altra precomposizione) o "cti" (indicatore del tempo). */
function inflect_clipPaste(where) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var CL = $.global.MT_CLIP, AU = $.global.MT_AUTOCLIP;
    // Gli ultimi keyframe selezionati valgono come copiati, se sono pi\u00f9 recenti dell'ultima copia.
    if (AU && (!CL || AU.stamp > CL.stamp)) { var R = mt_resolveAuto(AU); if (R) CL = R; }
    if (!CL) return inflect_err("Seleziona dei keyframe (o premi Copia), poi seleziona i layer su cui incollarli.");
    var targets = comp.selectedLayers;
    if (!targets.length) return inflect_err("Seleziona i layer su cui incollare.");
    var base = comp.time, notes = [];
    if (CL.mode === "keys" && where === "same") {
        var r = mt_mapTime(CL.comp, CL.t0, comp.id);
        if (r) { base = r.t; if (!r.strict) notes.push("Il momento cade fuori dalla durata della precomposizione."); }
        else notes.push(comp.name + " non \u00e8 collegata a " + CL.compName + ": incollato all'indicatore del tempo.");
    }
    var done = 0, missing = 0;
    mt_begin("Motion Tools: incolla");
    try {
        for (var ti = 0; ti < targets.length; ti++) {
            var T = targets[ti], srcLayer = CL.layers > 1 ? ti % CL.layers : 0;
            for (var i = 0; i < CL.items.length; i++) {
                var it = CL.items[i];
                if (it.layer !== srcLayer) continue;
                var dst = mt_resolvePath(T, it.path);
                if (!dst) { missing++; continue; }
                try {
                    if (CL.mode === "keys") {
                        for (var k = 0; k < it.keys.length; k++) {
                            var K = it.keys[k], tt = base + (K.t - CL.t0);
                            dst.setValueAtTime(tt, mt_fitValue(K.v, dst));
                            var j = dst.nearestKeyIndex(tt);
                            try { if (K.ii) dst.setInterpolationTypeAtKey(j, K.ii, K.oi); } catch (e1) {}
                            try { if (K.ie && K.ie.length === dst.keyInTemporalEase(j).length) dst.setTemporalEaseAtKey(j, K.ie, K.oe); } catch (e2) {}
                            try { if (K.tc !== undefined) { dst.setTemporalContinuousAtKey(j, K.tc); dst.setTemporalAutoBezierAtKey(j, K.ta); } } catch (e3) {}
                            if (it.spatial && K.ist) {
                                try { dst.setSpatialTangentsAtKey(j, mt_fitValue(K.ist, dst), mt_fitValue(K.ost, dst)); dst.setSpatialContinuousAtKey(j, K.sc); dst.setSpatialAutoBezierAtKey(j, K.sa); } catch (e4) {}
                                try { dst.setRovingAtKey(j, K.rv); } catch (e5) {}
                            }
                        }
                    } else {
                        var v = mt_fitValue(it.v, dst);
                        if (dst.numKeys > 0) dst.setValueAtTime(comp.time, v); else dst.setValue(v);
                    }
                    done++;
                } catch (eP) { missing++; }
            }
        }
        mt_end();
    } catch (e) { mt_end(); return inflect_err("Incolla non riuscito: " + e.toString()); }
    if (missing) notes.push(missing + (missing === 1 ? " propriet\u00e0 non trovata" : " propriet\u00e0 non trovate") + " sui layer di destinazione.");
    return inflect_ok({ mode: CL.mode, props: done, base: base, notes: notes, fps: 1 / comp.frameDuration, auto: !!CL.auto, from: CL.compName });
}

function inflect_clipInfo() {
    var CL = $.global.MT_CLIP, M = $.global.MT_MOMENT;
    return inflect_ok({ clip: CL ? { mode: CL.mode, props: CL.items.length, comp: CL.compName } : null, moment: M || null });
}

