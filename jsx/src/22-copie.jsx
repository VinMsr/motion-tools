/* --------------------------------------------------------- copie -- */

/** Prepara una copia completa da un layer sorgente: effetti di servizio ed espressioni. */
function mt_setupClone(src, ctrl, sIdx, threeD) {
    var c = src.duplicate();
    c.enabled = true;
    c.shy = false;
    if (threeD) { try { c.threeDLayer = true; } catch (e3) {} }
    var tr = c.property("ADBE Transform Group");
    try { if (tr.property("ADBE Position").dimensionsSeparated) tr.property("ADBE Position").dimensionsSeparated = false; } catch (eS) {}
    // Agganciata al controllo, After Effects riporta la posizione nello spazio del controllo:
    // la posizione di partenza si legge DOPO, cosi' resta solo l'eventuale animazione della sorgente.
    c.parent = ctrl;
    var org = mt_cloneOrigin(c);
    c.comment = mt_cloneComment(sIdx, src);
    var cn = ctrl.name;
    mt_fx(c, "sl", "MT Indice", 0);
    mt_fx(c, "p3", "MT Origine", org);
    mt_fx(c, "p3", "MT Base", [0, 0, 0]).expression = mt_expr("base", cn);
    mt_fx(c, "p3", "MT Orient", [0, 0, 0]).expression = mt_expr("orient", cn);
    mt_fx(c, "p3", "MT Pos", [0, 0, 0]).expression = mt_expr("behave", cn, 1);
    mt_fx(c, "p3", "MT Rot", [0, 0, 0]).expression = mt_expr("behave", cn, 4);
    mt_fx(c, "p3", "MT Extra", [0, 0, 0]).expression = mt_expr("behave", cn, 7);
    // Gli effetti di servizio si nascondono dai Controlli effetti per non fare confusione.
    var parade = c.property("ADBE Effect Parade");
    for (var f = 1; f <= parade.numProperties; f++) { if (parade.property(f).name.indexOf("MT ") === 0) { try { parade.property(f).enabled = true; } catch (eE) {} } }

    tr = c.property("ADBE Transform Group");
    tr.property("ADBE Position").expression = mt_expr("position", cn);
    tr.property("ADBE Scale").expression = mt_expr("scale", cn);
    tr.property("ADBE Rotate Z").expression = mt_expr("rotation", cn);
    tr.property("ADBE Opacity").expression = mt_expr("opacity", cn);
    if (c.threeDLayer) {
        try { tr.property("ADBE Rotate X").expression = mt_expr("rotationX", cn); } catch (eX) {}
        try { tr.property("ADBE Rotate Y").expression = mt_expr("rotationY", cn); } catch (eY) {}
    }
    try { mt_cloneLists(c, ctrl); } catch (eL) {}
    try { mt_cloneInput(c, cn, sIdx, mt_isVector(src)); } catch (eI) {}
    if (mt_hasColorBeh(ctrl)) { try { mt_cloneFallColor(c, cn); } catch (eF) {} }
    return c;
}

/* Posizione di partenza della copia nello spazio del controllo (primo keyframe o valore fisso). */
function mt_cloneOrigin(c) {
    var sp = c.property("ADBE Transform Group").property("ADBE Position"), org;
    try { org = sp.numKeys > 0 ? sp.keyValue(1) : sp.value; } catch (eO) { org = [0, 0, 0]; }
    return [org[0], org[1], org.length > 2 ? org[2] : 0];
}

/*
 * Il quadrato del null parte dal suo ancoraggio (che sta in 0, 0): largo 100 px sembrava lontano
 * dalle copie. Piccolo, sta sul punto attorno a cui si dispongono.
 */
function mt_smallNull(ctrl) {
    try { var s = ctrl.source; if (s && s.mainSource && s.mainSource instanceof SolidSource && s.width > 12) { s.width = 10; s.height = 10; } } catch (e) {}
}

