/* ------------------------------------------------------- modifiche -- */

var MT_COUNT_PARAMS = { "Quantit\u00e0": 1, "Colonne": 1, "Righe": 1, "Livelli": 1, "Distribuzione": 1 };

/** Imposta un parametro del controllo. Numero copie e distribuzione aggiornano anche i layer. */
function inflect_repeatSet(name, valueJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var v;
    try { v = inflect_parse(valueJSON); } catch (e0) { return inflect_err("Valore non valido."); }
    mt_begin("Motion Tools: " + name);
    try {
        mt_upgrade(ctrl);
        if (name === "threeD") {
            mt_make3D(comp, ctrl, !!v);
        } else if (name === "pick" || name === "front") {
            var meta = mt_meta(ctrl);
            meta[name] = String(v);
            mt_writeMeta(ctrl, meta);
            if (name === "front") mt_order(ctrl, mt_clones(comp, ctrl), meta.front);
            else {
                // Cambia l'alternanza degli input: si rifanno tutte le copie.
                mt_rebuildClones(comp, ctrl);
            }
        } else {
            var prevMode = Math.round(mt_get(ctrl, "Distribuzione"));
            // Parametro di un comportamento creato da una versione precedente: si aggiunge ora.
            var bm = /^B(\d+) (.+)$/.exec(name);
            if (bm && !mt_fxProp(ctrl, name)) {
                for (var bq = 0; bq < MT_BPARAMS.length; bq++) if (MT_BPARAMS[bq][0] === bm[2]) mt_fx(ctrl, MT_BPARAMS[bq][1], name, MT_BPARAMS[bq][2], MT_LISTS[bm[2]]);
            }
            var imt = /^I(\d+) (.+)$/.exec(name);
            if (imt && !mt_fxProp(ctrl, name)) {
                for (var iq = 0; iq < MT_IPARAMS.length; iq++) if (MT_IPARAMS[iq][0] === imt[2]) mt_fx(ctrl, MT_IPARAMS[iq][1], name, MT_IPARAMS[iq][2]);
            }
            if (!mt_set(ctrl, name, v, comp.time)) throw new Error("Parametro sconosciuto: " + name);
            // Da Griglia a Lineare il passo Y della griglia farebbe una diagonale: la riga torna orizzontale.
            if (name === "Distribuzione" && Math.round(v) !== prevMode) mt_adaptStep(ctrl, prevMode, Math.round(v), comp.time);
            if (name === "Modo misura" && Math.round(v) === 3) mt_set(ctrl, "Dimensione copia", mt_measureSources(ctrl), comp.time);
            // Scala di un input con la misura Distanza: lo spazio tra le copie tiene conto della misura nuova.
            if (imt && imt[2] === "Scala" && Math.round(mt_get(ctrl, "Modo misura")) === 3) mt_set(ctrl, "Dimensione copia", mt_measureSources(ctrl), comp.time);
            if (MT_COUNT_PARAMS[name]) {
                var n = mt_countFor(ctrl);
                if (n > MT_MAX) throw new Error("Troppe copie (" + n + "). Il massimo \u00e8 " + MT_MAX + ".");
                // In griglia la Quantita' e' solo il totale; animata (in lineare) resta com'e'.
                var qp = mt_fxProp(ctrl, "Quantit\u00e0");
                if (Math.round(mt_get(ctrl, "Distribuzione")) === 2 && qp && qp.numKeys === 0) qp.setValue(n);
                mt_syncClones(comp, ctrl, n);
            }
            // Comportamento sul Colore: le copie ricevono il riempimento che lo mostra.
            if (/^B\d+ Destinazione$/.test(name) && Math.round(v) === MT_DEST_COLOR) mt_ensureColor(comp, ctrl, parseInt(name.substring(1), 10));
        }
        mt_syncTime(comp, ctrl);
        mt_end();
        return inflect_ok({ count: Math.round(mt_get(ctrl, "Quantit\u00e0")) });
    } catch (e) {
        mt_end();
        return inflect_err(e.message || e.toString());
    }
}

/* Colore nei comportamenti: parametro colore del comportamento k e riempimento sulle copie. */
function mt_ensureColor(comp, ctrl, k) {
    if (k && !mt_fxProp(ctrl, "B" + k + " Colore")) mt_fx(ctrl, "cl", "B" + k + " Colore", [1, 0.35, 0.12, 1]);
    var cl = mt_clones(comp, ctrl);
    for (var i = 0; i < cl.length; i++) { try { mt_cloneFallColor(cl[i].layer, ctrl.name); } catch (e) {} }
}

