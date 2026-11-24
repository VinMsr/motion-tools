/* ------------------------------------------------------- ricette -- */

function mt_keyEase(p, t, v) {
    p.setValueAtTime(t, v);
    var k = mt_keyAt(p, t);
    var dims = (v instanceof Array) ? v.length : 1, e = [];
    if (p.propertyValueType === PropertyValueType.TwoD_SPATIAL || p.propertyValueType === PropertyValueType.ThreeD_SPATIAL) dims = 1;
    for (var d = 0; d < dims; d++) e.push(new KeyframeEase(0, 75));
    try { p.setTemporalEaseAtKey(k, e, e); } catch (eE) {}
    return k;
}

function mt_clearKeys(p) { if (!p) return; while (p.numKeys > 0) p.removeKey(1); }

function mt_addBeh(ctrl, vals) {
    var k = Math.round(mt_get(ctrl, "Comportamenti") || 0) + 1;
    for (var j = 0; j < MT_BPARAMS.length; j++) {
        var P = MT_BPARAMS[j];
        mt_fx(ctrl, P[1], "B" + k + " " + P[0], vals.hasOwnProperty(P[0]) ? vals[P[0]] : P[2], MT_LISTS[P[0]]);
    }
    mt_fxProp(ctrl, "Comportamenti").setValue(k);
    return k;
}

/**
 * Animazioni pronte, costruite con gli stessi strumenti del pannello:
 *  cascata   le copie entrano una dopo l'altra, con scala e opacita'
 *  pop       come cascata, ma in ordine casuale e con un piccolo rimbalzo
 *  onda      un'onda che attraversa le copie in verticale
 *  anello    anello 3D inclinato che gira, le copie davanti si ingrandiscono
 */
function inflect_repeatRecipe(name) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var t0 = Math.max(comp.time, 0), fd = comp.frameDuration, n = Math.round(mt_get(ctrl, "Quantit\u00e0"));
    mt_begin("Motion Tools: animazione " + name);
    try {
        var sc = mt_fxProp(ctrl, "Trasforma scala"), op = mt_fxProp(ctrl, "Trasforma opacit\u00e0");
        if (name === "cascata" || name === "pop") {
            mt_clearKeys(sc); mt_clearKeys(op);
            mt_keyEase(sc, t0, 0);
            if (name === "pop") { mt_keyEase(sc, t0 + 9 * fd, 112); mt_keyEase(sc, t0 + 15 * fd, 100); }
            else mt_keyEase(sc, t0 + 14 * fd, 100);
            mt_keyEase(op, t0, 0);
            mt_keyEase(op, t0 + 6 * fd, 100);
            var spread = Math.max(10, Math.min(60, Math.round(n * (name === "pop" ? 1.5 : 2))));
            mt_addBeh(ctrl, { "Tipo": 1, "Destinazione": 9, "Min": 0, "Max": spread, "Ordine": name === "pop" ? 5 : 1, "Seme": 1 });
        } else if (name === "onda") {
            mt_addBeh(ctrl, { "Tipo": 4, "Destinazione": 2, "Min": -40, "Max": 40, "Frequenza": 0.6, "Fase": 360 / Math.max(4, Math.min(n, 16)) });
        } else if (name === "anello") {
            if (!ctrl.threeDLayer) mt_make3D(comp, ctrl, true);
            var cnt = Math.max(n, 12);
            mt_set(ctrl, "Distribuzione", 3, t0);
            if (cnt !== n) { mt_set(ctrl, "Quantit\u00e0", cnt, t0); mt_syncClones(comp, ctrl, cnt); }
            mt_set(ctrl, "Piano", 2, t0);
            mt_set(ctrl, "Orienta", 1, t0);
            mt_set(ctrl, "Arco", 360, t0);
            var R = Math.abs(mt_get(ctrl, "Raggio")) || 300;
            var trv = mt_fxProp(ctrl, "Scorrimento");
            mt_clearKeys(trv);
            trv.setValueAtTime(t0, 0);
            trv.setValueAtTime(t0 + 6, 100);
            var rx = ctrl.property("ADBE Transform Group").property("ADBE Rotate X");
            if (rx.numKeys === 0) rx.setValue(-18);
            // Falloff sferico davanti all'anello: le copie che passano davanti crescono.
            var fr = inflect_parse(inflect_falloffCreate(1, 0));
            if (fr.ok) {
                var F = comp.layer(fr.index);
                var cp = ctrl.property("ADBE Transform Group").property("ADBE Position").value;
                F.property("ADBE Transform Group").property("ADBE Position").setValue([cp[0], cp[1], cp[2] - R]);
                mt_set(F, "Dimensione", [R * 1.4, R * 1.4], t0);
                mt_set(F, "Morbidezza", 100, t0);
                mt_addBeh(ctrl, { "Tipo": 5, "Destinazione": 7, "Min": 0, "Max": 80, "Falloff": fr.index });
            }
        } else {
            throw new Error("Animazione sconosciuta.");
        }
        mt_syncTime(comp, ctrl);
        mt_end();
        return inflect_ok({ name: name });
    } catch (e) {
        mt_end();
        return inflect_err("Animazione non creata: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
}


/** Rif\u00e0 tutte le copie partendo dalle sorgenti attuali: serve dopo aver modificato il layer originale. */
function inflect_repeatRebuild() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var meta = mt_meta(ctrl);
    for (var s = 0; s < meta.src.length; s++) {
        var ok = false;
        try { ok = !!mt_layerById(meta.src[s]); } catch (e0) {}
        if (!ok) return inflect_err("Una delle sorgenti del Cloner \u00e8 stata eliminata.");
    }
    mt_begin("Motion Tools: aggiorna copie dalle sorgenti");
    try {
        mt_upgrade(ctrl);
        var clones = mt_clones(comp, ctrl), n = mt_countFor(ctrl);
        for (var i = clones.length - 1; i >= 0; i--) clones[i].layer.remove();
        var count = mt_syncClones(comp, ctrl, n);
        // Le copie nuove possono avere un ingombro diverso: il punto di ancoraggio scelto si ricalcola.
        if (meta.anchorSet) {
            for (var d0 = 1; d0 <= comp.numLayers; d0++) comp.layer(d0).selected = false;
            ctrl.selected = true;
            try { inflect_clonerAnchor(meta.ax, meta.ay); } catch (eA) {}
        }
        for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
        ctrl.selected = true;
        mt_end();
        return inflect_ok({ count: count, name: ctrl.name });
    } catch (e) {
        mt_end();
        return inflect_err("Copie non aggiornate: " + e.toString());
    }
}