/* Dimensione delle copie: la sorgente piu' grande, con la sua scala, nel frame corrente. */
function mt_measureSources(ctrl) {
    var meta = mt_meta(ctrl), t = ctrl.containingComp.time, w = 0, h = 0;
    for (var s = 0; s < meta.src.length; s++) {
        try {
            var L = mt_layerById(meta.src[s]);
            var r = L.sourceRectAtTime(t, false), sc = L.property("ADBE Transform Group").property("ADBE Scale").valueAtTime(t, false);
            var ik = mt_get(ctrl, "I" + (s + 1) + " Scala");
            ik = (ik === null || ik === undefined) ? 1 : Math.abs(ik) / 100;
            w = Math.max(w, r.width * Math.abs(sc[0]) / 100 * ik); h = Math.max(h, r.height * Math.abs(sc[1]) / 100 * ik);
        } catch (e) {}
    }
    if (w < 1) w = 100; if (h < 1) h = 100;
    return [Math.round(w * 10) / 10, Math.round(h * 10) / 10, Math.round(Math.min(w, h) * 10) / 10];
}

/** Porta le copie a n, aggiungendo o togliendo layer e riusando una copia della stessa sorgente come modello. */
function mt_syncClones(comp, ctrl, n) {
    var meta = mt_meta(ctrl);
    var clones = mt_clones(comp, ctrl);
    var seed = mt_get(ctrl, "Seme") || 1;
    var threeD = ctrl.threeDLayer;
    var i;
    for (i = clones.length - 1; i >= 0; i--) {
        if (clones[i].i >= n) { clones[i].layer.remove(); clones.splice(i, 1); }
    }
    var have = {};
    for (i = 0; i < clones.length; i++) have[clones[i].i] = true;
    var templates = {};
    for (i = 0; i < clones.length; i++) if (!templates[clones[i].s]) templates[clones[i].s] = clones[i].layer;
    var nSrc = Math.max(1, meta.src.length);
    for (i = 0; i < n; i++) {
        if (have[i]) continue;
        var s = mt_pick(i, nSrc, meta.pick, seed, n), c;
        if (templates[s]) {
            c = templates[s].duplicate();
        } else {
            var src = null;
            try { src = mt_layerById(meta.src[s]); } catch (e) {}
            if (!src) { try { src = mt_layerById(meta.src[0]); s = 0; } catch (e2) {} }
            if (!src) throw new Error("Il layer originale del Cloner non esiste pi\u00f9.");
            c = mt_setupClone(src, ctrl, s, threeD);
            templates[s] = c;
        }
        try { c.comment = mt_cloneComment(s, mt_layerById(meta.src[s])); } catch (eC) { c.comment = MT_CLONE_TAG + "|s=" + s; }
        mt_fxProp(c, "MT Indice").setValue(i);
        try { mt_cloneInput(c, ctrl.name, s, mt_srcIsVector(meta, s)); } catch (eIn) {}
        clones.push({ layer: c, i: i, s: s });
    }
    clones.sort(function (a, b) { return a.i - b.i; });
    for (i = 0; i < clones.length; i++) {
        var base = "";
        try { base = mt_layerById(meta.src[clones[i].s]).name; } catch (e3) { base = ctrl.name; }
        clones[i].layer.name = base + " " + mt_pad(clones[i].i);
    }
    mt_order(ctrl, clones, meta.front);
    mt_syncTime(comp, ctrl);
    return clones.length;
}

function mt_order(ctrl, clones, front) {
    // Il controllo sta sopra, poi le copie: "last" mette in primo piano l'ultima copia.
    var prev = ctrl, i;
    if (front === "first") { for (i = 0; i < clones.length; i++) { clones[i].layer.moveAfter(prev); prev = clones[i].layer; } }
    else { for (i = clones.length - 1; i >= 0; i--) { clones[i].layer.moveAfter(prev); prev = clones[i].layer; } }
}

