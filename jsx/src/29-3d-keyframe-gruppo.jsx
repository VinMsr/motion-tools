/* ------------------------------------------- 3D, keyframe, gruppo -- */

function mt_allCtrls(comp) {
    var out = [];
    for (var i = 1; i <= comp.numLayers; i++) if (mt_isCtrl(comp.layer(i))) out.push(comp.layer(i));
    return out;
}

/** Passa un Cloner esistente in 3D (o in 2D): controllo, copie e falloff collegati. */
function mt_make3D(comp, ctrl, on) {
    ctrl.threeDLayer = on;
    var clones = mt_clones(comp, ctrl), cn = ctrl.name;
    for (var i = 0; i < clones.length; i++) {
        var c = clones[i].layer;
        c.threeDLayer = on;
        if (on) {
            var tr = c.property("ADBE Transform Group");
            try { tr.property("ADBE Rotate X").expression = mt_expr("rotationX", cn); } catch (eX) {}
            try { tr.property("ADBE Rotate Y").expression = mt_expr("rotationY", cn); } catch (eY) {}
        }
    }
    var nb = Math.round(mt_get(ctrl, "Comportamenti") || 0);
    for (var k = 1; k <= nb; k++) {
        var fi = mt_get(ctrl, "B" + k + " Falloff");
        if (fi) { try { comp.layer(fi).threeDLayer = on; } catch (eF) {} }
    }
    if (on) {
        var st = mt_get(ctrl, "Passo");
        if (st && !st[2] && Math.round(mt_get(ctrl, "Distribuzione")) === 2) mt_set(ctrl, "Passo", [st[0], st[1], st[0]], comp.time);
    }
}

var MT_TPROPS = {
    "Posizione": "ADBE Position", "Rotazione X": "ADBE Rotate X", "Rotazione Y": "ADBE Rotate Y",
    "Rotazione Z": "ADBE Rotate Z", "Scala": "ADBE Scale"
};

/**
 * Proprieta' raggiungibili dal pannello:
 *  ctrl   effetto del controllo     ctrlT  trasformazione del controllo (gruppo)
 *  fall   effetto di un falloff     fallT  trasformazione di un falloff
 */
function mt_resolve(comp, ctrl, target, idx, name) {
    if (target === "ctrl") return ctrl ? mt_fxProp(ctrl, name) : null;
    var L = target.indexOf("ctrl") === 0 ? ctrl : comp.layer(idx);
    if (!L) return null;
    if (target === "fall") return mt_fxProp(L, name);
    var mn = MT_TPROPS[name];
    if (!mn) return null;
    if (mn === "ADBE Rotate Z" && !L.threeDLayer) mn = "ADBE Rotate Z";
    return L.property("ADBE Transform Group").property(mn);
}

function mt_keyAt(p, t) {
    if (!p || p.numKeys < 1) return 0;
    var k = p.nearestKeyIndex(t);
    return Math.abs(p.keyTime(k) - t) < 1e-4 ? k : 0;
}

function mt_anim(p, t) { return p ? [p.numKeys > 0 ? 1 : 0, mt_keyAt(p, t) ? 1 : 0] : [0, 0]; }

/** Imposta un valore di una trasformazione (gruppo o falloff). */
function inflect_repeatTSet(target, idx, name, valueJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    try {
        var p = mt_resolve(comp, ctrl, target, idx, name), v = inflect_parse(valueJSON);
        if (!p) return inflect_err("Propriet\u00e0 non trovata.");
        if (name === "Scala" && !(v instanceof Array)) v = [v, v, v];
        if (name === "Posizione" && v instanceof Array && v.length === 2 && p.value.length === 3) v = [v[0], v[1], p.value[2]];
        mt_begin("Motion Tools: " + name);
        if (p.numKeys > 0) p.setValueAtTime(comp.time, v); else p.setValue(v);
        if (ctrl) mt_syncTime(comp, ctrl);
        mt_end();
        return inflect_ok({});
    } catch (e) { try { mt_end(); } catch (e2) {} return inflect_err(e.toString()); }
}

