/* --------------------------------------------------------- falloff -- */

/** Crea un falloff vicino al Cloner; se k > 0 lo collega subito a quel comportamento. */
function inflect_falloffCreate(form, k) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    mt_begin("Motion Tools: crea falloff");
    try {
        var F = comp.layers.addShape();
        F.name = mt_uniqueName(comp, "Falloff");
        F.comment = MT_FALLOFF_TAG + (ctrl ? " " + ctrl.id : "");
        // Mai nell'export: livello guida e di regolazione. Un livello di regolazione non mostra il proprio
        // contenuto, quindi il contorno si vede solo selezionando il falloff (o con "Contorno" dal pannello).
        F.guideLayer = true;
        F.adjustmentLayer = true;
        F.label = 2;
        if (ctrl && ctrl.threeDLayer) F.threeDLayer = true;
        for (var j = 0; j < MT_FPARAMS.length; j++) {
            var P = MT_FPARAMS[j];
            mt_fx(F, P[1], P[0], P[0] === "Forma" ? Math.max(1, Math.round(form || 1)) : P[2], MT_LISTS[P[0]]);
        }
        var root = F.property("ADBE Root Vectors Group");
        // Area piena (linea continua) e fine della sfumatura (linea sottile, piu' trasparente).
        var outer = 'var s = effect("Dimensione")(1).value, k = 1 + effect("Morbidezza")(1).value / 100; [s[0] * k, s[1] * k]';
        var inner = 'effect("Dimensione")(1).value';
        var shapes = [["Cerchio", "ADBE Vector Shape - Ellipse", "ADBE Vector Ellipse Size", 'Math.round(effect("Forma")(1).value) == 1 ? 100 : 0', inner, 2],
                      ["Rettangolo", "ADBE Vector Shape - Rect", "ADBE Vector Rect Size", 'Math.round(effect("Forma")(1).value) == 2 ? 100 : 0', inner, 2],
                      ["Sfumatura cerchio", "ADBE Vector Shape - Ellipse", "ADBE Vector Ellipse Size", 'Math.round(effect("Forma")(1).value) == 1 ? 45 : 0', outer, 1],
                      ["Sfumatura rettangolo", "ADBE Vector Shape - Rect", "ADBE Vector Rect Size", 'Math.round(effect("Forma")(1).value) == 2 ? 45 : 0', outer, 1],
                      ["Lineare", "ADBE Vector Shape - Rect", "ADBE Vector Rect Size", 'Math.round(effect("Forma")(1).value) == 3 ? 100 : 0', inner, 2]];
        for (var s = 0; s < shapes.length; s++) {
            var grp = root.addProperty("ADBE Vector Group");
            grp.name = shapes[s][0];
            var idx = grp.propertyIndex;
            var vg = root.property(idx).property("ADBE Vectors Group");
            vg.addProperty(shapes[s][1]);
            vg = root.property(idx).property("ADBE Vectors Group");
            vg.addProperty("ADBE Vector Graphic - Stroke");
            vg = root.property(idx).property("ADBE Vectors Group");
            vg.property(shapes[s][1]).property(shapes[s][2]).expression = shapes[s][4];
            vg.property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Color").setValue([0.42, 0.66, 1, 1]);
            vg.property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(shapes[s][5]);
            root.property(idx).property("ADBE Vector Transform Group").property("ADBE Vector Group Opacity").expression = shapes[s][3];
        }
        if (ctrl) {
            try {
                if (!ctrl.parent) {
                    var tg = ctrl.property("ADBE Transform Group");
                    var cpv = tg.property("ADBE Position").value, cap = tg.property("ADBE Anchor Point").value, csc = tg.property("ADBE Scale").value;
                    var B = null;
                    try { B = mt_clonerBounds(comp, ctrl); } catch (eB) { B = null; }
                    var cx = B ? (B.l + B.r) / 2 : cap[0], cy = B ? (B.t + B.b) / 2 : cap[1];
                    // Al centro delle copie (rotazione del controllo ignorata: e' solo il punto di partenza).
                    F.property("ADBE Transform Group").property("ADBE Position").setValue([cpv[0] + (cx - cap[0]) * csc[0] / 100, cpv[1] + (cy - cap[1]) * csc[1] / 100, ctrl.threeDLayer ? cpv[2] : 0]);
                    // Area piena su circa un terzo delle copie: si vede subito, e la sfumatura arriva oltre.
                    if (B) {
                        var side = Math.max(B.r - B.l, B.b - B.t) * Math.abs(csc[0]) / 100;
                        var d0 = Math.max(80, Math.round(side * 0.35));
                        mt_set(F, "Dimensione", [d0, d0], comp.time);
                    }
                }
                F.outPoint = ctrl.outPoint; F.inPoint = ctrl.inPoint;
            } catch (eT) {}
            F.moveBefore(ctrl);
            if (k > 0) mt_set(ctrl, "B" + k + " Falloff", F.index, comp.time);
        }
        var name = F.name;
        mt_end();
        return inflect_ok({ name: name, index: F.index });
    } catch (e) { mt_end(); return inflect_err("Falloff non creato: " + e.toString() + (e.line ? " (riga " + e.line + ")" : "")); }
}

/** Imposta un parametro di un falloff (indice del layer nella composizione). */
function inflect_falloffSet(index, name, valueJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    try {
        var F = comp.layer(index);
        if (!mt_isFalloff(F)) return inflect_err("Il layer non \u00e8 un falloff.");
        mt_begin("Motion Tools: falloff " + name);
        // Parametro nuovo (per esempio Profondita') su un falloff fatto con una versione precedente.
        if (!mt_fxProp(F, name)) { for (var q = 0; q < MT_FPARAMS.length; q++) if (MT_FPARAMS[q][0] === name) mt_fx(F, MT_FPARAMS[q][1], name, MT_FPARAMS[q][2], MT_LISTS[name]); }
        mt_set(F, name, inflect_parse(valueJSON), comp.time);
        var cs = mt_allCtrls(comp);
        for (var c = 0; c < cs.length; c++) mt_syncTime(comp, cs[c]);
        mt_end();
        return inflect_ok({});
    } catch (e) { try { mt_end(); } catch (e2) {} return inflect_err(e.toString()); }
}