/** Cloner creati con le versioni precedenti: ancoraggio del controllo a zero e parametro di allineamento. */
function mt_upgrade(ctrl) {
    try { mt_upgradeLists(ctrl); } catch (eUL) {}
    try { mt_upgradeV3(ctrl); } catch (eV3) {}
    try { mt_upgradeV4(ctrl); } catch (eV4) {}
    try { mt_upgradeV5(ctrl); } catch (eV5) {}
    try { mt_upgradeV6(ctrl); } catch (eV6) {}
    try { mt_upgradeV7(ctrl); } catch (eV7) {}
    try {
        var ap = ctrl.property("ADBE Transform Group").property("ADBE Anchor Point");
        var v = ap.value;
        // Solo l'ancoraggio di fabbrica del null (50, 50) delle prime versioni: quello scelto da te resta.
        if (ap.numKeys === 0 && Math.abs(v[0] - 50) < 0.001 && Math.abs(v[1] - 50) < 0.001 && !mt_meta(ctrl).anchorSet) ap.setValue([0, 0, 0]);
    } catch (e) {}
    if (!mt_fxProp(ctrl, "Allinea copie")) {
        try { mt_fx(ctrl, "dd", "Allinea copie", 1, MT_LISTS["Allinea copie"]); } catch (e2) {}
        // Le copie esistenti ricevono la nuova espressione di posizione.
        try {
            var cl = mt_clones(ctrl.containingComp, ctrl);
            for (var i = 0; i < cl.length; i++) cl[i].layer.property("ADBE Transform Group").property("ADBE Position").expression = mt_expr("position", ctrl.name);
        } catch (e3) {}
    }
}

/*
 * Versione 3: misura Spazio, dimensione delle copie, espressioni nuove e origine delle copie corretta
 * (prima era letta prima dell'aggancio al controllo e le copie finivano spostate).
 */
function mt_upgradeV3(ctrl) {
    var meta = mt_meta(ctrl);
    if (meta.ver >= 3) return;
    var mm = mt_fxProp(ctrl, "Modo misura");
    if (mm) { try { var v = mm.value; var np = mm.setPropertyParameters(MT_LISTS["Modo misura"]); np.setValue(v); } catch (eM) {} }
    if (!mt_fxProp(ctrl, "Distanza")) mt_fx(ctrl, "p3", "Distanza", [30, 30, 30]);
    if (!mt_fxProp(ctrl, "Dimensione copia")) mt_fx(ctrl, "p3", "Dimensione copia", mt_measureSources(ctrl));
    var comp = ctrl.containingComp, cl = mt_clones(comp, ctrl), cn = ctrl.name;
    for (var i = 0; i < cl.length; i++) {
        var c = cl[i].layer, fx = c.property("ADBE Effect Parade");
        try {
            fx.property("MT Base").property(1).expression = mt_expr("base", cn);
            fx.property("MT Pos").property(1).expression = mt_expr("behave", cn, 1);
            fx.property("MT Rot").property(1).expression = mt_expr("behave", cn, 4);
            fx.property("MT Extra").property(1).expression = mt_expr("behave", cn, 7);
            c.property("ADBE Transform Group").property("ADBE Position").expression = mt_expr("position", cn);
            mt_fxProp(c, "MT Origine").setValue(mt_cloneOrigin(c));
        } catch (eC) {}
    }
    // Ancoraggio scelto (per esempio dopo "Centra"): torna sullo stesso punto delle copie corrette.
    // La posizione non cambia, quindi il Cloner resta dov'era nella composizione.
    if (meta.anchorSet) {
        try {
            var B = mt_clonerBounds(comp, ctrl);
            if (B) {
                var apP = ctrl.property("ADBE Transform Group").property("ADBE Anchor Point"), A0 = apP.value;
                var A = [B.l + (B.r - B.l) * meta.ax, B.t + (B.b - B.t) * meta.ay, A0.length > 2 ? A0[2] : 0];
                if (apP.numKeys) { for (var k = 1; k <= apP.numKeys; k++) apP.setValueAtKey(k, A); } else apP.setValue(A);
            }
        } catch (eA) {}
    }
    mt_smallNull(ctrl);
    meta.ver = 3;
    mt_writeMeta(ctrl, meta);
}