/**
 * Rombo del keyframe, come in After Effects: senza animazione la avvia, su un keyframe
 * lo toglie, altrove ne aggiunge uno con il valore attuale.
 */
function inflect_repeatKey(target, idx, name) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    try {
        var p = mt_resolve(comp, ctrl, target, idx, name), t = comp.time, state;
        if (!p) return inflect_err("Propriet\u00e0 non trovata.");
        mt_begin("Motion Tools: keyframe " + name);
        var k = mt_keyAt(p, t);
        if (k) { p.removeKey(k); state = "tolto"; }
        else {
            p.setValueAtTime(t, p.valueAtTime(t, true));
            var nk = mt_keyAt(p, t);
            // Easy Ease sui keyframe nuovi, come farebbe un motion designer.
            try {
                var dims = 1, v = p.value;
                if (v instanceof Array && !(p.propertyValueType === PropertyValueType.TwoD_SPATIAL || p.propertyValueType === PropertyValueType.ThreeD_SPATIAL)) dims = v.length;
                var ease = [];
                for (var d = 0; d < dims; d++) ease.push(new KeyframeEase(0, 33.33));
                if (p.propertyValueType !== PropertyValueType.NO_VALUE) p.setTemporalEaseAtKey(nk, ease, ease);
            } catch (eE) {}
            state = "aggiunto";
        }
        if (ctrl && target === "ctrl" && MT_COUNT_PARAMS[name]) {
            var nn = mt_countFor(ctrl);
            if (nn <= MT_MAX && nn !== mt_clones(comp, ctrl).length) mt_syncClones(comp, ctrl, nn);
        }
        if (ctrl) mt_syncTime(comp, ctrl);
        mt_end();
        return inflect_ok({ state: state, keys: p.numKeys });
    } catch (e) { try { mt_end(); } catch (e2) {} return inflect_err(e.toString()); }
}

/** Stato dei keyframe (animato, keyframe al tempo corrente) di tutto quello che il pannello mostra. */
function mt_animMap(comp, ctrl, falloffs) {
    var t = comp.time, out = { ctrl: {}, ctrlT: {}, fall: {} }, k, i;
    for (k = 0; k < MT_PARAMS.length; k++) out.ctrl[MT_PARAMS[k][0]] = mt_anim(mt_fxProp(ctrl, MT_PARAMS[k][0]), t);
    var nb = Math.round(mt_get(ctrl, "Comportamenti") || 0);
    for (i = 1; i <= nb; i++) for (k = 0; k < MT_BPARAMS.length; k++) {
        var nm = "B" + i + " " + MT_BPARAMS[k][0];
        out.ctrl[nm] = mt_anim(mt_fxProp(ctrl, nm), t);
    }
    for (var n in MT_TPROPS) if (MT_TPROPS.hasOwnProperty(n)) { try { out.ctrlT[n] = mt_anim(mt_resolve(comp, ctrl, "ctrlT", 0, n), t); } catch (e) {} }
    for (i = 0; i < falloffs.length; i++) {
        var F = comp.layer(falloffs[i].index), m = {};
        for (k = 0; k < MT_FPARAMS.length; k++) m[MT_FPARAMS[k][0]] = mt_anim(mt_fxProp(F, MT_FPARAMS[k][0]), t);
        m["Posizione"] = mt_anim(F.property("ADBE Transform Group").property("ADBE Position"), t);
        out.fall[falloffs[i].index] = m;
    }
    return out;
}

function mt_groupValues(ctrl) {
    var tr = ctrl.property("ADBE Transform Group"), o = {};
    o["Rotazione Z"] = tr.property("ADBE Rotate Z").value;
    if (ctrl.threeDLayer) { o["Rotazione X"] = tr.property("ADBE Rotate X").value; o["Rotazione Y"] = tr.property("ADBE Rotate Y").value; }
    o["Scala"] = tr.property("ADBE Scale").value[0];
    return o;
}

