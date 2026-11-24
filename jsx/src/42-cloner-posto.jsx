/* ====================================================== cloner: posto == */

/* Ingombro delle copie nello spazio del controllo, nel frame corrente. */
function mt_clonerBounds(comp, ctrl) {
    var cl = mt_clones(comp, ctrl), t = comp.time, B = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 }, n = 0;
    var al = 1;
    try { al = Math.round(mt_get(ctrl, "Allinea copie")); } catch (e0) {}
    for (var i = 0; i < cl.length; i++) {
        var L = cl[i].layer;
        try {
            var tr = L.property("ADBE Transform Group");
            var p = tr.property("ADBE Position").valueAtTime(t, false), sc = tr.property("ADBE Scale").valueAtTime(t, false);
            var ap = tr.property("ADBE Anchor Point").valueAtTime(t, false), r = L.sourceRectAtTime(t, false);
            var w = r.width * Math.abs(sc[0]) / 100, h = r.height * Math.abs(sc[1]) / 100;
            var cx = al === 1 ? p[0] : p[0] + (r.left + r.width / 2 - ap[0]) * sc[0] / 100;
            var cy = al === 1 ? p[1] : p[1] + (r.top + r.height / 2 - ap[1]) * sc[1] / 100;
            B.l = Math.min(B.l, cx - w / 2); B.r = Math.max(B.r, cx + w / 2);
            B.t = Math.min(B.t, cy - h / 2); B.b = Math.max(B.b, cy + h / 2);
            n++;
        } catch (e) {}
    }
    return n ? B : null;
}

/**
 * Punto di ancoraggio del Cloner: fx, fy da 0 a 1 sull'ingombro delle copie.
 * Le copie restano dove sono; cambia il punto attorno a cui ruota e scala tutto il gruppo.
 */
function inflect_clonerAnchor(fx, fy) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var B = mt_clonerBounds(comp, ctrl);
    if (!B) return inflect_err("Il Cloner non ha copie da misurare.");
    mt_begin("Motion Tools: ancoraggio del Cloner");
    try {
        var tr = ctrl.property("ADBE Transform Group"), apP = tr.property("ADBE Anchor Point"), posP = tr.property("ADBE Position");
        var A0 = apP.value, A = [B.l + (B.r - B.l) * fx, B.t + (B.b - B.t) * fy, A0.length > 2 ? A0[2] : 0];
        var t = comp.time, sc = tr.property("ADBE Scale").valueAtTime(t, false), rot = 0;
        try { rot = tr.property("ADBE Rotate Z").valueAtTime(t, false); } catch (eR) {}
        var a = rot * Math.PI / 180, dx = (A[0] - A0[0]) * sc[0] / 100, dy = (A[1] - A0[1]) * sc[1] / 100;
        var off = [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a), 0];
        if (apP.numKeys) { for (var k = 1; k <= apP.numKeys; k++) apP.setValueAtKey(k, A); } else apP.setValue(A);
        mt_offsetProp(posP, off, false);
        var meta = mt_meta(ctrl); meta.anchorSet = true; meta.ax = fx; meta.ay = fy; mt_writeMeta(ctrl, meta);
        mt_end();
        return inflect_ok({});
    } catch (e) { mt_end(); return inflect_err("Ancoraggio non cambiato: " + e.toString()); }
}

/** Porta il Cloner al centro della composizione (il suo punto di ancoraggio va al centro). */
function inflect_clonerCenter(useBounds) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    mt_begin("Motion Tools: centra il Cloner");
    try {
        if (useBounds) { var r0 = inflect_parse(inflect_clonerAnchor(0.5, 0.5)); if (!r0.ok) { mt_end(); return inflect_stringify(r0); } }
        var tr = ctrl.property("ADBE Transform Group"), posP = tr.property("ADBE Position"), t = comp.time;
        var M = inflect_mMul(inflect_parentMat(ctrl, t), inflect_layerMat(ctrl, t)), A = tr.property("ADBE Anchor Point").valueAtTime(t, false);
        var cur = [M.a * A[0] + M.b * A[1] + M.tx, M.c * A[0] + M.d * A[1] + M.ty];
        var off = [comp.width / 2 - cur[0], comp.height / 2 - cur[1], 0];
        if (ctrl.parent) {
            // Con un genitore lo scarto va riportato nel suo spazio: si stacca e si riattacca.
            var par = ctrl.parent; ctrl.parent = null;
            mt_offsetProp(tr.property("ADBE Position"), off, false);
            ctrl.parent = par;
        } else mt_offsetProp(posP, off, false);
        mt_end();
        return inflect_ok({});
    } catch (e) { mt_end(); return inflect_err("Non riesco a centrarlo: " + e.toString()); }
}