/*
 * Versione 4: conteggio che segue colonne e righe animate (le copie in piu' si nascondono) e
 * destinazione Colore nei comportamenti.
 */
function mt_upgradeV4(ctrl) {
    var meta = mt_meta(ctrl);
    if (meta.ver >= 4) return;
    var comp = ctrl.containingComp, cl = mt_clones(comp, ctrl), cn = ctrl.name;
    if (!ctrl.threeDLayer) { try { mt_set(ctrl, "Livelli", 1, comp.time); } catch (eL) {} }
    for (var i = 0; i < cl.length; i++) {
        var c = cl[i].layer, fx = c.property("ADBE Effect Parade");
        try {
            fx.property("MT Base").property(1).expression = mt_expr("base", cn);
            fx.property("MT Orient").property(1).expression = mt_expr("orient", cn);
            fx.property("MT Pos").property(1).expression = mt_expr("behave", cn, 1);
            fx.property("MT Rot").property(1).expression = mt_expr("behave", cn, 4);
            fx.property("MT Extra").property(1).expression = mt_expr("behave", cn, 7);
            c.property("ADBE Transform Group").property("ADBE Opacity").expression = mt_expr("opacity", cn);
        } catch (eC) {}
    }
    var nb = 0;
    try { nb = Math.round(mt_get(ctrl, "Comportamenti") || 0); } catch (e3) {}
    for (var k = 1; k <= nb; k++) {
        var dp = mt_fxProp(ctrl, "B" + k + " Destinazione");
        if (dp) { try { var v = dp.value; var np = dp.setPropertyParameters(MT_LISTS["Destinazione"]); np.setValue(v); } catch (e4) {} }
    }
    meta.ver = 4;
    mt_writeMeta(ctrl, meta);
}

/*
 * Versione 5: falloff come area con sfumatura esterna, Scala che mantiene le distanze, colore che
 * si mescola senza spegnere le copie.
 */
function mt_upgradeV5(ctrl) {
    var meta = mt_meta(ctrl);
    if (meta.ver >= 5) return;
    var comp = ctrl.containingComp, cl = mt_clones(comp, ctrl), cn = ctrl.name;
    for (var i = 0; i < cl.length; i++) {
        var c = cl[i].layer, fx = c.property("ADBE Effect Parade");
        try {
            fx.property("MT Pos").property(1).expression = mt_expr("behave", cn, 1);
            fx.property("MT Rot").property(1).expression = mt_expr("behave", cn, 4);
            fx.property("MT Extra").property(1).expression = mt_expr("behave", cn, 7);
            if (fx.property("MT Peso colore")) fx.property("MT Peso colore").property(1).expression = mt_expr("fcolor", cn, MT_DEST_COLOR);
            mt_fillBlend(fx.property("MT Colore falloff"));
        } catch (eC) {}
    }
    meta.ver = 5;
    mt_writeMeta(ctrl, meta);
}

/* Cloner delle versioni precedenti: comportamento Lista nelle espressioni e nel menu Tipo. */
function mt_upgradeLists(ctrl) {
    var comp = ctrl.containingComp, cl = mt_clones(comp, ctrl);
    if (!cl.length) return;
    var ex = "";
    try { ex = cl[0].layer.property("ADBE Effect Parade").property("MT Pos").property(1).expression; } catch (e) {}
    if (ex.indexOf("mtLists") >= 0) return;
    var cn = ctrl.name;
    for (var i = 0; i < cl.length; i++) {
        var fx = cl[i].layer.property("ADBE Effect Parade");
        try {
            fx.property("MT Pos").property(1).expression = mt_expr("behave", cn, 1);
            fx.property("MT Rot").property(1).expression = mt_expr("behave", cn, 4);
            fx.property("MT Extra").property(1).expression = mt_expr("behave", cn, 7);
        } catch (e2) {}
    }
    var nb = 0;
    try { nb = Math.round(mt_get(ctrl, "Comportamenti")); } catch (e3) {}
    for (var k = 1; k <= nb; k++) {
        var tp = mt_fxProp(ctrl, "B" + k + " Tipo");
        if (!tp) continue;
        try { var v = tp.value; var np = tp.setPropertyParameters(MT_LISTS["Tipo"]); np.setValue(v); } catch (e4) {}
    }
}