/* Passo coerente con la distribuzione nuova. */
function mt_adaptStep(ctrl, from, to, t) {
    var st = mt_get(ctrl, "Passo") || [0, 0, 0], dc = mt_get(ctrl, "Dimensione copia") || [100, 100, 100];
    if (to === 1) {
        var sx = Math.abs(st[0]) > 0.001 ? st[0] : Math.round(dc[0] * 1.25);
        mt_set(ctrl, "Passo", [sx, 0, 0], t);
        mt_set(ctrl, "Direzione griglia", 1, t);
    } else if (to === 2) {
        var gx = Math.abs(st[0]) > 0.001 ? st[0] : Math.round(dc[0] * 1.25);
        var gy = Math.abs(st[1]) > 0.001 ? st[1] : Math.round(dc[1] * 1.25);
        mt_set(ctrl, "Passo", [gx, gy, ctrl.threeDLayer ? (Math.abs(st[2]) > 0.001 ? st[2] : gx) : 0], t);
    }
}

/** Rimisura le copie (dopo aver cambiato la sorgente o la sua scala). */
function inflect_repeatMeasure() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    mt_begin("Motion Tools: misura le copie");
    try {
        mt_upgrade(ctrl);
        var d = mt_measureSources(ctrl);
        mt_set(ctrl, "Dimensione copia", d, comp.time);
        mt_end();
        return inflect_ok({ size: d });
    } catch (e) { mt_end(); return inflect_err("Misura non riuscita: " + e); }
}

/** Aggiunge un comportamento. o = { tipo, dest, min, max } */
function inflect_repeatAddBehaviour(optsJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var o = inflect_parse(optsJSON);
    mt_begin("Motion Tools: aggiungi comportamento");
    try {
        mt_upgrade(ctrl);
        var k = Math.round(mt_get(ctrl, "Comportamenti") || 0) + 1;
        var vals = { "Tipo": o.tipo || 1, "Destinazione": o.dest || 9, "Min": o.min, "Max": o.max, "Falloff": o.fall || 0, "Colore": o.color, "Mantieni spazi": o.push ? 1 : 0 };
        for (var j = 0; j < MT_BPARAMS.length; j++) {
            var P = MT_BPARAMS[j];
            var val = (vals.hasOwnProperty(P[0]) && vals[P[0]] !== undefined) ? vals[P[0]] : P[2];
            mt_fx(ctrl, P[1], "B" + k + " " + P[0], val, MT_LISTS[P[0]]);
        }
        mt_fxProp(ctrl, "Comportamenti").setValue(k);
        if (Math.round(vals["Destinazione"]) === MT_DEST_COLOR) mt_ensureColor(comp, ctrl, k);
        mt_syncTime(comp, ctrl);
        mt_end();
        return inflect_ok({ k: k });
    } catch (e) { mt_end(); return inflect_err("Comportamento non aggiunto: " + e.toString()); }
}

/** Toglie il comportamento k e rinumera i successivi. */
function inflect_repeatRemoveBehaviour(k) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner.");
    mt_begin("Motion Tools: togli comportamento");
    try {
        var nb = Math.round(mt_get(ctrl, "Comportamenti") || 0), j, q;
        var parade = ctrl.property("ADBE Effect Parade");
        // Prima abbassa il conteggio, cosi' le espressioni non leggono effetti a meta'.
        mt_fxProp(ctrl, "Comportamenti").setValue(nb - 1);
        for (j = 0; j < MT_BPARAMS.length; j++) {
            var fx = parade.property("B" + k + " " + MT_BPARAMS[j][0]);
            if (fx) fx.remove();
        }
        for (q = k + 1; q <= nb; q++) {
            for (j = 0; j < MT_BPARAMS.length; j++) {
                var f2 = parade.property("B" + q + " " + MT_BPARAMS[j][0]);
                if (f2) f2.name = "B" + (q - 1) + " " + MT_BPARAMS[j][0];
            }
        }
        // Le liste dei comportamenti seguono la nuova numerazione.
        var LS = mt_listsGet(ctrl), moved = false;
        if (LS["B" + k]) { delete LS["B" + k]; moved = true; }
        for (q = k + 1; q <= nb; q++) if (LS["B" + q]) { LS["B" + (q - 1)] = LS["B" + q]; delete LS["B" + q]; moved = true; }
        if (moved) mt_listsSet(ctrl, LS);
        mt_syncTime(comp, ctrl);
        mt_end();
        return inflect_ok({});
    } catch (e) { mt_end(); return inflect_err("Comportamento non tolto: " + e.toString()); }
}

