/* ----------------------------------------------------- input: stile -- */
/*
 * Ogni input ha la sua scala e, se e' un vettoriale (livello forma o testo), il suo colore.
 * I valori stanno sul controllo come "I<n> Scala", "I<n> Colora", "I<n> Colore": si animano
 * come gli altri parametri. Ogni copia sa da quale input viene grazie all'effetto "MT Input".
 */

var MT_IPARAMS = [
    ["Scala", "sl", 100],
    ["Colora", "cb", 0],
    ["Colore", "cl", [1, 1, 1, 1]]
];

/* Colore dell'input sulla copia: un Riempimento che si accende con "Colora". */
MT_X.icolor = [
    'var C = thisComp.layer(@C@), si = 0, c = [1, 1, 1, 1];',
    'try { si = Math.round(effect("MT Input")(1).value); } catch (e0) { si = 0; }',
    'try { c = C.effect("I" + (si + 1) + " Colore")(1).value; } catch (e1) {}',
    'c'
];
MT_X.ion = [
    'var C = thisComp.layer(@C@), si = 0, on = 0;',
    'try { si = Math.round(effect("MT Input")(1).value); } catch (e0) { si = 0; }',
    'try { on = C.effect("I" + (si + 1) + " Colora")(1).value; } catch (e1) { on = 0; }',
    'on ? value : 0'
];

function mt_isVector(L) {
    try { return L instanceof ShapeLayer || L instanceof TextLayer; } catch (e) { return false; }
}

/* Valori degli input 1..n (quelli che mancano hanno i valori di partenza). */
function mt_inputGet(ctrl, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
        var o = {};
        for (var j = 0; j < MT_IPARAMS.length; j++) {
            var v = mt_get(ctrl, "I" + (i + 1) + " " + MT_IPARAMS[j][0]);
            o[MT_IPARAMS[j][0]] = (v === null || v === undefined) ? MT_IPARAMS[j][2] : v;
        }
        out.push(o);
    }
    return out;
}

/* Scrive i valori degli input e toglie i controlli degli input che non ci sono piu'. */
function mt_inputWrite(ctrl, arr) {
    var t = ctrl.containingComp.time, i, j;
    for (i = 0; i < arr.length; i++) {
        for (j = 0; j < MT_IPARAMS.length; j++) {
            var P = MT_IPARAMS[j], name = "I" + (i + 1) + " " + P[0];
            if (!mt_fxProp(ctrl, name)) mt_fx(ctrl, P[1], name, arr[i][P[0]]);
            else mt_set(ctrl, name, arr[i][P[0]], t);
        }
    }
    var parade = ctrl.property("ADBE Effect Parade");
    for (i = arr.length + 1; i <= arr.length + 50; i++) {
        var gone = false;
        for (j = 0; j < MT_IPARAMS.length; j++) {
            var fx = parade.property("I" + i + " " + MT_IPARAMS[j][0]);
            if (fx) { fx.remove(); gone = true; }
        }
        if (!gone) break;
    }
}

/* Effetti dell'input sulla copia: da quale input viene e, per i vettoriali, il colore. */
function mt_cloneInput(c, cn, sIdx, vector) {
    var p = mt_fxProp(c, "MT Input");
    if (!p) p = mt_fx(c, "sl", "MT Input", sIdx);
    else p.setValue(sIdx);
    if (!vector) return;
    var parade = c.property("ADBE Effect Parade");
    if (!parade.property("MT Colore input")) {
        parade.addProperty("ADBE Fill").name = "MT Colore input";
        var F = c.property("ADBE Effect Parade").property("MT Colore input");
        F.property("ADBE Fill-0002").expression = mt_expr("icolor", cn);
        try { F.property("ADBE Effect Built In Params").property("ADBE Effect Mask Opacity").expression = mt_expr("ion", cn); } catch (eO) {}
        // Prima del colore del falloff, cosi' il falloff ci passa sopra.
        var ff = c.property("ADBE Effect Parade").property("MT Colore falloff");
        if (ff) { try { c.property("ADBE Effect Parade").property("MT Colore input").moveTo(ff.propertyIndex); } catch (eM) {} }
    }
}

function mt_srcIsVector(meta, s) {
    try { return mt_isVector(mt_layerById(meta.src[s])); } catch (e) { return false; }
}

/* Versione 6: scala e colore per input. */
function mt_upgradeV6(ctrl) {
    var meta = mt_meta(ctrl);
    if (meta.ver >= 6) return;
    var comp = ctrl.containingComp, cl = mt_clones(comp, ctrl), cn = ctrl.name;
    mt_inputWrite(ctrl, mt_inputGet(ctrl, Math.max(1, meta.src.length)));
    for (var i = 0; i < cl.length; i++) {
        try {
            mt_cloneInput(cl[i].layer, cn, cl[i].s, mt_srcIsVector(meta, cl[i].s));
            cl[i].layer.property("ADBE Transform Group").property("ADBE Scale").expression = mt_expr("scale", cn);
        } catch (eC) {}
    }
    meta.ver = 6;
    mt_writeMeta(ctrl, meta);
}

/*
 * Selettore di colore di After Effects. $.colorPicker (ExtendScript Tools Guide) apre il selettore
 * del sistema e restituisce il colore come 0xRRGGBB, oppure -1 se annulli.
 */
function inflect_pickColor(hex) {
    try {
        var start = parseInt(String(hex || "#FFFFFF").replace("#", ""), 16);
        if (isNaN(start)) start = 0xFFFFFF;
        var c = $.colorPicker(start);
        if (c === -1 || c === undefined || c === null) return inflect_ok({ cancelled: true });
        var s = (c & 0xFFFFFF).toString(16).toUpperCase();
        while (s.length < 6) s = "0" + s;
        return inflect_ok({ hex: "#" + s });
    } catch (e) { return inflect_err("Selettore di colore non disponibile: " + e); }
}
