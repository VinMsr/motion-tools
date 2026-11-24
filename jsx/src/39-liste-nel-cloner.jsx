/* ------------------------------------------------- liste nel Cloner -- */

function mt_listsGet(ctrl) {
    try {
        var M = ctrl.property("ADBE Marker");
        for (var k = 1; k <= M.numKeys; k++) {
            var c = M.keyValue(k).comment;
            if (c.indexOf("MT_LISTS ") === 0) return inflect_parse(c.substring(9));
        }
    } catch (e) {}
    return {};
}

function mt_listsSet(ctrl, obj) {
    var M = ctrl.property("ADBE Marker");
    for (var k = M.numKeys; k >= 1; k--) { try { if (M.keyValue(k).comment.indexOf("MT_LISTS ") === 0) M.removeKey(k); } catch (e) {} }
    var mv = new MarkerValue("MT_LISTS " + inflect_stringify(obj));
    M.setValueAtTime(ctrl.inPoint, mv);
}

MT_X.color = [].concat([
    'var C = thisComp.layer(@C@);',
    'var i = Math.round(effect("MT Indice")(1).value);',
    'var n = 1; try { n = Math.round(C.effect("Quantit\u00e0")(1).value); } catch (eN) {}'
], MT_X.lists, [
    'var D = mtLists().colori;',
    'if (!D || !D.v || !D.v.length) value; else {',
    '  var hx = String(D.v[mtPick(D, i, n)]).replace("#", "");',
    '  if (hx.length == 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];',
    '  var c = parseInt(hx, 16);',
    '  [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1];',
    '}'
]);

MT_X.text = [].concat([
    'var C = thisComp.layer(@C@);',
    'var i = Math.round(effect("MT Indice")(1).value);',
    'var n = 1; try { n = Math.round(C.effect("Quantit\u00e0")(1).value); } catch (eN) {}'
], MT_X.lists, [
    'var D = mtLists().testi;',
    '(!D || !D.v || !D.v.length) ? value : String(D.v[mtPick(D, i, n)])'
]);

/** Prepara una copia per colori e testi della lista (chiamata anche alla creazione delle copie). */
function mt_cloneLists(c, ctrl, L) {
    L = L || mt_listsGet(ctrl);
    var cn = ctrl.name;
    var hasC = !!(L.colori && L.colori.v && L.colori.v.length);
    var fx = c.property("ADBE Effect Parade"), fill = fx.property("MT Colore");
    if (hasC && !fill) {
        fx.addProperty("ADBE Fill").name = "MT Colore";
        fill = c.property("ADBE Effect Parade").property("MT Colore");
        fill.property("ADBE Fill-0002").expression = mt_expr("color", cn);
    }
    if (fill) fill.enabled = hasC;
    if (mt_isText(c)) {
        var st = c.property("ADBE Text Properties").property("ADBE Text Document");
        var hasT = !!(L.testi && L.testi.v && L.testi.v.length);
        try { st.expression = hasT ? mt_expr("text", cn) : ""; } catch (e) {}
    }
}

/** key: "B<k>", "colori" o "testi". dataJSON: { v: [...], m, s } oppure null per toglierla. */
function inflect_repeatListSet(key, dataJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var data = inflect_parse(dataJSON);
    mt_begin("Motion Tools: lista");
    try {
        var L = mt_listsGet(ctrl);
        if (data && data.v && data.v.length) L[key] = data; else delete L[key];
        mt_listsSet(ctrl, L);
        if (key === "colori" || key === "testi") {
            var cl = mt_clones(comp, ctrl);
            for (var i = 0; i < cl.length; i++) mt_cloneLists(cl[i].layer, ctrl, L);
        }
        mt_end();
        return inflect_ok({ lists: L });
    } catch (e) { mt_end(); return inflect_err("Lista non salvata: " + e.toString()); }
}

