/* -------------------------------------------------------- effetti -- */

function mt_matchName(kind) {
    return { sl: "ADBE Slider Control", p3: "ADBE Point3D Control", p2: "ADBE Point Control", cb: "ADBE Checkbox Control",
        an: "ADBE Angle Control", dd: "ADBE Dropdown Control", ly: "ADBE Layer Control", cl: "ADBE Color Control" }[kind];
}

/** Aggiunge un controllo espressione con nome e valore, e restituisce la proprieta' valore. */
function mt_fx(layer, kind, name, value, items) {
    var parade = layer.property("ADBE Effect Parade");
    var done = false, matchName = mt_matchName(kind);
    if (kind === "dd") {
        var before = parade.numProperties;
        try {
            var dd = parade.addProperty(matchName);
            var menu = dd.property(1).setPropertyParameters(items);
            menu.propertyGroup(1).name = name;
            done = true;
        } catch (e) {
            // Versioni senza menu a discesa: un cursore con lo stesso significato (1, 2, 3...).
            try { while (parade.numProperties > before) parade.property(parade.numProperties).remove(); } catch (e2) {}
            matchName = "ADBE Slider Control";
        }
    }
    if (!done) {
        var fx = parade.addProperty(matchName);
        fx.name = name;
    }
    var p = layer.property("ADBE Effect Parade").property(name).property(1);
    if (value !== undefined && value !== null && !(kind === "ly" && !value)) p.setValue(value);
    return p;
}

function mt_fxProp(layer, name) {
    try {
        var fx = layer.property("ADBE Effect Parade").property(name);
        return fx ? fx.property(1) : null;
    } catch (e) { return null; }
}

function mt_get(layer, name) {
    var p = mt_fxProp(layer, name);
    if (!p) return null;
    var v = p.value;
    if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(v[i]); return a; }
    return v;
}

/** Imposta un valore: se la proprieta' e' animata, mette un keyframe al tempo corrente. */
function mt_set(layer, name, value, t) {
    var p = mt_fxProp(layer, name);
    if (!p) return false;
    if (p.numKeys > 0) p.setValueAtTime(t, value); else p.setValue(value);
    return true;
}