/* Valore piu' alto di un parametro, tra il valore attuale e tutti i suoi keyframe. */
function mt_maxParam(ctrl, name) {
    var p = mt_fxProp(ctrl, name);
    if (!p) return 1;
    var mx = p.value;
    try { for (var k = 1; k <= p.numKeys; k++) mx = Math.max(mx, p.keyValue(k)); } catch (e) {}
    return Math.max(1, Math.round(mx));
}

/*
 * Copie da creare: con Quantita', Colonne o Righe animate servono quelle del keyframe piu' alto.
 * Le espressioni nascondono quelle in piu' quando il valore scende (come in Cavalry).
 */
function mt_countFor(ctrl) {
    var mode = Math.round(mt_get(ctrl, "Distribuzione"));
    if (mode === 2) {
        return mt_maxParam(ctrl, "Colonne") * mt_maxParam(ctrl, "Righe") * (ctrl.threeDLayer ? mt_maxParam(ctrl, "Livelli") : 1);
    }
    return mt_maxParam(ctrl, "Quantit\u00e0");
}

/* Il Cloner usa il colore in qualche comportamento? */
function mt_hasColorBeh(ctrl) {
    var nb = 0;
    try { nb = Math.round(mt_get(ctrl, "Comportamenti") || 0); } catch (e) {}
    for (var k = 1; k <= nb; k++) { if (Math.round(mt_get(ctrl, "B" + k + " Destinazione") || 0) === MT_DEST_COLOR) return true; }
    return false;
}

/*
 * Colore dai comportamenti (per esempio un falloff collegato al Colore): un controllo colore con
 * [r, g, b, peso] e un effetto Riempimento. Il peso va nell'Opacita' effetto delle Opzioni di
 * composito (ADBE Effect Built In Params > ADBE Effect Mask Opacity), che mescola il riempimento
 * con la copia. L'Opacita' interna del Riempimento agisce su tutto il layer: messa li', le copie
 * fuori dal falloff sparivano.
 */
var MT_FILL_W = 'value * effect("MT Peso colore")(1).value[3]';
function mt_cloneFallColor(c, cn) {
    var fx = c.property("ADBE Effect Parade");
    if (!fx.property("MT Peso colore")) {
        fx.addProperty("ADBE Color Control").name = "MT Peso colore";
        c.property("ADBE Effect Parade").property("MT Peso colore").property(1).expression = mt_expr("fcolor", cn, MT_DEST_COLOR);
    }
    if (!c.property("ADBE Effect Parade").property("MT Colore falloff")) {
        c.property("ADBE Effect Parade").addProperty("ADBE Fill").name = "MT Colore falloff";
        c.property("ADBE Effect Parade").property("MT Colore falloff").property("ADBE Fill-0002").expression = 'var w = effect("MT Peso colore")(1).value; [w[0], w[1], w[2], 1]';
    }
    mt_fillBlend(c.property("ADBE Effect Parade").property("MT Colore falloff"));
}

/* Peso del colore sull'opacita' dell'effetto; toglie quello messo dalle versioni precedenti sull'opacita' interna. */
function mt_fillBlend(F) {
    if (!F) return;
    for (var q = 1; q <= F.numProperties; q++) {
        var pp = F.property(q);
        try { if (pp.canSetExpression && pp.expression === MT_FILL_W) pp.expression = ""; } catch (e1) {}
    }
    try {
        var eo = F.property("ADBE Effect Built In Params").property("ADBE Effect Mask Opacity");
        if (eo && eo.expression !== MT_FILL_W) eo.expression = MT_FILL_W;
    } catch (e2) {}
}

