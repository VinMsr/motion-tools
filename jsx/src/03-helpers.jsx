/* --------------------------------------------------------------- helpers -- */

var INFLECT_LAST_COMP = 0;

/*
 * Composizione su cui lavorare. Quando il fuoco passa al pannello o al pannello Progetto,
 * After Effects puo' non indicare piu' una composizione attiva: si usa l'ultima vista.
 */
function inflect_activeComp() {
    if (!app.project) return null;
    var item = null;
    try { item = app.project.activeItem; } catch (e) {}
    if (item && item instanceof CompItem) { INFLECT_LAST_COMP = item.id; return item; }
    if (INFLECT_LAST_COMP) {
        try {
            var c = app.project.itemByID(INFLECT_LAST_COMP);
            if (c && c instanceof CompItem) return c;
        } catch (e2) {}
    }
    return null;
}

function inflect_isNumericType(pvt) {
    return pvt === PropertyValueType.OneD ||
        pvt === PropertyValueType.TwoD ||
        pvt === PropertyValueType.ThreeD ||
        pvt === PropertyValueType.TwoD_SPATIAL ||
        pvt === PropertyValueType.ThreeD_SPATIAL ||
        pvt === PropertyValueType.COLOR;
}

function inflect_isSpatial(prop) {
    var pvt = prop.propertyValueType;
    return pvt === PropertyValueType.TwoD_SPATIAL || pvt === PropertyValueType.ThreeD_SPATIAL;
}

function inflect_toArray(v) { return (v instanceof Array) ? v : [v]; }

function inflect_easeDims(prop) {
    if (!inflect_isNumericType(prop.propertyValueType)) return 1;
    if (inflect_isSpatial(prop)) return 1;
    var v = prop.keyValue(1);
    return (v instanceof Array) ? v.length : 1;
}

function inflect_lerpValue(a, b, k) {
    if (a instanceof Array) {
        var out = [];
        for (var i = 0; i < a.length; i++) out.push(a[i] + (b[i] - a[i]) * k);
        return out;
    }
    return a + (b - a) * k;
}

function inflect_clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

function inflect_sortNum(a, b) { return a - b; }

/** Propriet\u00e0 animate con almeno un keyframe selezionato. */
function inflect_selectedKeyedProps(comp) {
    var out = [];
    var props = comp.selectedProperties;
    for (var i = 0; i < props.length; i++) {
        var p = props[i];
        if (p.propertyType !== PropertyType.PROPERTY) continue;
        if (!p.canVaryOverTime || p.numKeys < 1) continue;
        var sel = p.selectedKeys;
        if (!sel || sel.length < 1) continue;
        var copy = [];
        for (var j = 0; j < sel.length; j++) copy.push(sel[j]);
        copy.sort(inflect_sortNum);
        out.push({ prop: p, keys: copy });
    }
    return out;
}

function inflect_frameRound(comp, t) {
    var fd = comp.frameDuration;
    return Math.round(t / fd) * fd;
}


/*
 * Layer per ID. Project.layerByID esiste da After Effects 22.0 (2022): nelle versioni precedenti, o se
 * l'ID non e' valido, si cerca nei layer di tutte le composizioni. Restituisce null se non c'e'.
 */
function mt_layerById(id) {
    try { if (typeof app.project.layerByID === "function") { var L = app.project.layerByID(id); if (L) return L; } } catch (e) {}
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!(it instanceof CompItem)) continue;
        for (var k = 1; k <= it.numLayers; k++) { try { if (it.layer(k).id === id) return it.layer(k); } catch (e2) {} }
    }
    return null;
}
