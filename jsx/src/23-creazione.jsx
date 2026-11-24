/* ------------------------------------------------------ creazione -- */

/*
 * opts = { mode, count, cols, rows, levels, threeD, front, hide, pick }
 * Tutti i layer selezionati diventano sorgenti, come gli Input Shapes di Cavalry.
 */
function inflect_repeatCreate(optsJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona il layer da ripetere.");
    var o;
    try { o = inflect_parse(optsJSON); } catch (e0) { return inflect_err("Opzioni non valide."); }
    $.global.MT_PINCTRL = null; // un Cloner rimasto fissato non deve bloccare la creazione di un altro
    var sel = comp.selectedLayers, srcs = [], s;
    for (s = 0; s < sel.length; s++) {
        var L = sel[s];
        if (!inflect_isVisual(L) || mt_isCtrl(L) || mt_isFalloff(L)) continue;
        try { if (L.parent && mt_isCtrl(L.parent)) continue; } catch (eP) {}
        srcs.push(L);
    }
    if (!srcs.length) return inflect_err("Seleziona il layer da ripetere (o pi\u00f9 layer, che verranno alternati).");
    var mode = Math.max(1, Math.min(7, Math.round(o.mode || 1)));
    var threeD = !!o.threeD;
    var n = mode === 2 ? Math.max(1, o.cols) * Math.max(1, o.rows) * (threeD ? Math.max(1, o.levels) : 1) : Math.max(1, Math.round(o.count));
    if (n > MT_MAX) return inflect_err("Troppe copie (" + n + "). Il massimo \u00e8 " + MT_MAX + ": oltre, After Effects diventa lento.");

    mt_begin("Motion Tools: crea Cloner");
    try {
        var t = comp.time, first = srcs[0];
        // Passo e raggio di partenza dalle dimensioni del layer, come farebbe a mano un motion designer.
        var w = 100, h = 100;
        try {
            var r = first.sourceRectAtTime(t, false);
            var sc = first.property("ADBE Transform Group").property("ADBE Scale").valueAtTime(t, false);
            w = Math.max(10, r.width * Math.abs(sc[0]) / 100); h = Math.max(10, r.height * Math.abs(sc[1]) / 100);
        } catch (eR) {}
        var gap = 1.25;
        var step = mode === 2 ? [Math.round(w * gap), Math.round(h * gap), threeD ? Math.round(w * gap) : 0] : [Math.round(w * gap), 0, 0];
        var radius = Math.round(Math.max(w, h) * gap * Math.max(3, n) / (2 * Math.PI));

        var name = mt_uniqueName(comp, "Cloner");
        var ctrl = comp.layers.addNull();
        ctrl.name = name;
        ctrl.label = 9;
        mt_smallNull(ctrl);
        var ids = [];
        for (s = 0; s < srcs.length; s++) ids.push(srcs[s].id);
        mt_writeMeta(ctrl, { src: ids, pick: o.pick === "random" ? "random" : "cycle", front: o.front === "first" ? "first" : "last", ver: MT_REPEAT_VER });
        // Scala e colore di ogni input, subito sul controllo.
        mt_inputWrite(ctrl, mt_inputGet(ctrl, ids.length));
        if (threeD) ctrl.threeDLayer = true;
        // Ancoraggio del controllo nell'origine: le copie si dispongono esattamente attorno alla sua posizione.
        ctrl.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0, 0]);
        var pv;
        if (o.place === "layer") {
            try { if (first.parent) ctrl.parent = first.parent; } catch (eP2) {}
            pv = inflect_layerPos(first, t);
        } else pv = [comp.width / 2, comp.height / 2, 0];
        ctrl.property("ADBE Transform Group").property("ADBE Position").setValue([pv[0], pv[1], (threeD && pv.length > 2) ? pv[2] : 0]);
        try { ctrl.outPoint = first.outPoint; ctrl.inPoint = first.inPoint; } catch (eT) {}

        var defaults = {
            "Distribuzione": mode, "Quantit\u00e0": n, "Colonne": Math.max(1, o.cols || 5), "Righe": Math.max(1, o.rows || 4),
            "Livelli": Math.max(1, o.levels || 1), "Passo": step, "Raggio": radius,
            // Si parte dallo spazio tra i bordi: un quarto della copia, come una griglia fatta a mano.
            "Modo misura": (mode === 1 || mode === 2) ? 3 : 1,
            "Distanza": [Math.round(w * (gap - 1)), Math.round(h * (gap - 1)), Math.round(Math.min(w, h) * (gap - 1))],
            "Dimensione copia": [Math.round(w * 10) / 10, Math.round(h * 10) / 10, Math.round(Math.min(w, h) * 10) / 10],
            "Area": [Math.round(comp.width * 0.8), Math.round(comp.height * 0.8), threeD ? 800 : 0]
        };
        for (var k = 0; k < MT_PARAMS.length; k++) {
            var P = MT_PARAMS[k];
            var val = defaults.hasOwnProperty(P[0]) ? defaults[P[0]] : P[2];
            mt_fx(ctrl, P[1], P[0], val, MT_LISTS[P[0]]);
        }

        mt_syncClones(comp, ctrl, n);
        ctrl.moveBefore(first);
        var meta = mt_meta(ctrl), clones = mt_clones(comp, ctrl);
        mt_order(ctrl, clones, meta.front);
        if (o.hide) for (s = 0; s < srcs.length; s++) srcs[s].enabled = false;

        for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
        ctrl.selected = true;
        mt_end();
        return inflect_ok({ name: name, count: n, sources: srcs.length });
    } catch (e) {
        mt_end();
        return inflect_err("Cloner non creato: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
}