function inflect_falloffSelect(index) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    try {
        for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
        comp.layer(index).selected = true;
        return inflect_ok({});
    } catch (e) { return inflect_err(e.toString()); }
}


/*
 * Collega un falloff a una proprieta' delle copie: un comportamento Valore con quel falloff.
 * dest: 7 Scala, 8 Opacita', 4 Rotazione, 1/2/3 Posizione, 10 Colore. amount: quanto cambia al
 * centro del falloff (Scala e Opacita' in %, Rotazione in gradi, Posizione in px, Colore in %).
 */
function inflect_falloffLink(fIndex, dest, amount, colorJSON) {
    var color = null;
    try { color = colorJSON ? inflect_parse(colorJSON) : null; } catch (e0) {}
    // Un solo passo di annullamento per collegamento e verifica.
    mt_begin("Motion Tools: collega falloff");
    var res = inflect_repeatAddBehaviour(inflect_stringify({ tipo: 5, dest: dest, min: 0, max: amount, fall: fIndex, color: color || undefined, push: Math.round(dest) === 7 }));
    try {
        var r = inflect_parse(res);
        if (r && r.ok && r.k) { r.check = mt_fallCheck(r.k); res = inflect_stringify(r); }
    } catch (eC) {}
    mt_end();
    return res;
}

/*
 * Chiede ad After Effects cosa ha calcolato davvero: legge il valore delle copie dopo l'espressione
 * (valueAtTime con preExpression = false) e l'errore dell'espressione (expressionError).
 * Se nessuna copia cambia, prova il falloff su una copia senza nascondere gli errori.
 */
function inflect_falloffCheck(k) {
    // La prova aggiunge e toglie un controllo temporaneo: un solo passo di annullamento.
    mt_begin("Motion Tools: verifica falloff");
    try { var c = mt_fallCheck(k); mt_end(); return inflect_ok({ check: c }); } catch (e) { mt_end(); return inflect_err(e.toString()); }
}

function mt_fallCheck(k) {
    var out = { total: 0, affected: 0, error: "" };
    var comp = inflect_activeComp(), ctrl = comp ? mt_findCtrl(comp) : null;
    if (!ctrl) return out;
    var pre = "B" + k + " ";
    var dst = Math.round(mt_get(ctrl, pre + "Destinazione") || 0);
    var name = dst <= 3 ? "MT Pos" : (dst <= 6 ? "MT Rot" : (dst <= 9 ? "MT Extra" : "MT Peso colore"));
    var comp1 = dst <= 3 ? dst - 1 : (dst <= 6 ? dst - 4 : (dst <= 9 ? dst - 7 : 3));
    var cl = mt_clones(comp, ctrl), t = comp.time;
    out.total = cl.length;
    for (var i = 0; i < cl.length; i++) {
        var p = mt_fxProp(cl[i].layer, name);
        if (!p) continue;
        try {
            if (p.expressionError && !out.error) out.error = cl[i].layer.name + ": " + p.expressionError;
            var v = p.valueAtTime(t, false);
            if (Math.abs(v[comp1]) > 0.0001) out.affected++;
        } catch (eV) {}
    }
    if (out.affected > 0 || out.error || !cl.length) return out;
    // Nessuna copia cambia: prova vera su una copia, con un controllo temporaneo.
    var c = cl[Math.floor(cl.length / 2)].layer, tmp = null;
    try {
        var parade = c.property("ADBE Effect Parade");
        tmp = parade.addProperty("ADBE Point3D Control");
        tmp.name = "MT Prova falloff";
        var tp = tmp.property(1);
        try { tp.expression = mt_expr("fallTest", ctrl.name, k); } catch (eE) { out.error = "Espressione di prova: " + eE.toString(); }
        if (!out.error && tp.expressionError) out.error = tp.expressionError;
        if (!out.error) {
            var w = tp.valueAtTime(t, false);
            out.weight = w[0];
            out.fallIndex = w[1];
        }
    } catch (eT) { out.error = out.error || eT.toString(); }
    try { if (tmp) tmp.remove(); } catch (eR) {}
    return out;
}

/* Contorno del falloff visibile nella composizione (on) o nascosto; nell'export non c'e' mai. */
function inflect_falloffOutline(index, on) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    try {
        var F = comp.layer(index);
        if (!mt_isFalloff(F)) return inflect_err("Il layer non è un falloff.");
        mt_begin("Motion Tools: contorno del falloff");
        F.guideLayer = true;
        F.adjustmentLayer = !(on === true || on === "true" || on === 1);
        mt_end();
        return inflect_ok({ outline: !F.adjustmentLayer });
    } catch (e) { mt_end(); return inflect_err(e.toString()); }
}

/* Versione 7: i falloff esistenti diventano invisibili nell'export (prima avevano il contorno visibile). */
function mt_upgradeV7(ctrl) {
    var meta = mt_meta(ctrl);
    if (meta.ver >= 7) return;
    var comp = ctrl.containingComp;
    for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        if (!mt_isFalloff(L)) continue;
        try { L.guideLayer = true; L.adjustmentLayer = true; if (ctrl.threeDLayer) L.threeDLayer = true; } catch (e) {}
    }
    meta.ver = 7;
    mt_writeMeta(ctrl, meta);
}
