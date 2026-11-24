/* ----------------------------------------------------------- input -- */
/*
 * Input del Cloner, come la lista Input Shapes del Duplicator di Cavalry: aggiungi, togli,
 * riordina e sostituisci i layer da ripetere. Le copie sono layer veri, quindi dopo ogni
 * cambio si rifanno dalle sorgenti nuove (la sorgente di un layer non cambia con un'espressione).
 */

/* Layer selezionati che possono fare da input: niente controlli, falloff o copie di un Cloner. */
function mt_inputCandidates(comp) {
    var sel = comp.selectedLayers, out = [];
    for (var s = 0; s < sel.length; s++) {
        var L = sel[s];
        if (!inflect_isVisual(L) || mt_isCtrl(L) || mt_isFalloff(L)) continue;
        try { if (L.parent && mt_isCtrl(L.parent)) continue; } catch (eP) {}
        out.push(L);
    }
    return out;
}

/* Rifa tutte le copie con le sorgenti e l'alternanza attuali. */
function mt_rebuildClones(comp, ctrl) {
    var meta = mt_meta(ctrl);
    var clones = mt_clones(comp, ctrl), n = mt_countFor(ctrl);
    for (var i = clones.length - 1; i >= 0; i--) clones[i].layer.remove();
    var count = mt_syncClones(comp, ctrl, n);
    try { if (Math.round(mt_get(ctrl, "Modo misura")) === 3) mt_set(ctrl, "Dimensione copia", mt_measureSources(ctrl), comp.time); } catch (eM) {}
    if (meta.anchorSet) {
        for (var d0 = 1; d0 <= comp.numLayers; d0++) comp.layer(d0).selected = false;
        ctrl.selected = true;
        try { inflect_clonerAnchor(meta.ax, meta.ay); } catch (eA) {}
    }
    for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
    ctrl.selected = true;
    return count;
}

/**
 * action: "add" (layer selezionati in fondo alla lista), "remove", "up", "down",
 * "replace" (con il primo layer selezionato), "select" (seleziona l'input nella composizione).
 */
function inflect_repeatInput(action, idx) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var meta = mt_meta(ctrl), k = Math.round(idx || 0);
    if (action === "select") {
        try {
            var L0 = mt_layerById(meta.src[k]);
            if (!L0) return inflect_err("Questo input non esiste più nella composizione.");
            for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
            L0.selected = true;
            $.global.MT_LASTCTRL = ctrl.id;
            return inflect_ok({ name: L0.name, hidden: !L0.enabled });
        } catch (eS) { return inflect_err(eS.toString()); }
    }
    var cand = (action === "add" || action === "replace") ? mt_inputCandidates(comp) : [];
    if ((action === "add" || action === "replace") && !cand.length) return inflect_err("Seleziona nella composizione il layer da usare come input.");
    if (action === "remove" && meta.src.length <= 1) return inflect_err("Il Cloner ha bisogno di almeno un input.");
    mt_begin("Motion Tools: input del Cloner");
    try {
        mt_upgrade(ctrl);
        meta = mt_meta(ctrl);
        var added = 0, j;
        // Scala e colore seguono il loro input quando la lista cambia.
        var st = mt_inputGet(ctrl, meta.src.length), def = {};
        for (j = 0; j < MT_IPARAMS.length; j++) def[MT_IPARAMS[j][0]] = MT_IPARAMS[j][2];
        if (action === "add") {
            for (j = 0; j < cand.length; j++) {
                var dup = false;
                for (var q = 0; q < meta.src.length; q++) if (meta.src[q] === cand[j].id) dup = true;
                if (dup) continue;
                meta.src.push(cand[j].id);
                st.push(def);
                cand[j].enabled = false;
                added++;
            }
            if (!added) { mt_end(); return inflect_err("I layer selezionati sono già input di questo Cloner."); }
        } else if (action === "remove") {
            meta.src.splice(k, 1);
            st.splice(k, 1);
        } else if (action === "up" || action === "down") {
            var to = action === "up" ? k - 1 : k + 1;
            if (to < 0 || to >= meta.src.length) { mt_end(); return inflect_ok({ count: mt_clones(comp, ctrl).length }); }
            var tmp = meta.src[k]; meta.src[k] = meta.src[to]; meta.src[to] = tmp;
            var ts = st[k]; st[k] = st[to]; st[to] = ts;
        } else if (action === "replace") {
            meta.src[k] = cand[0].id;
            cand[0].enabled = false;
        } else {
            mt_end();
            return inflect_err("Azione sconosciuta: " + action);
        }
        // "Solo un input" che punta oltre la lista: torna sul primo.
        var om = /^only:(\d+)$/.exec(meta.pick);
        if (om && parseInt(om[1], 10) >= meta.src.length) meta.pick = "only:0";
        mt_writeMeta(ctrl, meta);
        mt_inputWrite(ctrl, st);
        var count = mt_rebuildClones(comp, ctrl);
        $.global.MT_LASTCTRL = ctrl.id;
        $.global.MT_PINCTRL = null;
        mt_end();
        return inflect_ok({ count: count, added: added, inputs: meta.src.length });
    } catch (e) {
        mt_end();
        return inflect_err("Input non cambiati: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
}
