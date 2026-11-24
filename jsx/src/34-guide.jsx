/* ============================================================== guide == */
/* orientationType: 0 orizzontale (posizione Y), 1 verticale (posizione X). */

/*
 * I numeri che After Effects usa per l'orientamento delle guide cambiano tra le versioni.
 * Si usano le costanti quando esistono, e ogni guida creata dal pannello "calibra" la lettura.
 */
/*
 * Da After Effects 26.5 le guide si creano con GuideOptions e le costanti GuideOrientationType;
 * prima si usavano 0 (orizzontale) e 1 (verticale). Si usa il sistema nuovo quando c'e'.
 * L'inversione manuale resta come riserva, salvata nelle impostazioni.
 */
function mt_gModern() {
    try { return typeof GuideOptions !== "undefined" && typeof GuideOrientationType !== "undefined"; } catch (e) { return false; }
}

function mt_gFlip() {
    var G = $.global;
    if (G.MT_GFLIP === undefined || G.MT_GFLIP === null) {
        var st = {};
        try { st = inflect_settings(); } catch (e) {}
        G.MT_GFLIP = !!st.guideFlip2;
    }
    return G.MT_GFLIP;
}

function mt_gIsVertical(g) {
    var raw = g.orientationType !== undefined ? g.orientationType : g.orientation, v;
    if (mt_gModern()) v = raw === GuideOrientationType.VERTICAL;
    else v = raw === 1;
    return mt_gFlip() ? !v : v;
}

function mt_gAdd(comp, vertical, pos) {
    var v = mt_gFlip() ? !vertical : vertical;
    if (mt_gModern()) {
        try {
            var o = new GuideOptions();
            o.orientation = v ? GuideOrientationType.VERTICAL : GuideOrientationType.HORIZONTAL;
            try { o.orientationType = o.orientation; } catch (eO) {}
            o.position = pos;
            try { o.positionType = GuidePositionType.PIXEL; } catch (eP) {}
            comp.addGuide(o);
            return;
        } catch (e) {}
        comp.addGuide(v ? GuideOrientationType.VERTICAL : GuideOrientationType.HORIZONTAL, pos);
        return;
    }
    comp.addGuide(v ? 1 : 0, pos);
}

function mt_gSet(comp, index, pos) {
    if (mt_gModern()) {
        try {
            var o = new GuideOptions();
            o.position = pos;
            try { o.positionType = GuidePositionType.PIXEL; } catch (eP) {}
            comp.setGuide(o, index);
            return;
        } catch (e) {}
    }
    comp.setGuide(pos, index);
}

function inflect_guidesFlip() {
    var st = inflect_settings();
    st.guideFlip2 = !mt_gFlip();
    inflect_saveSettings(st);
    $.global.MT_GFLIP = st.guideFlip2;
    return inflect_guidesRead();
}

function mt_gPx(comp, g, vertical) {
    var pct = false;
    try { if (typeof GuidePositionType !== "undefined") pct = g.positionType === GuidePositionType.PERCENTAGE; } catch (e) {}
    return pct ? g.position / 100 * (vertical ? comp.width : comp.height) : g.position;
}

function mt_guideList(comp) {
    var out = [];
    try {
        var g = comp.guides;
        for (var i = 0; i < g.length; i++) {
            var v = mt_gIsVertical(g[i]);
            out.push({ i: i, o: v ? 1 : 0, p: mt_gPx(comp, g[i], v) });
        }
    } catch (e) {}
    return out;
}

function inflect_guidesRead() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_ok({ comp: null });
    var ok = typeof comp.addGuide === "function";
    return inflect_ok({ comp: comp.name, width: comp.width, height: comp.height, guides: mt_guideList(comp), supported: ok, flip: mt_gFlip() });
}

/** list = [{o, p}]: le guide gia' presenti nella stessa posizione non si duplicano. */
function inflect_guidesAdd(listJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    if (typeof comp.addGuide !== "function") return inflect_err("Questa versione di After Effects non gestisce le guide da script.");
    var list;
    try { list = inflect_parse(listJSON); } catch (e0) { return inflect_err("Valori non validi."); }
    var have = mt_guideList(comp), added = 0;
    mt_begin("Motion Tools: guide");
    try {
        for (var i = 0; i < list.length; i++) {
            var g = list[i], dup = false;
            for (var k = 0; k < have.length; k++) if (have[k].o === g.o && Math.abs(have[k].p - g.p) < 0.01) dup = true;
            if (dup) continue;
            mt_gAdd(comp, g.o === 1, g.p);
            have.push({ o: g.o, p: g.p });
            added++;
        }
        mt_end();
        return inflect_ok({ added: added, guides: mt_guideList(comp) });
    } catch (e) {
        mt_end();
        return inflect_err("Guide non create: " + e.toString());
    }
}

function inflect_guideSet(index, pos) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    mt_begin("Motion Tools: sposta guida");
    try { mt_gSet(comp, index, pos); mt_end(); return inflect_ok({ guides: mt_guideList(comp) }); }
    catch (e) { mt_end(); return inflect_err(e.toString()); }
}

/** indexes = [i...] oppure "all". */
function inflect_guidesRemove(idxJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var idx, i;
    if (idxJSON === "all" || idxJSON === '"all"') idx = "all";
    else { try { idx = inflect_parse(idxJSON); } catch (e0) { return inflect_err("Guide non valide."); } }
    mt_begin("Motion Tools: togli guide");
    try {
        if (idx === "all") { for (i = comp.guides.length - 1; i >= 0; i--) comp.removeGuide(i); }
        else { idx.sort(inflect_sortNum); for (i = idx.length - 1; i >= 0; i--) comp.removeGuide(idx[i]); }
        mt_end();
        return inflect_ok({ guides: mt_guideList(comp) });
    } catch (e) { mt_end(); return inflect_err(e.toString()); }
}

/** Bordi dei layer selezionati nel frame corrente, per costruire le guide nel pannello. */
function inflect_guideBounds() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var sel = comp.selectedLayers, out = [];
    for (var i = 0; i < sel.length; i++) {
        if (!inflect_isVisual(sel[i])) continue;
        try { var b = inflect_bounds(sel[i], comp.time, false); out.push({ name: sel[i].name, l: b.l, r: b.r, t: b.t, b: b.b }); } catch (e) {}
    }
    if (!out.length) return inflect_err("Seleziona uno o pi\u00f9 layer visibili.");
    return inflect_ok({ bounds: out });
}

