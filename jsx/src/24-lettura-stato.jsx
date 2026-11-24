/* --------------------------------------------------- lettura stato -- */

function mt_repeatInfo(comp) {
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return null;
    return { name: ctrl.name, index: ctrl.index, mode: Math.round(mt_get(ctrl, "Distribuzione")), count: Math.round(mt_get(ctrl, "Quantit\u00e0")), threeD: ctrl.threeDLayer };
}

/*
 * Misure vere, in pixel della composizione nel frame corrente: dimensione di una copia, distanza
 * da centro a centro e spazio tra i bordi con la copia accanto (e con quella sotto, nella griglia).
 */
function mt_cloneMeasure(comp, ctrl, p) {
    var cl = mt_clones(comp, ctrl), t = comp.time, out = { size: null, h: null, v: null };
    if (!cl.length) return out;
    var bd = function (L) { var b = inflect_bounds(L, t, false); return { l: b.l, r: b.r, t: b.t, b: b.b, cx: (b.l + b.r) / 2, cy: (b.t + b.b) / 2 }; };
    var pair = function (a, b) {
        if (!a || !b) return null;
        var A = bd(a.layer), B = bd(b.layer), dx = B.cx - A.cx, dy = B.cy - A.cy;
        var horiz = Math.abs(dx) >= Math.abs(dy);
        var gap = horiz ? (dx >= 0 ? B.l - A.r : A.l - B.r) : (dy >= 0 ? B.t - A.b : A.t - B.b);
        return { center: Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10, gap: Math.round(gap * 10) / 10, axis: horiz ? "x" : "y" };
    };
    try { var b0 = bd(cl[0].layer); out.size = [Math.round((b0.r - b0.l) * 10) / 10, Math.round((b0.b - b0.t) * 10) / 10]; } catch (e0) {}
    var m = Math.round(p["Distribuzione"]);
    try { out.h = pair(cl[0], cl[1]); } catch (e1) {}
    if (m === 2) {
        var cols = Math.max(1, Math.round(p["Colonne"])), rowsFirst = Math.round(p["Direzione griglia"]) !== 2;
        var step = rowsFirst ? cols : Math.max(1, Math.round(p["Righe"]));
        try { out.v = pair(cl[0], cl[step]); } catch (e2) {}
    }
    return out;
}

function mt_layerName(comp, idx) {
    if (!idx) return "";
    try { return comp.layer(idx).name; } catch (e) { return ""; }
}

/** Tutti i parametri del Cloner selezionato, dei suoi comportamenti e dei falloff della composizione. */
function inflect_repeatRead() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_ok({ repeat: null });
        var ctrl = mt_findCtrl(comp);
        if (!ctrl) return inflect_ok({ repeat: null });
        // Cloner di versioni precedenti: si aggiorna una volta sola (origine delle copie, misura Spazio).
        if (mt_meta(ctrl).ver < MT_REPEAT_VER) { mt_begin("Motion Tools: aggiorna Cloner"); try { mt_upgrade(ctrl); } catch (eU) {} mt_end(); }
        // Keyframe di colonne, righe o quantita' messi dai Controlli effetti: si creano le copie che mancano.
        try {
            var need = mt_countFor(ctrl), have = mt_clones(comp, ctrl).length;
            if (need > have && need <= MT_MAX) { mt_begin("Motion Tools: copie per l'animazione"); try { mt_syncClones(comp, ctrl, need); } catch (eS) {} mt_end(); }
        } catch (eN) {}
        var p = {}, k, i;
        for (k = 0; k < MT_PARAMS.length; k++) p[MT_PARAMS[k][0]] = mt_get(ctrl, MT_PARAMS[k][0]);
        var nb = Math.round(p["Comportamenti"] || 0), beh = [];
        for (i = 1; i <= nb; i++) {
            var b = { k: i };
            for (k = 0; k < MT_BPARAMS.length; k++) b[MT_BPARAMS[k][0]] = mt_get(ctrl, "B" + i + " " + MT_BPARAMS[k][0]);
            b.FalloffName = mt_layerName(comp, b["Falloff"]);
            beh.push(b);
        }
        var falloffs = [], paths = [];
        for (i = 1; i <= comp.numLayers; i++) {
            var L = comp.layer(i);
            if (mt_isFalloff(L)) {
                var f = { index: i, name: L.name, threeD: L.threeDLayer };
                var fp = L.property("ADBE Transform Group").property("ADBE Position").value;
                f["Posizione"] = [fp[0], fp[1], fp.length > 2 ? fp[2] : 0];
                var ftr = L.property("ADBE Transform Group");
                try { f["Rotazione Z"] = ftr.property("ADBE Rotate Z").value; } catch (eRz) { f["Rotazione Z"] = 0; }
                if (L.threeDLayer) { try { f["Rotazione X"] = ftr.property("ADBE Rotate X").value; f["Rotazione Y"] = ftr.property("ADBE Rotate Y").value; } catch (eRx) {} }
                f.outline = !L.adjustmentLayer;
                for (k = 0; k < MT_FPARAMS.length; k++) f[MT_FPARAMS[k][0]] = mt_get(L, MT_FPARAMS[k][0]);
                falloffs.push(f);
            } else {
                var hasPath = false;
                try { hasPath = L.property("ADBE Mask Parade").numProperties > 0; } catch (eM) {}
                if (!hasPath) { try { hasPath = L instanceof ShapeLayer; } catch (eS) {} }
                if (hasPath && !mt_isCtrl(L)) paths.push({ index: i, name: L.name });
            }
        }
        var meta = mt_meta(ctrl), srcNames = [];
        var inputs = [], used = {}, cls = mt_clones(comp, ctrl);
        for (i = 0; i < cls.length; i++) used[cls[i].s] = (used[cls[i].s] || 0) + 1;
        for (i = 0; i < meta.src.length; i++) {
            var IL = null;
            try { IL = mt_layerById(meta.src[i]); } catch (eN) { IL = null; }
            srcNames.push(IL ? IL.name : "(eliminato)");
            var isc = mt_get(ctrl, "I" + (i + 1) + " Scala"), ion = mt_get(ctrl, "I" + (i + 1) + " Colora"), icl = mt_get(ctrl, "I" + (i + 1) + " Colore");
            inputs.push({ name: IL ? IL.name : "(eliminato)", missing: !IL, hidden: IL ? !IL.enabled : false, copies: used[i] || 0,
                vector: IL ? mt_isVector(IL) : false, scale: isc === null ? 100 : isc, colorOn: ion ? 1 : 0, color: icl || [1, 1, 1, 1] });
        }
        return inflect_ok({ repeat: {
            name: ctrl.name, index: ctrl.index, threeD: ctrl.threeDLayer, params: p, behaviours: beh, falloffs: falloffs,
            paths: paths, pathName: mt_layerName(comp, p["Tracciato"]), sources: srcNames, inputs: inputs, pick: meta.pick, front: meta.front,
            clones: mt_clones(comp, ctrl).length, lists: MT_LISTS, data: mt_listsGet(ctrl),
            group: mt_groupValues(ctrl), anim: mt_animMap(comp, ctrl, falloffs), time: comp.time,
            measure: mt_cloneMeasure(comp, ctrl, p)
        } });
    } catch (e) { return inflect_err("Lettura del Cloner non riuscita: " + e.toString()); }
}

