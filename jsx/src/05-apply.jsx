/* ---------------------------------------------------------------- apply -- */

/*
 * plan = {
 *   points: [{ t, v, inSlope, inInfl, outSlope, outInfl }],  // spazio normalizzato 0..1
 *   mode: "both" | "in" | "out",                               // solo per curve semplici
 *   snapFrames: true
 * }
 * Lo slope \u00e8 dv/dt normalizzato: velocit\u00e0 reale = slope * deltaValore / durata.
 */
function inflect_apply(planJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona almeno due keyframe.");
    var plan;
    try { plan = inflect_parse(planJSON); } catch (e) { return inflect_err("Curva non valida."); }
    var list = inflect_selectedKeyedProps(comp);
    if (!list.length) return inflect_err("Seleziona almeno due keyframe vicini sulla stessa propriet\u00e0.");

    var report = { segments: 0, skipped: 0, notes: [] };
    var sel = inflect_captureSel(list);
    mt_begin("Motion Tools: applica curva");
    try {
        for (var i = 0; i < list.length; i++) {
            inflect_applyToProp(comp, list[i].prop, list[i].keys, plan, report);
        }
        inflect_restoreSel(sel);
    } catch (e) {
        mt_end();
        return inflect_err("Errore durante l'applicazione: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
    mt_end();
    INFLECT_SPEED = null;
    if (!report.segments) {
        return inflect_err(report.notes.length ? report.notes[0] : "Nessuna coppia di keyframe adiacenti selezionata.");
    }
    return inflect_ok(report);
}

function inflect_applyToProp(comp, prop, keys, plan, report) {
    var pts = plan.points;
    var isMulti = pts.length > 2;
    var numeric = inflect_isNumericType(prop.propertyValueType);
    var spatial = inflect_isSpatial(prop);

    if (isMulti && !numeric && !mt_isShapeProp(prop)) {
        report.skipped++;
        report.notes.push(prop.name + ": le curve multi punto funzionano su valori numerici e tracciati.");
        return;
    }

    // Se questi keyframe contengono una curva multi punto applicata prima, la toglie:
    // cos\u00ec si pu\u00f2 riapplicare o cambiare curva senza accumulare keyframe.
    keys = inflect_collapseSpans(prop, keys);

    // Coppie adiacenti, dalla fine all'inizio cos\u00ec l'inserimento non sposta gli indici ancora da elaborare.
    var pairs = [];
    for (var j = 0; j < keys.length - 1; j++) {
        if (keys[j + 1] === keys[j] + 1) pairs.push(keys[j]);
    }
    if (!pairs.length) {
        report.notes.push(prop.name + ": seleziona keyframe adiacenti.");
        return;
    }

    var dropped = 0;
    for (var p = pairs.length - 1; p >= 0; p--) {
        dropped += inflect_applySegment(comp, prop, pairs[p], pts, plan, numeric, spatial, isMulti, report) || 0;
        report.segments++;
    }
    if (dropped) report.notes.push(dropped + (dropped === 1 ? " punto della curva cadeva" : " punti della curva cadevano") + " sullo stesso frame di un altro e non " + (dropped === 1 ? "\u00e8 stato messo" : "sono stati messi") + ": allunga l'animazione per vedere tutta la curva.");
}

function inflect_applySegment(comp, prop, a, pts, plan, numeric, spatial, isMulti, report) {
    var b = a + 1;
    var t0 = prop.keyTime(a), t1 = prop.keyTime(b);
    var T = t1 - t0;
    if (T <= 0) return 0;
    var dropped = 0;
    var v0 = prop.keyValue(a), v1 = prop.keyValue(b);
    // Orientation: rotazione lungo l'arco (quaternioni), con l'ordine degli assi letto da After Effects.
    var OR = null;
    if (numeric && mt_isOrientation(prop)) {
        // Dal vivo l'ordine degli assi si ricava una volta per proprieta' e poi si riusa.
        var okey = inflect_propId(prop), cache = $.global.MT_ORIENT_BY || ($.global.MT_ORIENT_BY = {});
        var oc = (plan.live && cache[okey]) ? cache[okey] : mt_orientOrder(prop, a);
        cache[okey] = oc;
        var qa = mt_qFromEuler(inflect_toArray(v0), oc.order), qb = mt_qFromEuler(inflect_toArray(v1), oc.order);
        OR = { order: oc.order, ok: oc.ok, qa: qa, qb: qb, angle: mt_qRel(qa, qb).angle };
    }
    // Tracciati: ogni punto si sposta in linea retta; la velocita' si calibra su After Effects (mt_shapeSetSpeeds).
    var SH = null;
    if (!numeric && mt_isShapeProp(prop)) {
        if (mt_shapeCompat(v0, v1)) SH = { meter: mt_shapeMeter(v0, v1) };
        if (SH && !SH.meter) SH = null;
        if (!SH && isMulti) { if (report) report.notes.push(prop.name + ": i due keyframe hanno un numero di punti diverso o sono uguali, quindi la curva multi punto non si pu\u00f2 applicare."); return 0; }
    }
    var valueAt = function (f) { return OR ? mt_qToEuler(mt_qAlong(OR.qa, OR.qb, f), OR.order) : (SH ? mt_shapeLerp(v0, v1, f) : inflect_lerpValue(v0, v1, f)); };

    // 1. Inserisce i keyframe intermedi (curve multi punto).
    var used = [{ pi: 0, time: t0 }];
    if (isMulti) {
        var inner = [];
        var lastTime = t0;
        for (var i = 1; i < pts.length - 1; i++) {
            var tt = t0 + pts[i].t * T;
            if (plan.snapFrames) tt = inflect_frameRound(comp, tt);
            if (tt <= lastTime + 1e-6 || tt >= t1 - 1e-6) { dropped++; continue; } // collisione col frame precedente
            inner.push({ pi: i, time: tt });
            lastTime = tt;
        }
        for (var n = inner.length - 1; n >= 0; n--) {
            var val = valueAt(pts[inner[n].pi].v);
            prop.setValueAtTime(inner[n].time, val);
        }
        for (var m = 0; m < inner.length; m++) used.push(inner[m]);
    }
    used.push({ pi: pts.length - 1, time: t1 });
    if (isMulti && used.length > 2) {
        var innerT = [];
        for (var w = 1; w < used.length - 1; w++) innerT.push(used[w].time);
        INFLECT_SPANS.push({ id: inflect_propId(prop), t0: t0, t1: t1, inner: innerT });
        if (INFLECT_SPANS.length > 300) INFLECT_SPANS.shift();
    }

    // 2. Delta per dimensione (o lunghezza del percorso per le propriet\u00e0 spaziali).
    var dims = inflect_easeDims(prop);
    var deltas = [];
    if (numeric) {
        var A = inflect_toArray(v0), B = inflect_toArray(v1);
        if (spatial) {
            var sum = 0;
            for (var d = 0; d < A.length; d++) sum += (B[d] - A[d]) * (B[d] - A[d]);
            deltas.push(Math.sqrt(sum));
        } else {
            for (var d2 = 0; d2 < dims; d2++) deltas.push(B[d2] - A[d2]);
        }
    } else {
        deltas.push(0); // tracciati/testo: si usa solo l'influenza
    }

    /*
     * 3a. Prima di tutto toglie continuita' e auto bezier temporali dai keyframe della curva.
     * Un keyframe continuo tiene la stessa velocita' in entrata e in uscita, e uno auto bezier si
     * ricalcola da solo quando cambiano i vicini: tutti e due appiattivano le maniglie spezzate
     * (rimbalzi, cariche) e i valori tra un keyframe e l'altro non seguivano piu' la curva.
     * Sui keyframe agli estremi si tocca solo il lato del segmento: l'altro lato resta com'era.
     */
    for (var u0 = 0; u0 < used.length; u0++) {
        var ki = a + u0;
        try { prop.setTemporalAutoBezierAtKey(ki, false); } catch (eA) {}
        try { prop.setTemporalContinuousAtKey(ki, false); } catch (eC) {}
    }
    if (spatial && used.length > 2) {
        // Curva multi punto su una posizione: i valori intermedi stanno sulla retta da A a B, quindi il
        // percorso deve essere dritto anche agli estremi. Con due soli keyframe il percorso resta il tuo.
        try {
            var z = (prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) ? [0, 0, 0] : [0, 0];
            prop.setSpatialAutoBezierAtKey(a, false); prop.setSpatialContinuousAtKey(a, false);
            prop.setSpatialTangentsAtKey(a, prop.keyInSpatialTangent(a), z);
            var lastK = a + used.length - 1;
            prop.setSpatialAutoBezierAtKey(lastK, false); prop.setSpatialContinuousAtKey(lastK, false);
            prop.setSpatialTangentsAtKey(lastK, z, prop.keyOutSpatialTangent(lastK));
        } catch (eS) {}
    }

    // 3b. Imposta interpolazione ed easing chiave per chiave.
    for (var u = 0; u < used.length; u++) {
        var keyIndex = a + u;
        var pt = pts[used[u].pi];
        var isFirst = (u === 0), isLast = (u === used.length - 1);

        // Influenza calcolata rispetto alla durata reale del segmento (dopo l'arrotondamento ai frame).
        var segNextN = isLast ? 0 : (used[u + 1].time - used[u].time) / T;
        var segPrevN = isFirst ? 0 : (used[u].time - used[u - 1].time) / T;

        var setIn = !isFirst, setOut = !isLast;
        if (!isMulti) {
            if (plan.mode === "in") setOut = false;
            if (plan.mode === "out") setIn = false;
        }

        var curIn = prop.keyInTemporalEase(keyIndex);
        var curOut = prop.keyOutTemporalEase(keyIndex);
        var inEase = curIn, outEase = curOut;

        // Il numero di voci lo decide After Effects sul keyframe stesso: le liste devono averlo esatto.
        var nIn = curIn.length || 1, nOut = curOut.length || 1;
        // Orientation: la velocita' e' l'angolo dell'arco in gradi al secondo.
        var dIn = OR ? inflect_fill(nIn, OR.angle) : inflect_deltasFor(nIn, v0, v1, spatial, numeric);
        var dOut = OR ? inflect_fill(nOut, OR.angle) : inflect_deltasFor(nOut, v0, v1, spatial, numeric);
        if (setIn) inEase = inflect_buildEase(pt.inSlope, pt.inHandleX, segPrevN, dIn, T, spatial || !!OR, numeric, nIn);
        if (setOut) outEase = inflect_buildEase(pt.outSlope, pt.outHandleX, segNextN, dOut, T, spatial || !!OR, numeric, nOut);

        var inType = setIn ? KeyframeInterpolationType.BEZIER : prop.keyInInterpolationType(keyIndex);
        var outType = setOut ? KeyframeInterpolationType.BEZIER : prop.keyOutInterpolationType(keyIndex);
        prop.setInterpolationTypeAtKey(keyIndex, inType, outType);
        prop.setTemporalEaseAtKey(keyIndex, inEase, outEase);

        if (!isFirst && !isLast) {
            // Keyframe inseriti: niente tangenti spaziali che creerebbero anse nel percorso.
            try { prop.setTemporalContinuousAtKey(keyIndex, false); } catch (e1) {}
            try { prop.setTemporalAutoBezierAtKey(keyIndex, false); } catch (e2) {}
            if (spatial) {
                try {
                    prop.setSpatialAutoBezierAtKey(keyIndex, false);
                    var zero = (prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) ? [0, 0, 0] : [0, 0];
                    prop.setSpatialTangentsAtKey(keyIndex, zero, zero);
                } catch (e3) {}
            }
        }
    }
    if (SH) {
        mt_shapeSetSpeeds(prop, a, used, pts, T, SH.meter);
        if (!plan.live) inflect_checkSegment(prop, a, used, pts, v0, v1, spatial, report, OR, valueAt, SH.meter);
    }
    // Il controllo con i valori di After Effects si fa quando premi Applica, non a ogni movimento dal vivo.
    if (numeric && !plan.live) inflect_checkSegment(prop, a, used, pts, v0, v1, spatial, report, OR, valueAt);
    return dropped;
}

/* Valore della curva del pannello al tempo normalizzato x, ricostruito dal piano (maniglie da pendenza e lunghezza). */
function inflect_planValue(pts, x) {
    var i = 0;
    while (i < pts.length - 2 && pts[i + 1].t < x) i++;
    var A = pts[i], B = pts[i + 1];
    var X = [A.t, A.t + A.outHandleX, B.t - B.inHandleX, B.t];
    var Y = [A.v, A.v + A.outSlope * A.outHandleX, B.v - B.inSlope * B.inHandleX, B.v];
    var bz = function (q, u) { var m = 1 - u; return m * m * m * q[0] + 3 * m * m * u * q[1] + 3 * m * u * u * q[2] + u * u * u * q[3]; };
    var lo = 0, hi = 1;
    for (var n = 0; n < 50; n++) { var mid = (lo + hi) / 2; if (bz(X, mid) < x) lo = mid; else hi = mid; }
    return bz(Y, (lo + hi) / 2);
}

/*
 * Controllo dopo l'applicazione, con i valori calcolati da After Effects (valueAtTime prima delle espressioni): i keyframe
 * intermedi devono avere il valore della curva (se no si rimettono con setValueAtKey) e la curva in
 * After Effects deve seguire quella del pannello. Lo scarto piu' grande finisce nel resoconto.
 */
function inflect_fill(n, x) { var o = []; for (var i = 0; i < n; i++) o.push(x); return o; }

function inflect_checkSegment(prop, a, used, pts, v0, v1, spatial, report, OR, valueAt, meter) {
    var A = meter ? [0] : inflect_toArray(v0), B = meter ? [1] : inflect_toArray(v1), d, dir = [], len = 0, best = 0, bi = 0;
    for (d = 0; d < A.length; d++) { dir.push(B[d] - A[d]); len += (B[d] - A[d]) * (B[d] - A[d]); if (Math.abs(B[d] - A[d]) > Math.abs(B[bi] - A[bi])) bi = d; }
    len = Math.sqrt(len);
    if (len < 1e-9) return;
    var norm = function (v, hint) {
        if (meter) return meter(v);
        if (OR) return mt_qFraction(OR.qa, OR.qb, mt_qFromEuler(inflect_toArray(v), OR.order), hint);
        var arr = inflect_toArray(v), s2 = 0;
        if (spatial) { for (var q = 0; q < arr.length; q++) s2 += (arr[q] - A[q]) * dir[q]; return s2 / (len * len); }
        return (arr[bi] - A[bi]) / (B[bi] - A[bi]);
    };
    var fixed = 0, u;
    for (u = 1; u < used.length - 1; u++) {
        var want = valueAt(pts[used[u].pi].v);
        if (Math.abs(norm(prop.keyValue(a + u), pts[used[u].pi].v) - pts[used[u].pi].v) > 1e-4) {
            try { prop.setValueAtKey(a + u, want); fixed++; } catch (eF) {}
        }
    }
    var t0 = prop.keyTime(a), T = prop.keyTime(a + used.length - 1) - t0, worst = 0, at = 0;
    for (var k = 1; k < 24; k++) {
        var x = k / 24, got = 0;
        var exp = inflect_planValue(pts, x);
        try { got = norm(prop.valueAtTime(t0 + x * T, true), exp); } catch (eV) { return; }
        var dev = Math.abs(got - exp);
        if (dev > worst) { worst = dev; at = x; }
    }
    if (!report) return;
    report.check = report.check || [];
    report.check.push({ prop: prop.name, spatial: spatial, orient: OR ? OR.order + (OR.ok ? "" : "?") : undefined, worst: Math.round(worst * 1000) / 10, at: Math.round(at * 100), fixed: fixed, keys: used.length });
}

/**
 * slope: dv/dt normalizzato; handleX: lunghezza orizzontale della maniglia (normalizzata);
 * segN: durata normalizzata del segmento su cui agisce la maniglia.
 */
// Variazioni per ogni voce di easing: una sola (modulo del movimento) per spaziali e valori singoli, altrimenti per componente.
function inflect_deltasFor(n, v0, v1, spatial, numeric) {
    var out = [], i;
    if (!numeric) { for (i = 0; i < n; i++) out.push(0); return out; }
    var A = inflect_toArray(v0), B = inflect_toArray(v1);
    if (spatial || n === 1) {
        var sum = 0;
        for (i = 0; i < A.length; i++) sum += (B[i] - A[i]) * (B[i] - A[i]);
        for (i = 0; i < n; i++) out.push(Math.sqrt(sum));
        return out;
    }
    for (i = 0; i < n; i++) out.push(B[i] - A[i]);
    return out;
}

function inflect_buildEase(slope, handleX, segN, deltas, T, spatial, numeric, n) {
    var infl = segN > 0 ? (handleX / segN) * 100 : 33.33;
    infl = inflect_clamp(infl, 0.1, 100);
    var out = [];
    for (var d = 0; d < n; d++) {
        var speed = 0;
        if (numeric) {
            var delta = deltas[d];
            speed = slope * delta / T;
            if (spatial) speed = Math.abs(speed);
        }
        if (!isFinite(speed)) speed = 0;
        out.push(new KeyframeEase(speed, infl));
    }
    return out;
}

