var MT_BUILD = "2.37.0-b82c1c2d";
function inflect_build() { return MT_BUILD; }
/*
 * Curve \u00b7 host.jsx
 * Lato After Effects (ExtendScript, ES3). Il pannello HTML calcola la curva in
 * spazio normalizzato; qui la si scala sui valori reali dei keyframe.
 *
 * Ogni funzione pubblica restituisce una stringa JSON: { ok: bool, ... }.
 */

var INFLECT_VERSION = "2.0.0";
var INFLECT_NS = "https://inflect.tools/ns/1.0/";
var INFLECT_PREFIX = "inflect:";
var INFLECT_FOLDER_NAME = "Motion Tools \u00b7 curve del progetto";
var INFLECT_OLD_FOLDER_NAMES = ["Inflect \u00b7 Curve del progetto", "Curve \u00b7 libreria del progetto"];

/* ------------------------------------------------------------------ JSON -- */

function inflect_quote(s) {
    s = String(s);
    var out = '"';
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), code = s.charCodeAt(i);
        if (c === '"') out += '\\"';
        else if (c === '\\') out += '\\\\';
        else if (c === '\n') out += '\\n';
        else if (c === '\r') out += '\\r';
        else if (c === '\t') out += '\\t';
        else if (code < 32) out += '\\u' + ('0000' + code.toString(16)).slice(-4);
        else out += c;
    }
    return out + '"';
}

function inflect_stringify(v) {
    if (v === null || v === undefined) return 'null';
    var t = typeof v;
    if (t === 'number') return isFinite(v) ? String(v) : 'null';
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') return inflect_quote(v);
    if (v instanceof Array) {
        var a = [];
        for (var i = 0; i < v.length; i++) a.push(inflect_stringify(v[i]));
        return '[' + a.join(',') + ']';
    }
    var parts = [];
    for (var k in v) {
        if (v.hasOwnProperty(k) && typeof v[k] !== 'function') {
            parts.push(inflect_quote(k) + ':' + inflect_stringify(v[k]));
        }
    }
    return '{' + parts.join(',') + '}';
}

function inflect_parse(s) {
    // Input proveniente solo dal nostro pannello o dai nostri file.
    if (typeof JSON !== 'undefined' && JSON.parse) return JSON.parse(s);
    return eval('(' + s + ')');
}


/* ------------------------------------------------- gruppi di annullamento -- */
/*
 * After Effects segnala "Undo group mismatch, will attempt to fix" (e annulla da solo qualche passo)
 * quando si apre un gruppo di annullamento prima di aver chiuso il precedente, o se ne chiude uno
 * che non c'e'. Qui c'e' un solo gruppo vero per volta: le funzioni che ne chiamano altre (per
 * esempio Collega falloff, che aggiunge un comportamento) contano solo il livello, e il gruppo vero
 * si apre al primo mt_begin e si chiude all'ultimo mt_end. Alla fine di ogni chiamata del pannello
 * mt_flushUndo chiude quello rimasto aperto per un errore, una volta sola.
 */
function mt_begin(name) {
    var d = $.global.MT_UD || 0;
    if (d === 0) app.beginUndoGroup(name);
    $.global.MT_UD = d + 1;
}
function mt_end() {
    var d = $.global.MT_UD || 0;
    if (d <= 0) return;
    $.global.MT_UD = d - 1;
    if (d === 1) app.endUndoGroup();
}
function mt_flushUndo() {
    if (($.global.MT_UD || 0) > 0) { $.global.MT_UD = 0; try { app.endUndoGroup(); } catch (e) {} }
    return "";
}

function inflect_ok(obj) { obj = obj || {}; obj.ok = true; return inflect_stringify(obj); }
function inflect_err(msg) { return inflect_stringify({ ok: false, error: String(msg) }); }


/* Annulla (o ripeti) in After Effects, times volte: un gesto del pannello puo' aver fatto piu' passi. */
function inflect_aeUndo(redo, times) {
    try {
        mt_flushUndo();
        var n = Math.max(1, Math.min(60, Math.round(times || 1)));
        for (var i = 0; i < n; i++) app.executeCommand(redo ? 2035 : 16);
        return inflect_ok({ steps: n });
    } catch (e) { return inflect_err("Annulla non riuscito: " + e); }
}
/* --------------------------------------------------------------- helpers -- */

var INFLECT_LAST_COMP = 0;

/*
 * Composizione su cui lavorare. Quando il fuoco passa al pannello o al pannello Progetto,
 * After Effects puo' non indicare piu' una composizione attiva: si usa l'ultima vista.
 */
function inflect_activeComp() {
    if (!app.project) return null;
    var item = null;
    try { item = app.project.activeItem; } catch (e) {}
    if (item && item instanceof CompItem) { INFLECT_LAST_COMP = item.id; return item; }
    if (INFLECT_LAST_COMP) {
        try {
            var c = app.project.itemByID(INFLECT_LAST_COMP);
            if (c && c instanceof CompItem) return c;
        } catch (e2) {}
    }
    return null;
}

function inflect_isNumericType(pvt) {
    return pvt === PropertyValueType.OneD ||
        pvt === PropertyValueType.TwoD ||
        pvt === PropertyValueType.ThreeD ||
        pvt === PropertyValueType.TwoD_SPATIAL ||
        pvt === PropertyValueType.ThreeD_SPATIAL ||
        pvt === PropertyValueType.COLOR;
}

function inflect_isSpatial(prop) {
    var pvt = prop.propertyValueType;
    return pvt === PropertyValueType.TwoD_SPATIAL || pvt === PropertyValueType.ThreeD_SPATIAL;
}

function inflect_toArray(v) { return (v instanceof Array) ? v : [v]; }

function inflect_easeDims(prop) {
    if (!inflect_isNumericType(prop.propertyValueType)) return 1;
    if (inflect_isSpatial(prop)) return 1;
    var v = prop.keyValue(1);
    return (v instanceof Array) ? v.length : 1;
}

function inflect_lerpValue(a, b, k) {
    if (a instanceof Array) {
        var out = [];
        for (var i = 0; i < a.length; i++) out.push(a[i] + (b[i] - a[i]) * k);
        return out;
    }
    return a + (b - a) * k;
}

function inflect_clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

function inflect_sortNum(a, b) { return a - b; }

/** Propriet\u00e0 animate con almeno un keyframe selezionato. */
function inflect_selectedKeyedProps(comp) {
    var out = [];
    var props = comp.selectedProperties;
    for (var i = 0; i < props.length; i++) {
        var p = props[i];
        if (p.propertyType !== PropertyType.PROPERTY) continue;
        if (!p.canVaryOverTime || p.numKeys < 1) continue;
        var sel = p.selectedKeys;
        if (!sel || sel.length < 1) continue;
        var copy = [];
        for (var j = 0; j < sel.length; j++) copy.push(sel[j]);
        copy.sort(inflect_sortNum);
        out.push({ prop: p, keys: copy });
    }
    return out;
}

function inflect_frameRound(comp, t) {
    var fd = comp.frameDuration;
    return Math.round(t / fd) * fd;
}


/*
 * Layer per ID. Project.layerByID esiste da After Effects 22.0 (2022): nelle versioni precedenti, o se
 * l'ID non e' valido, si cerca nei layer di tutte le composizioni. Restituisce null se non c'e'.
 */
function mt_layerById(id) {
    try { if (typeof app.project.layerByID === "function") { var L = app.project.layerByID(id); if (L) return L; } } catch (e) {}
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!(it instanceof CompItem)) continue;
        for (var k = 1; k <= it.numLayers; k++) { try { if (it.layer(k).id === id) return it.layer(k); } catch (e2) {} }
    }
    return null;
}
/* ----------------------------------------------------------------- ping -- */

function inflect_ping() {
    try {
        var name = (app.project && app.project.file) ? app.project.file.displayName : "Progetto senza titolo";
        return inflect_ok({ version: INFLECT_VERSION, ae: app.version, project: name });
    } catch (e) { return inflect_err(e); }
}

/** Info leggere per l'interfaccia: quante propriet\u00e0 e coppie sono selezionate. */
function inflect_selectionInfo() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_ok({ props: 0, pairs: 0, duration: 0, fps: 0 });
        var list = inflect_selectedKeyedProps(comp);
        var pairs = 0, dur = 0;
        for (var i = 0; i < list.length; i++) {
            var k = list[i].keys;
            for (var j = 0; j < k.length - 1; j++) {
                if (k[j + 1] === k[j] + 1) {
                    pairs++;
                    if (!dur) dur = list[i].prop.keyTime(k[j + 1]) - list[i].prop.keyTime(k[j]);
                }
            }
        }
        return inflect_ok({ props: list.length, pairs: pairs, duration: dur, fps: 1 / comp.frameDuration, comp: comp.name });
    } catch (e) { return inflect_err(e); }
}

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

/* ----------------------------------------------------------------- read -- */

/**
 * Legge la curva dai keyframe selezionati della prima propriet\u00e0 valida.
 * Restituisce punti normalizzati con slope e lunghezza maniglia, come li usa il pannello.
 */
function inflect_read() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_err("Apri una composizione.");
        var list = inflect_selectedKeyedProps(comp);
        var target = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].keys.length >= 2 && (inflect_isNumericType(list[i].prop.propertyValueType) || mt_isShapeProp(list[i].prop))) { target = list[i]; break; }
        }
        if (!target) return inflect_err("Seleziona almeno due keyframe su una propriet\u00e0 con valori numerici o su un tracciato.");
        // Tracciati (maschere, forme): avanzamento dei punti tra il primo e l'ultimo keyframe.
        if (mt_isShapeProp(target.prop)) {
            var rs = mt_readShape(target.prop, target.keys);
            if (rs.error) return inflect_err(rs.error);
            return inflect_ok({ points: rs.points, property: target.prop.name, duration: rs.duration });
        }

        var prop = target.prop;
        var first = target.keys[0], last = target.keys[target.keys.length - 1];
        var t0 = prop.keyTime(first), tN = prop.keyTime(last), T = tN - t0;
        var V0 = inflect_toArray(prop.keyValue(first)), VN = inflect_toArray(prop.keyValue(last));
        var spatial = inflect_isSpatial(prop);

        // Asse di proiezione: direzione del movimento (spaziale) o dimensione che cambia di pi\u00f9.
        var dimIdx = 0, dir = null, total = 0;
        if (spatial) {
            dir = [];
            var len = 0;
            for (var d = 0; d < V0.length; d++) { dir.push(VN[d] - V0[d]); len += (VN[d] - V0[d]) * (VN[d] - V0[d]); }
            len = Math.sqrt(len);
            if (len === 0) return inflect_err("Il primo e l'ultimo keyframe hanno lo stesso valore: non c'\u00e8 una direzione da leggere.");
            for (var d1 = 0; d1 < dir.length; d1++) dir[d1] /= len;
            total = len;
        } else {
            var best = 0;
            for (var d2 = 0; d2 < V0.length; d2++) {
                var dd = Math.abs(VN[d2] - V0[d2]);
                if (dd > best) { best = dd; dimIdx = d2; }
            }
            total = VN[dimIdx] - V0[dimIdx];
            if (total === 0) return inflect_err("Il primo e l'ultimo keyframe hanno lo stesso valore: non c'\u00e8 una curva da leggere.");
        }

        // Orientation: frazione dell'arco tra il primo e l'ultimo keyframe (ordine degli assi letto all'ultima applicazione).
        var OR = null;
        if (mt_isOrientation(prop)) {
            var ord = $.global.MT_ORIENT_ORDER || "XYZ";
            var qa = mt_qFromEuler(V0, ord), qb = mt_qFromEuler(VN, ord), ang = mt_qRel(qa, qb).angle;
            if (ang > 1e-6) { OR = { order: ord, qa: qa, qb: qb }; total = ang; }
        }
        var project = function (v) {
            if (OR) return mt_qFraction(OR.qa, OR.qb, mt_qFromEuler(inflect_toArray(v), OR.order));
            var arr = inflect_toArray(v);
            if (spatial) {
                var s = 0;
                for (var q = 0; q < arr.length; q++) s += (arr[q] - V0[q]) * dir[q];
                return s / total;
            }
            return (arr[dimIdx] - V0[dimIdx]) / total;
        };

        var avgSpeed = total / T; // unit\u00e0 per secondo, normalizzazione delle velocit\u00e0
        var points = [];
        for (var k = first; k <= last; k++) {
            var tn = (prop.keyTime(k) - t0) / T;
            var vn = project(prop.keyValue(k));
            var pt = { t: tn, v: vn, inSlope: 0, inHandleX: 0, outSlope: 0, outHandleX: 0, inLinear: false, outLinear: false };
            var ei = prop.keyInTemporalEase(k), eo = prop.keyOutTemporalEase(k);
            var ii = spatial ? 0 : Math.min(dimIdx, ei.length - 1);
            var io = spatial ? 0 : Math.min(dimIdx, eo.length - 1);
            var segPrev = k > first ? tn - (prop.keyTime(k - 1) - t0) / T : 0;
            var segNext = k < last ? (prop.keyTime(k + 1) - t0) / T - tn : 0;

            var sIn = ei[ii].speed / avgSpeed, sOut = eo[io].speed / avgSpeed;
            if (spatial) {
                // La velocit\u00e0 spaziale \u00e8 sempre positiva: il segno lo d\u00e0 la direzione del segmento.
                if (k > first && project(prop.keyValue(k - 1)) > vn) sIn = -sIn;
                if (k < last && project(prop.keyValue(k + 1)) < vn) sOut = -sOut;
            }
            pt.inSlope = sIn;
            pt.outSlope = sOut;
            pt.inHandleX = segPrev * ei[ii].influence / 100;
            pt.outHandleX = segNext * eo[io].influence / 100;
            pt.inLinear = prop.keyInInterpolationType(k) !== KeyframeInterpolationType.BEZIER;
            pt.outLinear = prop.keyOutInterpolationType(k) !== KeyframeInterpolationType.BEZIER;
            points.push(pt);
        }
        return inflect_ok({ points: points, property: prop.name, duration: T });
    } catch (e) { return inflect_err(e); }
}

/* ------------------------------------------------ brand library (XMP) -- */

function inflect_loadXMPLib() {
    if (ExternalObject.AdobeXMPScript === undefined) {
        ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
    }
}

/** Legge la libreria brand salvata dentro il file di progetto (.aep). */
function inflect_loadProject() {
    try {
        if (!app.project) return inflect_ok({ library: null });
        inflect_loadXMPLib();
        var xmp = new XMPMeta(app.project.xmpPacket);
        XMPMeta.registerNamespace(INFLECT_NS, INFLECT_PREFIX);
        var prop = xmp.getProperty(INFLECT_NS, "library");
        var lib = prop ? inflect_parse(String(prop.value)) : null;
        return inflect_ok({ library: lib });
    } catch (e) { return inflect_err("Lettura della libreria brand non riuscita: " + e); }
}

/** Scrive la libreria brand nel progetto e segnala la modifica nel pannello Progetto. */
function inflect_saveProject(libJSON) {
    try {
        if (!app.project) return inflect_err("Nessun progetto aperto.");
        var lib = inflect_parse(libJSON);
        inflect_loadXMPLib();
        mt_begin("Motion Tools: aggiorna curve del progetto");
        var xmp = new XMPMeta(app.project.xmpPacket);
        XMPMeta.registerNamespace(INFLECT_NS, INFLECT_PREFIX);
        xmp.setProperty(INFLECT_NS, "library", libJSON);
        xmp.setProperty(INFLECT_NS, "updated", new Date().toUTCString());
        app.project.xmpPacket = xmp.serialize(XMPConst.SERIALIZE_USE_COMPACT_FORMAT);

        // Cartella segnaposto: rende visibile che il progetto contiene brand curves
        // e marca il progetto come modificato, cos\u00ec Cmd+S lo salva davvero.
        var count = (lib && lib.curves) ? lib.curves.length : 0;
        var folder = inflect_findFolder();
        if (count > 0) {
            if (!folder) folder = app.project.items.addFolder(INFLECT_FOLDER_NAME);
            folder.comment = count + " curve salvate nel progetto \u00b7 aggiornato " + new Date().toLocaleString();
            folder.label = 0;
        } else if (folder && folder.numItems === 0) {
            folder.remove();
        }
        mt_end();
        return inflect_ok({ count: count });
    } catch (e) {
        try { mt_end(); } catch (e2) {}
        return inflect_err("Salvataggio nel progetto non riuscito: " + e);
    }
}

function inflect_findFolder() {
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof FolderItem && (it.name === INFLECT_OLD_FOLDER_NAMES[0] || it.name === INFLECT_OLD_FOLDER_NAMES[1])) it.name = INFLECT_FOLDER_NAME;
        if (it instanceof FolderItem && it.name === INFLECT_FOLDER_NAME) return it;
    }
    return null;
}

/* ------------------------------------------------- libreria personale -- */

function inflect_userFile() {
    var dir = inflect_dataDir();
    return new File(dir.fsName + "/library.json");
}

function inflect_readText(f) {
    f.encoding = "UTF-8";
    if (!f.open("r")) return null;
    var s = f.read();
    f.close();
    return s;
}

function inflect_writeText(f, s) {
    f.encoding = "UTF-8";
    if (!f.open("w")) return false;
    f.write(s);
    f.close();
    return true;
}

function inflect_loadUser() {
    try {
        var f = inflect_userFile();
        if (!f.exists) return inflect_ok({ library: null });
        var s = inflect_readText(f);
        return inflect_ok({ library: s ? inflect_parse(s) : null });
    } catch (e) { return inflect_err(e); }
}

function inflect_saveUser(libJSON) {
    try {
        var f = inflect_userFile();
        if (!inflect_writeText(f, libJSON)) return inflect_err("Non riesco a scrivere " + f.fsName);
        return inflect_ok({ path: f.fsName });
    } catch (e) { return inflect_err(e); }
}

/* ------------------------------------------------ import / export file -- */

function inflect_exportFile(libJSON, suggestedName) {
    try {
        var f = new File(Folder.desktop.fsName + "/" + (suggestedName || "brand-curves") + ".curve.json");
        var target = f.saveDlg("Esporta curve", "JSON:*.json");
        if (!target) return inflect_ok({ cancelled: true });
        if (!inflect_writeText(target, libJSON)) return inflect_err("Non riesco a scrivere il file.");
        return inflect_ok({ path: target.fsName });
    } catch (e) { return inflect_err(e); }
}

function inflect_importFile() {
    try {
        var f = File.openDialog("Importa curve", "JSON:*.json", false);
        if (!f) return inflect_ok({ cancelled: true });
        var s = inflect_readText(f);
        return inflect_ok({ library: inflect_parse(s), name: f.displayName });
    } catch (e) { return inflect_err("File non valido: " + e); }
}

/* ------------------------------------------------------------- audit -- */

/**
 * Controlla gli easing della composizione attiva rispetto alle curve brand semplici.
 * brandJSON = [{ id, name, x1, y1, x2, y2 }]
 */
function inflect_audit(brandJSON, selectOffenders) {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_err("Apri la composizione da controllare.");
        var brand = inflect_parse(brandJSON);
        var stats = { brand: 0, linear: 0, easyEase: 0, custom: 0, hold: 0, total: 0 };
        var byCurve = {};
        var offenders = [];
        var tol = 0.04;

        if (selectOffenders) {
            for (var s = 0; s < comp.selectedLayers.length; s++) comp.selectedLayers[s].selected = false;
        }

        var walk = function (group, layer) {
            for (var i = 1; i <= group.numProperties; i++) {
                var p = group.property(i);
                if (!p) continue;
                if (p.propertyType === PropertyType.PROPERTY) {
                    if (p.numKeys >= 2 && inflect_isNumericType(p.propertyValueType)) checkProp(p, layer);
                } else {
                    walk(p, layer);
                }
            }
        };

        var checkProp = function (p, layer) {
            var spatial = inflect_isSpatial(p);
            for (var k = 1; k < p.numKeys; k++) {
                stats.total++;
                var outT = p.keyOutInterpolationType(k), inT = p.keyInInterpolationType(k + 1);
                if (outT === KeyframeInterpolationType.HOLD) { stats.hold++; continue; }
                if (outT === KeyframeInterpolationType.LINEAR && inT === KeyframeInterpolationType.LINEAR) {
                    stats.linear++; flag(p, layer, k, "lineare"); continue;
                }
                var c = inflect_segmentCubic(p, k, spatial);
                if (!c) { stats.custom++; continue; }
                var hit = null;
                for (var b = 0; b < brand.length; b++) {
                    var bc = brand[b];
                    if (Math.abs(bc.x1 - c[0]) < tol && Math.abs(bc.y1 - c[1]) < tol &&
                        Math.abs(bc.x2 - c[2]) < tol && Math.abs(bc.y2 - c[3]) < tol) { hit = bc; break; }
                }
                if (hit) {
                    stats.brand++;
                    byCurve[hit.name] = (byCurve[hit.name] || 0) + 1;
                } else if (Math.abs(c[0] - 0.3333) < tol && Math.abs(c[1]) < tol && Math.abs(c[2] - 0.6667) < tol && Math.abs(c[3] - 1) < tol) {
                    stats.easyEase++; flag(p, layer, k, "Easy Ease");
                } else {
                    stats.custom++; flag(p, layer, k, "fuori brand");
                }
            }
        };

        var flag = function (p, layer, k, why) {
            if (offenders.length < 200) {
                offenders.push({ layer: layer.name, prop: p.name, time: Math.round(p.keyTime(k) / comp.frameDuration), why: why });
            }
            if (selectOffenders) {
                try { p.setSelectedAtKey(k, true); p.setSelectedAtKey(k + 1, true); } catch (e) {}
            }
        };

        for (var l = 1; l <= comp.numLayers; l++) {
            var layer = comp.layer(l);
            walk(layer, layer);
        }
        return inflect_ok({ stats: stats, byCurve: byCurve, offenders: offenders, comp: comp.name });
    } catch (e) { return inflect_err(e); }
}

/** Ricava i parametri cubic-bezier di un segmento AE (k \u2192 k+1). */
function inflect_segmentCubic(p, k, spatial) {
    var T = p.keyTime(k + 1) - p.keyTime(k);
    if (T <= 0) return null;
    var A = inflect_toArray(p.keyValue(k)), B = inflect_toArray(p.keyValue(k + 1));
    var dim = 0, total = 0;
    if (spatial) {
        for (var d = 0; d < A.length; d++) total += (B[d] - A[d]) * (B[d] - A[d]);
        total = Math.sqrt(total);
    } else {
        var best = 0;
        for (var d2 = 0; d2 < A.length; d2++) {
            if (Math.abs(B[d2] - A[d2]) > best) { best = Math.abs(B[d2] - A[d2]); dim = d2; }
        }
        total = B[dim] - A[dim];
    }
    if (total === 0) return null;
    var avg = total / T;
    var eo = p.keyOutTemporalEase(k), ei = p.keyInTemporalEase(k + 1);
    var io = spatial ? 0 : Math.min(dim, eo.length - 1), ii = spatial ? 0 : Math.min(dim, ei.length - 1);
    var x1 = eo[io].influence / 100, x2 = 1 - ei[ii].influence / 100;
    var y1 = x1 * eo[io].speed / avg;
    var y2 = 1 - (1 - x2) * ei[ii].speed / avg;
    return [x1, y1, x2, y2];
}

/* ------------------------------------------- libreria brand condivisa -- */
/*
 * Le librerie brand sono file .inflect.json in una cartella. Di default la cartella
 * sta dentro i dati del plugin; si puo' spostare su una cartella sincronizzata
 * (Synology Drive, Dropbox, Creative Cloud Files, server) per condividerla col team.
 */

function inflect_dataDir() {
    var root = Folder.userData.fsName;
    var dir = new Folder(root + "/Motion Tools");
    if (!dir.exists) {
        // Dati delle versioni precedenti (Curve, Inflect): si rinomina la cartella.
        var olds = ["Curve", "Inflect"];
        for (var i = 0; i < olds.length; i++) {
            var old = new Folder(root + "/" + olds[i]);
            if (old.exists) { try { old.rename("Motion Tools"); } catch (e) {} break; }
        }
        dir = new Folder(root + "/Motion Tools");
        if (!dir.exists) dir.create();
    }
    return dir;
}

function inflect_settings() {
    var f = new File(inflect_dataDir().fsName + "/settings.json");
    var s = f.exists ? inflect_readText(f) : null;
    var obj = {};
    try { if (s) obj = inflect_parse(s); } catch (e) { obj = {}; }
    return obj;
}

function inflect_saveSettings(obj) {
    inflect_writeText(new File(inflect_dataDir().fsName + "/settings.json"), inflect_stringify(obj));
}

// Una sola impostazione alla volta, solo tra quelle previste.
function inflect_settingSet(key, value) {
    try {
        var allowed = { githubRepo: 1, updateChannel: 1 };
        if (!allowed[key]) return inflect_err("Impostazione sconosciuta: " + key);
        var st = inflect_settings();
        if (value === "" || value === null) delete st[key]; else st[key] = String(value);
        inflect_saveSettings(st);
        return inflect_ok({ key: key, value: st[key] || "" });
    } catch (e) { return inflect_err(e); }
}

function inflect_sharedDir() {
    var st = inflect_settings();
    var dir = st.sharedFolder ? new Folder(st.sharedFolder) : null;
    if (!dir || !dir.exists) {
        dir = new Folder(inflect_dataDir().fsName + "/Brand");
        if (!dir.exists) dir.create();
    }
    return dir;
}

function inflect_libFiles(dir) {
    var files = dir.getFiles(function (f) { return (f instanceof File) && /\.(curve|inflect)\.json$/i.test(f.name); });
    return files || [];
}

function inflect_slug(name) {
    var s = String(name || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "brand";
}

/** Elenco delle librerie nella cartella condivisa e quella attiva. */
function inflect_sharedList() {
    try {
        var st = inflect_settings();
        var dir = inflect_sharedDir();
        var files = inflect_libFiles(dir);
        if (!files.length) {
            // Prima volta: crea una libreria vuota.
            var first = new File(dir.fsName + "/brand.curve.json");
            inflect_writeText(first, inflect_stringify({ format: "inflect-library", version: 1, name: "Brand", owner: "", locked: false, curves: [], updated: new Date().getTime() }));
            files = [first];
        }
        var out = [], active = null;
        for (var i = 0; i < files.length; i++) {
            var f = files[i], name = decodeURI(f.name), count = 0, title = name;
            try {
                var lib = inflect_parse(inflect_readText(f));
                count = lib.curves ? lib.curves.length : 0;
                title = lib.name || name;
            } catch (e) {}
            out.push({ file: decodeURI(f.name), name: title, count: count, modified: f.modified ? f.modified.getTime() : 0 });
            if (st.activeLibrary === decodeURI(f.name)) active = st.activeLibrary;
        }
        if (!active) active = out[0].file;
        var isDefault = !st.sharedFolder || !(new Folder(st.sharedFolder)).exists;
        return inflect_ok({ folder: dir.fsName, folderName: decodeURI(dir.name), isDefault: isDefault, libraries: out, active: active });
    } catch (e) { return inflect_err("Non riesco a leggere la cartella brand: " + e); }
}

function inflect_sharedChooseFolder() {
    try {
        var cur = inflect_sharedDir();
        var dir = cur.selectDlg("Scegli la cartella condivisa con le curve brand");
        if (!dir) return inflect_ok({ cancelled: true });
        var st = inflect_settings();
        st.sharedFolder = dir.fsName;
        st.activeLibrary = null;
        inflect_saveSettings(st);
        return inflect_sharedList();
    } catch (e) { return inflect_err(e); }
}

function inflect_sharedResetFolder() {
    var st = inflect_settings();
    st.sharedFolder = null;
    st.activeLibrary = null;
    inflect_saveSettings(st);
    return inflect_sharedList();
}

function inflect_sharedSetActive(fileName) {
    var st = inflect_settings();
    st.activeLibrary = fileName;
    inflect_saveSettings(st);
    return inflect_ok({});
}

function inflect_sharedFile(fileName) {
    return new File(inflect_sharedDir().fsName + "/" + fileName);
}

function inflect_sharedLoad(fileName) {
    try {
        var f = inflect_sharedFile(fileName);
        if (!f.exists) return inflect_err("La libreria " + fileName + " non esiste piu' nella cartella condivisa.");
        var s = inflect_readText(f);
        return inflect_ok({ library: inflect_parse(s), modified: f.modified.getTime() });
    } catch (e) { return inflect_err("Libreria non leggibile: " + e); }
}

/** Data di modifica: il pannello la controlla per accorgersi delle modifiche dei colleghi. */
function inflect_sharedStat(fileName) {
    try {
        var f = inflect_sharedFile(fileName);
        return inflect_ok({ exists: f.exists, modified: f.exists ? f.modified.getTime() : 0 });
    } catch (e) { return inflect_err(e); }
}

function inflect_sharedSave(fileName, libJSON) {
    try {
        var f = inflect_sharedFile(fileName);
        // Scrive su un file temporaneo e poi lo sostituisce, cosi' la sincronizzazione non legge file a meta'.
        var tmp = new File(f.fsName + ".tmp");
        if (!inflect_writeText(tmp, libJSON)) return inflect_err("Non riesco a scrivere nella cartella condivisa. Controlla i permessi.");
        if (f.exists) f.remove();
        tmp.rename(decodeURI(f.name));
        f = inflect_sharedFile(fileName);
        return inflect_ok({ modified: f.modified ? f.modified.getTime() : 0 });
    } catch (e) { return inflect_err("Salvataggio della libreria non riuscito: " + e); }
}

function inflect_sharedCreate(name) {
    try {
        var dir = inflect_sharedDir();
        var base = inflect_slug(name), fname = base + ".curve.json", n = 2;
        while ((new File(dir.fsName + "/" + fname)).exists) { fname = base + "-" + n + ".curve.json"; n++; }
        var lib = { format: "inflect-library", version: 1, name: name || "Brand", owner: "", locked: false, curves: [], updated: new Date().getTime() };
        inflect_writeText(new File(dir.fsName + "/" + fname), inflect_stringify(lib));
        inflect_sharedSetActive(fname);
        return inflect_ok({ file: fname });
    } catch (e) { return inflect_err(e); }
}

function inflect_revealShared() {
    try { inflect_sharedDir().execute(); return inflect_ok({}); } catch (e) { return inflect_err(e); }
}

/* ------------------------------------------------------ velocita' -- */
/*
 * Cambia il picco di velocita' dei segmenti selezionati di una percentuale,
 * senza spostare i keyframe e senza cambiarne i valori o il tipo di interpolazione.
 * Ogni segmento viene avvicinato (o allontanato) dalla sua versione lineare finche'
 * il picco non e' quello richiesto. Il punto di partenza e' l'easing al momento in cui
 * la selezione e' stata "agganciata", cosi' trascinare piu' volte non accumula errori.
 */

var INFLECT_SPEED = null; // { sig, pct, items: [{ prop, a, outEase, inEase }] }

/*
 * Riferimento stabile a una proprieta': After Effects invalida gli oggetti tra una
 * chiamata e l'altra (dopo un annulla, un cambio di selezione...), quindi si salva
 * il percorso e lo si risolve di nuovo quando serve.
 */
function fin(x, d) { return (typeof x === "number" && isFinite(x)) ? x : d; }

function mt_propRef(p) {
    var path = [], cur = p;
    try { while (cur && cur.parentProperty) { path.unshift(cur.propertyIndex); cur = cur.parentProperty; } } catch (e) {}
    var o = { lid: 0, cid: 0, lix: 0, path: path };
    try { var layer = p.propertyGroup(p.propertyDepth); o.lix = layer.index; o.cid = layer.containingComp.id; o.lid = layer.id; } catch (e1) {}
    return o;
}

function mt_propGet(ref) {
    if (!ref) return null;
    var L = null;
    try { if (ref.lid) L = mt_layerById(ref.lid); } catch (e) { L = null; }
    if (!L) { try { L = app.project.itemByID(ref.cid).layer(ref.lix); } catch (e2) { L = null; } }
    if (!L) return null;
    try {
        var p = L;
        for (var i = 0; i < ref.path.length; i++) p = p.property(ref.path[i]);
        return p;
    } catch (e3) { return null; }
}

function mt_live(obj) {
    // Usa il riferimento salvato; se non si risolve prova l'oggetto originale.
    var p = mt_propGet(obj.ref);
    if (p) return p;
    try { var test = obj.prop.numKeys; return obj.prop; } catch (e) { return null; }
}

function inflect_selectionSignature(list) {
    var parts = [];
    for (var i = 0; i < list.length; i++) {
        var p = list[i].prop;
        var path = [];
        var cur = p;
        try { while (cur && cur.parentProperty) { path.push(cur.propertyIndex); cur = cur.parentProperty; } } catch (e) {}
        var layer = p.propertyGroup(p.propertyDepth);
        parts.push((layer ? layer.index : 0) + ":" + path.join(".") + "@" + list[i].keys.join(","));
    }
    return parts.join("|");
}

function inflect_copyEase(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) out.push(new KeyframeEase(arr[i].speed, arr[i].influence));
    return out;
}

/** Aggancia la selezione corrente; se e' la stessa di prima restituisce la percentuale gia' applicata. */
function inflect_speedBegin() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_err("Apri una composizione.");
        var list = inflect_selectedKeyedProps(comp);
        var sig = inflect_selectionSignature(list);
        if (INFLECT_SPEED && INFLECT_SPEED.sig === sig && INFLECT_SPEED.compId === comp.id &&
            INFLECT_SPEED.written === inflect_currentEaseSig(INFLECT_SPEED.items)) {
            return inflect_ok({ pct: INFLECT_SPEED.pct, segments: INFLECT_SPEED.items.length, linear: INFLECT_SPEED.linear, hold: INFLECT_SPEED.hold, other: INFLECT_SPEED.other });
        }
        // Code di assestamento tra i keyframe selezionati: si tolgono finche' si regola la velocita'.
        var tails = [], TL = mt_tails(), ids = {}, i0;
        for (i0 = 0; i0 < list.length; i0++) {
            var times = {};
            for (var q0 = 0; q0 < list[i0].keys.length; q0++) times[Math.round(list[i0].prop.keyTime(list[i0].keys[q0]) * 1000)] = 1;
            ids[inflect_propId(list[i0].prop)] = times;
        }
        for (var r0 = TL.length - 1; r0 >= 0; r0--) {
            var rc = TL[r0], tm = ids[rc.id];
            if (!tm || !(tm[Math.round(rc.tK * 1000)] || tm[Math.round(rc.tN * 1000)])) continue;
            tails.push({ ref: rc.ref, side: rc.side, D: rc.D, qWanted: rc.qWanted, t0: rc.shift ? rc.tN : rc.tK, rec: rc });
        }
        if (tails.length) {
            mt_begin("Motion Tools: velocit\u00e0");
            for (var r1 = 0; r1 < tails.length; r1++) {
                inflect_tailRevertOne(tails[r1].rec);
                for (var r2 = TL.length - 1; r2 >= 0; r2--) if (TL[r2] === tails[r1].rec) TL.splice(r2, 1);
            }
            list = inflect_selectedKeyedProps(comp);
            sig = inflect_selectionSignature(list);
        }
        var items = [], linear = 0, hold = 0, other = 0;
        for (var i = 0; i < list.length; i++) {
            var p = list[i].prop, k = list[i].keys;
            var isShape = mt_isShapeProp(p);
            if (!inflect_isNumericType(p.propertyValueType) && !isShape) { other++; continue; }
            for (var j = 0; j < k.length - 1; j++) {
                if (k[j + 1] !== k[j] + 1) continue;
                var a = k[j];
                var ot = p.keyOutInterpolationType(a), it2 = p.keyInInterpolationType(a + 1);
                if (ot === KeyframeInterpolationType.HOLD) { hold++; continue; }
                if (ot !== KeyframeInterpolationType.BEZIER || it2 !== KeyframeInterpolationType.BEZIER) { linear++; continue; }
                var item = { prop: p, ref: mt_propRef(p), a: a, tA: p.keyTime(a), tB: p.keyTime(a + 1), outEase: inflect_copyEase(p.keyOutTemporalEase(a)), inEase: inflect_copyEase(p.keyInTemporalEase(a + 1)) };
                if (isShape) {
                    // Tracciato: la pendenza di partenza si misura su After Effects (l'unita' della velocita' non e' documentata).
                    var meter = mt_shapeCompat(p.keyValue(a), p.keyValue(a + 1)) ? mt_shapeMeter(p.keyValue(a), p.keyValue(a + 1)) : null;
                    if (!meter) { other++; continue; }
                    var Ts = p.keyTime(a + 1) - p.keyTime(a);
                    item.shape = true;
                    item.sOut = mt_shapeSlope(p, a, meter, Ts, 1);
                    item.sIn = mt_shapeSlope(p, a + 1, meter, Ts, -1);
                }
                if (mt_isOrientation(p)) item.orient = true;
                items.push(item);
            }
        }
        INFLECT_SPEED = { sig: sig, compId: comp.id, pct: 0, items: items, linear: linear, hold: hold, other: other, tails: tails, live: [] };
        INFLECT_SPEED.sel = inflect_captureSel(list);
        if (tails.length) {
            mt_speedTailsOn(comp);
            inflect_restoreSel(INFLECT_SPEED.sel);
            mt_end();
            INFLECT_SPEED.sig = inflect_selectionSignature(inflect_selectedKeyedProps(comp));
        }
        INFLECT_SPEED.written = inflect_currentEaseSig(items);
        return inflect_ok({ pct: 0, segments: items.length, linear: linear, hold: hold, other: other });
    } catch (e) { return inflect_err(e); }
}

/** Impronta degli easing attuali: se qualcuno li ha cambiati, si riparte da capo. */
/* Indice del primo keyframe del segmento, ritrovato dal tempo (le code di assestamento aggiungono keyframe). */
function mt_segIndex(p, it) {
    if (it.tA !== undefined) { var k = inflect_keyAt(p, it.tA); if (k && k < p.numKeys) return k; }
    return it.a;
}

/*
 * Lo slider della velocita' con un assestamento selezionato: la coda si toglie, la velocita'
 * si cambia sul movimento originale e la coda si ricalcola con gli stessi frame e la stessa quota.
 */
function mt_speedTailsOff() {
    var live = (INFLECT_SPEED && INFLECT_SPEED.live) || [], TL = mt_tails();
    for (var i = live.length - 1; i >= 0; i--) {
        inflect_tailRevertOne(live[i]);
        for (var r = TL.length - 1; r >= 0; r--) if (TL[r] === live[i]) TL.splice(r, 1);
    }
    if (INFLECT_SPEED) INFLECT_SPEED.live = [];
}

function mt_speedTailsOn(comp) {
    if (!INFLECT_SPEED || !INFLECT_SPEED.tails || !INFLECT_SPEED.tails.length) return;
    var TL = mt_tails(), report = { notes: [] };
    INFLECT_SPEED.live = [];
    for (var i = 0; i < INFLECT_SPEED.tails.length; i++) {
        var m = INFLECT_SPEED.tails[i], p = mt_propGet(m.ref);
        if (!p) continue;
        var K = inflect_keyAt(p, m.t0);
        if (!K) continue;
        var rec = inflect_tailApplyOne(comp, p, K, m.side, m.D, m.qWanted, report);
        if (rec) { TL.push(rec); INFLECT_SPEED.live.push(rec); }
    }
}

function inflect_currentEaseSig(items) {
    var s = [];
    for (var i = 0; i < items.length; i++) {
        try {
            var lp = mt_live(items[i]), ia = mt_segIndex(lp, items[i]);
            var o = lp.keyOutTemporalEase(ia), n = lp.keyInTemporalEase(ia + 1);
            s.push(Math.round(o[0].speed * 10) + "/" + Math.round(o[0].influence * 10) + "/" + Math.round(n[0].speed * 10) + "/" + Math.round(n[0].influence * 10));
        } catch (e) { s.push("x"); }
    }
    return s.join(";");
}

function inflect_peak(x1, y1, x2, y2) {
    var best = 0;
    for (var s = 0; s <= 64; s++) {
        var u = s / 64, m = 1 - u;
        var dx = 3 * m * m * x1 + 6 * m * u * (x2 - x1) + 3 * u * u * (1 - x2);
        var dy = 3 * m * m * y1 + 6 * m * u * (y2 - y1) + 3 * u * u * (1 - y2);
        if (dx > 1e-4) { var v = Math.abs(dy / dx); if (v > best) best = v; }
    }
    return best;
}

function inflect_blend(c, a) {
    // a = 0: curva originale; a = 1: lineare; a < 0: piu' accentuata.
    var x1 = c[0] + (1 / 3 - c[0]) * a, y1 = c[1] + (1 / 3 - c[1]) * a;
    var x2 = c[2] + (2 / 3 - c[2]) * a, y2 = c[3] + (2 / 3 - c[3]) * a;
    return [x1, y1, x2, y2];
}

function inflect_validCubic(c) { return c[0] >= 0.001 && c[0] <= 1 && c[2] >= 0 && c[2] <= 0.999; }

/*
 * Per accelerare: le maniglie si allungano mantenendo la loro pendenza, cosi' la curva parte e
 * arriva come prima (niente velocita' negative, niente rincorsa all'indietro) ma il centro e' piu' rapido.
 */
function inflect_accent(c, b) {
    var x1 = c[0] + (0.98 - c[0]) * b, x2 = c[2] - (c[2] - 0.02) * b;
    var s1 = c[0] > 1e-4 ? c[1] / c[0] : 0, s2 = (1 - c[2]) > 1e-4 ? (1 - c[3]) / (1 - c[2]) : 0;
    // Le pendenze restano quelle di partenza (niente limite a 0..1: con le maniglie ripide il limite
    // le schiacciava e la curva diventava piatta invece di accelerare). Solo il segno non si inverte.
    var y1 = s1 >= 0 ? Math.max(0, s1 * x1) : s1 * x1, y2 = s2 >= 0 ? Math.min(1, 1 - s2 * (1 - x2)) : 1 - s2 * (1 - x2);
    return [x1, y1, x2, y2];
}

/*
 * Slider della velocita': -100 = segmento lineare (velocita' costante, curva piatta), 0 = easing di
 * partenza, +100 = maniglie allungate al massimo (centro piu' rapido possibile). In mezzo si va per gradi.
 */
function inflect_speedCurve(c, pct) {
    if (pct <= 0) return [inflect_blend(c, Math.min(1, -pct / 100)), pct <= -100];
    return [inflect_accent(c, Math.min(1, pct / 100)), pct >= 100];
}

/** Porta il picco di velocita' a peak0 * factor. Restituisce [cubic, limitato]. */
function inflect_scalePeak(c, factor) {
    var peak0 = inflect_peak(c[0], c[1], c[2], c[3]);
    if (peak0 <= 0) return [c, false];
    var target = peak0 * factor, lo, hi, it, m, pk;
    if (factor < 1) {
        var linPeak = inflect_peak(1 / 3, 1 / 3, 2 / 3, 2 / 3);
        if (target <= linPeak + 1e-4) return [inflect_blend(c, 1), true];
        lo = 0; hi = 1;
        for (it = 0; it < 40; it++) {
            m = (lo + hi) / 2; pk = inflect_peak.apply(null, inflect_blend(c, m));
            if (pk > target) lo = m; else hi = m;
        }
        return [inflect_blend(c, (lo + hi) / 2), false];
    }
    var maxPk = inflect_peak.apply(null, inflect_accent(c, 1));
    if (maxPk < target) return [inflect_accent(c, 1), true];
    lo = 0; hi = 1;
    for (it = 0; it < 40; it++) {
        m = (lo + hi) / 2; pk = inflect_peak.apply(null, inflect_accent(c, m));
        if (pk < target) lo = m; else hi = m;
    }
    return [inflect_accent(c, (lo + hi) / 2), false];
}

/*
 * Velocita' di un segmento di tracciato: si parte dalle pendenze misurate quando la selezione e' stata
 * agganciata, si scala il picco come per gli altri valori e si impostano le velocita' misurando
 * After Effects (mt_shapeSetSpeeds).
 */
function mt_speedShape(p, a, it, factor) {
    var T = p.keyTime(a + 1) - p.keyTime(a);
    var meter = mt_shapeMeter(p.keyValue(a), p.keyValue(a + 1));
    if (!meter || T <= 0) return null;
    var x1 = fin(it.outEase[0].influence, 33.33) / 100, x2 = 1 - fin(it.inEase[0].influence, 33.33) / 100;
    var c0 = [x1, x1 * fin(it.sOut, 0), x2, 1 - (1 - x2) * fin(it.sIn, 0)];
    var res = inflect_speedCurve(c0, it.pct), c = res[0];
    var i1 = inflect_clamp(c[0] * 100, 0.1, 100), i2 = inflect_clamp((1 - c[2]) * 100, 0.1, 100);
    var s1 = c[0] > 1e-4 ? c[1] / c[0] : 0, s2 = (1 - c[2]) > 1e-4 ? (1 - c[3]) / (1 - c[2]) : 0;
    // Influenze nuove, poi le velocita' giuste per le pendenze volute.
    var ko = p.keyOutTemporalEase(a), ki = p.keyInTemporalEase(a + 1);
    p.setTemporalEaseAtKey(a, p.keyInTemporalEase(a), [new KeyframeEase(fin(ko[0].speed, 0), i1)]);
    p.setTemporalEaseAtKey(a + 1, [new KeyframeEase(fin(ki[0].speed, 0), i2)], p.keyOutTemporalEase(a + 1));
    var pts = [{ t: 0, v: 0, inSlope: 0, outSlope: s1 }, { t: 1, v: 1, inSlope: s2, outSlope: 0 }];
    mt_shapeSetSpeeds(p, a, [{ pi: 0 }, { pi: 1 }], pts, T, meter);
    return { limited: res[1], before: inflect_peak(c0[0], c0[1], c0[2], c0[3]), after: inflect_peak(c[0], c[1], c[2], c[3]) };
}

/** pct: variazione del picco di velocita', per esempio -20 per rallentare del 20%. */
function inflect_speedSet(pct) {
    try {
        if (!INFLECT_SPEED) { var b = inflect_parse(inflect_speedBegin()); if (!b.ok) return inflect_stringify(b); }
        var items = INFLECT_SPEED.items;
        if (!items.length) {
            if (INFLECT_SPEED.linear) return inflect_err("I keyframe selezionati sono lineari: non c'\u00e8 un easing da accelerare o rallentare. Applica prima una curva (o Easy Ease, F9) e poi usa lo slider.");
            if (INFLECT_SPEED.hold) return inflect_err("I keyframe selezionati sono in mantenimento: lo slider non li modifica.");
            return inflect_err("Seleziona almeno due keyframe vicini sulla stessa propriet\u00e0.");
        }
        var factor = 1 + pct / 100;
        var limited = 0, done = 0, before = 0, after = 0;
        mt_begin("Motion Tools: velocit\u00e0 " + (pct > 0 ? "+" : "") + pct + "%");
        var comp0 = inflect_activeComp();
        mt_speedTailsOff();
        for (var i = 0; i < items.length; i++) {
            var it = items[i], p = mt_live(it);
            if (!p) continue;
            var a = mt_segIndex(p, it);
            if (it.shape) {
                it.pct = pct;
                var rs = mt_speedShape(p, a, it, factor);
                if (rs) { if (rs.limited) limited++; before += rs.before; after += rs.after; done++; }
                continue;
            }
            var spatial = inflect_isSpatial(p);
            // Orientation: la velocita' e' l'angolo dell'arco (gradi al secondo), non la distanza tra i numeri.
            var arc = -1;
            if (it.orient) {
                try {
                    if (!it.order) it.order = mt_orientOrder(p, a).order;
                    arc = mt_qRel(mt_qFromEuler(inflect_toArray(p.keyValue(a)), it.order), mt_qFromEuler(inflect_toArray(p.keyValue(a + 1)), it.order)).angle;
                } catch (eO) { arc = -1; }
            }
            var T = p.keyTime(a + 1) - p.keyTime(a);
            var A = inflect_toArray(p.keyValue(a)), B = inflect_toArray(p.keyValue(a + 1));
            // Le dimensioni vengono dalla proprieta' viva: la lista passata deve averne esattamente quante ne ha la proprieta'.
            var liveOut = p.keyOutTemporalEase(a), liveIn = p.keyInTemporalEase(a + 1);
            var dims = liveOut.length;
            var outE = [], inE = [];
            for (var z = 0; z < dims; z++) {
                outE.push(new KeyframeEase(fin(liveOut[z].speed, 0), fin(liveOut[z].influence, 33.33)));
                inE.push(new KeyframeEase(fin(liveIn[z].speed, 0), fin(liveIn[z].influence, 33.33)));
            }
            for (var d = 0; d < dims; d++) {
                var delta;
                if (arc >= 0) delta = arc;
                else if (spatial) {
                    var sum = 0;
                    for (var q = 0; q < A.length; q++) sum += (B[q] - A[q]) * (B[q] - A[q]);
                    delta = Math.sqrt(sum);
                } else delta = B[d] - A[d];
                if (delta === 0 || T <= 0 || !isFinite(delta)) continue;
                var avg = delta / T;
                var oi = it.outEase[d] || liveOut[d], ii = it.inEase[d] || liveIn[d];
                var x1 = fin(oi.influence, 33.33) / 100, x2 = 1 - fin(ii.influence, 33.33) / 100;
                var y1 = x1 * fin(oi.speed, 0) / avg, y2 = 1 - (1 - x2) * fin(ii.speed, 0) / avg;
                var c0 = [x1, y1, x2, y2];
                var res = inflect_speedCurve(c0, pct);
                var c = res[0];
                if (res[1]) limited++;
                if (d === 0) { before += inflect_peak(c0[0], c0[1], c0[2], c0[3]); after += inflect_peak(c[0], c[1], c[2], c[3]); }
                var i1 = inflect_clamp(c[0] * 100, 0.1, 100), i2 = inflect_clamp((1 - c[2]) * 100, 0.1, 100);
                var s1 = fin((c[0] > 1e-4 ? c[1] / c[0] : 0) * avg, 0);
                var s2 = fin(((1 - c[2]) > 1e-4 ? (1 - c[3]) / (1 - c[2]) : 0) * avg, 0);
                if (spatial) { s1 = Math.max(0, s1); s2 = Math.max(0, s2); }
                outE[d] = new KeyframeEase(s1, fin(i1, 33.33));
                inE[d] = new KeyframeEase(s2, fin(i2, 33.33));
            }
            // Mantiene il lato opposto di ciascun keyframe cosi' com'e'.
            try {
                p.setTemporalEaseAtKey(a, p.keyInTemporalEase(a), outE);
                p.setTemporalEaseAtKey(a + 1, inE, p.keyOutTemporalEase(a + 1));
            } catch (eSet) {
                throw new Error("Velocita' sul keyframe " + (a + 1) + " di " + p.name + " (" + eSet + "). Dimensioni " + dims + ", velocita' " + outE[0].speed + " / " + inE[0].speed + ", influenza " + outE[0].influence + " / " + inE[0].influence);
            }
            done++;
        }
        if (comp0) mt_speedTailsOn(comp0);
        if (INFLECT_SPEED.sel) inflect_restoreSel(INFLECT_SPEED.sel);
        mt_end();
        if (INFLECT_SPEED.tails && INFLECT_SPEED.tails.length && comp0) INFLECT_SPEED.sig = inflect_selectionSignature(inflect_selectedKeyedProps(comp0));
        INFLECT_SPEED.pct = pct;
        INFLECT_SPEED.written = inflect_currentEaseSig(items);
        return inflect_ok({ segments: done, limited: limited, peakBefore: done ? before / done : 0, peakAfter: done ? after / done : 0 });
    } catch (e) {
        try { mt_end(); } catch (e2) {}
        return inflect_err("Velocit\u00e0 non applicata: " + e);
    }
}

/* ------------------------------------------------------ selezione -- */

var INFLECT_SPANS = [];  // curve multi punto applicate: { id, t0, t1, inner: [tempi] }
var INFLECT_TAILS = [];  // assestamenti applicati, per poterli aggiornare o togliere

function inflect_propId(p) {
    var path = [], cur = p;
    try { while (cur && cur.parentProperty) { path.push(cur.propertyIndex); cur = cur.parentProperty; } } catch (e) {}
    var layer = p.propertyGroup(p.propertyDepth);
    var cid = 0;
    try { cid = layer.containingComp.id; } catch (e2) {}
    return cid + ":" + (layer ? layer.index : 0) + ":" + path.join(".");
}

function inflect_keyAt(p, t) {
    if (p.numKeys < 1) return 0;
    var idx = p.nearestKeyIndex(t);
    return Math.abs(p.keyTime(idx) - t) < 1e-4 ? idx : 0;
}

function inflect_captureSel(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
        var times = [];
        for (var j = 0; j < list[i].keys.length; j++) times.push(list[i].prop.keyTime(list[i].keys[j]));
        out.push({ prop: list[i].prop, times: times });
    }
    return out;
}

/** Riseleziona i keyframe di prima, piu' quelli inseriti da una curva multi punto tra di loro. */
function inflect_restoreSel(sel) {
    for (var i = 0; i < sel.length; i++) {
        var p = sel[i].prop, times = sel[i].times.slice(0), id = "";
        try { id = inflect_propId(p); } catch (e0) {}
        for (var s = 0; s < INFLECT_SPANS.length; s++) {
            var sp = INFLECT_SPANS[s];
            if (sp.id !== id) continue;
            var has0 = false, has1 = false;
            for (var q = 0; q < times.length; q++) {
                if (Math.abs(times[q] - sp.t0) < 1e-4) has0 = true;
                if (Math.abs(times[q] - sp.t1) < 1e-4) has1 = true;
            }
            if (has0 && has1) for (var w = 0; w < sp.inner.length; w++) times.push(sp.inner[w]);
        }
        for (var j = 0; j < times.length; j++) {
            try { var idx = inflect_keyAt(p, times[j]); if (idx) p.setSelectedAtKey(idx, true); } catch (e) {}
        }
    }
}

function inflect_collapseSpans(p, keys) {
    var id = inflect_propId(p), times = [], i, j;
    for (i = 0; i < keys.length; i++) times.push(p.keyTime(keys[i]));
    var find = function (t) {
        for (var q = 0; q < times.length; q++) if (Math.abs(times[q] - t) < 1e-4) return q;
        return -1;
    };
    var changed = false;
    for (i = INFLECT_SPANS.length - 1; i >= 0; i--) {
        var s = INFLECT_SPANS[i];
        if (s.id !== id) continue;
        if (find(s.t0) < 0 || find(s.t1) < 0) continue;
        for (j = s.inner.length - 1; j >= 0; j--) {
            var idx = inflect_keyAt(p, s.inner[j]);
            if (idx) { p.removeKey(idx); changed = true; }
            var q2 = find(s.inner[j]);
            if (q2 >= 0) times.splice(q2, 1);
        }
        INFLECT_SPANS.splice(i, 1);
    }
    if (!changed) return keys;
    var out = [];
    for (i = 0; i < times.length; i++) { var k = inflect_keyAt(p, times[i]); if (k) out.push(k); }
    out.sort(inflect_sortNum);
    return out;
}

/* ---------------------------------------------------------- stato -- */

/**
 * Una sola chiamata con tutto quello che serve al pannello per restare allineato ad After Effects.
 * view = scheda aperta nel pannello: le letture che servono a una scheda sola (Cloner, code di
 * assestamento) si fanno solo quando quella scheda e' aperta, cosi' ogni giro pesa meno.
 */
function inflect_state(view) {
    try {
        var o = { version: INFLECT_VERSION, project: "", comp: null, props: 0, pairs: 0, keys: 0, duration: 0, fps: 0, layers: 0, sig: "", tails: 0 };
        o.project = (app.project && app.project.file) ? app.project.file.displayName : "Progetto senza titolo";
        var comp = inflect_activeComp();
        if (comp) {
            o.comp = comp.name;
            o.fps = 1 / comp.frameDuration;
            o.layers = comp.selectedLayers.length;
            // I nomi dei primi layer selezionati, per le intestazioni del pannello ("Da Logo e Pallino").
            o.selNames = [];
            for (var sn = 0; sn < comp.selectedLayers.length && sn < 3; sn++) o.selNames.push(comp.selectedLayers[sn].name);
            var list = inflect_selectedKeyedProps(comp);
            o.props = list.length;
            for (var i = 0; i < list.length; i++) {
                var k = list[i].keys;
                o.keys += k.length;
                for (var j = 0; j < k.length - 1; j++) {
                    if (k[j + 1] === k[j] + 1) {
                        o.pairs++;
                        if (!o.duration) o.duration = list[i].prop.keyTime(k[j + 1]) - list[i].prop.keyTime(k[j]);
                    }
                }
            }
            o.sig = comp.id + "|" + inflect_selectionSignature(list);
            if (list.length && o.sig !== $.global.MT_LASTSIG) { try { mt_autoClip(comp, list); } catch (eA) {} }
            $.global.MT_LASTSIG = o.sig;
            if (list.length) {
                try { o.propName = list[0].prop.name; } catch (eN) {}
                try { var ly = list[0].prop.propertyGroup(list[0].prop.propertyDepth); o.layerName = ly ? ly.name : ""; } catch (eL) {}
            }
            if (!view || view === "curve") o.tails = mt_tails().length;
            if (!view || view === "repeat") { try { o.repeat = mt_repeatInfo(comp); } catch (eR) { o.repeat = null; } }
        }
        return inflect_ok(o);
    } catch (e) { return inflect_err(e); }
}

/* --------------------------------------------------- assestamento -- */
/*
 * Assestamento senza rimbalzo, come lo fa un motion designer a mano.
 *  Fine:   A -> B diventa A -> C -> B. C sta dove c'era B, a una quota prima dell'arrivo (per esempio
 *          il 90% del movimento); B va piu' avanti dei frame scelti e l'ultimo tratto scivola e si posa.
 *  Inizio: A va indietro dei frame scelti; da A a C (al posto di A) l'animazione parte piano, poi
 *          prosegue con la tua curva.
 * In C la velocita' in arrivo e quella in partenza sono uguali: il movimento non si ferma e non scatta.
 * La partenza della tua curva (o il suo arrivo, per l'inizio) resta com'era.
 * Se si cancella C resta un normale A -> B; "Togli" rimette tutto com'era.
 */
function mt_tails() { if (!$.global.MT_TAILS) $.global.MT_TAILS = []; return $.global.MT_TAILS; }

var MT_SETTLE = { k: 1.6, cTail: 50, end: 65, maxK: 2 };

/* Punto a una frazione della lunghezza del tracciato tra i due keyframe (campionando l'animazione originale). */
function mt_pathPoint(p, tA, tB, frac) {
    var N = 120, pts = [], len = [0], d;
    for (var i = 0; i <= N; i++) pts.push(inflect_toArray(p.valueAtTime(tA + (tB - tA) * i / N, true)));
    for (i = 1; i <= N; i++) { var s = 0; for (d = 0; d < pts[i].length; d++) s += Math.pow(pts[i][d] - pts[i - 1][d], 2); len.push(len[i - 1] + Math.sqrt(s)); }
    var L = len[N], want = L * frac;
    for (i = 1; i <= N; i++) {
        if (len[i] >= want) {
            var f = (want - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]), out = [];
            for (d = 0; d < pts[i].length; d++) out.push(pts[i - 1][d] + (pts[i][d] - pts[i - 1][d]) * f);
            return { pt: out, len: L };
        }
    }
    return { pt: pts[N], len: L };
}

/* Sposta nel tempo i keyframe da "from" in poi, con valori, easing e tangenti. */
function mt_shiftKeys(p, from, dt, to) {
    var data = [], k, spatial = inflect_isSpatial(p), last = to || p.numKeys;
    for (k = from; k <= last; k++) {
        var K = { t: p.keyTime(k), v: p.keyValue(k), ii: p.keyInInterpolationType(k), oi: p.keyOutInterpolationType(k), sel: false };
        try { K.ie = p.keyInTemporalEase(k); K.oe = p.keyOutTemporalEase(k); } catch (e1) {}
        try { K.tc = p.keyTemporalContinuous(k); K.ta = p.keyTemporalAutoBezier(k); } catch (e2) {}
        try { K.sel = p.keySelected(k); } catch (e3) {}
        if (spatial) { try { K.ist = p.keyInSpatialTangent(k); K.ost = p.keyOutSpatialTangent(k); K.sc = p.keySpatialContinuous(k); K.sa = p.keySpatialAutoBezier(k); K.rv = p.keyRoving(k); } catch (e4) {} }
        data.push(K);
    }
    for (k = last; k >= from; k--) p.removeKey(k);
    for (k = 0; k < data.length; k++) {
        var D = data[k], t = D.t + dt;
        p.setValueAtTime(t, D.v);
        var j = inflect_keyAt(p, t);
        if (!j) continue;
        try { p.setInterpolationTypeAtKey(j, D.ii, D.oi); } catch (e5) {}
        try { if (D.ie) p.setTemporalEaseAtKey(j, D.ie, D.oe); } catch (e6) {}
        try { p.setTemporalContinuousAtKey(j, D.tc); p.setTemporalAutoBezierAtKey(j, D.ta); } catch (e7) {}
        if (spatial && D.ist) { try { p.setSpatialTangentsAtKey(j, D.ist, D.ost); p.setSpatialContinuousAtKey(j, D.sc); p.setSpatialAutoBezierAtKey(j, D.sa); } catch (e8) {} try { p.setRovingAtKey(j, D.rv); } catch (e9) {} }
        try { p.setSelectedAtKey(j, D.sel); } catch (e10) {}
    }
}

function mt_scaleEase(E, f) {
    var out = [];
    for (var i = 0; i < E.length; i++) out.push(new KeyframeEase(E[i].speed * f, E[i].influence));
    return out;
}
function mt_easeN(n, speed, infl) { var out = []; for (var i = 0; i < n; i++) out.push(new KeyframeEase(speed, infl)); return out; }
function mt_zeroTan(p) { return p.propertyValueType === PropertyValueType.ThreeD_SPATIAL ? [0, 0, 0] : [0, 0]; }

/*
 * Applica l'assestamento su un keyframe. side "end": K e' l'arrivo (B), "start": K e' la partenza (A).
 * D: durata in secondi del tratto aggiunto. q: quota del movimento oltre l'arrivo (o prima della partenza).
 */
function inflect_tailApplyOne(comp, p, K, side, D, q, report) {
    var isEnd = side !== "start", d;
    if (!inflect_isNumericType(p.propertyValueType)) { report.notes.push(p.name + ": solo valori numerici."); return null; }
    var kA = isEnd ? K - 1 : K, kB = isEnd ? K : K + 1;
    if (kA < 1 || kB > p.numKeys) { report.notes.push(p.name + ": serve un altro keyframe " + (isEnd ? "prima." : "dopo.")); return null; }
    if (p.keyOutInterpolationType(kA) === KeyframeInterpolationType.HOLD) { report.notes.push(p.name + ": il keyframe \u00e8 in mantenimento."); return null; }
    var fd = comp.frameDuration;
    D = Math.max(fd, Math.round(D / fd) * fd);
    q = inflect_clamp(q, 0.01, 0.4);
    var tA = p.keyTime(kA), tB = p.keyTime(kB), T = tB - tA;
    var spatial = inflect_isSpatial(p), dims = inflect_easeDims(p);
    var VA = inflect_toArray(p.keyValue(kA)), VB = inflect_toArray(p.keyValue(kB)), isArr = p.keyValue(kA) instanceof Array;
    var moving = false;
    for (d = 0; d < VA.length; d++) if (Math.abs(VB[d] - VA[d]) > 1e-6) moving = true;
    if (!moving) { report.notes.push(p.name + ": i due keyframe hanno lo stesso valore."); return null; }

    // Distanza per dimensione (con segno) o lunghezza del tracciato; C a una quota prima di B (fine) o dopo A (inizio).
    var frac = isEnd ? 1 - q : q, C = [], dl = [], path = null;
    if (spatial) {
        path = mt_pathPoint(p, tA, tB, frac);
        C = path.pt; dl.push(path.len);
    } else {
        for (d = 0; d < VA.length; d++) C.push(VA[d] + frac * (VB[d] - VA[d]));
        for (d = 0; d < dims; d++) dl.push(VB[Math.min(d, VB.length - 1)] - VA[Math.min(d, VA.length - 1)]);
    }
    // Velocita' in C: la coda (q del movimento in D) parte a questa velocita' e frena fino a zero.
    // Non piu' del doppio della velocita' media del tratto principale, cosi' la curva non fa la gobba.
    var main = 1 - q, vC = [], kv = MT_SETTLE.k * q / D, kmax = MT_SETTLE.maxK * main / T, kk = Math.min(kv, kmax);
    for (d = 0; d < dims; d++) vC.push((spatial ? Math.abs(dl[0]) : dl[d]) * kk);

    var rec = {
        ref: mt_propRef(p), id: inflect_propId(p), side: side, D: D, qWanted: q, shift: 0, spatial: spatial,
        aOut: inflect_copyEase(p.keyOutTemporalEase(kA)), bIn: inflect_copyEase(p.keyInTemporalEase(kB)),
        aOutType: p.keyOutInterpolationType(kA), bInType: p.keyInInterpolationType(kB)
    };
    if (spatial) { try { rec.aTanOut = p.keyOutSpatialTangent(kA); rec.bTanIn = p.keyInSpatialTangent(kB); } catch (eT) {} }
    var BZ = KeyframeInterpolationType.BEZIER, kC, i;
    // Influenza della tua curva sul lato che tocca C, ridotta se la velocita' in C la farebbe tornare indietro.
    var userInfl = function (E) {
        var out = [];
        for (i = 0; i < dims; i++) {
            var inf = E[Math.min(i, E.length - 1)] ? E[Math.min(i, E.length - 1)].influence / 100 : 0.5;
            var dist = Math.abs(spatial ? dl[0] : dl[i]) * main, sp = Math.abs(vC[i]);
            if (sp > 1e-9) inf = Math.min(inf, 0.6 * dist / (sp * T));
            out.push(new KeyframeEase(vC[i], Math.max(10, Math.min(100, inf * 100))));
        }
        return out;
    };
    var tailE = function () { var o = []; for (i = 0; i < dims; i++) o.push(new KeyframeEase(vC[i], MT_SETTLE.cTail)); return o; };
    var still = function (inf) { var o = []; for (i = 0; i < dims; i++) o.push(new KeyframeEase(0, inf)); return o; };

    if (isEnd) {
        var nb = kB + 1, roomAfter = nb > p.numKeys || p.keyTime(nb) > tB + D + fd / 2;
        rec.tK = tB; rec.tC = tB; rec.tN = tB + D; rec.shiftAll = !roomAfter; rec.tA = tA;
        if (roomAfter) mt_shiftKeys(p, kB, D, kB); else mt_shiftKeys(p, kB, D);
        p.setValueAtTime(tB, isArr ? C : C[0]);
        var iA = inflect_keyAt(p, tA); kC = inflect_keyAt(p, tB); var iB = inflect_keyAt(p, tB + D);
        p.setInterpolationTypeAtKey(iA, p.keyInInterpolationType(iA), BZ);
        p.setInterpolationTypeAtKey(kC, BZ, BZ);
        p.setInterpolationTypeAtKey(iB, BZ, p.keyOutInterpolationType(iB));
        // Partenza della tua curva: stessa forma su una distanza un po' piu' corta.
        p.setTemporalEaseAtKey(iA, p.keyInTemporalEase(iA), mt_scaleEase(rec.aOut, main));
        p.setTemporalEaseAtKey(kC, userInfl(rec.bIn), tailE());
        p.setTemporalEaseAtKey(iB, still(MT_SETTLE.end), p.keyOutTemporalEase(iB));
        try { p.setTemporalContinuousAtKey(kC, true); p.setTemporalAutoBezierAtKey(kC, false); } catch (eC) {}
        try { p.setSelectedAtKey(kC, true); p.setSelectedAtKey(iB, true); } catch (eSel) {}
    } else {
        var pv = kA - 1, floorT = 0;
        try { floorT = Math.max(0, p.propertyGroup(p.propertyDepth).inPoint); } catch (eL) {}
        var roomBefore = tA - D >= floorT - 1e-6 && (pv < 1 || p.keyTime(pv) < tA - D - fd / 2);
        if (roomBefore) { rec.tAp = tA - D; rec.tC = tA; rec.tB = tB; rec.shiftAll = false; mt_shiftKeys(p, kA, -D, kA); }
        else { rec.tAp = tA; rec.tC = tA + D; rec.tB = tB + D; rec.shiftAll = true; mt_shiftKeys(p, kB, D); }
        rec.tK = tA; rec.tN = rec.tAp;
        p.setValueAtTime(rec.tC, isArr ? C : C[0]);
        var jA = inflect_keyAt(p, rec.tAp); kC = inflect_keyAt(p, rec.tC); var jB = inflect_keyAt(p, rec.tB);
        p.setInterpolationTypeAtKey(jA, p.keyInInterpolationType(jA), BZ);
        p.setInterpolationTypeAtKey(kC, BZ, BZ);
        p.setInterpolationTypeAtKey(jB, BZ, p.keyOutInterpolationType(jB));
        // Partenza lenta fino a C, poi la tua curva con lo stesso arrivo.
        p.setTemporalEaseAtKey(jA, p.keyInTemporalEase(jA), still(MT_SETTLE.end));
        p.setTemporalEaseAtKey(kC, tailE(), userInfl(rec.aOut));
        p.setTemporalEaseAtKey(jB, mt_scaleEase(rec.bIn, main), p.keyOutTemporalEase(jB));
        try { p.setTemporalContinuousAtKey(kC, true); p.setTemporalAutoBezierAtKey(kC, false); } catch (eC2) {}
        try { p.setSelectedAtKey(jA, true); p.setSelectedAtKey(kC, true); } catch (eSel2) {}
    }
    if (spatial) {
        // Tangenti in C lungo il percorso: il tracciato non fa angoli.
        try {
            var before = mt_pathPoint(p, Math.min(rec.tA !== undefined ? rec.tA : rec.tAp, rec.tC), rec.tC, 0.97).pt;
            var dir = [], ln = 0;
            for (d = 0; d < C.length; d++) { dir.push(C[d] - before[d]); ln += dir[d] * dir[d]; }
            ln = Math.sqrt(ln);
            if (ln > 1e-6) {
                var L1 = Math.abs(dl[0]) * (isEnd ? main : q) / 3, L2 = Math.abs(dl[0]) * (isEnd ? q : main) / 3, tin = [], tout = [];
                for (d = 0; d < C.length; d++) { tin.push(-dir[d] / ln * L1); tout.push(dir[d] / ln * L2); }
                p.setSpatialAutoBezierAtKey(kC, false); p.setSpatialContinuousAtKey(kC, true); p.setSpatialTangentsAtKey(kC, tin, tout);
            }
        } catch (eS) {}
    }
    if (kk < kv - 1e-9) report.notes.push("Coda corta per questo movimento: la velocità in mezzo è stata ridotta. Aumenta i frame per un'uscita più lunga.");
    return rec;
}

/*
 * Toglie l'assestamento: via C, il keyframe spostato torna al suo tempo con le sue curve.
 * Restituisce l'indice del keyframe di partenza della modifica (B per la fine, A per l'inizio), o 0.
 */
function inflect_tailRevertOne(rec) {
    try {
        var p = mt_propGet(rec.ref);
        if (!p) return 0;
        var half = 0.5 * p.propertyGroup(p.propertyDepth).containingComp.frameDuration;
        var near = function (t) { if (!p.numKeys) return 0; var i = p.nearestKeyIndex(t); return Math.abs(p.keyTime(i) - t) < half ? i : 0; };
        var D = rec.D, iC;
        if (rec.side !== "start") {
            iC = near(rec.tC);
            if (iC && near(rec.tN) && iC !== near(rec.tN)) p.removeKey(iC);
            var iB = near(rec.tN);
            if (!iB) return near(rec.tK);
            if (rec.shiftAll) mt_shiftKeys(p, iB, -D); else mt_shiftKeys(p, iB, -D, iB);
            iB = near(rec.tK);
            var iA = near(rec.tA);
            if (iB) { try { p.setInterpolationTypeAtKey(iB, rec.bInType, p.keyOutInterpolationType(iB)); p.setTemporalEaseAtKey(iB, rec.bIn, p.keyOutTemporalEase(iB)); } catch (e1) {} }
            if (iA) { try { p.setInterpolationTypeAtKey(iA, p.keyInInterpolationType(iA), rec.aOutType); p.setTemporalEaseAtKey(iA, p.keyInTemporalEase(iA), rec.aOut); } catch (e2) {} }
            if (rec.spatial && iB && rec.bTanIn) { try { p.setSpatialTangentsAtKey(iB, rec.bTanIn, p.keyOutSpatialTangent(iB)); } catch (e3) {} }
            if (rec.spatial && iA && rec.aTanOut) { try { p.setSpatialTangentsAtKey(iA, p.keyInSpatialTangent(iA), rec.aTanOut); } catch (e4) {} }
            try { if (iB) p.setSelectedAtKey(iB, true); } catch (e5) {}
            return iB;
        }
        iC = near(rec.tC);
        if (iC && near(rec.tAp) !== iC) p.removeKey(iC);
        if (rec.shiftAll) { var jB = near(rec.tB); if (jB) mt_shiftKeys(p, jB, -D); }
        else { var jA0 = near(rec.tAp); if (jA0) mt_shiftKeys(p, jA0, D, jA0); }
        var jA = near(rec.tK), jB2 = near(rec.shiftAll ? rec.tB - D : rec.tB);
        if (jA) { try { p.setInterpolationTypeAtKey(jA, p.keyInInterpolationType(jA), rec.aOutType); p.setTemporalEaseAtKey(jA, p.keyInTemporalEase(jA), rec.aOut); } catch (e6) {} }
        if (jB2) { try { p.setInterpolationTypeAtKey(jB2, rec.bInType, p.keyOutInterpolationType(jB2)); p.setTemporalEaseAtKey(jB2, rec.bIn, p.keyOutTemporalEase(jB2)); } catch (e7) {} }
        if (rec.spatial && jA && rec.aTanOut) { try { p.setSpatialTangentsAtKey(jA, p.keyInSpatialTangent(jA), rec.aTanOut); } catch (e8) {} }
        try { if (jA) p.setSelectedAtKey(jA, true); } catch (e9) {}
        return jA;
    } catch (e) { return 0; }
}

function inflect_tailParams(comp, frames, pct) {
    return { D: Math.max(1, Math.round(frames)) * comp.frameDuration, q: inflect_clamp(pct, 1, 40) / 100 };
}

function inflect_tail(side, frames, pct) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona i keyframe.");
    var list = inflect_selectedKeyedProps(comp);
    if (!list.length) return inflect_err("Seleziona almeno un keyframe per proprietà.");
    var pr = inflect_tailParams(comp, frames, pct), TL = mt_tails();
    var report = { added: 0, notes: [] };
    mt_begin(side === "start" ? "Motion Tools: inizio morbido" : "Motion Tools: fine morbida");
    try {
        for (var i = 0; i < list.length; i++) {
            var p = list[i].prop, keys = list[i].keys, id = inflect_propId(p);
            var K = side === "start" ? keys[0] : keys[keys.length - 1];
            var tSel = p.keyTime(K);
            // Gia' assestato da questo lato: si toglie la coda vecchia e si rifa' da capo.
            for (var r = TL.length - 1; r >= 0; r--) {
                var rec0 = TL[r];
                if (rec0.id !== id || rec0.side !== side) continue;
                if (Math.abs(tSel - rec0.tK) < 1e-3 || Math.abs(tSel - rec0.tN) < 1e-3) {
                    var back = inflect_tailRevertOne(rec0);
                    TL.splice(r, 1);
                    if (back) K = back;
                }
            }
            var rec = inflect_tailApplyOne(comp, p, K, side, pr.D, pr.q, report);
            if (rec) { TL.push(rec); report.added++; }
        }
    } catch (e) {
        mt_end();
        return inflect_err("Errore: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
    mt_end();
    INFLECT_SPEED = null;
    if (!report.added) return inflect_err(report.notes.length ? report.notes[0] : "Nessun keyframe modificato.");
    report.tails = TL.length;
    return inflect_ok(report);
}

/** Cambia frame e quota delle code gia' applicate: toglie il keyframe aggiunto e lo rimette (remove = true le toglie e basta). */
function inflect_tailUpdate(frames, pct, remove) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var old = mt_tails();
    if (!old.length) return inflect_err("Non c'è un assestamento da aggiornare: seleziona i keyframe e premi Inizio o Fine.");
    var pr = inflect_tailParams(comp, frames, pct);
    var report = { added: 0, notes: [], removed: 0 }, keep = [];
    $.global.MT_TAILS = [];
    mt_begin(remove ? "Motion Tools: togli assestamento" : "Motion Tools: aggiorna assestamento");
    try {
        for (var i = 0; i < old.length; i++) {
            var K = inflect_tailRevertOne(old[i]);
            if (!K) continue;
            report.removed++;
            if (remove) continue;
            var rec = inflect_tailApplyOne(comp, mt_propGet(old[i].ref), K, old[i].side, pr.D, pr.q, report);
            if (rec) { keep.push(rec); report.added++; }
        }
    } catch (e) {
        mt_end();
        $.global.MT_TAILS = keep;
        return inflect_err("Errore: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
    mt_end();
    $.global.MT_TAILS = keep;
    INFLECT_SPEED = null;
    report.tails = keep.length;
    if (!report.removed) return inflect_err("L'assestamento è stato spostato o annullato a mano: seleziona i keyframe e premi di nuovo Inizio o Fine.");
    return inflect_ok(report);
}

/* --------------------------------------------------- allineamento -- */
/* Matrici affini 2D: x' = a*x + b*y + tx, y' = c*x + d*y + ty. */

function inflect_mIdentity() { return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }; }

function inflect_mMul(A, B) {
    return {
        a: A.a * B.a + A.b * B.c, b: A.a * B.b + A.b * B.d,
        c: A.c * B.a + A.d * B.c, d: A.c * B.b + A.d * B.d,
        tx: A.a * B.tx + A.b * B.ty + A.tx, ty: A.c * B.tx + A.d * B.ty + A.ty
    };
}

function inflect_layerPos(layer, t) {
    var tr = layer.property("ADBE Transform Group");
    var pos = tr.property("ADBE Position");
    if (pos.dimensionsSeparated) {
        return [tr.property("ADBE Position_0").valueAtTime(t, false), tr.property("ADBE Position_1").valueAtTime(t, false)];
    }
    return pos.valueAtTime(t, false);
}

function inflect_layerLinear(layer, t) {
    var tr = layer.property("ADBE Transform Group");
    var s = tr.property("ADBE Scale").valueAtTime(t, false);
    var r = tr.property("ADBE Rotate Z").valueAtTime(t, false) * Math.PI / 180;
    var cs = Math.cos(r), sn = Math.sin(r), sx = s[0] / 100, sy = s[1] / 100;
    return { a: cs * sx, b: -sn * sy, c: sn * sx, d: cs * sy };
}

function inflect_layerMat(layer, t) {
    var L = inflect_layerLinear(layer, t);
    var an = layer.property("ADBE Transform Group").property("ADBE Anchor Point").valueAtTime(t, false);
    var pos = inflect_layerPos(layer, t);
    return { a: L.a, b: L.b, c: L.c, d: L.d, tx: pos[0] - (L.a * an[0] + L.b * an[1]), ty: pos[1] - (L.c * an[0] + L.d * an[1]) };
}

function inflect_parentMat(layer, t) {
    var M = inflect_mIdentity(), cur = layer.parent, guard = 0;
    var chain = [];
    while (cur && guard < 200) { chain.push(cur); cur = cur.parent; guard++; }
    for (var i = chain.length - 1; i >= 0; i--) {
        try { M = inflect_mMul(M, inflect_layerMat(chain[i], t)); } catch (e) {}
    }
    return M;
}

function inflect_offsetProp(p, delta) {
    var add = function (v) {
        if (v instanceof Array) {
            var out = [];
            for (var i = 0; i < v.length; i++) out.push(v[i] + (i < delta.length ? delta[i] : 0));
            return out;
        }
        return v + delta[0];
    };
    if (p.numKeys > 0) {
        for (var k = 1; k <= p.numKeys; k++) p.setValueAtKey(k, add(p.keyValue(k)));
    } else {
        p.setValue(add(p.value));
    }
}

/** Sposta il layer di un delta espresso nello spazio del suo genitore. */
function inflect_movePos(layer, dx, dy) {
    var tr = layer.property("ADBE Transform Group");
    var pos = tr.property("ADBE Position");
    if (pos.dimensionsSeparated) {
        inflect_offsetProp(tr.property("ADBE Position_0"), [dx]);
        inflect_offsetProp(tr.property("ADBE Position_1"), [dy]);
    } else {
        inflect_offsetProp(pos, [dx, dy, 0]);
    }
}

/*
 * Layer con un contenuto visibile: video, solidi, precomp, testo, forme, nulli.
 * Negli script i layer di testo e di forma non risultano "AVLayer", per questo
 * si escludono solo camere e luci invece di cercare un tipo preciso.
 */
function inflect_isVisual(l) {
    try {
        if (l instanceof CameraLayer || l instanceof LightLayer) return false;
    } catch (e) {}
    try { return typeof l.sourceRectAtTime === "function" || l instanceof AVLayer || l instanceof TextLayer || l instanceof ShapeLayer; }
    catch (e2) { return true; }
}

function inflect_alignLayers(comp) {
    var out = [], sel = comp.selectedLayers;
    for (var i = 0; i < sel.length; i++) {
        if (!inflect_isVisual(sel[i])) continue; // niente camere e luci
        out.push(sel[i]);
    }
    return out;
}

/** Sposta il punto di ancoraggio (fx, fy da 0 a 1 sul riquadro del layer) senza muovere il layer. */
function inflect_anchor(fx, fy) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona un layer.");
    var layers = inflect_alignLayers(comp);
    if (!layers.length) return inflect_err("Seleziona uno o pi\u00f9 layer.");
    var t = comp.time, done = 0, notes = [];
    mt_begin("Motion Tools: punto di ancoraggio");
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        try {
            var rect = layer.sourceRectAtTime(t, false);
            if (!rect || (rect.width === 0 && rect.height === 0)) { notes.push(layer.name + ": layer vuoto."); continue; }
            var ap = layer.property("ADBE Transform Group").property("ADBE Anchor Point");
            var cur = ap.valueAtTime(t, false);
            var dx = rect.left + fx * rect.width - cur[0], dy = rect.top + fy * rect.height - cur[1];
            if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { done++; continue; }
            var L = inflect_layerLinear(layer, t);
            inflect_offsetProp(ap, [dx, dy, 0]);
            inflect_movePos(layer, L.a * dx + L.b * dy, L.c * dx + L.d * dy);
            done++;
        } catch (e) { notes.push(layer.name + ": " + (layer.locked ? "\u00e8 bloccato." : e.toString())); }
    }
    mt_end();
    if (!done) return inflect_err(notes.length ? notes[0] : "Nessun layer modificato.");
    return inflect_ok({ layers: done, notes: notes });
}

function inflect_bounds(layer, t, extents) {
    var rect = layer.sourceRectAtTime(t, !!extents);
    var M = inflect_mMul(inflect_parentMat(layer, t), inflect_layerMat(layer, t));
    var xs = [rect.left, rect.left + rect.width], ys = [rect.top, rect.top + rect.height];
    var b = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 };
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
        var x = M.a * xs[i] + M.b * ys[j] + M.tx, y = M.c * xs[i] + M.d * ys[j] + M.ty;
        if (x < b.l) b.l = x; if (x > b.r) b.r = x; if (y < b.t) b.t = y; if (y > b.b) b.b = y;
    }
    return b;
}

/** Sposta il layer di un delta in pixel della composizione, tenendo conto dei genitori. */
function inflect_moveComp(layer, t, Dx, Dy) {
    var P = inflect_parentMat(layer, t);
    var det = P.a * P.d - P.b * P.c;
    if (Math.abs(det) < 1e-9) return;
    inflect_movePos(layer, (P.d * Dx - P.b * Dy) / det, (-P.c * Dx + P.a * Dy) / det);
}

/** edge: left | hcenter | right | top | vcenter | bottom; target: comp | selection. */
/* Gruppo salvato di un layer (nel suo commento, "MT_G=nome"), o "" se non ne ha. */
function mt_groupOf(layer) {
    try { var m = String(layer.comment).match(/MT_G=([^|\n]+)/); return m ? m[1] : ""; } catch (e) { return ""; }
}

/*
 * Allinea. Con group = true i layer si muovono a blocchi: tutta la selezione insieme
 * (verso la composizione) oppure ogni gruppo salvato insieme (tra loro). Le distanze dentro
 * un blocco restano uguali. Si somma lo stesso scarto a tutti i keyframe di posizione,
 * quindi l'animazione resta identica.
 */
function inflect_align(edge, target, group) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona i layer.");
    // La selezione di partenza resta attiva dopo l'allineamento: si puo' riallineare subito.
    var keepSel = [];
    try { keepSel = comp.selectedLayers.slice(); } catch (eK) {}
    var layers = inflect_alignLayers(comp);
    if (!layers.length) return inflect_err("Seleziona uno o più layer.");
    var t = comp.time, i, items = [], notes = [];
    for (i = 0; i < layers.length; i++) {
        try { items.push({ layer: layers[i], b: inflect_bounds(layers[i], t) }); } catch (e) { notes.push(layers[i].name + ": " + e.toString()); }
    }
    // Un layer il cui genitore e' anche selezionato si muove gia' con lui.
    var isSel = function (L) { for (var q = 0; q < items.length; q++) if (items[q].layer === L) return true; return false; };
    for (i = 0; i < items.length; i++) {
        var par = null, child = false, guard = 0;
        try { par = items[i].layer.parent; } catch (eP) {}
        while (par && guard++ < 50) { if (isSel(par)) { child = true; break; } try { par = par.parent; } catch (eQ) { par = null; } }
        items[i].child = child;
    }
    // Blocchi: gruppi di layer che si muovono insieme.
    var units = [], byName = {};
    for (i = 0; i < items.length; i++) {
        var key = null;
        if (group) key = target === "selection" ? (mt_groupOf(items[i].layer) || null) : "tutti";
        var u;
        if (key !== null && byName[key]) u = byName[key];
        else { u = { items: [], b: { l: 1e12, r: -1e12, t: 1e12, b: -1e12 } }; units.push(u); if (key !== null) byName[key] = u; }
        u.items.push(items[i]);
        var bb0 = items[i].b;
        if (bb0.l < u.b.l) u.b.l = bb0.l; if (bb0.r > u.b.r) u.b.r = bb0.r; if (bb0.t < u.b.t) u.b.t = bb0.t; if (bb0.b > u.b.b) u.b.b = bb0.b;
    }
    if (target === "selection" && units.length < 2) return inflect_err(group ? "Per allineare tra loro servono almeno due blocchi: due gruppi salvati, o un gruppo e un layer." : "Per allineare tra loro servono almeno due layer. Con uno solo scegli Composizione.");
    var ref = { l: 0, r: comp.width, t: 0, b: comp.height };
    if (target === "selection") {
        ref = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 };
        for (i = 0; i < units.length; i++) {
            var b = units[i].b;
            if (b.l < ref.l) ref.l = b.l; if (b.r > ref.r) ref.r = b.r; if (b.t < ref.t) ref.t = b.t; if (b.b > ref.b) ref.b = b.b;
        }
    }
    var done = 0;
    mt_begin("Motion Tools: allinea");
    for (var g = 0; g < units.length; g++) {
        var bb = units[g].b, Dx = 0, Dy = 0;
        if (edge === "left") Dx = ref.l - bb.l;
        else if (edge === "hcenter") Dx = (ref.l + ref.r) / 2 - (bb.l + bb.r) / 2;
        else if (edge === "right") Dx = ref.r - bb.r;
        else if (edge === "top") Dy = ref.t - bb.t;
        else if (edge === "vcenter") Dy = (ref.t + ref.b) / 2 - (bb.t + bb.b) / 2;
        else if (edge === "bottom") Dy = ref.b - bb.b;
        for (i = 0; i < units[g].items.length; i++) {
            var it = units[g].items[i];
            if (it.child) continue;
            try { inflect_moveComp(it.layer, t, Dx, Dy); done++; }
            catch (e2) { notes.push(it.layer.name + ": " + (it.layer.locked ? "è bloccato." : e2.toString())); }
        }
    }
    mt_end();
    for (var ks = 0; ks < keepSel.length; ks++) { try { keepSel[ks].selected = true; } catch (eS) {} }
    if (!done) return inflect_err(notes.length ? notes[0] : "Nessun layer spostato.");
    return inflect_ok({ layers: done, units: units.length, notes: notes });
}

function inflect_groupCreate(name) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var sel = comp.selectedLayers;
    if (sel.length < 2) return inflect_err("Seleziona almeno due layer da tenere insieme.");
    name = String(name || "").replace(/[|\n]/g, " ");
    if (!name) return inflect_err("Dai un nome al gruppo.");
    mt_begin("Motion Tools: crea gruppo");
    try {
        for (var i = 0; i < sel.length; i++) {
            var c = String(sel[i].comment || "").replace(/\|?\s*MT_G=[^|\n]+/g, "");
            sel[i].comment = (c ? c + "|" : "") + "MT_G=" + name;
        }
        mt_end();
        return inflect_groupList();
    } catch (e) { mt_end(); return inflect_err(e.toString()); }
}

function inflect_groupList() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_ok({ groups: [] });
    var map = {}, out = [];
    for (var i = 1; i <= comp.numLayers; i++) { var g = mt_groupOf(comp.layer(i)); if (g) map[g] = (map[g] || 0) + 1; }
    for (var k in map) if (map.hasOwnProperty(k)) out.push({ name: k, count: map[k] });
    out.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return inflect_ok({ groups: out });
}

/** add = true aggiunge il gruppo alla selezione (Maiusc). */
function inflect_groupSelect(name, add) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var n = 0;
    for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i), inG = mt_groupOf(L) === name;
        if (inG) { L.selected = true; n++; } else if (!add) L.selected = false;
    }
    return inflect_ok({ count: n });
}

function inflect_groupRemove(name) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    mt_begin("Motion Tools: sciogli gruppo");
    for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        if (mt_groupOf(L) === name) L.comment = String(L.comment).replace(/\|?\s*MT_G=[^|\n]+/g, "");
    }
    mt_end();
    return inflect_groupList();
}

/** Distribuisce i centri a distanza uguale. axis: h | v. */
function inflect_distribute(axis) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona i layer.");
    var layers = inflect_alignLayers(comp);
    if (layers.length < 3) return inflect_err("Per distribuire servono almeno tre layer.");
    var t = comp.time, items = [], i, notes = [];
    for (i = 0; i < layers.length; i++) {
        try {
            var b = inflect_bounds(layers[i], t);
            items.push({ layer: layers[i], c: axis === "h" ? (b.l + b.r) / 2 : (b.t + b.b) / 2 });
        } catch (e) { notes.push(layers[i].name + ": " + e.toString()); }
    }
    items.sort(function (x, y) { return x.c - y.c; });
    var first = items[0].c, step = (items[items.length - 1].c - first) / (items.length - 1), done = 0;
    mt_begin("Motion Tools: distribuisci");
    for (i = 1; i < items.length - 1; i++) {
        var delta = first + step * i - items[i].c;
        try { inflect_moveComp(items[i].layer, t, axis === "h" ? delta : 0, axis === "h" ? 0 : delta); done++; }
        catch (e2) { notes.push(items[i].layer.name + ": " + (items[i].layer.locked ? "\u00e8 bloccato." : e2.toString())); }
    }
    mt_end();
    return inflect_ok({ layers: items.length, notes: notes });
}


/**
 * Solo lettura, per l'anteprima della scheda Allinea: misura della comp e riquadri
 * dei layer selezionati in questo istante (al massimo 40). Non cambia niente nel progetto.
 */
function inflect_layoutRead() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_ok({ comp: null, layers: [] });
        var layers = inflect_alignLayers(comp), t = comp.time, out = [];
        for (var i = 0; i < layers.length && i < 40; i++) {
            var b;
            try { b = inflect_bounds(layers[i], t); } catch (eB) { continue; }
            out.push({ name: layers[i].name, l: b.l, t: b.t, r: b.r, b: b.b });
        }
        return inflect_ok({ comp: { name: comp.name, w: comp.width, h: comp.height }, layers: out, total: layers.length });
    } catch (e) { return inflect_err(e); }
}
/* -------------------------------------------------------- utility -- */

/** Misure tra i layer selezionati, come il righello di Figma. */
function inflect_measure() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_ok({ count: 0 });
        var layers = inflect_alignLayers(comp), t = comp.time;
        if (!layers.length) return inflect_ok({ count: 0 });
        var A = inflect_bounds(layers[0], t);
        var o = { count: layers.length, comp: { w: comp.width, h: comp.height }, a: { name: layers[0].name, l: A.l, r: A.r, t: A.t, b: A.b } };
        if (layers.length >= 2) {
            var B = inflect_bounds(layers[1], t);
            o.b = { name: layers[1].name, l: B.l, r: B.r, t: B.t, b: B.b };
            // Positivo: spazio vuoto tra i bordi. Negativo: i layer si sovrappongono di quel tanto.
            o.gapX = B.l >= A.r ? B.l - A.r : (A.l >= B.r ? A.l - B.r : -(Math.min(A.r, B.r) - Math.max(A.l, B.l)));
            o.gapY = B.t >= A.b ? B.t - A.b : (A.t >= B.b ? A.t - B.b : -(Math.min(A.b, B.b) - Math.max(A.t, B.t)));
            o.dx = (B.l + B.r) / 2 - (A.l + A.r) / 2;
            o.dy = (B.t + B.b) / 2 - (A.t + A.b) / 2;
            o.dist = Math.sqrt(o.dx * o.dx + o.dy * o.dy);
        }
        return inflect_ok(o);
    } catch (e) { return inflect_err(e); }
}

/** Imposta lo spazio tra i primi due layer selezionati spostando il secondo. axis: x | y. */
function inflect_setGap(axis, value) {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_err("Apri una composizione.");
        var layers = inflect_alignLayers(comp), t = comp.time;
        if (layers.length < 2) return inflect_err("Seleziona due layer.");
        var A = inflect_bounds(layers[0], t), B = inflect_bounds(layers[1], t), Dx = 0, Dy = 0;
        if (axis === "x") Dx = ((B.l + B.r) >= (A.l + A.r)) ? (A.r + value - B.l) : (A.l - value - B.r);
        else Dy = ((B.t + B.b) >= (A.t + A.b)) ? (A.b + value - B.t) : (A.t - value - B.b);
        mt_begin("Motion Tools: imposta spazio");
        try { inflect_moveComp(layers[1], t, Dx, Dy); }
        catch (e1) { mt_end(); return inflect_err(layers[1].name + (layers[1].locked ? " \u00e8 bloccato." : ": " + e1.toString())); }
        mt_end();
        return inflect_ok({ moved: layers[1].name });
    } catch (e) { return inflect_err(e); }
}


/* --------------------------------------------------------- repeat -- */
/*
 * Cloner: duplicatore in stile Cavalry costruito con strumenti nativi di After Effects.
 *
 *  Controllo   un oggetto nullo con i parametri come controlli espressione:
 *              distribuzione, trasformazioni e comportamenti. Si regola dal pannello
 *              o dai Controlli effetti, e si anima come qualsiasi effetto.
 *  Copie       layer veri, figli del controllo. Ogni copia calcola la propria posizione
 *              e somma i comportamenti con espressioni lette dal controllo.
 *  Comportam.  Stagger, Casuale, Rumore, Oscillatore, Valore. Ognuno ha una destinazione
 *              (posizione, rotazione, scala, opacita', tempo) e puo' usare un falloff.
 *  Falloff     layer guida con forma, dimensione, morbidezza, intensita', inverti e
 *              probabilita': moltiplica la forza dei comportamenti collegati.
 *  Tempo       il ritardo di ogni copia sposta i controlli Trasforma e, per precomp e
 *              video, anche il tempo interno tramite il remapping del tempo.
 */

var MT_TAG = "MT_REPEAT";
var MT_CLONE_TAG = "MT_CLONE";
var MT_FALLOFF_TAG = "MT_FALLOFF";
var MT_MAX = 400;
// Versione delle espressioni: i Cloner piu' vecchi si aggiornano da soli alla prima modifica.
var MT_REPEAT_VER = 7;
var MT_DEST_COLOR = 10;

var MT_LISTS = {
    "Distribuzione": ["Lineare", "Griglia", "Cerchio", "Casuale", "Spirale", "Tracciato", "Punto"],
    "Modo misura": ["Passo", "Adatta", "Distanza"],
    "Direzione griglia": ["Per righe", "Per colonne"],
    "Piano": ["XY", "XZ", "YZ"],
    "Tipo": ["Stagger", "Casuale", "Rumore", "Oscillatore", "Valore", "Lista"],
    "Destinazione": ["Posizione X", "Posizione Y", "Posizione Z", "Rotazione", "Rotazione X", "Rotazione Y", "Scala", "Opacit\u00e0", "Tempo", "Colore"],
    "Curva": ["Lineare", "Ease in", "Ease out", "Ease in-out"],
    "Ordine": ["Indice", "Inverso", "Dal centro", "Verso il centro", "Casuale", "Asse X", "Asse Y"],
    "Forma": ["Cerchio", "Rettangolo", "Lineare"],
    "Allinea copie": ["Centro del contenuto", "Punto di ancoraggio"]
};

/* Parametri del controllo: nome, tipo, valore di partenza. */
var MT_PARAMS = [
    ["Distribuzione", "dd", 1],
    ["Quantit\u00e0", "sl", 8],
    ["Colonne", "sl", 5],
    ["Righe", "sl", 4],
    ["Livelli", "sl", 1],
    ["Modo misura", "dd", 1],
    ["Passo", "p3", [120, 0, 0]],
    ["Distanza", "p3", [30, 30, 30]],
    ["Dimensione copia", "p3", [100, 100, 100]],
    ["Direzione griglia", "dd", 1],
    ["Sfalsa righe", "sl", 0],
    ["Centra", "cb", 1],
    ["Raggio", "sl", 300],
    ["Angolo iniziale", "an", 0],
    ["Arco", "an", 360],
    ["Scorrimento", "sl", 0],
    ["Orienta", "cb", 0],
    ["Inverti senso", "cb", 0],
    ["Piano", "dd", 1],
    ["Area", "p3", [1200, 700, 0]],
    ["Tracciato", "ly", 0],
    ["Seme", "sl", 1],
    ["Allinea copie", "dd", 1],
    ["Trasforma posizione", "p3", [0, 0, 0]],
    ["Trasforma scala", "sl", 100],
    ["Trasforma rotazione", "an", 0],
    ["Trasforma opacit\u00e0", "sl", 100],
    ["Comportamenti", "sl", 0]
];

/* Parametri di ogni comportamento, con il prefisso "B<k> ". */
var MT_BPARAMS = [
    ["Tipo", "dd", 1],
    ["Destinazione", "dd", 9],
    ["Attivo", "cb", 1],
    ["Min", "sl", 0],
    ["Max", "sl", 20],
    ["Curva", "dd", 1],
    ["Ordine", "dd", 1],
    ["Seme", "sl", 1],
    ["Frequenza", "sl", 1],
    ["Fase", "sl", 30],
    ["Falloff", "ly", 0],
    ["Colore", "cl", [1, 0.35, 0.12, 1]],
    ["Mantieni spazi", "cb", 0]
];

var MT_FPARAMS = [
    ["Forma", "dd", 1],
    ["Dimensione", "p2", [500, 500]],
    ["Profondit\u00e0", "sl", 0],
    ["Morbidezza", "sl", 100],
    ["Intensit\u00e0", "sl", 100],
    ["Inverti", "cb", 0],
    ["Probabilit\u00e0", "cb", 0],
    ["Seme", "sl", 1]
];

/* ------------------------------------------------------- espressioni -- */

var MT_X = {};

MT_X.head = [
    'var C = thisComp.layer(@C@);',
    'var g = function (nm) { return C.effect(nm)(1).value; };',
    'var i = effect("MT Indice")(1).value;',
    'var m = Math.round(g("Distribuzione"));',
    // Copie in uso adesso: con Quantita', Colonne o Righe animate cambia nel tempo (le copie in piu' si nascondono).
    'var n = m == 2 ? Math.max(1, Math.round(g("Colonne"))) * Math.max(1, Math.round(g("Righe"))) * Math.max(1, Math.round(g("Livelli"))) : Math.max(1, Math.round(g("Quantit\u00e0")));'
];

/* Angolo sul cerchio o sulla spirale per la copia i. */
MT_X.angle = [
    'var mtAngle = function () {',
    '  var dir = g("Inverti senso") == 1 ? -1 : 1;',
    '  if (m == 5) return g("Angolo iniziale") + dir * i * 137.50776;',
    '  var arc = g("Arco"), full = Math.abs(arc) >= 360;',
    '  var k = n > 1 ? i / (full ? n : n - 1) : 0;',
    '  return g("Angolo iniziale") + dir * arc * (k + g("Scorrimento") / 100);',
    '};'
];

/* Tracciato: maschera 1 del layer scelto, oppure il primo tracciato di un livello forma. */
MT_X.path = [
    'var mtPath = function () {',
    '  var P = null;',
    '  try { P = C.effect("Tracciato")(1); } catch (e0) { P = null; }',
    '  if (!P) return null;',
    '  var pth = null;',
    '  try { pth = P.mask(1).maskPath; } catch (e1) { try { pth = P.content(1).content(1).path; } catch (e2) { pth = null; } }',
    '  if (!pth) return null;',
    '  var closed = false;',
    '  try { closed = pth.isClosed(); } catch (e3) {}',
    '  var u = (n > 1 ? i / (closed ? n : n - 1) : 0) + g("Scorrimento") / 100;',
    '  u = closed ? u - Math.floor(u) : clamp(u, 0, 1);',
    '  return { L: P, p: pth, u: u };',
    '};'
];

/*
 * Passo effettivo. Passo: da centro a centro. Adatta: dimensione totale. Distanza: spazio tra i bordi,
 * sommata alla dimensione delle copie (scalata da Trasforma scala). In Lineare con Spazio la riga va
 * in orizzontale, o in verticale con "Per colonne".
 */
MT_X.step = [
    'var mm = Math.round(g("Modo misura")), fit = mm == 2, st = g("Passo");',
    'if (mm == 3) {',
    '  var gp = [0, 0, 0], dc = [100, 100, 100];',
    '  try { gp = g("Distanza"); dc = g("Dimensione copia"); } catch (eS) {}',
    '  var ks = Math.abs(C.effect("Trasforma scala")(1).value) / 100;',
    '  if (m == 1) st = Math.round(g("Direzione griglia")) == 2 ? [0, dc[1] * ks + gp[1], 0] : [dc[0] * ks + gp[0], 0, 0];',
    '  else st = [dc[0] * ks + gp[0], dc[1] * ks + gp[1], dc[2] * ks + gp[2]];',
    '}'
];

MT_X.base = [].concat(MT_X.head, MT_X.angle, MT_X.path, MT_X.step, [
    'var ctr = g("Centra") == 1 ? 1 : 0;',
    'var p = [0, 0, 0];',
    'if (m == 1) {',
    '  var k = fit ? (n > 1 ? i / (n - 1) : 0) : i;',
    '  var c = fit ? 0.5 : (n - 1) / 2;',
    '  p = [st[0] * (k - ctr * c), st[1] * (k - ctr * c), st[2] * (k - ctr * c)];',
    '} else if (m == 2) {',
    '  var cols = Math.max(1, Math.round(g("Colonne"))), rows = Math.max(1, Math.round(g("Righe"))), lev = Math.max(1, Math.round(g("Livelli")));',
    '  var per = cols * rows, z = Math.floor(i / per), r = i % per, cx, cy;',
    '  if (Math.round(g("Direzione griglia")) == 2) { cx = Math.floor(r / rows); cy = r % rows; } else { cy = Math.floor(r / cols); cx = r % cols; }',
    '  var sx = fit ? (cols > 1 ? st[0] / (cols - 1) : 0) : st[0];',
    '  var sy = fit ? (rows > 1 ? st[1] / (rows - 1) : 0) : st[1];',
    '  var sz = fit ? (lev > 1 ? st[2] / (lev - 1) : 0) : st[2];',
    '  var off = (cy % 2 == 1) ? g("Sfalsa righe") : 0;',
    '  p = [sx * (cx - ctr * (cols - 1) / 2) + off, sy * (cy - ctr * (rows - 1) / 2), sz * (z - ctr * (lev - 1) / 2)];',
    '} else if (m == 3 || m == 5) {',
    '  var a = degreesToRadians(mtAngle());',
    '  var rad = m == 5 ? g("Raggio") * Math.sqrt((i + 0.5) / n) : g("Raggio");',
    '  var s = Math.sin(a) * rad, co = Math.cos(a) * rad, pl = Math.round(g("Piano"));',
    '  p = pl == 2 ? [s, 0, -co] : (pl == 3 ? [0, -co, s] : [s, -co, 0]);',
    '} else if (m == 4) {',
    '  seedRandom(Math.round(g("Seme")) * 1000 + i, true);',
    '  var A = g("Area");',
    '  p = [random(-0.5, 0.5) * A[0], random(-0.5, 0.5) * A[1], random(-0.5, 0.5) * A[2]];',
    '} else if (m == 6) {',
    '  var T = mtPath();',
    '  if (T) {',
    '    var q = C.fromWorld(T.L.toWorld(T.p.pointOnPath(T.u)));',
    '    p = [q[0], q[1], q.length > 2 ? q[2] : 0];',
    '  }',
    '}',
    'p'
]);

MT_X.orient = [].concat(MT_X.head, MT_X.angle, MT_X.path, [
    'var o = [0, 0, 0];',
    'if (g("Orienta") == 1) {',
    '  if (m == 3 || m == 5) {',
    '    var ang = mtAngle(), pl = Math.round(g("Piano"));',
    '    if (pl == 2) o[1] = -ang; else if (pl == 3) o[0] = ang; else o[2] = ang;',
    '  } else if (m == 6) {',
    '    var T = mtPath();',
    '    if (T) { var tg = T.p.tangentOnPath(T.u); o[2] = radiansToDegrees(Math.atan2(tg[1], tg[0])); }',
    '  }',
    '}',
    'o'
]);

/* Espressioni che leggono le liste dal marker del controllo. */
MT_X.lists = [
    'var mtLists = function () {',
    '  try {',
    '    var M = C.marker;',
    '    for (var q = 1; q <= M.numKeys; q++) {',
    '      var cm = M.key(q).comment;',
    '      if (cm.indexOf("MT_LISTS ") == 0) { var s = cm.substr(9); try { return JSON.parse(s); } catch (eJ) { return eval("(" + s + ")"); } }',
    '    }',
    '  } catch (e) {}',
    '  return {};',
    '};',
    'var mtPick = function (D, i, n) {',
    '  var len = D.v.length, md = D.m || "cycle";',
    '  if (md == "random") { seedRandom((D.s || 1) * 1000 + i, true); return Math.floor(random(len)); }',
    '  if (md == "pingpong") { if (len == 1) return 0; var p = i % (2 * len - 2); return p < len ? p : 2 * len - 2 - p; }',
    '  if (md == "stretch") return n > 1 ? Math.round(i / (n - 1) * (len - 1)) : 0;',
    '  return i % len;',
    '};'
];

/*
 * Falloff come un'area: dentro la forma l'effetto e' pieno; fuori sfuma fino a sparire, su una
 * fascia larga Morbidezza % del raggio. Cosi' anche una copia appena fuori riceve un po' di effetto.
 * Lineare: pieno a sinistra, vuoto a destra.
 */
MT_X.fall = [
    'var mtFallInfo = function (F, wp) {',
    '  var fx = function (nm) { return F.effect(nm)(1).value; };',
    '  var l = F.fromWorld(wp), a = F.transform.anchorPoint.value;',
    '  var sz = fx("Dimensione"), form = Math.round(fx("Forma"));',
    '  var hw = Math.max(0.001, Math.abs(sz[0]) / 2), hh = Math.max(0.001, Math.abs(sz[1]) / 2);',
    '  var dx = l[0] - a[0], dy = l[1] - a[1];',
    '  var dz = (l.length > 2 && a.length > 2) ? l[2] - a[2] : 0;',
    // In 3D la profondita' del falloff (0 = uguale alla larghezza).
    '  var dp = 0;',
    '  try { dp = Math.abs(fx("Profondit\u00e0")); } catch (eP) { dp = 0; }',
    '  var hd = dp > 0.001 ? dp / 2 : hw;',
    '  var r = form == 2 ? Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh, Math.abs(dz) / hd) : Math.sqrt(dx * dx / (hw * hw) + dy * dy / (hh * hh) + dz * dz / (hd * hd));',
    '  return { fx: fx, form: form, r: r, dx: dx, hw: hw, s: Math.max(0.001, fx("Morbidezza") / 100), inv: fx("Inverti") == 1, gain: fx("Intensità") / 100, prob: fx("Probabilità") == 1 };',
    '};',
    'var mtFallT = function (I, r) {',
    '  var t = I.form == 3 ? clamp(0.5 - I.dx / (2 * I.hw), 0, 1) : (r <= 1 ? 1 : clamp(1 - (r - 1) / I.s, 0, 1));',
    '  t = t * t * (3 - 2 * t);',
    '  return I.inv ? 1 - t : t;',
    '};',
    'var mtFall = function (F, wp, k) {',
    '  var w = 0;',
    '  try {',
    '    var I = mtFallInfo(F, wp), t = mtFallT(I, I.r);',
    '    if (I.prob) { seedRandom(Math.round(I.fx("Seme")) * 1000 + i * 31 + k, true); t = random() < t ? 1 : 0; }',
    '    w = t * I.gain;',
    '  } catch (e) { w = 0; }',
    '  return w;',
    '};',
    // Spinta che mantiene le distanze quando la scala cresce: ogni copia si allontana dal centro del
    // falloff di quanto sono cresciute le copie tra lei e il centro (peso medio lungo il raggio).
    // A: quanto cresce la scala (1 = +100%). rho: dimensione della copia diviso il passo.
    'var mtPush = function (F, wp, A, rho) {',
    '  try {',
    '    var I = mtFallInfo(F, wp);',
    '    if (I.form == 3 || I.prob) return [0, 0, 0];',
    '    var cw = F.toWorld(F.transform.anchorPoint.value);',
    '    var d = [wp[0] - cw[0], wp[1] - cw[1], (wp.length > 2 && cw.length > 2) ? wp[2] - cw[2] : 0];',
    '    var sum = 0, N = 12;',
    '    for (var j = 0; j < N; j++) sum += mtFallT(I, I.r * (j + 0.5) / N);',
    '    var mul = A * rho * I.gain * sum / N;',
    '    return [d[0] * mul, d[1] * mul, d[2] * mul];',
    '  } catch (e) { return [0, 0, 0]; }',
    '};'
];


/* Somma dei comportamenti con destinazione tra @LO@ e @LO@+2. */
MT_X.behave = [].concat(MT_X.head, MT_X.fall, MT_X.lists, [
    'var LS = null;',
    'var out = [0, 0, 0];',
    'var nb = 0;',
    'try { nb = Math.round(g("Comportamenti")); } catch (e0) { nb = 0; }',
    'if (nb > 0) {',
    '  var b = effect("MT Base")(1).value, wp = null;',
    MT_X.step.join("\n"),
    '  var ctr = g("Centra") == 1;',
    '  var e = [0, 0, 0], c = [0, 0, 0];',
    '  if (m == 1) { var L1 = fit ? 1 : Math.max(1, n - 1); e = [Math.abs(st[0]) * L1 / 2, Math.abs(st[1]) * L1 / 2, Math.abs(st[2]) * L1 / 2]; if (!ctr) c = [st[0] * L1 / 2, st[1] * L1 / 2, st[2] * L1 / 2]; }',
    '  else if (m == 2) {',
    '    var cl = Math.max(1, Math.round(g("Colonne"))), rw = Math.max(1, Math.round(g("Righe"))), lv = Math.max(1, Math.round(g("Livelli")));',
    '    var Lx = fit ? 1 : Math.max(1, cl - 1), Ly = fit ? 1 : Math.max(1, rw - 1), Lz = fit ? 1 : Math.max(1, lv - 1);',
    '    e = [Math.abs(st[0]) * Lx / 2, Math.abs(st[1]) * Ly / 2, Math.abs(st[2]) * Lz / 2];',
    '    if (!ctr) c = [st[0] * Lx / 2, st[1] * Ly / 2, st[2] * Lz / 2];',
    '  }',
    '  else if (m == 3 || m == 5) { var R = Math.abs(g("Raggio")); e = [R, R, R]; }',
    '  else if (m == 4) { var Ar = g("Area"); e = [Math.abs(Ar[0]) / 2, Math.abs(Ar[1]) / 2, Math.abs(Ar[2]) / 2]; }',
    '  var el = Math.max(0.001, Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]));',
    '  for (var k = 1; k <= nb; k++) {',
    '    var pre = "B" + k + " ";',
    '    if (C.effect(pre + "Attivo")(1).value != 1) continue;',
    '    var dst = Math.round(C.effect(pre + "Destinazione")(1).value);',
    // Scala con "Mantieni spazi": nella posizione, le copie si allargano attorno al falloff.
    '    if (@LO@ == 1 && dst == 7) {',
    '      var pf = 0, Fp = null;',
    '      try { pf = C.effect(pre + "Mantieni spazi")(1).value; } catch (eP) { pf = 0; }',
    '      try { Fp = C.effect(pre + "Falloff")(1); } catch (eF2) { Fp = null; }',
    '      if (pf == 1 && Fp && Fp.index && Math.round(C.effect(pre + "Tipo")(1).value) == 5) {',
    '        var dcs = [100, 100, 100];',
    '        try { dcs = g("Dimensione copia"); } catch (eD) {}',
    '        var ksc = Math.abs(C.effect("Trasforma scala")(1).value) / 100, dd = 1, DD = 1;',
    '        if (m == 1) {',
    '          var sl = Math.sqrt(st[0] * st[0] + st[1] * st[1] + st[2] * st[2]);',
    '          dd = (Math.abs(st[1]) > Math.abs(st[0]) ? Math.abs(dcs[1]) : Math.abs(dcs[0])) * ksc;',
    '          DD = fit ? sl / Math.max(1, n - 1) : sl;',
    '        } else if (m == 2) {',
    '          var c2 = Math.max(1, Math.round(g("Colonne"))), r2 = Math.max(1, Math.round(g("Righe")));',
    '          dd = (Math.abs(dcs[0]) + Math.abs(dcs[1])) / 2 * ksc;',
    '          DD = ((fit ? Math.abs(st[0]) / Math.max(1, c2 - 1) : Math.abs(st[0])) + (fit ? Math.abs(st[1]) / Math.max(1, r2 - 1) : Math.abs(st[1]))) / 2;',
    '        }',
    '        var rho = DD > 0.001 ? clamp(dd / DD, 0, 1.5) : 1;',
    '        if (!wp) { try { wp = C.toWorld(b); } catch (eW2) { wp = C.toWorld([b[0], b[1]]); } }',
    '        var dv = mtPush(Fp, wp, C.effect(pre + "Max")(1).value / 100, rho);',
    '        var w2 = wp.length > 2 ? [wp[0] + dv[0], wp[1] + dv[1], wp[2] + dv[2]] : [wp[0] + dv[0], wp[1] + dv[1]];',
    '        var q0 = C.fromWorld(wp), q1 = C.fromWorld(w2);',
    '        out[0] += q1[0] - q0[0]; out[1] += q1[1] - q0[1];',
    '        if (q0.length > 2 && q1.length > 2) out[2] += q1[2] - q0[2];',
    '      }',
    '      continue;',
    '    }',
    '    if (dst < @LO@ || dst > @LO@ + 2) continue;',
    '    var typ = Math.round(C.effect(pre + "Tipo")(1).value);',
    '    var mn = C.effect(pre + "Min")(1).value, mx = C.effect(pre + "Max")(1).value;',
    '    var sd = Math.round(C.effect(pre + "Seme")(1).value);',
    '    var v = 0;',
    '    if (typ == 1) {',
    '      var ord = Math.round(C.effect(pre + "Ordine")(1).value);',
    '      var t = n > 1 ? i / (n - 1) : 0;',
    '      if (ord == 2) t = 1 - t;',
    '      else if (ord == 3 || ord == 4) {',
    '        var ddx = b[0] - c[0], ddy = b[1] - c[1], ddz = b[2] - c[2];',
    '        t = clamp(Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) / el, 0, 1);',
    '        if (ord == 4) t = 1 - t;',
    '      }',
    '      else if (ord == 5) { seedRandom(sd * 1000 + i * 13 + k * 101, true); t = random(); }',
    '      else if (ord == 6) t = clamp(((b[0] - c[0]) / Math.max(0.001, e[0]) + 1) / 2, 0, 1);',
    '      else if (ord == 7) t = clamp(((b[1] - c[1]) / Math.max(0.001, e[1]) + 1) / 2, 0, 1);',
    '      var cv = Math.round(C.effect(pre + "Curva")(1).value);',
    '      if (cv == 2) t = t * t; else if (cv == 3) t = 1 - (1 - t) * (1 - t); else if (cv == 4) t = t * t * (3 - 2 * t);',
    '      v = mn + (mx - mn) * t;',
    '    } else if (typ == 2) {',
    '      seedRandom(sd * 1000 + i * 7 + k * 101, true);',
    '      v = mn + (mx - mn) * random();',
    '    } else if (typ == 3) {',
    '      var fq = C.effect(pre + "Frequenza")(1).value, sp = C.effect(pre + "Fase")(1).value;',
    '      var nz = noise([i * fq * 0.15 + sd * 17.3, time * sp / 60 + k * 3.1]);',
    '      v = mn + (mx - mn) * (nz + 1) / 2;',
    '    } else if (typ == 4) {',
    '      var hz = C.effect(pre + "Frequenza")(1).value, ph = C.effect(pre + "Fase")(1).value;',
    '      v = (mn + mx) / 2 + (mx - mn) / 2 * Math.sin(2 * Math.PI * hz * time - degreesToRadians(ph) * i);',
    '    } else if (typ == 6) {',
    '      if (!LS) LS = mtLists();',
    '      var D = LS["B" + k];',
    '      v = (D && D.v && D.v.length) ? (parseFloat(D.v[mtPick(D, Math.round(i), n)]) || 0) : 0;',
    '    } else {',
    '      v = mx;',
    '    }',
    '    var F = null;',
    '    try { F = C.effect(pre + "Falloff")(1); } catch (eF) { F = null; }',
    '    if (F && F.index) {',
    '      if (!wp) { try { wp = C.toWorld(b); } catch (eW) { wp = C.toWorld([b[0], b[1]]); } }',
    '      v *= mtFall(F, wp, k);',
    '    }',
    '    out[dst - @LO@] += v;',
    '  }',
    '}',
    'out'
]);

MT_X.position = [
    'var C = thisComp.layer(@C@);',
    'var b = effect("MT Base")(1).value, q = effect("MT Pos")(1).value, x = effect("MT Extra")(1).value;',
    'var t = time - x[2] * thisComp.frameDuration;',
    'var o = C.effect("Trasforma posizione")(1).valueAtTime(t);',
    'var g0 = [0, 0, 0];',
    'try { g0 = effect("MT Origine")(1).value; } catch (e0) {}',
    'var v = value.length > 2 ? value : [value[0], value[1], 0];',
    'var p = [b[0] + q[0] + o[0] + v[0] - g0[0], b[1] + q[1] + o[1] + v[1] - g0[1], b[2] + q[2] + o[2] + v[2] - g0[2]];',
    // Centro del contenuto: ogni copia si posa sul punto con il suo centro visivo, qualunque sia il suo ancoraggio.
    'var al = 2;',
    'try { al = Math.round(C.effect("Allinea copie")(1).value); } catch (eA) { al = 2; }',
    'if (al == 1) {',
    '  try {',
    '    var rr = sourceRectAtTime(inPoint + (outPoint - inPoint) / 2, false), ap = anchorPoint, sc = scale;',
    '    var dx = (ap[0] - (rr.left + rr.width / 2)) * sc[0] / 100, dy = (ap[1] - (rr.top + rr.height / 2)) * sc[1] / 100;',
    '    var an = degreesToRadians(rotation), cs = Math.cos(an), sn = Math.sin(an);',
    '    p[0] += dx * cs - dy * sn; p[1] += dx * sn + dy * cs;',
    '  } catch (eR) {}',
    '}',
    'value.length > 2 ? p : [p[0], p[1]]'
];

MT_X.scale = [
    'var C = thisComp.layer(@C@);',
    'var x = effect("MT Extra")(1).value;',
    'var t = time - x[2] * thisComp.frameDuration;',
    // Scala dell'input da cui viene la copia (I<n> Scala sul controllo).
    'var si = 0, isc = 1;',
    'try { si = Math.round(effect("MT Input")(1).value); } catch (eI) { si = 0; }',
    'try { isc = C.effect("I" + (si + 1) + " Scala")(1).valueAtTime(t) / 100; } catch (eS) { isc = 1; }',
    'var s = C.effect("Trasforma scala")(1).valueAtTime(t) / 100 * Math.max(0, 100 + x[0]) / 100 * isc;',
    'var out = [];',
    'for (var d = 0; d < value.length; d++) out.push(value[d] * s);',
    'out'
];

MT_X.rotation = [
    'var C = thisComp.layer(@C@);',
    'var x = effect("MT Extra")(1).value, r = effect("MT Rot")(1).value, o = effect("MT Orient")(1).value;',
    'var t = time - x[2] * thisComp.frameDuration;',
    'value + C.effect("Trasforma rotazione")(1).valueAtTime(t) + o[2] + r[0]'
];

MT_X.rotationX = ['value + effect("MT Orient")(1).value[0] + effect("MT Rot")(1).value[1]'];
MT_X.rotationY = ['value + effect("MT Orient")(1).value[1] + effect("MT Rot")(1).value[2]'];

MT_X.opacity = [].concat(MT_X.head, [
    'var x = effect("MT Extra")(1).value;',
    'var t = time - x[2] * thisComp.frameDuration;',
    // Copia oltre il numero di adesso (colonne o righe animate): nascosta, come in Cavalry.
    'i >= n ? 0 : value * C.effect("Trasforma opacit\u00e0")(1).valueAtTime(t) / 100 + x[1]'
]);

MT_X.timeRemap = [
    'var x = effect("MT Extra")(1).value;',
    'valueAtTime(Math.max(inPoint, time - x[2] * thisComp.frameDuration))'
];

/*
 * Colore dei comportamenti (destinazione Colore): media dei colori pesata dalla forza di ciascuno
 * (Valore in %, per il falloff), in [r, g, b, peso]. Il peso decide quanto si vede il colore.
 */
MT_X.fcolor = (function () {
    var out = [], L = MT_X.behave;
    for (var q = 0; q < L.length; q++) {
        var ln = L[q];
        if (ln === 'var out = [0, 0, 0];') ln = 'var out = [0, 0, 0], col = [0, 0, 0], sw = 0;';
        else if (ln === '    out[dst - @LO@] += v;') ln = '    var wv = clamp(v / 100, 0, 1), cc = [1, 0.35, 0.12, 1];\n    try { cc = C.effect(pre + "Colore")(1).value; } catch (eC) {}\n    col[0] += cc[0] * wv; col[1] += cc[1] * wv; col[2] += cc[2] * wv; sw += wv;';
        else if (ln === 'out') ln = 'sw > 0 ? [col[0] / sw, col[1] / sw, col[2] / sw, Math.min(1, sw)] : [0, 0, 0, 0]';
        out.push(ln);
    }
    return out;
})();

/*
 * Prova del falloff per una copia, senza try/catch che nascondono l'errore: serve solo a farsi dire
 * da After Effects cosa non va. Restituisce [peso, indice del falloff, 1].
 */
MT_X.fallTest = (function () {
    var f = [];
    for (var q = 0; q < MT_X.fall.length; q++) f.push(MT_X.fall[q] === '  } catch (e) { w = 0; }' ? '  } catch (e) { throw e; }' : MT_X.fall[q]);
    return [].concat(MT_X.head, f, [
        'var b = effect("MT Base")(1).value;',
        'var F = C.effect("B@K@ Falloff")(1);',
        'var wp = C.toWorld(b);',
        '[mtFall(F, wp, @K@), F.index, 1]'
    ]);
})();

function mt_sub(s, key, val) { return s.split(key).join(val); }

function mt_expr(kind, ctrlName, lo) {
    var s = MT_X[kind].join("\n");
    s = mt_sub(s, "@C@", inflect_quote(ctrlName));
    if (lo) s = mt_sub(s, "@LO@", String(lo));
    if (kind === "fallTest") s = mt_sub(s, "@K@", String(lo));
    return s;
}

/* -------------------------------------------------------- effetti -- */

function mt_matchName(kind) {
    return { sl: "ADBE Slider Control", p3: "ADBE Point3D Control", p2: "ADBE Point Control", cb: "ADBE Checkbox Control",
        an: "ADBE Angle Control", dd: "ADBE Dropdown Control", ly: "ADBE Layer Control", cl: "ADBE Color Control" }[kind];
}

/** Aggiunge un controllo espressione con nome e valore, e restituisce la proprieta' valore. */
function mt_fx(layer, kind, name, value, items) {
    var parade = layer.property("ADBE Effect Parade");
    var done = false, matchName = mt_matchName(kind);
    if (kind === "dd") {
        var before = parade.numProperties;
        try {
            var dd = parade.addProperty(matchName);
            var menu = dd.property(1).setPropertyParameters(items);
            menu.propertyGroup(1).name = name;
            done = true;
        } catch (e) {
            // Versioni senza menu a discesa: un cursore con lo stesso significato (1, 2, 3...).
            try { while (parade.numProperties > before) parade.property(parade.numProperties).remove(); } catch (e2) {}
            matchName = "ADBE Slider Control";
        }
    }
    if (!done) {
        var fx = parade.addProperty(matchName);
        fx.name = name;
    }
    var p = layer.property("ADBE Effect Parade").property(name).property(1);
    if (value !== undefined && value !== null && !(kind === "ly" && !value)) p.setValue(value);
    return p;
}

function mt_fxProp(layer, name) {
    try {
        var fx = layer.property("ADBE Effect Parade").property(name);
        return fx ? fx.property(1) : null;
    } catch (e) { return null; }
}

function mt_get(layer, name) {
    var p = mt_fxProp(layer, name);
    if (!p) return null;
    var v = p.value;
    if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(v[i]); return a; }
    return v;
}

/** Imposta un valore: se la proprieta' e' animata, mette un keyframe al tempo corrente. */
function mt_set(layer, name, value, t) {
    var p = mt_fxProp(layer, name);
    if (!p) return false;
    if (p.numKeys > 0) p.setValueAtTime(t, value); else p.setValue(value);
    return true;
}

/* -------------------------------------------------- ricerca layer -- */

function mt_isCtrl(l) {
    try { return !!l && String(l.comment).indexOf(MT_TAG) === 0 && mt_fxProp(l, "Distribuzione") !== null; }
    catch (e) { return false; }
}

function mt_isFalloff(l) {
    try { return !!l && String(l.comment).indexOf(MT_FALLOFF_TAG) === 0; } catch (e) { return false; }
}

function mt_findCtrl(comp) {
    var sel = comp.selectedLayers, i;
    for (i = 0; i < sel.length; i++) {
        if (mt_isCtrl(sel[i])) { $.global.MT_LASTCTRL = sel[i].id; return sel[i]; }
        try { if (sel[i].parent && mt_isCtrl(sel[i].parent)) { $.global.MT_LASTCTRL = sel[i].parent.id; return sel[i].parent; } } catch (e) {}
    }
    // Un falloff selezionato porta al Cloner che lo usa: il pannello resta sul suo Cloner.
    for (i = 0; i < sel.length; i++) {
        if (!mt_isFalloff(sel[i])) continue;
        var c = mt_ctrlForFalloff(comp, sel[i]);
        if (c) return c;
    }
    // Mentre scegli nella composizione i layer da aggiungere come input, il Cloner resta quello di prima.
    var pin = mt_pinnedCtrl(comp);
    if (pin) return pin;
    return null;
}

/* Cloner "fissato" dal pannello per due minuti al massimo. */
function mt_pinnedCtrl(comp) {
    var id = $.global.MT_PINCTRL;
    if (!id) return null;
    if (new Date().getTime() - ($.global.MT_PINAT || 0) > 120000) { $.global.MT_PINCTRL = null; return null; }
    for (var l = 1; l <= comp.numLayers; l++) if (comp.layer(l).id === id && mt_isCtrl(comp.layer(l))) return comp.layer(l);
    return null;
}

function inflect_repeatPin(on) {
    var comp = inflect_activeComp();
    if (!on || on === "false") { $.global.MT_PINCTRL = null; return inflect_ok({}); }
    var ctrl = comp ? mt_findCtrl(comp) : null;
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner.");
    $.global.MT_PINCTRL = ctrl.id;
    $.global.MT_PINAT = new Date().getTime();
    return inflect_ok({ name: ctrl.name });
}

function mt_ctrlForFalloff(comp, F) {
    var ctrls = [], j, l;
    for (l = 1; l <= comp.numLayers; l++) if (mt_isCtrl(comp.layer(l))) ctrls.push(comp.layer(l));
    if (!ctrls.length) return null;
    var tag = String(F.comment), m = tag.match(/MT_FALLOFF (\d+)/);
    if (m) for (j = 0; j < ctrls.length; j++) if (String(ctrls[j].id) === m[1]) return ctrls[j];
    for (j = 0; j < ctrls.length; j++) {
        var nb = 0;
        try { nb = Math.round(mt_get(ctrls[j], "Comportamenti")); } catch (e) {}
        for (var k = 1; k <= nb; k++) {
            var fp = mt_fxProp(ctrls[j], "B" + k + " Falloff");
            try { if (fp && fp.value === F.index) return ctrls[j]; } catch (e2) {}
        }
    }
    var last = $.global.MT_LASTCTRL;
    for (j = 0; j < ctrls.length; j++) if (ctrls[j].id === last) return ctrls[j];
    return ctrls[0];
}

function mt_meta(ctrl) {
    var o = { src: [], pick: "cycle", front: "last" };
    var parts = String(ctrl.comment).split("|");
    for (var i = 1; i < parts.length; i++) {
        var kv = parts[i].split("=");
        if (kv[0] === "src" && kv[1]) { var ids = kv[1].split(","); for (var j = 0; j < ids.length; j++) o.src.push(parseInt(ids[j], 10)); }
        if (kv[0] === "pick") o.pick = kv[1];
        if (kv[0] === "anch" && kv[1]) { var af = kv[1].split(","); o.anchorSet = true; o.ax = parseFloat(af[0]); o.ay = parseFloat(af[1]); if (isNaN(o.ax)) o.ax = 0.5; if (isNaN(o.ay)) o.ay = 0.5; }
        if (kv[0] === "front") o.front = kv[1];
        if (kv[0] === "v") o.ver = parseInt(kv[1], 10) || 0;
    }
    if (!o.ver) o.ver = 0;
    return o;
}

function mt_writeMeta(ctrl, meta) {
    ctrl.comment = MT_TAG + "|src=" + meta.src.join(",") + "|pick=" + meta.pick + "|front=" + meta.front + (meta.anchorSet ? "|anch=" + (meta.ax === undefined ? 0.5 : meta.ax) + "," + (meta.ay === undefined ? 0.5 : meta.ay) : "") + (meta.ver ? "|v=" + meta.ver : "");
}

/* Ogni copia ricorda inizio, punto d'attacco e fine della sorgente, per lo stagger nel tempo. */
function mt_cloneComment(sIdx, src) {
    return MT_CLONE_TAG + "|s=" + sIdx + "|st=" + src.startTime + "|in=" + src.inPoint + "|out=" + src.outPoint;
}

function mt_cloneTimes(l) {
    var c = String(l.comment), o = { st: null, ip: null, op: null };
    var m1 = /\|st=([-0-9.e]+)/.exec(c), m2 = /\|in=([-0-9.e]+)/.exec(c), m3 = /\|out=([-0-9.e]+)/.exec(c);
    if (m1) o.st = parseFloat(m1[1]);
    if (m2) o.ip = parseFloat(m2[1]);
    if (m3) o.op = parseFloat(m3[1]);
    return o;
}

/*
 * Stagger nel tempo: ogni copia viene spostata nella timeline del ritardo calcolato dai
 * comportamenti sul Tempo, come quando si sfalsano i layer a mano. Si spostano anche i
 * keyframe propri della copia. Inizio e fine visibili restano quelli della sorgente.
 */
function mt_syncTime(comp, ctrl) {
    var clones = mt_clones(comp, ctrl), fd = comp.frameDuration, moved = 0;
    for (var i = 0; i < clones.length; i++) {
        var L = clones[i].layer, T = mt_cloneTimes(L);
        if (T.st === null) continue;
        var d = 0;
        try { d = mt_fxProp(L, "MT Extra").value[2]; } catch (e) { d = 0; }
        if (!isFinite(d)) d = 0;
        var target = T.st + Math.round(d) * fd;
        if (Math.abs(L.startTime - target) > fd / 4) {
            var wasLocked = L.locked;
            if (wasLocked) L.locked = false;
            L.startTime = target;
            try { L.inPoint = T.ip; } catch (e1) {}
            try { L.outPoint = T.op + Math.max(0, Math.round(d)) * fd; } catch (e2) {}
            if (wasLocked) L.locked = true;
            moved++;
        }
    }
    return moved;
}

function mt_cloneSrc(l) {
    var m = /s=(\d+)/.exec(String(l.comment));
    return m ? parseInt(m[1], 10) : 0;
}

function mt_clones(comp, ctrl) {
    var out = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        try { if (!l.parent || l.parent.index !== ctrl.index) continue; } catch (e) { continue; }
        var ip = mt_fxProp(l, "MT Indice");
        if (ip) out.push({ layer: l, i: Math.round(ip.value), s: mt_cloneSrc(l) });
    }
    out.sort(function (a, b) { return a.i - b.i; });
    return out;
}

function mt_pad(n) { var s = String(n + 1); while (s.length < 3) s = "0" + s; return s; }

function mt_uniqueName(comp, base) {
    var k = 1, name, found;
    do {
        name = base + " " + k; found = false;
        for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) { found = true; break; }
        k++;
    } while (found && k < 1000);
    return name;
}

/*
 * Quale input usa la copia i: cycle (a turno), random, pingpong (avanti e indietro),
 * stretch (a blocchi: il primo input per le prime copie, e cosi' via), only:N (sempre lo stesso).
 */
function mt_pick(i, nSrc, pick, seed, n) {
    if (nSrc <= 1) return 0;
    var om = /^only:(\d+)$/.exec(String(pick));
    if (om) return Math.min(nSrc - 1, parseInt(om[1], 10));
    if (pick === "pingpong") { var p = i % (2 * nSrc - 2); return p < nSrc ? p : 2 * nSrc - 2 - p; }
    if (pick === "stretch") return Math.min(nSrc - 1, Math.floor(i * nSrc / Math.max(1, n || nSrc)));
    if (pick === "random") {
        var x = ((i + 1) * 9301 + 49297 + Math.round(seed) * 233) % 233280;
        x = (x * 9301 + 49297) % 233280;
        return Math.floor(x / 233280 * nSrc);
    }
    return i % nSrc;
}

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
/* ---------------------------------------------------------- utilita' -- */

/** Sposta nel tempo i layer delle copie (utile se le sorgenti hanno gia' una loro animazione). */
function inflect_repeatSequence(frames, mode, seed) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var clones = mt_clones(comp, ctrl), n = clones.length, i;
    if (!n) return inflect_err("Questo Cloner non ha copie.");
    var base = clones[0].layer.startTime;
    for (i = 1; i < n; i++) if (clones[i].layer.startTime < base) base = clones[i].layer.startTime;
    var x = (Math.round(seed) * 9301 + 49297) % 233280, mid = (n - 1) / 2;
    mt_begin("Motion Tools: sfalsa copie");
    try {
        for (i = 0; i < n; i++) {
            var r = i;
            if (mode === 2) r = n - 1 - i;
            else if (mode === 3) r = Math.abs(i - mid);
            else if (mode === 4) r = mid - Math.abs(i - mid);
            else if (mode === 5) { x = (x * 9301 + 49297) % 233280; r = (x / 233280) * (n - 1); }
            clones[i].layer.startTime = base + Math.round(r * frames) * comp.frameDuration;
        }
    } catch (e) { mt_end(); return inflect_err("Sfalsamento non riuscito: " + e.toString()); }
    mt_end();
    return inflect_ok({ count: n });
}

function inflect_repeatSelect(what) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var clones = mt_clones(comp, ctrl);
    for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
    if (what === "clones") for (var i = 0; i < clones.length; i++) clones[i].layer.selected = true;
    else ctrl.selected = true;
    return inflect_ok({ count: clones.length });
}

/** Elimina controllo e copie e riattiva le sorgenti. I falloff restano: possono servire ad altri Cloner. */
function inflect_repeatRemove() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    mt_begin("Motion Tools: elimina Cloner");
    try {
        var meta = mt_meta(ctrl), clones = mt_clones(comp, ctrl), name = ctrl.name;
        for (var i = clones.length - 1; i >= 0; i--) clones[i].layer.remove();
        ctrl.remove();
        for (var s = 0; s < meta.src.length; s++) {
            try { var src = mt_layerById(meta.src[s]); if (src) { src.enabled = true; src.selected = true; } } catch (e1) {}
        }
        mt_end();
        return inflect_ok({ name: name });
    } catch (e) { mt_end(); return inflect_err("Eliminazione non riuscita: " + e.toString()); }
}

/* -------------------------------------------------- composizione -- */

/*
 * Riquadro che contiene i layer in tutti i frame in cui sono visibili.
 * Si misura il contenuto senza far calcolare gli effetti (con gli effetti ogni misura e' un render,
 * e alcuni effetti dichiarano ingombri enormi): al massimo 48 campioni piu' i tempi dei keyframe.
 * Gli effetti allargano il riquadro solo in tre momenti e al massimo di MT_FX_PAD px per lato.
 */
var MT_FX_PAD = 300;

function mt_sampleTimes(L, t0, t1, fd) {
    var out = [], frames = Math.max(1, Math.round((t1 - t0) / fd)), steps = Math.min(48, frames), s, k;
    for (s = 0; s <= steps; s++) out.push(t0 + (t1 - t0) * s / steps);
    // Anche i keyframe della trasformazione: li' il layer e' spesso nel punto piu' lontano.
    try {
        var tr = L.property("ADBE Transform Group");
        for (var i = 1; i <= tr.numProperties; i++) {
            var p = tr.property(i);
            if (!p || !p.numKeys) continue;
            for (k = 1; k <= p.numKeys; k++) { var kt = p.keyTime(k); if (kt >= t0 && kt <= t1) out.push(kt); }
        }
    } catch (e) {}
    for (s = 0; s < out.length; s++) if (out[s] >= t1 && t1 > t0) out[s] = t1 - fd / 2;
    return out;
}

function mt_hasEffects(L) {
    try { return L.property("ADBE Effect Parade").numProperties > 0; } catch (e) { return false; }
}

function mt_boundsOverTime(layers, comp) {
    var B = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 };
    var grow = function (b) { if (b.l < B.l) B.l = b.l; if (b.r > B.r) B.r = b.r; if (b.t < B.t) B.t = b.t; if (b.b > B.b) B.b = b.b; };
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!inflect_isVisual(L)) continue;
        var t0 = Math.max(0, L.inPoint), t1 = Math.min(comp.duration, L.outPoint);
        if (t1 < t0) { t0 = 0; t1 = 0; }
        var T = mt_sampleTimes(L, t0, t1, comp.frameDuration);
        for (var s = 0; s < T.length; s++) { try { grow(inflect_bounds(L, T[s], false)); } catch (e) {} }
        if (mt_hasEffects(L)) {
            var tm = [t0, (t0 + t1) / 2, Math.max(t0, t1 - comp.frameDuration / 2)];
            for (var q = 0; q < 3; q++) {
                try {
                    var c = inflect_bounds(L, tm[q], false), e2 = inflect_bounds(L, tm[q], true);
                    grow({ l: Math.max(e2.l, c.l - MT_FX_PAD), r: Math.min(e2.r, c.r + MT_FX_PAD), t: Math.max(e2.t, c.t - MT_FX_PAD), b: Math.min(e2.b, c.b + MT_FX_PAD) });
                } catch (eF) {}
            }
        }
    }
    return B.l <= B.r ? B : null;
}

/* Lato massimo ragionevole per la precomposizione: oltre, After Effects rallenta molto o va in crash. */
function mt_maxSide(comp) { return Math.max(4096, 3 * Math.max(comp.width, comp.height)); }

/** Sposta tutti i layer senza genitore (camere e luci comprese) di dx, dy in pixel della composizione. */
function mt_shiftAll(comp, dx, dy, onlyLayers) {
    var list = [], i;
    if (onlyLayers) list = onlyLayers; else for (i = 1; i <= comp.numLayers; i++) list.push(comp.layer(i));
    for (i = 0; i < list.length; i++) {
        var L = list[i];
        try { if (L.parent) continue; } catch (eP) {}
        var wasLocked = L.locked;
        if (wasLocked) L.locked = false;
        try {
            inflect_movePos(L, dx, dy);
            if (L instanceof CameraLayer || L instanceof LightLayer) {
                var poi = L.property("ADBE Transform Group").property("ADBE Anchor Point");
                if (poi) inflect_offsetProp(poi, [dx, dy, 0]);
            }
        } catch (e) {}
        if (wasLocked) L.locked = true;
    }
}

/**
 * Precomponi e ritaglia: i layer selezionati passano, con keyframe ed effetti, in una
 * precomposizione grande quanto il loro contenuto durante tutta l'animazione.
 * Nella composizione di partenza il risultato resta esattamente dov'era.
 */
/* Copia l'animazione (keyframe, interpolazioni, easing, tangenti, espressione) da una proprieta' a un'altra. */
function mt_copyAnim(src, dst) {
    if (!src || !dst) return;
    try { if (src.expression) dst.expression = src.expression; } catch (eX) {}
    if (src.numKeys === 0) { dst.setValue(src.value); return; }
    var k, spatial = false;
    try { spatial = src.isSpatial; } catch (eS) {}
    for (k = 1; k <= src.numKeys; k++) dst.setValueAtTime(src.keyTime(k), src.keyValue(k));
    for (k = 1; k <= src.numKeys; k++) {
        var j = dst.nearestKeyIndex(src.keyTime(k));
        try { dst.setInterpolationTypeAtKey(j, src.keyInInterpolationType(k), src.keyOutInterpolationType(k)); } catch (e1) {}
        try { dst.setTemporalEaseAtKey(j, src.keyInTemporalEase(k), src.keyOutTemporalEase(k)); } catch (e2) {}
        if (spatial) {
            try { dst.setSpatialTangentsAtKey(j, src.keyInSpatialTangent(k), src.keyOutSpatialTangent(k)); } catch (e3) {}
            try { dst.setSpatialAutoBezierAtKey(j, src.keySpatialAutoBezier(k)); dst.setSpatialContinuousAtKey(j, src.keySpatialContinuous(k)); } catch (e4) {}
            try { dst.setRovingAtKey(j, src.keyRoving(k)); } catch (e5) {}
        }
        try { dst.setTemporalContinuousAtKey(j, src.keyTemporalContinuous(k)); dst.setTemporalAutoBezierAtKey(j, src.keyTemporalAutoBezier(k)); } catch (e6) {}
    }
}

function mt_clearAnim(p, v) {
    if (!p) return;
    try { p.expression = ""; } catch (e) {}
    while (p.numKeys > 0) p.removeKey(1);
    if (v !== undefined) p.setValue(v);
}

/*
 * Variante "animazione sulla composizione": il contenuto resta fermo e centrato nella
 * precomposizione, mentre posizione, scala, rotazione e opacita' (con i loro keyframe)
 * passano al layer della precomposizione. Comoda per animare il blocco come un tutt'uno.
 */
function mt_precompKeepOuter(comp, layer, margin) {
    var name = layer.name;
    // Misura prima di precomporre: se il risultato e' sproporzionato ci si ferma senza toccare nulla.
    var B = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 };
    var ta = Math.max(0, layer.inPoint), tb = Math.min(comp.duration, layer.outPoint);
    var TT = mt_sampleTimes(layer, ta, tb, comp.frameDuration);
    for (var s = 0; s < TT.length; s++) {
        try {
            var r = layer.sourceRectAtTime(TT[s], false);
            if (r.left < B.l) B.l = r.left; if (r.left + r.width > B.r) B.r = r.left + r.width;
            if (r.top < B.t) B.t = r.top; if (r.top + r.height > B.b) B.b = r.top + r.height;
        } catch (eR) {}
    }
    if (B.l > B.r) throw new Error("Non riesco a misurare il contenuto.");
    if (mt_hasEffects(layer)) { B.l -= Math.min(MT_FX_PAD, margin + 40); B.t -= Math.min(MT_FX_PAD, margin + 40); B.r += Math.min(MT_FX_PAD, margin + 40); B.b += Math.min(MT_FX_PAD, margin + 40); }
    var W = Math.max(4, Math.ceil(B.r - B.l + 2 * margin)), H = Math.max(4, Math.ceil(B.b - B.t + 2 * margin)), mx = mt_maxSide(comp);
    if (W > mx || H > mx) throw new Error("il contenuto occuperebbe " + W + " x " + H + " px, troppo per After Effects. Controlla se il layer ha un ingombro enorme (per esempio un tracciato o un testo a paragrafo molto grande).");
    var pc = comp.layers.precompose([layer.index], name, true);
    var O = null, i;
    for (i = 1; i <= comp.numLayers; i++) {
        try { if (comp.layer(i).source && comp.layer(i).source.id === pc.id) { O = comp.layer(i); break; } } catch (e) {}
    }
    var L = pc.layer(1);
    var trL = L.property("ADBE Transform Group");
    pc.width = W; pc.height = H;
    var ap = trL.property("ADBE Anchor Point").value;
    var cx = (B.l + B.r) / 2, cy = (B.t + B.b) / 2;
    var inner = [W / 2 + ap[0] - cx, H / 2 + ap[1] - cy];
    var trO = O.property("ADBE Transform Group");
    if (L.threeDLayer) O.threeDLayer = true;
    // L'animazione passa fuori, il layer interno resta fermo con il contenuto centrato.
    var pairs = [["ADBE Position", null], ["ADBE Scale", null], ["ADBE Rotate Z", null], ["ADBE Opacity", null]];
    if (L.threeDLayer) pairs.push(["ADBE Rotate X", null], ["ADBE Rotate Y", null], ["ADBE Orientation", null]);
    var posL = trL.property("ADBE Position");
    if (posL.dimensionsSeparated) posL.dimensionsSeparated = false;
    trO.property("ADBE Anchor Point").setValue([inner[0], inner[1], 0]);
    for (i = 0; i < pairs.length; i++) {
        var pL = trL.property(pairs[i][0]), pO = trO.property(pairs[i][0]);
        if (!pL || !pO) continue;
        mt_copyAnim(pL, pO);
    }
    mt_clearAnim(trL.property("ADBE Position"), L.threeDLayer ? [inner[0], inner[1], 0] : [inner[0], inner[1]]);
    mt_clearAnim(trL.property("ADBE Scale"), L.threeDLayer ? [100, 100, 100] : [100, 100]);
    mt_clearAnim(trL.property("ADBE Rotate Z"), 0);
    mt_clearAnim(trL.property("ADBE Opacity"), 100);
    if (L.threeDLayer) {
        mt_clearAnim(trL.property("ADBE Rotate X"), 0);
        mt_clearAnim(trL.property("ADBE Rotate Y"), 0);
        mt_clearAnim(trL.property("ADBE Orientation"), [0, 0, 0]);
        L.threeDLayer = false;
    }
    for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    O.selected = true;
    return { name: pc.name, width: W, height: H };
}

function inflect_precomposeFit(margin, keepOuter) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona i layer.");
    var sel = comp.selectedLayers, layers = [], i;
    for (i = 0; i < sel.length; i++) if (inflect_isVisual(sel[i])) layers.push(sel[i]);
    if (!layers.length) return inflect_err("Seleziona i layer da precomporre.");
    for (i = 0; i < layers.length; i++) {
        try { if (layers[i].parent) return inflect_err(layers[i].name + " \u00e8 imparentato a un altro layer: togli il genitore prima di precomporlo."); } catch (eP) {}
    }
    margin = Math.max(0, margin || 0);
    var idx = [];
    for (i = 0; i < layers.length; i++) idx.push(layers[i].index);
    idx.sort(inflect_sortNum);
    var name = layers.length === 1 ? layers[0].name : layers[0].name + " e altri";

    if (keepOuter && layers.length === 1) {
        mt_begin("Motion Tools: precomponi con animazione fuori");
        try {
            var res = mt_precompKeepOuter(comp, layers[0], margin);
            mt_end();
            res.outer = true;
            return inflect_ok(res);
        } catch (eO) {
            mt_end();
            return inflect_err("Precomposizione non riuscita: " + eO.toString() + (eO.line ? " (riga " + eO.line + ")" : ""));
        }
    }

    // Misura nella composizione di partenza, prima di precomporre: la precomp ha le stesse coordinate.
    var B = mt_boundsOverTime(layers, comp);
    if (!B) return inflect_err("Non riesco a misurare il contenuto dei layer selezionati.");
    var l = Math.floor(B.l - margin), t = Math.floor(B.t - margin);
    var W = Math.max(4, Math.ceil(B.r + margin) - l);
    var H = Math.max(4, Math.ceil(B.b + margin) - t);
    var mx = mt_maxSide(comp);
    if (W > mx || H > mx) return inflect_err("La precomposizione verrebbe di " + W + " x " + H + " px, troppo per After Effects: si bloccherebbe o andrebbe in crash. Di solito succede con un layer che arriva da molto lontano o con un ingombro enorme. Precomponi quel layer a parte, o accorcia il movimento. Non ho cambiato niente.");

    mt_begin("Motion Tools: precomponi e ritaglia");
    try {
        var pc = comp.layers.precompose(idx, name, true);
        var pcLayer = null;
        for (i = 1; i <= comp.numLayers; i++) {
            var L = comp.layer(i);
            try { if (L.source && L.source.id === pc.id) { pcLayer = L; break; } } catch (eS) {}
        }
        var inner = [];
        for (i = 1; i <= pc.numLayers; i++) inner.push(pc.layer(i));
        mt_shiftAll(pc, -l, -t, inner);
        pc.width = W;
        pc.height = H;
        if (pcLayer) {
            var tr = pcLayer.property("ADBE Transform Group");
            tr.property("ADBE Anchor Point").setValue([W / 2, H / 2, 0]);
            var pos = tr.property("ADBE Position");
            if (pos.dimensionsSeparated) {
                tr.property("ADBE Position_0").setValue(l + W / 2);
                tr.property("ADBE Position_1").setValue(t + H / 2);
            } else {
                pos.setValue([l + W / 2, t + H / 2, 0]);
            }
            for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
            pcLayer.selected = true;
        }
        mt_end();
        return inflect_ok({ name: pc.name, width: W, height: H });
    } catch (e) {
        mt_end();
        return inflect_err("Precomposizione non riuscita: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
}

/** Ridimensiona la composizione attorno ai layer selezionati, come sono nel frame corrente. */
function inflect_fitComp(margin) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione e seleziona un layer.");
    var sel = comp.selectedLayers, B = { l: 1e12, r: -1e12, t: 1e12, b: -1e12 }, i, n = 0;
    for (i = 0; i < sel.length; i++) {
        if (!inflect_isVisual(sel[i])) continue;
        try {
            var b = inflect_bounds(sel[i], comp.time, true);
            if (b.l < B.l) B.l = b.l; if (b.r > B.r) B.r = b.r; if (b.t < B.t) B.t = b.t; if (b.b > B.b) B.b = b.b;
            n++;
        } catch (e) {}
    }
    if (!n || B.l > B.r) return inflect_err("Seleziona il layer attorno a cui ridimensionare la composizione.");
    margin = Math.max(0, margin || 0);
    var l = Math.floor(B.l - margin), t = Math.floor(B.t - margin);
    var W = Math.max(4, Math.min(30000, Math.ceil(B.r + margin) - l));
    var H = Math.max(4, Math.min(30000, Math.ceil(B.b + margin) - t));
    mt_begin("Motion Tools: adatta la composizione");
    try {
        mt_shiftAll(comp, -l, -t, null);
        comp.width = W;
        comp.height = H;
        mt_end();
        return inflect_ok({ width: W, height: H });
    } catch (e) {
        mt_end();
        return inflect_err("Ridimensionamento non riuscito: " + e.toString());
    }
}

/* ------------------------------------------- 3D, keyframe, gruppo -- */

function mt_allCtrls(comp) {
    var out = [];
    for (var i = 1; i <= comp.numLayers; i++) if (mt_isCtrl(comp.layer(i))) out.push(comp.layer(i));
    return out;
}

/** Passa un Cloner esistente in 3D (o in 2D): controllo, copie e falloff collegati. */
function mt_make3D(comp, ctrl, on) {
    ctrl.threeDLayer = on;
    var clones = mt_clones(comp, ctrl), cn = ctrl.name;
    for (var i = 0; i < clones.length; i++) {
        var c = clones[i].layer;
        c.threeDLayer = on;
        if (on) {
            var tr = c.property("ADBE Transform Group");
            try { tr.property("ADBE Rotate X").expression = mt_expr("rotationX", cn); } catch (eX) {}
            try { tr.property("ADBE Rotate Y").expression = mt_expr("rotationY", cn); } catch (eY) {}
        }
    }
    var nb = Math.round(mt_get(ctrl, "Comportamenti") || 0);
    for (var k = 1; k <= nb; k++) {
        var fi = mt_get(ctrl, "B" + k + " Falloff");
        if (fi) { try { comp.layer(fi).threeDLayer = on; } catch (eF) {} }
    }
    if (on) {
        var st = mt_get(ctrl, "Passo");
        if (st && !st[2] && Math.round(mt_get(ctrl, "Distribuzione")) === 2) mt_set(ctrl, "Passo", [st[0], st[1], st[0]], comp.time);
    }
}

var MT_TPROPS = {
    "Posizione": "ADBE Position", "Rotazione X": "ADBE Rotate X", "Rotazione Y": "ADBE Rotate Y",
    "Rotazione Z": "ADBE Rotate Z", "Scala": "ADBE Scale"
};

/**
 * Proprieta' raggiungibili dal pannello:
 *  ctrl   effetto del controllo     ctrlT  trasformazione del controllo (gruppo)
 *  fall   effetto di un falloff     fallT  trasformazione di un falloff
 */
function mt_resolve(comp, ctrl, target, idx, name) {
    if (target === "ctrl") return ctrl ? mt_fxProp(ctrl, name) : null;
    var L = target.indexOf("ctrl") === 0 ? ctrl : comp.layer(idx);
    if (!L) return null;
    if (target === "fall") return mt_fxProp(L, name);
    var mn = MT_TPROPS[name];
    if (!mn) return null;
    if (mn === "ADBE Rotate Z" && !L.threeDLayer) mn = "ADBE Rotate Z";
    return L.property("ADBE Transform Group").property(mn);
}

function mt_keyAt(p, t) {
    if (!p || p.numKeys < 1) return 0;
    var k = p.nearestKeyIndex(t);
    return Math.abs(p.keyTime(k) - t) < 1e-4 ? k : 0;
}

function mt_anim(p, t) { return p ? [p.numKeys > 0 ? 1 : 0, mt_keyAt(p, t) ? 1 : 0] : [0, 0]; }

/** Imposta un valore di una trasformazione (gruppo o falloff). */
function inflect_repeatTSet(target, idx, name, valueJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    try {
        var p = mt_resolve(comp, ctrl, target, idx, name), v = inflect_parse(valueJSON);
        if (!p) return inflect_err("Propriet\u00e0 non trovata.");
        if (name === "Scala" && !(v instanceof Array)) v = [v, v, v];
        if (name === "Posizione" && v instanceof Array && v.length === 2 && p.value.length === 3) v = [v[0], v[1], p.value[2]];
        mt_begin("Motion Tools: " + name);
        if (p.numKeys > 0) p.setValueAtTime(comp.time, v); else p.setValue(v);
        if (ctrl) mt_syncTime(comp, ctrl);
        mt_end();
        return inflect_ok({});
    } catch (e) { try { mt_end(); } catch (e2) {} return inflect_err(e.toString()); }
}

/**
 * Rombo del keyframe, come in After Effects: senza animazione la avvia, su un keyframe
 * lo toglie, altrove ne aggiunge uno con il valore attuale.
 */
function inflect_repeatKey(target, idx, name) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    try {
        var p = mt_resolve(comp, ctrl, target, idx, name), t = comp.time, state;
        if (!p) return inflect_err("Propriet\u00e0 non trovata.");
        mt_begin("Motion Tools: keyframe " + name);
        var k = mt_keyAt(p, t);
        if (k) { p.removeKey(k); state = "tolto"; }
        else {
            p.setValueAtTime(t, p.valueAtTime(t, true));
            var nk = mt_keyAt(p, t);
            // Easy Ease sui keyframe nuovi, come farebbe un motion designer.
            try {
                var dims = 1, v = p.value;
                if (v instanceof Array && !(p.propertyValueType === PropertyValueType.TwoD_SPATIAL || p.propertyValueType === PropertyValueType.ThreeD_SPATIAL)) dims = v.length;
                var ease = [];
                for (var d = 0; d < dims; d++) ease.push(new KeyframeEase(0, 33.33));
                if (p.propertyValueType !== PropertyValueType.NO_VALUE) p.setTemporalEaseAtKey(nk, ease, ease);
            } catch (eE) {}
            state = "aggiunto";
        }
        if (ctrl && target === "ctrl" && MT_COUNT_PARAMS[name]) {
            var nn = mt_countFor(ctrl);
            if (nn <= MT_MAX && nn !== mt_clones(comp, ctrl).length) mt_syncClones(comp, ctrl, nn);
        }
        if (ctrl) mt_syncTime(comp, ctrl);
        mt_end();
        return inflect_ok({ state: state, keys: p.numKeys });
    } catch (e) { try { mt_end(); } catch (e2) {} return inflect_err(e.toString()); }
}

/** Stato dei keyframe (animato, keyframe al tempo corrente) di tutto quello che il pannello mostra. */
function mt_animMap(comp, ctrl, falloffs) {
    var t = comp.time, out = { ctrl: {}, ctrlT: {}, fall: {} }, k, i;
    for (k = 0; k < MT_PARAMS.length; k++) out.ctrl[MT_PARAMS[k][0]] = mt_anim(mt_fxProp(ctrl, MT_PARAMS[k][0]), t);
    var nb = Math.round(mt_get(ctrl, "Comportamenti") || 0);
    for (i = 1; i <= nb; i++) for (k = 0; k < MT_BPARAMS.length; k++) {
        var nm = "B" + i + " " + MT_BPARAMS[k][0];
        out.ctrl[nm] = mt_anim(mt_fxProp(ctrl, nm), t);
    }
    for (var n in MT_TPROPS) if (MT_TPROPS.hasOwnProperty(n)) { try { out.ctrlT[n] = mt_anim(mt_resolve(comp, ctrl, "ctrlT", 0, n), t); } catch (e) {} }
    for (i = 0; i < falloffs.length; i++) {
        var F = comp.layer(falloffs[i].index), m = {};
        for (k = 0; k < MT_FPARAMS.length; k++) m[MT_FPARAMS[k][0]] = mt_anim(mt_fxProp(F, MT_FPARAMS[k][0]), t);
        m["Posizione"] = mt_anim(F.property("ADBE Transform Group").property("ADBE Position"), t);
        out.fall[falloffs[i].index] = m;
    }
    return out;
}

function mt_groupValues(ctrl) {
    var tr = ctrl.property("ADBE Transform Group"), o = {};
    o["Rotazione Z"] = tr.property("ADBE Rotate Z").value;
    if (ctrl.threeDLayer) { o["Rotazione X"] = tr.property("ADBE Rotate X").value; o["Rotazione Y"] = tr.property("ADBE Rotate Y").value; }
    o["Scala"] = tr.property("ADBE Scale").value[0];
    return o;
}

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

/* ------------------------------------------------------- analisi -- */
/*
 * Analisi della timeline della composizione attiva:
 *  - densita' dei keyframe nel tempo (tutti i layer e tutte le proprieta')
 *  - quantita' di movimento nel tempo, dai valori di posizione, scala, rotazione e opacita'
 *  - picchi, layer piu' animati e tipo di easing usato
 */
function mt_walkProps(group, cb) {
    for (var i = 1; i <= group.numProperties; i++) {
        var p = group.property(i);
        if (!p) continue;
        if (p.propertyType === PropertyType.PROPERTY) cb(p);
        else mt_walkProps(p, cb);
    }
}

/*
 * Il tempo di un keyframe dentro una precomp si riporta al tempo della comp principale
 * risalendo la catena dei layer che la contengono. Senza rimappatura del tempo e' lineare;
 * con la rimappatura e' un'approssimazione.
 */
function mt_anaUp(chain, t) {
    for (var i = chain.length - 1; i >= 0; i--) t = chain[i].startTime + t * chain[i].stretch / 100;
    return t;
}

/* Tempo della comp che contiene il layer bersaglio, a partire dal tempo della comp principale. Null se un livello e' spento o non visibile. */
function mt_anaSample(chain, t) {
    for (var i = 0; i < chain.length; i++) {
        var c = chain[i];
        if (!c.enabled || t < c.inPoint || t > c.outPoint) return null;
        t = (t - c.startTime) * 100 / c.stretch;
    }
    return t;
}

// Una comp ha numLayers e frameDuration; un footage o un layer no. Non uso instanceof perche' con gli oggetti di After Effects non e' affidabile.
function mt_anaIsComp(L) {
    try {
        var s = L.source;
        return !!s && s.numLayers !== undefined && s.frameDuration !== undefined;
    } catch (e) { return false; }
}

/* Raccoglie keyframe, easing e candidati al movimento, scendendo nelle precomp (fino a 4 livelli). */
function mt_anaWalk(comp, chain, acc, depth) {
    var sum = { keys: 0, props: 0, animated: 0 };
    for (var l = 1; l <= comp.numLayers; l++) {
        var L = comp.layer(l), lk = 0, lp = 0, isMT = false;
        if (chain.length === 0) { try { isMT = String(L.comment).indexOf("MT_") === 0; } catch (eC) {} }
        mt_walkProps(L, function (p) {
            var n = 0;
            try { n = p.numKeys; } catch (e0) { n = 0; }
            var hasExpr = false;
            try { hasExpr = p.canSetExpression && p.expressionEnabled && p.expression !== ""; } catch (e1) {}
            if (hasExpr) acc.totals.expr++;
            if (!n) return;
            lp++; lk += n;
            for (var k = 1; k <= n; k++) {
                var t = mt_anaUp(chain, p.keyTime(k));
                var bi = Math.floor(t / acc.bw);
                if (bi >= 0 && bi < acc.nb) acc.keysBins[bi]++;
                if (k < n) {
                    try {
                        var ot = p.keyOutInterpolationType(k), it = p.keyInInterpolationType(k + 1);
                        if (ot === KeyframeInterpolationType.HOLD) acc.easing.hold++;
                        else if (ot === KeyframeInterpolationType.LINEAR && it === KeyframeInterpolationType.LINEAR) acc.easing.linear++;
                        else {
                            var eo = p.keyOutTemporalEase(k)[0], ei = p.keyInTemporalEase(k + 1)[0];
                            if (Math.abs(eo.influence - 33.33) < 1 && Math.abs(ei.influence - 33.33) < 1 && Math.abs(eo.speed) < 0.01 && Math.abs(ei.speed) < 0.01) acc.easing.easy++;
                            else acc.easing.custom++;
                        }
                    } catch (e2) {}
                }
            }
        });
        // Candidati al movimento: solo i layer con trasformazioni animate.
        if (L.enabled && !(function () { try { return L.guideLayer; } catch (eG) { return false; } })()) {
            var tr = L.property("ADBE Transform Group");
            if (tr) {
                var props = [];
                var names = ["ADBE Position", "ADBE Position_0", "ADBE Position_1", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity"];
                for (var i = 0; i < names.length; i++) {
                    var pp = tr.property(names[i]);
                    if (!pp) continue;
                    var anim = false;
                    try { anim = pp.numKeys > 0 || (pp.expressionEnabled && pp.expression !== ""); } catch (eA) {}
                    if (anim) props.push({ p: pp, kind: names[i] });
                }
                if (props.length) acc.cands.push({ layer: L, props: props, chain: chain });
            }
        }
        var sub = { keys: 0, props: 0, animated: 0 };
        if (depth < 4 && mt_anaIsComp(L)) {
            var link = { startTime: L.startTime, stretch: L.stretch || 100, inPoint: L.inPoint, outPoint: L.outPoint, enabled: L.enabled };
            sub = mt_anaWalk(L.source, chain.concat([link]), acc, depth + 1);
        }
        sum.keys += lk + sub.keys; sum.props += lp + sub.props; sum.animated += (lk > 0 ? 1 : 0) + sub.animated;
        if (chain.length === 0 && lk + sub.keys > 0) acc.perLayer.push({ index: l, name: L.name, keys: lk + sub.keys, props: lp + sub.props, mt: isMT });
    }
    return sum;
}

function inflect_analyze() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_err("Apri una composizione da analizzare.");
        var fd = comp.frameDuration, dur = comp.duration;
        var frames = Math.max(1, Math.round(dur / fd));
        var nb = Math.min(160, frames);
        var bw = dur / nb;
        var acc = {
            bw: bw, nb: nb, keysBins: [], motion: [], cands: [], perLayer: [],
            totals: { layers: comp.numLayers, animated: 0, props: 0, keys: 0, expr: 0 },
            easing: { linear: 0, easy: 0, custom: 0, hold: 0 }
        };
        var b, i;
        for (b = 0; b < nb; b++) { acc.keysBins.push(0); acc.motion.push(0); }

        var sum = mt_anaWalk(comp, [], acc, 0);
        acc.totals.animated = sum.animated; acc.totals.props = sum.props; acc.totals.keys = sum.keys;
        var keysBins = acc.keysBins, motion = acc.motion, totals = acc.totals, easing = acc.easing, perLayer = acc.perLayer;

        // Movimento: variazione di posizione, scala, rotazione e opacita' tra un campione e il successivo.
        var cands = acc.cands;
        // Limite per non bloccare After Effects su progetti enormi.
        var budget = 60000, cost = cands.length * nb;
        var step = cost > budget ? Math.ceil(cost / budget) : 1;
        for (var c = 0; c < cands.length; c++) {
            var C = cands[c], prev = null;
            for (b = 0; b < nb; b += step) {
                var tt = (b + 0.5) * bw;
                var tc = mt_anaSample(C.chain, tt);
                if (tc === null || tc < C.layer.inPoint || tc > C.layer.outPoint) { prev = null; continue; }
                var cur = [];
                for (i = 0; i < C.props.length; i++) {
                    var v;
                    try { v = C.props[i].p.valueAtTime(tc, false); } catch (eV) { v = 0; }
                    cur.push(v instanceof Array ? v : [v]);
                }
                if (prev) {
                    var m = 0;
                    for (i = 0; i < cur.length; i++) {
                        var kind = C.props[i].kind, dsum = 0;
                        for (var d = 0; d < cur[i].length && d < 3; d++) dsum += Math.abs(cur[i][d] - prev[i][d]);
                        // Pesi: pixel, punti di scala, gradi e opacita' resi confrontabili.
                        if (kind === "ADBE Scale") dsum *= 4; else if (kind === "ADBE Rotate Z") dsum *= 3; else if (kind === "ADBE Opacity") dsum *= 4;
                        m += dsum;
                    }
                    for (var f = 0; f < step && b + f < nb; f++) motion[b + f] += m / (bw * step);
                }
                prev = cur;
            }
        }

        // Picchi di movimento ben separati tra loro.
        var order = [];
        for (b = 0; b < nb; b++) order.push(b);
        order.sort(function (x, y) { return motion[y] - motion[x]; });
        var peaks = [], minGap = Math.max(2, Math.round(nb / 20));
        for (i = 0; i < order.length && peaks.length < 5; i++) {
            var bb = order[i];
            if (motion[bb] <= 0) break;
            var near = false;
            for (var q = 0; q < peaks.length; q++) if (Math.abs(peaks[q].bin - bb) < minGap) near = true;
            if (!near) peaks.push({ bin: bb, time: (bb + 0.5) * bw, motion: motion[bb], keys: keysBins[bb] });
        }
        perLayer.sort(function (x, y) { return y.keys - x.keys; });
        var quiet = 0;
        for (b = 0; b < nb; b++) if (motion[b] < 1 && keysBins[b] === 0) quiet++;

        return inflect_ok({
            comp: comp.name, duration: dur, fps: 1 / fd, time: comp.time, bins: nb, binWidth: bw,
            keys: keysBins, motion: motion, totals: totals, easing: easing,
            peaks: peaks, layers: perLayer.slice(0, 8), quiet: quiet / nb
        });
    } catch (e) { return inflect_err("Analisi non riuscita: " + e.toString() + (e.line ? " (riga " + e.line + ")" : "")); }
}

function inflect_setTime(t) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    try { comp.time = Math.max(0, Math.min(comp.duration, t)); return inflect_ok({ time: comp.time }); }
    catch (e) { return inflect_err(e.toString()); }
}

function inflect_selectLayer(index) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    try {
        for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
        comp.layer(index).selected = true;
        return inflect_ok({});
    } catch (e) { return inflect_err(e.toString()); }
}

/** Seleziona nella timeline le coppie di keyframe lineari, per sistemarle con una curva. */
function inflect_selectLinear() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var n = 0;
    try {
        for (var l = 1; l <= comp.numLayers; l++) {
            mt_walkProps(comp.layer(l), function (p) {
                var k;
                try { if (p.numKeys < 2) return; } catch (e0) { return; }
                for (k = 1; k <= p.numKeys; k++) { try { p.setSelectedAtKey(k, false); } catch (e1) {} }
                for (k = 1; k < p.numKeys; k++) {
                    try {
                        if (p.keyOutInterpolationType(k) === KeyframeInterpolationType.LINEAR && p.keyInInterpolationType(k + 1) === KeyframeInterpolationType.LINEAR) {
                            p.setSelectedAtKey(k, true); p.setSelectedAtKey(k + 1, true); n++;
                        }
                    } catch (e2) {}
                }
            });
        }
        return inflect_ok({ count: n });
    } catch (e) { return inflect_err(e.toString()); }
}

/* ============================================================== testo == */
/*
 * Animazioni del testo con gli animatori nativi di After Effects.
 * Ogni fase (entrata, uscita) e' un animatore "MT Entrata" / "MT Uscita" con:
 *  - le proprieta' nello stato di partenza (opacita', posizione, scala, rotazione, sfocatura, spaziatura)
 *  - un selettore di espressione che per ogni lettera, parola o riga calcola quanto e' animata,
 *    con ritardo, ordine e curva (bezier o molla).
 * Il preset completo e' scritto in testa all'espressione: il pannello lo rilegge per modificarlo.
 * Gli animatori seguono il punto di attacco e di stacco del layer: spostando il layer si sposta tutto.
 */

var MT_TEXT_UNIT = { chars: 2, charsAll: 1, words: 3, lines: 4 };
var MT_TEXT_ANCHOR = { chars: 1, charsAll: 1, words: 2, lines: 3 };

function mt_isText(layer) {
    try { return !!layer.property("ADBE Text Properties"); } catch (e) { return false; }
}

function mt_textLayers(comp) {
    var out = [], sel = comp.selectedLayers;
    for (var i = 0; i < sel.length; i++) if (mt_isText(sel[i])) out.push(sel[i]);
    return out;
}

function mt_textExpr(P, ph, headP) {
    var F = ph.from || {};
    var head = "// MT_TEXT " + inflect_stringify(headP || P);
    var p = {
        ph: ph === P.out ? 1 : 0,
        iv: ph.to ? 1 : 0,
        dur: Math.max(0.001, ph.dur || 0.6), stg: ph.stg || 0, delay: ph.delay || 0,
        ord: ph.ord || 0, seed: ph.seed || 1,
        et: ph.ease && ph.ease.type === "spring" ? 1 : (ph.ease && ph.ease.type === "lut" ? 2 : 0),
        e: (ph.ease && ph.ease.v && ph.ease.type !== "lut") ? ph.ease.v : [0.22, 1, 0.36, 1],
        L: (ph.ease && ph.ease.type === "lut" && ph.ease.v) ? ph.ease.v : [0, 1],
        b: (ph.ease && ph.ease.bounce !== undefined) ? ph.ease.bounce : 0.2,
        sp: ph.spread || 0,
        // Sfalsamento che riparte a ogni parola (1) o riga (2); ws: ritardo tra un gruppo e il successivo.
        rs: mt_textRestart(P, ph), ws: ph.wstg || ph.wordStg || 0, u: MT_TEXT_UNIT[P.unit || "chars"] || 2
    };
    return [
        head,
        "var P = " + inflect_stringify(p) + ";",
        "function bz(x, a, b, c, d) {",
        "  if (x <= 0) return 0; if (x >= 1) return 1;",
        "  var t = x;",
        "  for (var k = 0; k < 10; k++) {",
        "    var cx = 3 * a * t * (1 - t) * (1 - t) + 3 * c * t * t * (1 - t) + t * t * t - x;",
        "    var dx = 3 * a * (1 - t) * (1 - t) + 6 * (c - a) * t * (1 - t) + 3 * (1 - c) * t * t;",
        "    if (Math.abs(cx) < 1e-5 || Math.abs(dx) < 1e-6) break;",
        "    t = Math.min(1, Math.max(0, t - cx / dx));",
        "  }",
        "  return 3 * b * t * (1 - t) * (1 - t) + 3 * d * t * t * (1 - t) + t * t * t;",
        "}",
        "function lut(x, L) {",
        "  if (x <= 0) return 0; if (x >= 1) return L[L.length - 1];",
        "  var f = x * (L.length - 1), k = Math.floor(f);",
        "  return L[k] + (L[k + 1] - L[k]) * (f - k);",
        "}",
        "function spring(s, T, bo) {",
        "  if (s <= 0) return 0;",
        "  var w = 2 * Math.PI / T, z = Math.max(0.05, 1 - bo);",
        "  if (s > T * (1 + 3 * bo) * 1.5) return 1;",
        "  if (z >= 1) return 1 - Math.exp(-w * s) * (1 + w * s);",
        "  var wd = w * Math.sqrt(1 - z * z);",
        "  return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s));",
        "}",
        "var n = textTotal, i = textIndex - 1, gofs = 0, span = -1;",
        // Gruppi (parole o righe): ogni unita' sa in che gruppo sta e in che posizione.
        "if (P.rs > 0) {",
        "  var s = String(thisLayer.text.sourceText), gi = [], g = 0, cnt = 0, pend = false, inW = false;",
        "  for (var c = 0; c < s.length; c++) {",
        "    var ch = s.charAt(c), br = (ch == '\\r' || ch == '\\n' || ch == '\\u0003');",
        "    if (br) { if (cnt > 0) pend = true; inW = false; continue; }",
        "    if (/\\s/.test(ch)) { if (P.rs == 1 && cnt > 0) pend = true; inW = false; if (P.u == 1) gi.push(g); continue; }",
        "    if (pend) { g++; pend = false; cnt = 0; }",
        "    if (P.u == 3) { if (!inW) { gi.push(g); cnt++; } } else { gi.push(g); cnt++; }",
        "    inW = true;",
        "  }",
        "  if (gi.length == n && n > 0) {",
        "    var my = gi[i], j = 0, gl = 0, NG = 0, cn = {}, mg = 0;",
        "    for (var c = 0; c < n; c++) { var q = gi[c]; cn[q] = (cn[q] || 0) + 1; if (q == my) { if (c < i) j++; gl++; } NG = Math.max(NG, q + 1); }",
        "    for (var q in cn) mg = Math.max(mg, cn[q]);",
        "    n = gl; i = j; gofs = my * P.ws; span = (NG - 1) * P.ws + Math.max(0, mg - 1) * P.stg;",
        "  }",
        "}",
        "var r = i, mx = Math.max(0, n - 1);",
        "if (P.ord == 1) r = n - 1 - i;",
        "else if (P.ord == 2) { r = Math.abs(i - (n - 1) / 2); mx = (n - 1) / 2; }",
        "else if (P.ord == 3) { r = (n - 1) / 2 - Math.abs(i - (n - 1) / 2); mx = (n - 1) / 2; }",
        "else if (P.ord == 4) {",
        "  seedRandom(P.seed, true);",
        "  var a = []; for (var k = 0; k < n; k++) a.push(k);",
        "  for (var k = n - 1; k > 0; k--) { var j = Math.floor(random(k + 1)); var tmp = a[k]; a[k] = a[j]; a[j] = tmp; }",
        "  r = a[i];",
        "}",
        // Distribuzione dei ritardi: uniforme, che accelera o che rallenta.
        "var u = mx > 0 ? r / mx : 0;",
        "if (P.sp == 1) u = u * u; else if (P.sp == 2) u = 1 - (1 - u) * (1 - u);",
        "var dl = u * mx * P.stg + gofs;",
        "if (span < 0) span = mx * P.stg;",
        "var t0 = P.ph == 0 ? inPoint + P.delay : outPoint - P.delay - P.dur - span;",
        "var s = time - t0 - dl;",
        "var e = P.et == 1 ? spring(s, P.dur, P.b) : (P.et == 2 ? lut(s / P.dur, P.L) : bz(s / P.dur, P.e[0], P.e[1], P.e[2], P.e[3]));",
        "var v = P.ph == 0 ? (P.iv == 1 ? 100 * e : 100 * (1 - e)) : 100 * e;",
        "[v, v, v]"
    ].join("\n");
}

/* Riparte a ogni parola (1) o riga (2). Si legge dalla fase o, se manca, dal preset. Solo se ha senso per l'unita'. */
function mt_textRestart(P, ph) {
    var r = ph.restart !== undefined ? ph.restart : P.restart, unit = P.unit || "chars";
    if (unit === "lines") return 0;
    if (r === "words" && unit !== "words") return 1;
    if (r === "lines") return 2;
    return 0;
}

/* "#RRGGBB" o "#RGB" -> [r, g, b] da 0 a 1, o null. */
function mt_hexColor(hex) {
    var h = String(hex || "").replace(/^#/, "");
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.substring(0, 2), 16) / 255, parseInt(h.substring(2, 4), 16) / 255, parseInt(h.substring(4, 6), 16) / 255];
}

/** Aggiunge un animatore: le proprieta' si aggiungono una alla volta e si rileggono per nome. */
function mt_textAnimator(layer, name, P, ph, unit, k, headP) {
    var F0 = ph.to || ph.from || {}, F = {};
    for (var key in F0) if (F0.hasOwnProperty(key)) F[key] = F0[key];
    // I preset sono pensati per un corpo di 100 px: spostamenti e sfocatura seguono la dimensione del testo.
    k = k || 1;
    if (F.x) F.x *= k; if (F.y) F.y *= k; if (F.z) F.z *= k; if (F.blur) F.blur *= k;
    var anims = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    var a = anims.addProperty("ADBE Text Animator");
    a.name = name;
    var get = function () { return layer.property("ADBE Text Properties").property("ADBE Text Animators").property(name); };
    var addP = function (mn, v) {
        var pr = get().property("ADBE Text Animator Properties").addProperty(mn);
        pr = get().property("ADBE Text Animator Properties").property(mn);
        pr.setValue(v);
    };
    if (F.opacity !== undefined && F.opacity !== 100) addP("ADBE Text Opacity", F.opacity);
    if (F.x || F.y || F.z) addP("ADBE Text Position 3D", [F.x || 0, F.y || 0, F.z || 0]);
    if (F.scale !== undefined && F.scale !== 100) addP("ADBE Text Scale 3D", [F.scale, F.scale, 100]);
    if (F.rotation) addP("ADBE Text Rotation", F.rotation);
    if (F.blur) addP("ADBE Text Blur", [F.blur, F.blur]);
    if (F.tracking) addP("ADBE Text Tracking Amount", F.tracking);
    if (F.skew) addP("ADBE Text Skew", F.skew);
    var fc = mt_hexColor(F.fill);
    if (fc) {
        // Colore di riempimento: vale per le lettere che hanno il riempimento attivo.
        var pf = get().property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");
        pf = get().property("ADBE Text Animator Properties").property("ADBE Text Fill Color");
        try { pf.setValue([fc[0], fc[1], fc[2], 1]); } catch (eF) { pf.setValue(fc); }
    }
    get().property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
    var sel = get().property("ADBE Text Selectors").property(1);
    try { sel.property("ADBE Text Range Type2").setValue(MT_TEXT_UNIT[unit] || 2); } catch (eU) {}
    sel.property("ADBE Text Expressible Amount").expression = mt_textExpr(P, ph, headP);
}

function mt_textClear(layer) {
    var anims = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    for (var i = anims.numProperties; i >= 1; i--) {
        var n = anims.property(i).name;
        if (n === "MT Entrata" || n === "MT Uscita" || n === "MT Colore") anims.property(i).remove();
    }
    var masks = layer.property("ADBE Mask Parade");
    for (var m = masks.numProperties; m >= 1; m--) { if (masks.property(m).name.indexOf("MT Ritaglio") === 0) masks.property(m).remove(); }
}

/* Numero di lettere, parole o righe del testo, per sapere quando l'entrata e' finita. */
function mt_textUnits(txt, unit) {
    var s = String(txt);
    if (unit === "lines") return s.split(/\r\n|\r|\n/).length;
    if (unit === "words") { var w = s.replace(/^\s+|\s+$/g, "").split(/\s+/); return w.length; }
    return s.replace(/\s/g, "").length;
}

/*
 * Ritaglio: una maschera per riga, grande quanto la riga a fine entrata. Il testo che sale
 * da sotto resta nascosto finche' non entra nella sua riga, come dietro una linea invisibile.
 */
function mt_textClip(layer, P, txt) {
    var lines = String(txt).split(/\r\n|\r|\n/).length;
    var ph = P["in"] || P.out, n = mt_textUnits(txt, P.unit || "chars");
    var T = (ph.delay || 0) + (ph.stg || 0) * Math.max(0, n - 1) + (ph.dur || 0.6) * (ph.ease && ph.ease.type === "spring" ? 2.5 : 1) + 0.05;
    var masks = layer.property("ADBE Mask Parade");
    for (var i = 0; i < lines; i++) {
        var nm = "MT Ritaglio " + (i + 1);
        masks.addProperty("ADBE Mask Atom").name = nm;
        var M = layer.property("ADBE Mask Parade").property(nm);
        M.property("ADBE Mask Shape").expression = [
            "var t = Math.min(inPoint + " + T + ", (inPoint + outPoint) / 2);",
            "var r = sourceRectAtTime(t, false), n = " + lines + ", i = " + i + ";",
            "var h = r.height / n, pad = h * 0.08, side = Math.max(r.width * 0.15, h);",
            "var top = r.top + h * i - (i == 0 ? pad * 2 : 0), bot = r.top + h * (i + 1) + (i == n - 1 ? pad : 0);",
            "createPath([[r.left - side, top], [r.left + r.width + side, top], [r.left + r.width + side, bot], [r.left - side, bot]], [], [], true)"
        ].join("\n");
    }
}

/*
 * Rilegge il preset dal layer. MT Entrata e MT Uscita portano il preset completo in testa all'espressione.
 * MT Colore porta il suo blocco; se manca nel preset (o c'e' solo lui) si aggiunge. Un MT Colore fatto
 * da un altro script, senza preset in testa, si legge dal colore e dall'unita' del selettore.
 */
function mt_textHead(a) {
    try {
        var ex = a.property("ADBE Text Selectors").property(1).property("ADBE Text Expressible Amount").expression;
        var line = ex.split("\n")[0];
        if (line.indexOf("// MT_TEXT ") === 0) return inflect_parse(line.substring(11));
    } catch (e) {}
    return null;
}
function mt_textFillFrom(a) {
    var fill = null, head = mt_textHead(a);
    if (head && head.fill) return head.fill;
    if (head && head["in"]) { fill = head["in"]; if (!fill.unit) fill.unit = head.unit || "chars"; if (!fill.restart && head.restart) fill.restart = head.restart; return fill; }
    // Senza preset in testa: colore dalla proprieta', unita' dal selettore.
    try {
        var v = a.property("ADBE Text Animator Properties").property("ADBE Text Fill Color").value;
        var hx = function (x) { var n = Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16); return n.length < 2 ? "0" + n : n; };
        var unit = "chars";
        try { var rt = a.property("ADBE Text Selectors").property(1).property("ADBE Text Range Type2").value; unit = rt === 3 ? "words" : (rt === 1 ? "charsAll" : "chars"); } catch (eU) {}
        fill = { unit: unit, dur: 0.6, stg: 0.03, delay: 0, ord: 0, spread: 0, seed: 1, ease: { type: "bezier", v: [0.22, 1, 0.36, 1] }, from: { fill: ("#" + hx(v[0]) + hx(v[1]) + hx(v[2])).toUpperCase() } };
    } catch (e2) {}
    return fill;
}
function mt_textRead(layer) {
    var anims = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    var P = null, colorAnim = null;
    for (var i = 1; i <= anims.numProperties; i++) {
        var a = anims.property(i);
        if (a.name === "MT Colore") { colorAnim = a; continue; }
        if (a.name !== "MT Entrata" && a.name !== "MT Uscita") continue;
        if (!P) P = mt_textHead(a);
    }
    if (colorAnim) {
        // Preset completo in testa a MT Colore (versioni nuove): vale anche se c'e' solo il colore.
        var hp = mt_textHead(colorAnim);
        if (!P && hp && hp.fill) P = hp;
        var f = mt_textFillFrom(colorAnim);
        if (f) {
            if (!P) P = { name: "Colore", unit: f.unit || "chars", ref: 100 };
            if (!P.fill) P.fill = f;
        }
    }
    return P;
}

/*
 * Legge un'animazione di testo fatta a mano con i keyframe dell'animatore.
 * Letto con sicurezza: valori di partenza, durata, curva del primo segmento, unita'.
 * Stimato: lo sfasamento tra le lettere (stagger), che dipende dal selettore di intervallo.
 */
var MT_READ_UNIT = { 1: "chars", 2: "chars", 3: "words", 4: "lines" };
var MT_READ_STAG = { chars: 0.03, charsAll: 0.03, words: 0.085, lines: 0.16 };

// Converte la curva temporale di un keyframe in maniglie cubiche (x1,y1,x2,y2) normalizzate.
function mt_keyBezier(prop, k, dim) {
    var out = prop.keyOutTemporalEase(k);
    var inn = prop.keyInTemporalEase(k + 1);
    var dt = prop.keyTime(k + 1) - prop.keyTime(k);
    var v1 = prop.keyValue(k), v2 = prop.keyValue(k + 1);
    if (dim !== undefined) { v1 = v1[dim]; v2 = v2[dim]; }
    var dv = v2 - v1;
    if (!dt || !dv) return null;
    var x1 = out[dim || 0].influence / 100, x2 = 1 - inn[dim || 0].influence / 100;
    var s1 = out[dim || 0].speed * dt / dv, s2 = inn[dim || 0].speed * dt / dv;
    var y1 = s1 * x1, y2 = 1 - s2 * (inn[dim || 0].influence / 100);
    return [C_clampX(x1), y1, C_clampX(x2), y2];
}
function C_clampX(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

function inflect_textReadKeys() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var L = mt_textLayers(comp);
    if (!L.length) return inflect_err("Seleziona un layer di testo.");
    var layer = L[0];
    var tp = layer.property("ADBE Text Properties");
    var size = 100;
    try { size = tp.property("ADBE Text Document").value.fontSize; } catch (eS) {}
    var k = size / 100;
    var anims = tp.property("ADBE Text Animators");
    if (!anims || anims.numProperties < 1) return inflect_err("Questo layer non ha animatori di testo.");

    var read = [], assumed = [];
    var unit = "chars", from = {}, tStart = null, tEnd = null, ease = null, keyed = 0;

    for (var i = 1; i <= anims.numProperties; i++) {
        var a = anims.property(i);
        try {
            var rt = a.property("ADBE Text Selectors").property(1).property("ADBE Text Range Type2").value;
            if (MT_READ_UNIT[rt]) unit = MT_READ_UNIT[rt];
        } catch (eU) {}
        var pg = a.property("ADBE Text Animator Properties");
        for (var j = 1; j <= pg.numProperties; j++) {
            var p = pg.property(j), mn = p.matchName, key = null, dim;
            if (mn === "ADBE Text Opacity") key = "opacity";
            else if (mn === "ADBE Text Position" || mn === "ADBE Text Position 3D") { key = "pos"; dim = 2; }
            else if (mn === "ADBE Text Scale" || mn === "ADBE Text Scale 3D") key = "scale";
            else if (mn === "ADBE Text Rotation") key = "rotation";
            else if (mn === "ADBE Text Tracking Amount") key = "tracking";
            if (!key || p.numKeys < 2) continue;
            keyed++;
            var n = p.numKeys;
            var first = p.keyTime(1), last = p.keyTime(n);
            tStart = tStart === null ? first : Math.min(tStart, first);
            tEnd = tEnd === null ? last : Math.max(tEnd, last);
            var v0 = p.keyValue(1);
            if (key === "pos") {
                // Posizione: offset rispetto alla posizione di riposo, in unita' a 100 px.
                from.x = Math.round(((v0[0] - p.keyValue(n)[0]) / k) * 10) / 10;
                from.y = Math.round(((v0[1] - p.keyValue(n)[1]) / k) * 10) / 10;
                read.push("posizione");
            } else if (key === "opacity") { from.opacity = Math.round(v0 * 10) / 10; read.push("opacita'"); }
            else if (key === "scale") { from.scale = Math.round((v0[0] !== undefined ? v0[0] : v0) * 10) / 10; read.push("scala"); }
            else if (key === "rotation") { from.rotation = Math.round(v0 * 10) / 10; read.push("rotazione"); }
            else if (key === "tracking") { from.tracking = Math.round(v0); read.push("spaziatura"); }
            if (!ease) {
                var bz = null;
                try { bz = mt_keyBezier(p, 1, key === "pos" ? 0 : undefined); } catch (eB) {}
                if (bz) ease = ["bezier", bz];
            }
        }
    }

    if (!keyed || tStart === null) return inflect_err("Nessun keyframe trovato sugli animatori di questo layer. Anima Posizione, Opacita' o Scala.");
    var dur = Math.round((tEnd - tStart) * 100) / 100;
    if (dur <= 0) return inflect_err("La durata dei keyframe e' zero.");
    if (!ease) { ease = ["bezier", [0.22, 1, 0.36, 1]]; assumed.push("curva: non leggibile, uso Morbida"); }
    else read.push("curva del primo segmento");
    assumed.push("sfasamento tra " + unit + ": stimato");
    read.push("durata " + dur.toFixed(2) + " s");

    var P = {};
    P.id = "r-" + new Date().getTime();
    P.name = "Da layer";
    P.ref = 100;
    P.unit = unit;
    var easeObj = (ease[0] === "spring") ? { type: "spring", bounce: ease[1] } : { type: "bezier", v: ease[1] };
    var inPhase = {};
    inPhase.dur = dur;
    inPhase.stg = MT_READ_STAG[unit] || 0.05;
    inPhase.delay = 0;
    inPhase.ord = 0;
    inPhase.spread = 0;
    inPhase.seed = 1;
    inPhase.ease = easeObj;
    inPhase.from = from;
    P["in"] = inPhase;
    return inflect_ok({ preset: P, read: read, assumed: assumed, fps: 1 / comp.frameDuration });
}

/*
 * Il pannello lo chiama spesso: se la selezione non e' cambiata non legge il testo,
 * cosi' non disturba After Effects mentre scrivi dentro un layer di testo.
 */
function inflect_textState(force) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_ok({ count: 0 });
    var L = mt_textLayers(comp);
    if (!L.length) { $.global.MT_TXSIG = ""; return inflect_ok({ count: 0, fps: 1 / comp.frameDuration }); }
    var sig = comp.id + ":";
    for (var q = 0; q < L.length; q++) sig += L[q].id + ",";
    if (!force && $.global.MT_TXSIG === sig) return inflect_ok({ same: true, count: L.length, id: L[0].id });
    $.global.MT_TXSIG = sig;
    var txt = "", size = 80, applied = null;
    try {
        var doc = L[0].property("ADBE Text Properties").property("ADBE Text Document").value;
        txt = String(doc.text).substring(0, 160);
        size = doc.fontSize;
    } catch (e) {}
    try { applied = mt_textRead(L[0]); } catch (e2) {}
    return inflect_ok({ count: L.length, text: txt, size: size, applied: applied, id: L[0].id, fps: 1 / comp.frameDuration, name: L[0].name });
}

function inflect_textApply(presetJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var L = mt_textLayers(comp);
    if (!L.length) return inflect_err("Seleziona uno o pi\u00f9 layer di testo.");
    var P;
    try { P = inflect_parse(presetJSON); } catch (e0) { return inflect_err("Preset non valido."); }
    var unit = P.unit || "chars";
    mt_begin("Motion Tools: animazione testo");
    try {
        for (var i = 0; i < L.length; i++) {
            var layer = L[i], k = 1, txt = "";
            try {
                var doc = layer.property("ADBE Text Properties").property("ADBE Text Document").value;
                txt = doc.text;
                if (P.ref) k = doc.fontSize / P.ref;
            } catch (eD) {}
            mt_textClear(layer);
            if (P["in"]) mt_textAnimator(layer, "MT Entrata", P, P["in"], unit, k);
            if (P.out) mt_textAnimator(layer, "MT Uscita", P, P.out, unit, k);
            // Colore: animatore a parte, con la sua unita' (di solito le lettere) e i suoi tempi.
            if (P.fill) {
                var Pf = { unit: P.fill.unit || "chars", ref: P.ref, restart: P.fill.restart };
                Pf["in"] = P.fill;
                mt_textAnimator(layer, "MT Colore", Pf, P.fill, Pf.unit, k, P);
            }
            if (P.clip) mt_textClip(layer, P, txt);
            // Scala e rotazione attorno al centro di ogni lettera, parola o riga.
            try {
                var mo = layer.property("ADBE Text Properties").property("ADBE Text More Options");
                mo.property("ADBE Text Anchor Point Option").setValue(MT_TEXT_ANCHOR[unit] || 1);
                mo.property("ADBE Text Anchor Point Align").setValue([0, -50]);
            } catch (eM) {}
        }
        mt_end();
        return inflect_ok({ count: L.length, name: P.name || "" });
    } catch (e) {
        mt_end();
        return inflect_err("Animazione non applicata: " + e.toString() + (e.line ? " (riga " + e.line + ")" : ""));
    }
}

function inflect_textRemove() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var L = mt_textLayers(comp);
    if (!L.length) return inflect_err("Seleziona uno o pi\u00f9 layer di testo.");
    mt_begin("Motion Tools: togli animazione testo");
    for (var i = 0; i < L.length; i++) mt_textClear(L[i]);
    mt_end();
    return inflect_ok({ count: L.length });
}

/* ------------------------------------------- file di dati generici -- */

function inflect_dataLoad(name) {
    try {
        var f = new File(inflect_dataDir().fsName + "/" + name + ".json");
        if (!f.exists) return inflect_ok({ data: null });
        var s = inflect_readText(f);
        return inflect_ok({ data: s ? inflect_parse(s) : null });
    } catch (e) { return inflect_err(e); }
}

function inflect_dataSave(name, json) {
    try {
        var f = new File(inflect_dataDir().fsName + "/" + name + ".json");
        if (!inflect_writeText(f, json)) return inflect_err("Non riesco a scrivere " + f.fsName);
        return inflect_ok({ path: f.fsName });
    } catch (e) { return inflect_err(e); }
}

function inflect_fileSave(json, suggestedName, title) {
    try {
        var f = new File(Folder.desktop.fsName + "/" + suggestedName);
        var target = f.saveDlg(title || "Esporta", "JSON:*.json");
        if (!target) return inflect_ok({ cancelled: true });
        if (!inflect_writeText(target, json)) return inflect_err("Non riesco a scrivere il file.");
        return inflect_ok({ path: target.fsName });
    } catch (e) { return inflect_err(e); }
}

function inflect_fileOpen(title) {
    try {
        var f = File.openDialog(title || "Importa", "JSON:*.json", false);
        if (!f) return inflect_ok({ cancelled: true });
        return inflect_ok({ data: inflect_parse(inflect_readText(f)), name: f.displayName });
    } catch (e) { return inflect_err("File non valido: " + e); }
}

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

/* ======================================================= tempo e copia == */
/*
 * Il "momento" e' un istante di una composizione. Si puo' ritrovare in qualsiasi altra
 * composizione collegata (precomposizioni dentro, composizioni che la contengono, sorelle)
 * seguendo i layer che le collegano: tempo di inizio, stiramento e rimappatura del tempo.
 */

function mt_compEdges() {
    var E = [];
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!(it instanceof CompItem)) continue;
        for (var l = 1; l <= it.numLayers; l++) {
            var L = it.layer(l);
            try { if (L.source && (L.source instanceof CompItem)) E.push({ p: it.id, c: L.source.id, L: L }); } catch (e) {}
        }
    }
    return E;
}

function mt_layerRange(L) { return [Math.min(L.inPoint, L.outPoint), Math.max(L.inPoint, L.outPoint)]; }

/* Tempo del figlio a partire dal tempo del genitore. */
function mt_toChild(L, t) {
    if (L.timeRemapEnabled) { try { return L.property("ADBE Time Remapping").valueAtTime(t, false); } catch (e) {} }
    return (t - L.startTime) * 100 / (L.stretch || 100);
}

/* Tempo del genitore a partire dal tempo del figlio (con la rimappatura si cerca frame per frame). */
function mt_toParent(L, t) {
    if (L.timeRemapEnabled) {
        try {
            var tr = L.property("ADBE Time Remapping"), R = mt_layerRange(L), fd = L.containingComp.frameDuration, best = null, bd = 1e9;
            for (var x = R[0]; x <= R[1]; x += fd) { var d = Math.abs(tr.valueAtTime(x, false) - t); if (d < bd) { bd = d; best = x; } }
            if (best !== null) return best;
        } catch (e) {}
    }
    return L.startTime + t * (L.stretch || 100) / 100;
}

/** Cerca il percorso piu' corto tra le due composizioni, preferendo i layer attivi in quell'istante. */
function mt_mapTime(fromId, t, toId) {
    if (fromId === toId) return { t: t, hops: 0, strict: true };
    var E = mt_compEdges();
    var run = function (strict) {
        var Q = [{ id: fromId, t: t, hops: 0 }], seen = {};
        seen[fromId] = true;
        while (Q.length) {
            var cur = Q.shift();
            for (var k = 0; k < E.length; k++) {
                var e = E[k], nid = null, nt = 0, R = mt_layerRange(e.L);
                if (e.p === cur.id) {
                    if (strict && (cur.t < R[0] - 1e-6 || cur.t > R[1] + 1e-6)) continue;
                    nid = e.c; nt = mt_toChild(e.L, cur.t);
                } else if (e.c === cur.id) {
                    nt = mt_toParent(e.L, cur.t);
                    if (strict && (nt < R[0] - 1e-6 || nt > R[1] + 1e-6)) continue;
                    nid = e.p;
                } else continue;
                if (seen[nid]) continue;
                seen[nid] = true;
                var nx = { id: nid, t: nt, hops: cur.hops + 1 };
                if (nid === toId) return nx;
                Q.push(nx);
            }
        }
        return null;
    };
    var r = run(true);
    if (r) { r.strict = true; return r; }
    r = run(false);
    if (r) r.strict = false;
    return r;
}

function inflect_momentTake() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    $.global.MT_MOMENT = { id: comp.id, name: comp.name, t: comp.time, fps: 1 / comp.frameDuration };
    return inflect_ok($.global.MT_MOMENT);
}

function inflect_momentGo() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var M = $.global.MT_MOMENT;
    if (!M) return inflect_err("Prima prendi un momento con Prendi.");
    var r = mt_mapTime(M.id, M.t, comp.id);
    if (!r) return inflect_err(comp.name + " non \u00e8 collegata a " + M.name + ": nessuna delle due contiene l'altra.");
    var t = inflect_frameRound(comp, r.t);
    try { comp.time = Math.max(0, Math.min(comp.duration, t)); } catch (e) {}
    return inflect_ok({ time: t, comp: comp.name, outside: t < 0 || t > comp.duration, loose: !r.strict, fps: 1 / comp.frameDuration });
}

function inflect_momentMarker() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var M = $.global.MT_MOMENT, t = comp.time;
    if (M) { var r = mt_mapTime(M.id, M.t, comp.id); if (r) t = inflect_frameRound(comp, r.t); }
    var label = M ? M.name : "Momento";
    mt_begin("Motion Tools: marker");
    try {
        var sel = comp.selectedLayers, n = 0;
        if (sel.length) {
            for (var i = 0; i < sel.length; i++) { sel[i].property("ADBE Marker").setValueAtTime(t, new MarkerValue(label)); n++; }
        } else {
            comp.markerProperty.setValueAtTime(t, new MarkerValue(label));
        }
        mt_end();
        return inflect_ok({ time: t, layers: n, fps: 1 / comp.frameDuration });
    } catch (e) { mt_end(); return inflect_err("Marker non creato: " + e.toString()); }
}

/* --------------------------------------------------- copia e incolla -- */

function mt_pathOf(p) {
    var path = [], q = p;
    while (q && q.parentProperty) {
        path.unshift({ mn: q.matchName, name: q.name, ix: q.propertyIndex });
        q = q.parentProperty;
    }
    return path;
}

function mt_resolvePath(layer, path) {
    var q = layer;
    for (var i = 0; i < path.length; i++) {
        var s = path[i], nx = null;
        try { nx = q.property(s.name); if (nx && nx.matchName !== s.mn) nx = null; } catch (e) { nx = null; }
        if (!nx) { try { nx = q.property(s.mn); } catch (e2) { nx = null; } }
        if (!nx) { try { nx = q.property(s.ix); if (nx && nx.matchName !== s.mn) nx = null; } catch (e3) { nx = null; } }
        if (!nx) return null;
        q = nx;
    }
    return (q && q.propertyType === PropertyType.PROPERTY) ? q : null;
}

function mt_fitValue(v, dst) {
    if (!(v instanceof Array)) return v;
    var cur = dst.value;
    if (!(cur instanceof Array) || cur.length === v.length) return v;
    var out = [];
    for (var i = 0; i < cur.length; i++) out.push(i < v.length ? v[i] : cur[i]);
    return out;
}

/* Costruisce gli appunti dai keyframe: entries = [{ prop, keys: [indici] }]. */
function mt_keysClip(entries) {
    var items = [], layerIds = [], t0 = 1e12;
    var lix = function (L) { for (var a = 0; a < layerIds.length; a++) if (layerIds[a] === L.id) return a; layerIds.push(L.id); return layerIds.length - 1; };
    for (var i = 0; i < entries.length; i++) {
        var p = entries[i].prop, sk = entries[i].keys, keys = [], spatial = false;
        try { spatial = p.isSpatial; } catch (eS) {}
        for (var k = 0; k < sk.length; k++) {
            var j = sk[k], K = { t: p.keyTime(j), v: p.keyValue(j) };
            try { K.ii = p.keyInInterpolationType(j); K.oi = p.keyOutInterpolationType(j); } catch (e1) {}
            try { K.ie = p.keyInTemporalEase(j); K.oe = p.keyOutTemporalEase(j); } catch (e2) {}
            try { K.tc = p.keyTemporalContinuous(j); K.ta = p.keyTemporalAutoBezier(j); } catch (e3) {}
            if (spatial) { try { K.ist = p.keyInSpatialTangent(j); K.ost = p.keyOutSpatialTangent(j); K.sc = p.keySpatialContinuous(j); K.sa = p.keySpatialAutoBezier(j); K.rv = p.keyRoving(j); } catch (e4) {} }
            keys.push(K);
            if (K.t < t0) t0 = K.t;
        }
        if (!keys.length) continue;
        items.push({ path: mt_pathOf(p), name: p.name, layer: lix(p.propertyGroup(p.propertyDepth)), keys: keys, spatial: spatial });
    }
    return { items: items, layers: layerIds.length, t0: t0 };
}

/* Ricorda in silenzio gli ultimi keyframe selezionati: "Incolla" li usa anche senza premere Copia. */
function mt_autoClip(comp, list) {
    if (!list.length) return;
    var refs = [];
    for (var i = 0; i < list.length; i++) {
        var times = [];
        for (var k = 0; k < list[i].keys.length; k++) times.push(list[i].prop.keyTime(list[i].keys[k]));
        refs.push({ ref: mt_propRef(list[i].prop), times: times });
    }
    $.global.MT_AUTOCLIP = { comp: comp.id, compName: comp.name, refs: refs, stamp: new Date().getTime() };
}

function mt_resolveAuto(A) {
    var entries = [];
    for (var i = 0; i < A.refs.length; i++) {
        var p = mt_propGet(A.refs[i].ref);
        if (!p) continue;
        var keys = [];
        for (var k = 0; k < A.refs[i].times.length; k++) { var ix = inflect_keyAt(p, A.refs[i].times[k]); if (ix) keys.push(ix); }
        if (keys.length) entries.push({ prop: p, keys: keys });
    }
    if (!entries.length) return null;
    var c = mt_keysClip(entries);
    return { mode: "keys", items: c.items, layers: c.layers, comp: A.comp, compName: A.compName, t0: c.t0, stamp: A.stamp, auto: true };
}

function inflect_clipCopy() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var props = comp.selectedProperties, items = [], layerIds = [], mode = "keys", t0 = 1e12, i, k;
    var lix = function (L) { for (var a = 0; a < layerIds.length; a++) if (layerIds[a] === L.id) return a; layerIds.push(L.id); return layerIds.length - 1; };
    var kc = mt_keysClip(inflect_selectedKeyedProps(comp));
    if (kc.items.length) { items = kc.items; t0 = kc.t0; for (i = 0; i < kc.layers; i++) layerIds.push(i); }
    if (!items.length) {
        mode = "values";
        for (i = 0; i < props.length; i++) {
            var q = props[i];
            if (q.propertyType !== PropertyType.PROPERTY) continue;
            try { if (q.propertyValueType === PropertyValueType.NO_VALUE) continue; } catch (e5) {}
            var Lq = q.propertyGroup(q.propertyDepth);
            try { items.push({ path: mt_pathOf(q), name: q.name, layer: lix(Lq), v: q.valueAtTime(comp.time, true) }); } catch (e6) {}
        }
    }
    if (!items.length) {
        mode = "transform";
        var sel = comp.selectedLayers;
        if (!sel.length) return inflect_err("Seleziona dei keyframe, delle propriet\u00e0 o dei layer da copiare.");
        var mns = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity"];
        for (i = 0; i < sel.length; i++) {
            var tr = sel[i].property("ADBE Transform Group");
            for (k = 0; k < mns.length; k++) {
                var pp = tr.property(mns[k]);
                if (!pp) continue;
                try { if (pp.dimensionsSeparated) continue; } catch (e7) {}
                items.push({ path: mt_pathOf(pp), name: pp.name, layer: lix(sel[i]), v: pp.valueAtTime(comp.time, true) });
            }
        }
    }
    if (mode !== "keys") t0 = comp.time;
    $.global.MT_CLIP = { mode: mode, items: items, layers: layerIds.length, comp: comp.id, compName: comp.name, t0: t0, stamp: new Date().getTime() };
    $.global.MT_MOMENT = { id: comp.id, name: comp.name, t: t0, fps: 1 / comp.frameDuration };
    var nk = 0, names = [];
    for (i = 0; i < items.length; i++) { if (items[i].keys) nk += items[i].keys.length; if (names.length < 3) names.push(items[i].name); }
    return inflect_ok({ mode: mode, props: items.length, keys: nk, layers: layerIds.length, names: names, comp: comp.name, t0: t0, fps: 1 / comp.frameDuration });
}

/** where: "same" (stesso momento, anche in un'altra precomposizione) o "cti" (indicatore del tempo). */
function inflect_clipPaste(where) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var CL = $.global.MT_CLIP, AU = $.global.MT_AUTOCLIP;
    // Gli ultimi keyframe selezionati valgono come copiati, se sono pi\u00f9 recenti dell'ultima copia.
    if (AU && (!CL || AU.stamp > CL.stamp)) { var R = mt_resolveAuto(AU); if (R) CL = R; }
    if (!CL) return inflect_err("Seleziona dei keyframe (o premi Copia), poi seleziona i layer su cui incollarli.");
    var targets = comp.selectedLayers;
    if (!targets.length) return inflect_err("Seleziona i layer su cui incollare.");
    var base = comp.time, notes = [];
    if (CL.mode === "keys" && where === "same") {
        var r = mt_mapTime(CL.comp, CL.t0, comp.id);
        if (r) { base = r.t; if (!r.strict) notes.push("Il momento cade fuori dalla durata della precomposizione."); }
        else notes.push(comp.name + " non \u00e8 collegata a " + CL.compName + ": incollato all'indicatore del tempo.");
    }
    var done = 0, missing = 0;
    mt_begin("Motion Tools: incolla");
    try {
        for (var ti = 0; ti < targets.length; ti++) {
            var T = targets[ti], srcLayer = CL.layers > 1 ? ti % CL.layers : 0;
            for (var i = 0; i < CL.items.length; i++) {
                var it = CL.items[i];
                if (it.layer !== srcLayer) continue;
                var dst = mt_resolvePath(T, it.path);
                if (!dst) { missing++; continue; }
                try {
                    if (CL.mode === "keys") {
                        for (var k = 0; k < it.keys.length; k++) {
                            var K = it.keys[k], tt = base + (K.t - CL.t0);
                            dst.setValueAtTime(tt, mt_fitValue(K.v, dst));
                            var j = dst.nearestKeyIndex(tt);
                            try { if (K.ii) dst.setInterpolationTypeAtKey(j, K.ii, K.oi); } catch (e1) {}
                            try { if (K.ie && K.ie.length === dst.keyInTemporalEase(j).length) dst.setTemporalEaseAtKey(j, K.ie, K.oe); } catch (e2) {}
                            try { if (K.tc !== undefined) { dst.setTemporalContinuousAtKey(j, K.tc); dst.setTemporalAutoBezierAtKey(j, K.ta); } } catch (e3) {}
                            if (it.spatial && K.ist) {
                                try { dst.setSpatialTangentsAtKey(j, mt_fitValue(K.ist, dst), mt_fitValue(K.ost, dst)); dst.setSpatialContinuousAtKey(j, K.sc); dst.setSpatialAutoBezierAtKey(j, K.sa); } catch (e4) {}
                                try { dst.setRovingAtKey(j, K.rv); } catch (e5) {}
                            }
                        }
                    } else {
                        var v = mt_fitValue(it.v, dst);
                        if (dst.numKeys > 0) dst.setValueAtTime(comp.time, v); else dst.setValue(v);
                    }
                    done++;
                } catch (eP) { missing++; }
            }
        }
        mt_end();
    } catch (e) { mt_end(); return inflect_err("Incolla non riuscito: " + e.toString()); }
    if (missing) notes.push(missing + (missing === 1 ? " propriet\u00e0 non trovata" : " propriet\u00e0 non trovate") + " sui layer di destinazione.");
    return inflect_ok({ mode: CL.mode, props: done, base: base, notes: notes, fps: 1 / comp.frameDuration, auto: !!CL.auto, from: CL.compName });
}

function inflect_clipInfo() {
    var CL = $.global.MT_CLIP, M = $.global.MT_MOMENT;
    return inflect_ok({ clip: CL ? { mode: CL.mode, props: CL.items.length, comp: CL.compName } : null, moment: M || null });
}

/* -------------------------------------------------------- stagger -- */

function inflect_staggerLayers(optsJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var o = inflect_parse(optsJSON), sel = comp.selectedLayers, L = [], i;
    for (i = 0; i < sel.length; i++) L.push(sel[i]);
    if (L.length < 2) return inflect_err("Seleziona almeno due layer.");
    var fd = comp.frameDuration, t = comp.time;
    var cx = function (l) { try { var b = inflect_bounds(l, t, false); return [(b.l + b.r) / 2, (b.t + b.b) / 2]; } catch (e) { var p = inflect_layerPos(l, t); return [p[0], p[1]]; } };
    var ord = o.order || "sel";
    if (ord === "top") L.sort(function (a, b) { return a.index - b.index; });
    else if (ord === "bottom") L.sort(function (a, b) { return b.index - a.index; });
    else if (ord === "left" || ord === "right" || ord === "up" || ord === "down" || ord === "center") {
        var key = {};
        for (i = 0; i < L.length; i++) {
            var c = cx(L[i]);
            key[L[i].id] = ord === "left" ? c[0] : ord === "right" ? -c[0] : ord === "up" ? c[1] : ord === "down" ? -c[1]
                : Math.sqrt(Math.pow(c[0] - comp.width / 2, 2) + Math.pow(c[1] - comp.height / 2, 2));
        }
        L.sort(function (a, b) { return key[a.id] - key[b.id]; });
    } else if (ord === "random") {
        var s = Math.max(1, Math.round(o.seed || 1)) * 9301 + 49297;
        var rnd = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        for (i = L.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = L[i]; L[i] = L[j]; L[j] = tmp; }
    }
    var base = o.from === "cti" ? t : 1e12;
    if (o.from !== "cti") for (i = 0; i < L.length; i++) base = Math.min(base, L[i].inPoint);
    var n = L.length, span = (o.step || 2) * fd * (n - 1);
    mt_begin("Motion Tools: sfalsa layer");
    try {
        for (i = 0; i < n; i++) {
            var u = n > 1 ? i / (n - 1) : 0;
            if (o.curve === 1) u = u * u; else if (o.curve === 2) u = 1 - (1 - u) * (1 - u); else if (o.curve === 3) u = u * u * (3 - 2 * u);
            var target = inflect_frameRound(comp, base + span * u);
            var ly = L[i], wasLocked = ly.locked;
            if (wasLocked) ly.locked = false;
            ly.startTime += target - ly.inPoint;
            if (wasLocked) ly.locked = true;
        }
        mt_end();
        return inflect_ok({ count: n, span: Math.round(span / fd) });
    } catch (e) { mt_end(); return inflect_err("Sfalsamento non riuscito: " + e.toString()); }
}

/* ============================================================== liste == */
/*
 * Liste come gli Array di Cavalry: valori (numeri, colori, testi) che si distribuiscono
 * su layer o copie in base all'indice. Nel Cloner stanno in un marker del controllo
 * ("MT_LISTS {...}"), che le espressioni delle copie leggono a ogni frame.
 */

function mt_hexToRGB(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (isNaN(n)) return [1, 1, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mt_listIndex(i, n, len, mode, seed) {
    if (len <= 0) return 0;
    if (mode === "random") { var s = (seed || 1) * 1000 + i * 7919; s = Math.abs(Math.sin(s) * 43758.5453); return Math.floor((s - Math.floor(s)) * len); }
    if (mode === "pingpong") { if (len === 1) return 0; var p = i % (2 * len - 2); return p < len ? p : 2 * len - 2 - p; }
    if (mode === "stretch") return n > 1 ? Math.round(i / (n - 1) * (len - 1)) : 0;
    return i % len;
}

/* Riempimento colore su un layer: testo nel documento, forme nei riempimenti, il resto con l'effetto Riempimento. */
function mt_setColor(layer, rgb, t) {
    var setv = function (p, v) { if (p.numKeys > 0) p.setValueAtTime(t, v); else p.setValue(v); };
    if (mt_isText(layer)) {
        var sp = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var doc = sp.value;
        doc.applyFill = true;
        doc.fillColor = rgb;
        setv(sp, doc);
        return;
    }
    var found = 0;
    var walk = function (g) {
        for (var i = 1; i <= g.numProperties; i++) {
            var p = g.property(i);
            if (p.matchName === "ADBE Vector Graphic - Fill") { try { setv(p.property("ADBE Vector Fill Color"), [rgb[0], rgb[1], rgb[2], 1]); found++; } catch (e) {} }
            else if (p.propertyType !== PropertyType.PROPERTY && p.numProperties) walk(p);
        }
    };
    try { if (layer.property("ADBE Root Vectors Group")) walk(layer.property("ADBE Root Vectors Group")); } catch (e2) {}
    if (found) return;
    var fx = layer.property("ADBE Effect Parade"), fill = fx.property("MT Colore");
    if (!fill) { fill = fx.addProperty("ADBE Fill"); fill.name = "MT Colore"; fill = layer.property("ADBE Effect Parade").property("MT Colore"); }
    setv(fill.property("ADBE Fill-0002"), [rgb[0], rgb[1], rgb[2], 1]);
}

/**
 * Applica una lista ai layer selezionati, nell'ordine di selezione.
 * o = { kind: "color"|"number"|"text", values: [...], target: "rotation"|"opacity"|"scale"|"x"|"y"|"time"|"text"|"color", mode, seed, add }
 */
function inflect_listApply(optsJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var o = inflect_parse(optsJSON), sel = comp.selectedLayers, n = sel.length, i;
    if (!n) return inflect_err("Seleziona i layer a cui dare i valori.");
    if (!o.values || !o.values.length) return inflect_err("La lista \u00e8 vuota.");
    var t = comp.time, skipped = 0;
    mt_begin("Motion Tools: applica lista");
    try {
        for (i = 0; i < n; i++) {
            var L = sel[i], v = o.values[mt_listIndex(i, n, o.values.length, o.mode, o.seed)];
            if (o.kind === "color") { mt_setColor(L, mt_hexToRGB(v), t); continue; }
            if (o.kind === "text" || o.target === "text") {
                if (!mt_isText(L)) { skipped++; continue; }
                var sp = L.property("ADBE Text Properties").property("ADBE Text Document"), doc = sp.value;
                doc.text = String(v);
                if (sp.numKeys > 0) sp.setValueAtTime(t, doc); else sp.setValue(doc);
                continue;
            }
            var num = parseFloat(v);
            if (isNaN(num)) { skipped++; continue; }
            if (o.target === "time") { L.startTime += num * comp.frameDuration; continue; }
            var tr = L.property("ADBE Transform Group"), p, cur, nv;
            if (o.target === "x" || o.target === "y") {
                p = tr.property("ADBE Position");
                if (p.dimensionsSeparated) { p = tr.property(o.target === "x" ? "ADBE Position_0" : "ADBE Position_1"); cur = p.valueAtTime(t, true); nv = o.add ? cur + num : num; }
                else { cur = p.valueAtTime(t, true); nv = cur.slice ? cur.slice() : [cur[0], cur[1]]; var ax = o.target === "x" ? 0 : 1; nv[ax] = o.add ? cur[ax] + num : num; }
            } else if (o.target === "scale") {
                p = tr.property("ADBE Scale"); cur = p.valueAtTime(t, true); nv = [];
                for (var d = 0; d < cur.length; d++) nv.push(o.add ? cur[d] + num : num);
            } else {
                p = tr.property(o.target === "opacity" ? "ADBE Opacity" : "ADBE Rotate Z");
                cur = p.valueAtTime(t, true); nv = o.add ? cur + num : num;
            }
            if (p.numKeys > 0) p.setValueAtTime(t, nv); else p.setValue(nv);
        }
        mt_end();
        return inflect_ok({ count: n - skipped, skipped: skipped });
    } catch (e) { mt_end(); return inflect_err("Lista non applicata: " + e.toString()); }
}

/* ------------------------------------------------- liste nel Cloner -- */

function mt_listsGet(ctrl) {
    try {
        var M = ctrl.property("ADBE Marker");
        for (var k = 1; k <= M.numKeys; k++) {
            var c = M.keyValue(k).comment;
            if (c.indexOf("MT_LISTS ") === 0) return inflect_parse(c.substring(9));
        }
    } catch (e) {}
    return {};
}

function mt_listsSet(ctrl, obj) {
    var M = ctrl.property("ADBE Marker");
    for (var k = M.numKeys; k >= 1; k--) { try { if (M.keyValue(k).comment.indexOf("MT_LISTS ") === 0) M.removeKey(k); } catch (e) {} }
    var mv = new MarkerValue("MT_LISTS " + inflect_stringify(obj));
    M.setValueAtTime(ctrl.inPoint, mv);
}

MT_X.color = [].concat([
    'var C = thisComp.layer(@C@);',
    'var i = Math.round(effect("MT Indice")(1).value);',
    'var n = 1; try { n = Math.round(C.effect("Quantit\u00e0")(1).value); } catch (eN) {}'
], MT_X.lists, [
    'var D = mtLists().colori;',
    'if (!D || !D.v || !D.v.length) value; else {',
    '  var hx = String(D.v[mtPick(D, i, n)]).replace("#", "");',
    '  if (hx.length == 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];',
    '  var c = parseInt(hx, 16);',
    '  [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1];',
    '}'
]);

MT_X.text = [].concat([
    'var C = thisComp.layer(@C@);',
    'var i = Math.round(effect("MT Indice")(1).value);',
    'var n = 1; try { n = Math.round(C.effect("Quantit\u00e0")(1).value); } catch (eN) {}'
], MT_X.lists, [
    'var D = mtLists().testi;',
    '(!D || !D.v || !D.v.length) ? value : String(D.v[mtPick(D, i, n)])'
]);

/** Prepara una copia per colori e testi della lista (chiamata anche alla creazione delle copie). */
function mt_cloneLists(c, ctrl, L) {
    L = L || mt_listsGet(ctrl);
    var cn = ctrl.name;
    var hasC = !!(L.colori && L.colori.v && L.colori.v.length);
    var fx = c.property("ADBE Effect Parade"), fill = fx.property("MT Colore");
    if (hasC && !fill) {
        fx.addProperty("ADBE Fill").name = "MT Colore";
        fill = c.property("ADBE Effect Parade").property("MT Colore");
        fill.property("ADBE Fill-0002").expression = mt_expr("color", cn);
    }
    if (fill) fill.enabled = hasC;
    if (mt_isText(c)) {
        var st = c.property("ADBE Text Properties").property("ADBE Text Document");
        var hasT = !!(L.testi && L.testi.v && L.testi.v.length);
        try { st.expression = hasT ? mt_expr("text", cn) : ""; } catch (e) {}
    }
}

/** key: "B<k>", "colori" o "testi". dataJSON: { v: [...], m, s } oppure null per toglierla. */
function inflect_repeatListSet(key, dataJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var data = inflect_parse(dataJSON);
    mt_begin("Motion Tools: lista");
    try {
        var L = mt_listsGet(ctrl);
        if (data && data.v && data.v.length) L[key] = data; else delete L[key];
        mt_listsSet(ctrl, L);
        if (key === "colori" || key === "testi") {
            var cl = mt_clones(comp, ctrl);
            for (var i = 0; i < cl.length; i++) mt_cloneLists(cl[i].layer, ctrl, L);
        }
        mt_end();
        return inflect_ok({ lists: L });
    } catch (e) { mt_end(); return inflect_err("Lista non salvata: " + e.toString()); }
}

/* =============================================================== team == */
/*
 * Libreria di team: un file motion-tools-team.json in una cartella condivisa
 * (Drive, Dropbox, server). Contiene curve, animazioni di testo, palette e liste.
 */

function mt_teamDir() {
    var st = inflect_settings();
    var dir = st.teamFolder ? new Folder(st.teamFolder) : null;
    if (!dir || !dir.exists) {
        dir = new Folder(inflect_dataDir().fsName + "/Team");
        if (!dir.exists) dir.create();
    }
    return dir;
}

function mt_teamFile() { return new File(mt_teamDir().fsName + "/motion-tools-team.json"); }

function inflect_teamLoad() {
    try {
        var st = inflect_settings(), f = mt_teamFile();
        var isDefault = !st.teamFolder || !(new Folder(st.teamFolder)).exists;
        var lib = null;
        if (f.exists) lib = inflect_parse(inflect_readText(f));
        if (!lib) {
            lib = { format: "motion-tools-team", version: 1, name: "Team", curves: [], text: [], palettes: [], lists: [], updated: new Date().getTime() };
            // Le curve brand delle versioni precedenti entrano nella libreria di team.
            try {
                var old = inflect_libFiles(inflect_sharedDir());
                for (var i = 0; i < old.length; i++) {
                    var b = inflect_parse(inflect_readText(old[i]));
                    if (b && b.curves) for (var k = 0; k < b.curves.length; k++) lib.curves.push(b.curves[k]);
                }
            } catch (eO) {}
            inflect_writeText(f, inflect_stringify(lib));
        }
        return inflect_ok({ library: lib, folder: mt_teamDir().fsName, folderName: decodeURI(mt_teamDir().name), isDefault: isDefault, modified: f.modified ? f.modified.getTime() : 0 });
    } catch (e) { return inflect_err("Libreria di team non leggibile: " + e); }
}

function inflect_teamStat() {
    try { var f = mt_teamFile(); return inflect_ok({ modified: f.exists && f.modified ? f.modified.getTime() : 0 }); }
    catch (e) { return inflect_err(e); }
}

function inflect_teamSave(libJSON) {
    try {
        var f = mt_teamFile(), tmp = new File(f.fsName + ".tmp");
        if (!inflect_writeText(tmp, libJSON)) return inflect_err("Non riesco a scrivere nella cartella del team. Controlla i permessi.");
        if (f.exists) f.remove();
        tmp.rename(decodeURI(f.name));
        f = mt_teamFile();
        return inflect_ok({ modified: f.modified ? f.modified.getTime() : 0 });
    } catch (e) { return inflect_err("Salvataggio non riuscito: " + e); }
}

function inflect_teamChoose() {
    try {
        var dir = mt_teamDir().selectDlg("Scegli la cartella condivisa con il team");
        if (!dir) return inflect_ok({ cancelled: true });
        var st = inflect_settings();
        st.teamFolder = dir.fsName;
        inflect_saveSettings(st);
        return inflect_teamLoad();
    } catch (e) { return inflect_err(e); }
}

function inflect_teamReveal() {
    try { mt_teamDir().execute(); return inflect_ok({}); } catch (e) { return inflect_err(e); }
}

/* ===================================================== sposta animazione == */
/*
 * Sposta tutta l'animazione senza toccare i tempi: somma lo stesso scarto a ogni keyframe.
 * Con proprieta' selezionate lavora su quelle, altrimenti sulla posizione dei layer selezionati.
 */
function mt_offsetProp(p, off, onlySel) {
    var add = function (v) {
        if (v instanceof Array) { var o = []; for (var d = 0; d < v.length; d++) o.push(v[d] + (off[d] || 0)); return o; }
        return v + off[0];
    };
    if (p.numKeys > 0) {
        var n = 0;
        for (var k = 1; k <= p.numKeys; k++) {
            if (onlySel && !p.keySelected(k)) continue;
            p.setValueAtKey(k, add(p.keyValue(k))); n++;
        }
        return n;
    }
    p.setValue(add(p.value));
    return 1;
}

function inflect_offsetAnim(optsJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var o = inflect_parse(optsJSON), off = [o.dx || 0, o.dy || 0, o.dz || 0];
    var props = comp.selectedProperties, targets = [], i;
    for (i = 0; i < props.length; i++) {
        var p = props[i];
        if (p.propertyType !== PropertyType.PROPERTY) continue;
        try { if (!inflect_isNumericType(p.propertyValueType)) continue; } catch (e0) { continue; }
        targets.push(p);
    }
    var sel = comp.selectedLayers;
    if (!targets.length) {
        for (i = 0; i < sel.length; i++) {
            var tr = sel[i].property("ADBE Transform Group"), pos = tr.property("ADBE Position");
            if (pos.dimensionsSeparated) {
                targets.push({ sep: tr.property("ADBE Position_0"), d: 0 }, { sep: tr.property("ADBE Position_1"), d: 1 });
                if (sel[i].threeDLayer) targets.push({ sep: tr.property("ADBE Position_2"), d: 2 });
            } else targets.push(pos);
        }
    }
    if (!targets.length) return inflect_err("Seleziona dei layer, oppure le proprietà da spostare.");
    var keys = 0;
    mt_begin("Motion Tools: sposta animazione");
    try {
        for (i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (t.sep) keys += mt_offsetProp(t.sep, [off[t.d]], false);
            else keys += mt_offsetProp(t, off, !!o.onlySelected);
        }
        mt_end();
        return inflect_ok({ props: targets.length, keys: keys });
    } catch (e) { mt_end(); return inflect_err("Non riesco a spostare: " + e.toString()); }
}


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

/* ======================================================== aggiornamenti == */
/*
 * Aggiornamento da una cartella condivisa (NAS, Drive, Dropbox): dentro c'e' la cartella
 * "motion-tools" della nuova versione. Se e' piu' recente di quella installata, i file
 * vengono copiati nella cartella dell'estensione (nella Libreria dell'utente, niente password).
 */
function mt_updateDir() {
    var st = inflect_settings();
    if (st.updateFolder && (new Folder(st.updateFolder)).exists) return new Folder(st.updateFolder);
    return new Folder(mt_teamDir().fsName + "/Aggiornamenti");
}

// Un pacchetto e' una cartella con CSXS/manifest.xml. Cerca nelle forme previste:
// dir/motion-tools, dir stessa, dir/Motion Tools/motion-tools.
function mt_packageAt(dir) {
    if (!dir || !dir.exists) return null;
    var direct = new Folder(dir.fsName + "/motion-tools");
    if ((new File(direct.fsName + "/CSXS/manifest.xml")).exists) return direct;
    if ((new File(dir.fsName + "/CSXS/manifest.xml")).exists) return dir;
    var inner = new Folder(dir.fsName + "/Motion Tools/motion-tools");
    if ((new File(inner.fsName + "/CSXS/manifest.xml")).exists) return inner;
    return null;
}

// Cerca nella cartella degli aggiornamenti e nelle sue sottocartelle (due livelli, es. Aggiornamenti/2.12.2/motion-tools).
// Sceglie il pacchetto con la versione piu' alta. Non cancella ne' sposta niente: le versioni restano affiancate.
function mt_findPackage(dir) {
    if (!dir || !dir.exists) return null;
    var best = null, bestV = "0", seen = 0;
    function consider(f) {
        if (!f) return;
        var v = mt_manifestVersion(f);
        if (!best || mt_versionCmp(v, bestV) > 0) { best = f; bestV = v; }
    }
    consider(mt_packageAt(dir));
    var level1 = dir.getFiles();
    for (var i = 0; i < level1.length && seen < 200; i++) {
        if (!(level1[i] instanceof Folder)) continue;
        seen++;
        consider(mt_packageAt(level1[i]));
        var level2 = level1[i].getFiles();
        for (var j = 0; j < level2.length && seen < 200; j++) {
            if (!(level2[j] instanceof Folder)) continue;
            seen++;
            consider(mt_packageAt(level2[j]));
        }
    }
    return best;
}

function mt_manifestVersion(folder) {
    try {
        var s = inflect_readText(new File(folder.fsName + "/CSXS/manifest.xml"));
        var m = s.match(/ExtensionBundleVersion="([0-9.]+)"/);
        return m ? m[1] : "0";
    } catch (e) { return "0"; }
}

function mt_versionCmp(a, b) {
    var A = String(a).split("."), B = String(b).split(".");
    for (var i = 0; i < Math.max(A.length, B.length); i++) {
        var x = parseInt(A[i] || "0", 10), y = parseInt(B[i] || "0", 10);
        if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
}

function inflect_updateCheck(extPath) {
    try {
        var cur = mt_manifestVersion(new Folder(extPath));
        var dir = mt_updateDir(), pkg = mt_findPackage(dir);
        var out = { current: cur, folder: dir.fsName, folderName: decodeURI(dir.name), found: !!pkg, available: false };
        if (!pkg) return inflect_ok(out);
        out.version = mt_manifestVersion(pkg);
        out.available = mt_versionCmp(out.version, cur) > 0;
        try { var n = new File(pkg.fsName + "/NOVITA.txt"); if (n.exists) out.notes = inflect_readText(n).substring(0, 600); } catch (eN) {}
        return inflect_ok(out);
    } catch (e) { return inflect_err("Controllo aggiornamenti non riuscito: " + e); }
}

function mt_copyTree(src, dst) {
    if (!dst.exists) dst.create();
    var items = src.getFiles(), n = 0;
    for (var i = 0; i < items.length; i++) {
        var it = items[i], name = decodeURI(it.name);
        if (name.charAt(0) === ".") continue;
        if (it instanceof Folder) n += mt_copyTree(it, new Folder(dst.fsName + "/" + name));
        else { var t = new File(dst.fsName + "/" + name); if (t.exists) t.remove(); if (!it.copy(t.fsName)) throw new Error("Non riesco a copiare " + name); n++; }
    }
    return n;
}

function inflect_updateInstall(extPath) {
    try {
        var upd = mt_updateDir(), pkg = mt_findPackage(upd);
        if (!pkg) return inflect_err("Non trovo Motion Tools in: " + upd.fsName + ". Dentro deve esserci la cartella motion-tools (con CSXS/manifest.xml).");
        var ext = new Folder(extPath);
        var ver = mt_manifestVersion(pkg), cur = mt_manifestVersion(ext);
        if (mt_versionCmp(ver, cur) <= 0) return inflect_ok({ installed: false, version: cur });
        var manifestChanged = false;
        try { manifestChanged = inflect_readText(new File(pkg.fsName + "/CSXS/manifest.xml")).replace(/ExtensionBundleVersion="[0-9.]+"|Version="[0-9.]+"/g, "") !== inflect_readText(new File(ext.fsName + "/CSXS/manifest.xml")).replace(/ExtensionBundleVersion="[0-9.]+"|Version="[0-9.]+"/g, ""); } catch (eM) {}
        var n = mt_copyTree(pkg, ext);
        var cleared = mt_clearCepCache();
        return inflect_ok({ installed: true, version: ver, from: cur, files: n, restart: manifestChanged, cache: cleared });
    } catch (e) { return inflect_err("Aggiornamento non riuscito: " + e + ". Puoi sempre reinstallare dallo zip."); }
}

/*
 * Installa da una cartella gia' pronta (lo zip scaricato da GitHub e aperto dal pannello).
 * Prima copia la versione in uso in backupPath, cosi' si puo' tornare indietro.
 * force = installa anche se la versione non e' piu' recente (serve per tornare indietro).
 */
function inflect_updateInstallFrom(extPath, pkgPath, backupPath, force) {
    try {
        var pkg = new Folder(pkgPath), ext = new Folder(extPath);
        if (!(new File(pkg.fsName + "/CSXS/manifest.xml")).exists) return inflect_err("La cartella scaricata non contiene Motion Tools.");
        var ver = mt_manifestVersion(pkg), cur = mt_manifestVersion(ext);
        if (!force && mt_versionCmp(ver, cur) <= 0) return inflect_ok({ installed: false, version: cur });
        var idNew = "", idCur = "";
        try { idNew = (inflect_readText(new File(pkg.fsName + "/CSXS/manifest.xml")).match(/ExtensionBundleId="([^"]+)"/) || [])[1]; } catch (e1) {}
        try { idCur = (inflect_readText(new File(ext.fsName + "/CSXS/manifest.xml")).match(/ExtensionBundleId="([^"]+)"/) || [])[1]; } catch (e2) {}
        if (idNew && idCur && idNew !== idCur) return inflect_err("La cartella scaricata contiene un'altra estensione.");
        var manifestChanged = false;
        try { manifestChanged = inflect_readText(new File(pkg.fsName + "/CSXS/manifest.xml")).replace(/ExtensionBundleVersion="[0-9.]+"|Version="[0-9.]+"/g, "") !== inflect_readText(new File(ext.fsName + "/CSXS/manifest.xml")).replace(/ExtensionBundleVersion="[0-9.]+"|Version="[0-9.]+"/g, ""); } catch (eM) {}
        var backed = false;
        if (backupPath) {
            try {
                var b = new Folder(backupPath);
                if (b.exists) mt_removeTree(b);
                mt_copyTree(ext, b);
                backed = true;
            } catch (eB) {}
        }
        var n = mt_copyTree(pkg, ext);
        var cleared = mt_clearCepCache();
        return inflect_ok({ installed: true, version: ver, from: cur, files: n, restart: manifestChanged, cache: cleared, backup: backed });
    } catch (e) { return inflect_err("Aggiornamento non riuscito: " + e + ". La versione di prima resta in uso."); }
}

function inflect_updateChooseFolder() {
    try {
        var dir = mt_updateDir().selectDlg("Scegli la cartella con gli aggiornamenti di Motion Tools");
        if (!dir) return inflect_ok({ cancelled: true });
        var st = inflect_settings(); st.updateFolder = dir.fsName; inflect_saveSettings(st);
        return inflect_ok({ folder: dir.fsName, folderName: decodeURI(dir.name) });
    } catch (e) { return inflect_err(e); }
}


/*
 * Cache dei pannelli di CEP: Mac ~/Library/Caches/CSXS/cep_cache, Windows %TEMP%/cep_cache.
 * Le cartelle di Motion Tools (nome con l'ID dell'estensione) si cancellano, cosi' alla prossima
 * apertura After Effects legge i file nuovi.
 */
function mt_removeTree(f) {
    if (f instanceof Folder) { var list = f.getFiles(); for (var i = 0; i < list.length; i++) mt_removeTree(list[i]); }
    try { f.remove(); } catch (e) {}
}
function mt_clearCepCache() {
    var n = 0, roots = [];
    try { roots.push(new Folder("~/Library/Caches/CSXS/cep_cache")); } catch (e0) {}
    try { roots.push(new Folder(Folder.temp.fsName + "/cep_cache")); } catch (e1) {}
    for (var r = 0; r < roots.length; r++) {
        if (!roots[r].exists) continue;
        var kids = roots[r].getFiles();
        for (var i = 0; i < kids.length; i++) {
            if (kids[i] instanceof Folder && decodeURI(kids[i].name).indexOf("tools.inflect.panel") >= 0) { mt_removeTree(kids[i]); n++; }
        }
    }
    return n;
}
/* ================================================================ note == */
/*
 * Le note sono marcatori di After Effects (della composizione o di un layer) con il testo,
 * la firma di chi le ha scritte e lo stato "fatta". Restano nel file .aep: chi apre il
 * progetto le vede anche senza Motion Tools, nel commento del marcatore.
 */
function mt_noteProp(comp, layerId) {
    if (!layerId) return comp.markerProperty;
    for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).id === layerId) return comp.layer(i).property("ADBE Marker");
    return null;
}

function mt_noteComment(text, author, done) {
    return (done ? "✓ " : "") + (author ? author + ": " : "") + text;
}

function mt_noteRead(mv) {
    var P = {};
    try { P = mv.getParameters() || {}; } catch (e) {}
    var isMT = P.mt_note === "1";
    var text = isMT && P.mt_text !== undefined ? String(P.mt_text) : String(mv.comment || "");
    return { text: text, author: isMT ? String(P.mt_author || "") : "", done: isMT && P.mt_done === "1", date: isMT ? String(P.mt_date || "") : "", mt: isMT };
}

function mt_noteCollect(comp, out) {
    var props = [{ p: comp.markerProperty, layer: null }];
    for (var l = 1; l <= comp.numLayers; l++) props.push({ p: comp.layer(l).property("ADBE Marker"), layer: comp.layer(l) });
    for (var i = 0; i < props.length; i++) {
        var M = props[i].p;
        if (!M) continue;
        for (var k = 1; k <= M.numKeys; k++) {
            var mv = M.keyValue(k), n = mt_noteRead(mv);
            if (!n.text && !n.mt) continue;
            if (mt_markerParams(mv).mt_sync === "1") continue; // marcatori collegati: hanno la loro sezione
            if (!n.mt && String(mv.comment).indexOf("MT_") === 0) continue; // marcatori interni del Cloner
            out.push({ comp: comp.name, compId: comp.id, fps: 1 / comp.frameDuration, layer: props[i].layer ? props[i].layer.name : "", layerId: props[i].layer ? props[i].layer.id : 0, time: M.keyTime(k), text: n.text, author: n.author, done: n.done, date: n.date, mt: n.mt });
        }
    }
}

function inflect_notesList(scope) {
    try {
        var out = [], comp = inflect_activeComp();
        if (scope === "project") {
            for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem) mt_noteCollect(it, out); }
        } else if (comp) mt_noteCollect(comp, out);
        return inflect_ok({ notes: out, comp: comp ? comp.name : null, compId: comp ? comp.id : 0, time: comp ? comp.time : 0, fps: comp ? 1 / comp.frameDuration : 25 });
    } catch (e) { return inflect_err("Note non lette: " + e); }
}

function inflect_noteAdd(optsJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var o = inflect_parse(optsJSON);
    if (!o.text) return inflect_err("Scrivi il testo della nota.");
    var sel = comp.selectedLayers, M = (o.onLayer && sel.length) ? sel[0].property("ADBE Marker") : comp.markerProperty;
    var t = comp.time, n = 0;
    while (M.numKeys && Math.abs(M.keyTime(M.nearestKeyIndex(t)) - t) < 1e-4 && n++ < 50) t += comp.frameDuration;
    mt_begin("Motion Tools: nota");
    try {
        var mv = new MarkerValue(mt_noteComment(o.text, o.author, false));
        var d = new Date();
        mv.setParameters({ mt_note: "1", mt_text: o.text, mt_author: o.author || "", mt_done: "0", mt_date: d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() });
        try { mv.label = 11; } catch (eL) {}
        M.setValueAtTime(t, mv);
        mt_end();
        return inflect_ok({ time: t, layer: (o.onLayer && sel.length) ? sel[0].name : "" });
    } catch (e) { mt_end(); return inflect_err("Nota non aggiunta: " + e.toString()); }
}

function mt_noteFind(ref) {
    var comp = app.project.itemByID(ref.compId);
    if (!comp) return null;
    var M = mt_noteProp(comp, ref.layerId);
    if (!M || !M.numKeys) return null;
    var k = M.nearestKeyIndex(ref.time);
    if (Math.abs(M.keyTime(k) - ref.time) > 1e-3) return null;
    return { comp: comp, M: M, k: k };
}

/** ch: { done, text } per modificare, { remove: true } per togliere. */
function inflect_noteSet(refJSON, chJSON) {
    var ref = inflect_parse(refJSON), ch = inflect_parse(chJSON), F = mt_noteFind(ref);
    if (!F) return inflect_err("La nota non c'è più: forse il marcatore è stato spostato.");
    mt_begin(ch.remove ? "Motion Tools: togli nota" : "Motion Tools: modifica nota");
    try {
        if (ch.remove) { F.M.removeKey(F.k); mt_end(); return inflect_ok({}); }
        var mv = F.M.keyValue(F.k), n = mt_noteRead(mv), P = {};
        try { P = mv.getParameters() || {}; } catch (e0) {}
        var text = ch.text !== undefined ? ch.text : n.text, done = ch.done !== undefined ? !!ch.done : n.done;
        var author = n.mt ? n.author : (ch.author || "");
        var nv = new MarkerValue(mt_noteComment(text, author, done));
        try { nv.duration = mv.duration; nv.chapter = mv.chapter; nv.url = mv.url; } catch (e1) {}
        P.mt_note = "1"; P.mt_text = text; P.mt_author = author; P.mt_done = done ? "1" : "0";
        if (!P.mt_date) { var d = new Date(); P.mt_date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
        nv.setParameters(P);
        try { nv.label = done ? 9 : 11; } catch (eL) {}
        F.M.setValueAtKey(F.k, nv);
        mt_end();
        return inflect_ok({});
    } catch (e) { mt_end(); return inflect_err("Nota non modificata: " + e.toString()); }
}

function inflect_noteGo(refJSON) {
    var ref = inflect_parse(refJSON);
    try {
        var comp = app.project.itemByID(ref.compId);
        if (!comp) return inflect_err("La composizione non c'è più.");
        try { comp.openInViewer(); } catch (e0) {}
        comp.time = ref.time;
        if (ref.layerId) for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = comp.layer(i).id === ref.layerId;
        return inflect_ok({});
    } catch (e) { return inflect_err(e.toString()); }
}

/* ================================================ marcatori collegati == */
/*
 * Un marcatore messo nella composizione principale viene copiato in tutte le composizioni
 * collegate (precomposizioni dentro, composizioni che la contengono), nello stesso istante
 * del video anche se i layer sono sfasati. La principale e' segnata nel suo commento ("MT_MAIN").
 */
function mt_mainComp() {
    // Prima quella gia' trovata (senza scorrere tutto il progetto), poi la ricerca completa.
    var id = $.global.MT_MAINID;
    if (id) {
        try {
            var c = app.project.itemByID(id);
            if (c && (c instanceof CompItem) && String(c.comment).indexOf("MT_MAIN") >= 0) return c;
        } catch (e) {}
    }
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if ((it instanceof CompItem) && String(it.comment).indexOf("MT_MAIN") >= 0) { $.global.MT_MAINID = it.id; return it; }
    }
    $.global.MT_MAINID = 0;
    return null;
}

function mt_markerParams(mv) { try { return mv.getParameters() || {}; } catch (e) { return {}; } }

function inflect_mainGet() {
    var m = mt_mainComp(), c = inflect_activeComp();
    return inflect_ok({ main: m ? { id: m.id, name: m.name } : null, active: c ? { id: c.id, name: c.name } : null, masters: m ? mt_masters(m) : [], fps: m ? 1 / m.frameDuration : 25 });
}

function inflect_mainSet() {
    var c = inflect_activeComp();
    if (!c) return inflect_err("Apri la composizione da usare come principale.");
    mt_begin("Motion Tools: composizione principale");
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if ((it instanceof CompItem) && String(it.comment).indexOf("MT_MAIN") >= 0) it.comment = String(it.comment).replace(/\s*MT_MAIN/g, "");
    }
    c.comment = (String(c.comment || "") + " MT_MAIN").replace(/^\s+/, "");
    mt_end();
    return inflect_mainGet();
}

function mt_masters(main) {
    var M = main.markerProperty, out = [];
    for (var k = 1; k <= M.numKeys; k++) {
        var P = mt_markerParams(M.keyValue(k));
        if (P.mt_sync === "1" && P.mt_master === "1") out.push({ id: P.mt_id, text: String(P.mt_text || M.keyValue(k).comment), author: String(P.mt_author || ""), time: M.keyTime(k) });
    }
    return out;
}

/* Toglie le copie (una o tutte) da tutte le composizioni tranne la principale. */
function mt_syncClear(main, id) {
    var n = 0;
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!(it instanceof CompItem) || it.id === main.id) continue;
        var M = it.markerProperty;
        for (var k = M.numKeys; k >= 1; k--) {
            var P = mt_markerParams(M.keyValue(k));
            if (P.mt_sync === "1" && P.mt_master !== "1" && (!id || P.mt_id === id)) { M.removeKey(k); n++; }
        }
    }
    return n;
}

/* Copia un marcatore principale in tutte le composizioni collegate. */
function mt_syncPropagate(main, m, report) {
    for (var i = 1; i <= app.project.numItems; i++) {
        var C = app.project.item(i);
        if (!(C instanceof CompItem) || C.id === main.id) continue;
        var r = mt_mapTime(main.id, m.time, C.id);
        if (!r || !r.strict) continue;
        var t = inflect_frameRound(C, r.t);
        if (t < -1e-6 || t > C.duration + 1e-6) continue;
        var M = C.markerProperty;
        if (M.numKeys) {
            var j = M.nearestKeyIndex(t);
            if (Math.abs(M.keyTime(j) - t) < 1e-4) {
                var P0 = mt_markerParams(M.keyValue(j));
                if (P0.mt_sync !== "1") { report.skipped.push(C.name); continue; }
            }
        }
        var mv = new MarkerValue(m.text);
        mv.setParameters({ mt_sync: "1", mt_master: "0", mt_id: m.id, mt_text: m.text, mt_author: m.author || "" });
        try { mv.label = 13; } catch (eL) {}
        M.setValueAtTime(t, mv);
        report.copies++;
        if (report.comps.join("|").indexOf(C.name) < 0) report.comps.push(C.name);
    }
}

function inflect_syncAdd(optsJSON) {
    var main = mt_mainComp();
    if (!main) return inflect_err("Prima scegli la composizione principale.");
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var o = inflect_parse(optsJSON);
    if (!o.text) return inflect_err("Scrivi il testo del marcatore.");
    var t = comp.time;
    if (comp.id !== main.id) {
        var r = mt_mapTime(comp.id, t, main.id);
        if (!r) return inflect_err(comp.name + " non è collegata alla principale " + main.name + ".");
        t = inflect_frameRound(main, r.t);
    }
    var Mm = main.markerProperty;
    if (Mm.numKeys && Math.abs(Mm.keyTime(Mm.nearestKeyIndex(t)) - t) < 1e-4) {
        var P0 = mt_markerParams(Mm.keyValue(Mm.nearestKeyIndex(t)));
        if (P0.mt_master !== "1") return inflect_err("In " + main.name + " c'è già un marcatore in quel momento.");
    }
    var m = { id: "s" + new Date().getTime() + Math.floor(Math.random() * 1000), text: o.text, author: o.author || "", time: t };
    var report = { copies: 0, comps: [], skipped: [] };
    mt_begin("Motion Tools: marcatore collegato");
    try {
        var mv = new MarkerValue(m.text);
        mv.setParameters({ mt_sync: "1", mt_master: "1", mt_id: m.id, mt_text: m.text, mt_author: m.author });
        try { mv.label = 13; } catch (eL) {}
        Mm.setValueAtTime(t, mv);
        mt_syncPropagate(main, m, report);
        mt_end();
        report.time = t; report.main = main.name; report.fps = 1 / main.frameDuration;
        return inflect_ok(report);
    } catch (e) { mt_end(); return inflect_err("Marcatore non creato: " + e.toString()); }
}

/** Rifa' tutte le copie: serve dopo aver spostato o accorciato i layer delle precomposizioni. */
function inflect_syncAll() {
    var main = mt_mainComp();
    if (!main) return inflect_err("Prima scegli la composizione principale.");
    var masters = mt_masters(main), report = { copies: 0, comps: [], skipped: [], removed: 0 };
    mt_begin("Motion Tools: aggiorna marcatori collegati");
    try {
        report.removed = mt_syncClear(main, null);
        for (var i = 0; i < masters.length; i++) mt_syncPropagate(main, masters[i], report);
        mt_end();
        report.masters = masters.length;
        return inflect_ok(report);
    } catch (e) { mt_end(); return inflect_err("Aggiornamento non riuscito: " + e.toString()); }
}

function inflect_syncRemove(id) {
    var main = mt_mainComp();
    if (!main) return inflect_err("Nessuna composizione principale.");
    mt_begin("Motion Tools: togli marcatore collegato");
    try {
        var M = main.markerProperty;
        for (var k = M.numKeys; k >= 1; k--) { var P = mt_markerParams(M.keyValue(k)); if (P.mt_sync === "1" && P.mt_id === id) M.removeKey(k); }
        var n = mt_syncClear(main, id);
        mt_end();
        return inflect_ok({ removed: n });
    } catch (e) { mt_end(); return inflect_err(e.toString()); }
}

function inflect_syncGo(id) {
    var main = mt_mainComp();
    if (!main) return inflect_err("Nessuna composizione principale.");
    var comp = inflect_activeComp(), ms = mt_masters(main);
    for (var i = 0; i < ms.length; i++) {
        if (ms[i].id !== id) continue;
        try {
            if (comp && comp.id !== main.id) {
                var r = mt_mapTime(main.id, ms[i].time, comp.id);
                if (r) { comp.time = Math.max(0, Math.min(comp.duration, inflect_frameRound(comp, r.t))); return inflect_ok({ comp: comp.name }); }
            }
            try { main.openInViewer(); } catch (e0) {}
            main.time = ms[i].time;
            return inflect_ok({ comp: main.name });
        } catch (e) { return inflect_err(e.toString()); }
    }
    return inflect_err("Marcatore non trovato.");
}

/*
 * Controllo leggero e frequente: se nella principale (anche dentro precomposizioni di
 * precomposizioni) compare una composizione nuova, riceve i marcatori collegati che le mancano.
 * Non tocca quelli gia' presenti e non crea passaggi di annullamento se non c'e' nulla da fare.
 */
function inflect_syncAuto() {
    try {
        var main = mt_mainComp();
        if (!main) return inflect_ok({ added: 0 });
        var E = mt_compEdges(), seen = {}, Q = [main.id], ids = [];
        seen[main.id] = true;
        while (Q.length) {
            var cur = Q.shift();
            for (var k = 0; k < E.length; k++) {
                var nx = E[k].p === cur ? E[k].c : (E[k].c === cur ? E[k].p : null);
                if (nx === null || seen[nx]) continue;
                seen[nx] = true; Q.push(nx); ids.push(nx);
            }
        }
        ids.sort(inflect_sortNum);
        var masters = mt_masters(main);
        var sig = main.id + ":" + ids.join(",") + ":" + masters.length;
        if ($.global.MT_SYNCSIG === sig) return inflect_ok({ added: 0 });
        $.global.MT_SYNCSIG = sig;
        if (!masters.length) return inflect_ok({ added: 0 });
        // Cosa manca, prima di toccare il progetto.
        var todo = [];
        for (var i = 0; i < ids.length; i++) {
            var C = app.project.itemByID(ids[i]);
            if (!C || !(C instanceof CompItem)) continue;
            var have = {}, M = C.markerProperty;
            for (var j = 1; j <= M.numKeys; j++) { var P = mt_markerParams(M.keyValue(j)); if (P.mt_sync === "1") have[P.mt_id] = true; }
            for (var m = 0; m < masters.length; m++) if (!have[masters[m].id]) todo.push({ C: C, m: masters[m] });
        }
        if (!todo.length) return inflect_ok({ added: 0 });
        var report = { copies: 0, comps: [], skipped: [] };
        var opened = false;
        for (var t = 0; t < todo.length; t++) {
            var it = todo[t], r = mt_mapTime(main.id, it.m.time, it.C.id);
            if (!r || !r.strict) continue;
            var tt = inflect_frameRound(it.C, r.t);
            if (tt < -1e-6 || tt > it.C.duration + 1e-6) continue;
            var MM = it.C.markerProperty;
            if (MM.numKeys && Math.abs(MM.keyTime(MM.nearestKeyIndex(tt)) - tt) < 1e-4) { report.skipped.push(it.C.name); continue; }
            if (!opened) { mt_begin("Motion Tools: marcatori collegati nelle composizioni nuove"); opened = true; }
            var mv = new MarkerValue(it.m.text);
            mv.setParameters({ mt_sync: "1", mt_master: "0", mt_id: it.m.id, mt_text: it.m.text, mt_author: it.m.author || "" });
            try { mv.label = 13; } catch (eL) {}
            MM.setValueAtTime(tt, mv);
            report.copies++;
            if (report.comps.join("|").indexOf(it.C.name) < 0) report.comps.push(it.C.name);
        }
        if (opened) mt_end();
        report.added = report.copies;
        return inflect_ok(report);
    } catch (e) { return inflect_err(e.toString()); }
}
/* ============================================================ cartelle == */
/*
 * Sposta nella cartella nuova gli elementi usati dalla comp attiva (comp, filmati, immagini,
 * anche dentro le precomp) che si trovano ancora nella cartella vecchia. Non cancella nulla.
 */

function mt_folderByName(name) {
    var n = app.project.numItems;
    for (var i = 1; i <= n; i++) {
        var it = app.project.item(i);
        if (it && it instanceof FolderItem && it.name === name) return it;
    }
    return null;
}

// Vero se l'elemento sta dentro la cartella (anche in una sottocartella). Confronto per nome e id.
function mt_inFolder(item, folder) {
    var p = null, guard = 0;
    try { p = item.parentFolder; } catch (e) { return false; }
    while (p && guard++ < 50) {
        if (p.id === folder.id) return true;
        var up = null;
        try { up = p.parentFolder; } catch (e2) { up = null; }
        if (!up || up.id === p.id) break;
        p = up;
    }
    return false;
}

function inflect_consolidate(oldName, newName) {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_err("Apri la comp che usa gli elementi.");
        var oldF = mt_folderByName(oldName), newF = mt_folderByName(newName);
        if (!oldF) return inflect_err("Non trovo la cartella vecchia: " + oldName + ".");
        if (!newF) return inflect_err("Non trovo la cartella nuova: " + newName + ".");

        // Elementi usati dalla comp, anche dentro le precomp. Senza ricorsione: una lista da svuotare.
        var seen = {}, list = [], todo = [{ c: comp, d: 0 }];
        while (todo.length) {
            var cur = todo.shift();
            var nl = 0;
            try { nl = cur.c.numLayers; } catch (e0) { nl = 0; }
            for (var l = 1; l <= nl; l++) {
                var src = null;
                try { src = cur.c.layer(l).source; } catch (e1) { src = null; }
                if (!src) continue;
                var key = String(src.id);
                if (seen[key]) continue;
                seen[key] = true;
                list.push(src);
                var sub = 0;
                try { sub = src.numLayers || 0; } catch (e2) { sub = 0; }
                if (sub > 0 && cur.d < 8) todo.push({ c: src, d: cur.d + 1 });
            }
        }

        var moved = [], skipped = [];
        // Niente try/finally: nel motore di After Effects puo' far perdere il risultato.
        mt_begin("Motion Tools: sposta elementi in " + newName);
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (!mt_inFolder(it, oldF)) continue;
            try { it.parentFolder = newF; moved.push(String(it.name)); }
            catch (e3) { skipped.push(String(it.name) + ": " + e3); }
        }
        mt_end();
        return inflect_ok({ moved: moved.length, names: moved.slice(0, 6), skipped: skipped, used: list.length });
    } catch (e) {
        try { mt_end(); } catch (eE) {}
        return inflect_err("Spostamento non riuscito: " + e + (e && e.line ? " (riga " + e.line + ")" : ""));
    }
}
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
/* ----------------------------------------------------- input: stile -- */
/*
 * Ogni input ha la sua scala e, se e' un vettoriale (livello forma o testo), il suo colore.
 * I valori stanno sul controllo come "I<n> Scala", "I<n> Colora", "I<n> Colore": si animano
 * come gli altri parametri. Ogni copia sa da quale input viene grazie all'effetto "MT Input".
 */

var MT_IPARAMS = [
    ["Scala", "sl", 100],
    ["Colora", "cb", 0],
    ["Colore", "cl", [1, 1, 1, 1]]
];

/* Colore dell'input sulla copia: un Riempimento che si accende con "Colora". */
MT_X.icolor = [
    'var C = thisComp.layer(@C@), si = 0, c = [1, 1, 1, 1];',
    'try { si = Math.round(effect("MT Input")(1).value); } catch (e0) { si = 0; }',
    'try { c = C.effect("I" + (si + 1) + " Colore")(1).value; } catch (e1) {}',
    'c'
];
MT_X.ion = [
    'var C = thisComp.layer(@C@), si = 0, on = 0;',
    'try { si = Math.round(effect("MT Input")(1).value); } catch (e0) { si = 0; }',
    'try { on = C.effect("I" + (si + 1) + " Colora")(1).value; } catch (e1) { on = 0; }',
    'on ? value : 0'
];

function mt_isVector(L) {
    try { return L instanceof ShapeLayer || L instanceof TextLayer; } catch (e) { return false; }
}

/* Valori degli input 1..n (quelli che mancano hanno i valori di partenza). */
function mt_inputGet(ctrl, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
        var o = {};
        for (var j = 0; j < MT_IPARAMS.length; j++) {
            var v = mt_get(ctrl, "I" + (i + 1) + " " + MT_IPARAMS[j][0]);
            o[MT_IPARAMS[j][0]] = (v === null || v === undefined) ? MT_IPARAMS[j][2] : v;
        }
        out.push(o);
    }
    return out;
}

/* Scrive i valori degli input e toglie i controlli degli input che non ci sono piu'. */
function mt_inputWrite(ctrl, arr) {
    var t = ctrl.containingComp.time, i, j;
    for (i = 0; i < arr.length; i++) {
        for (j = 0; j < MT_IPARAMS.length; j++) {
            var P = MT_IPARAMS[j], name = "I" + (i + 1) + " " + P[0];
            if (!mt_fxProp(ctrl, name)) mt_fx(ctrl, P[1], name, arr[i][P[0]]);
            else mt_set(ctrl, name, arr[i][P[0]], t);
        }
    }
    var parade = ctrl.property("ADBE Effect Parade");
    for (i = arr.length + 1; i <= arr.length + 50; i++) {
        var gone = false;
        for (j = 0; j < MT_IPARAMS.length; j++) {
            var fx = parade.property("I" + i + " " + MT_IPARAMS[j][0]);
            if (fx) { fx.remove(); gone = true; }
        }
        if (!gone) break;
    }
}

/* Effetti dell'input sulla copia: da quale input viene e, per i vettoriali, il colore. */
function mt_cloneInput(c, cn, sIdx, vector) {
    var p = mt_fxProp(c, "MT Input");
    if (!p) p = mt_fx(c, "sl", "MT Input", sIdx);
    else p.setValue(sIdx);
    if (!vector) return;
    var parade = c.property("ADBE Effect Parade");
    if (!parade.property("MT Colore input")) {
        parade.addProperty("ADBE Fill").name = "MT Colore input";
        var F = c.property("ADBE Effect Parade").property("MT Colore input");
        F.property("ADBE Fill-0002").expression = mt_expr("icolor", cn);
        try { F.property("ADBE Effect Built In Params").property("ADBE Effect Mask Opacity").expression = mt_expr("ion", cn); } catch (eO) {}
        // Prima del colore del falloff, cosi' il falloff ci passa sopra.
        var ff = c.property("ADBE Effect Parade").property("MT Colore falloff");
        if (ff) { try { c.property("ADBE Effect Parade").property("MT Colore input").moveTo(ff.propertyIndex); } catch (eM) {} }
    }
}

function mt_srcIsVector(meta, s) {
    try { return mt_isVector(mt_layerById(meta.src[s])); } catch (e) { return false; }
}

/* Versione 6: scala e colore per input. */
function mt_upgradeV6(ctrl) {
    var meta = mt_meta(ctrl);
    if (meta.ver >= 6) return;
    var comp = ctrl.containingComp, cl = mt_clones(comp, ctrl), cn = ctrl.name;
    mt_inputWrite(ctrl, mt_inputGet(ctrl, Math.max(1, meta.src.length)));
    for (var i = 0; i < cl.length; i++) {
        try {
            mt_cloneInput(cl[i].layer, cn, cl[i].s, mt_srcIsVector(meta, cl[i].s));
            cl[i].layer.property("ADBE Transform Group").property("ADBE Scale").expression = mt_expr("scale", cn);
        } catch (eC) {}
    }
    meta.ver = 6;
    mt_writeMeta(ctrl, meta);
}

/*
 * Selettore di colore di After Effects. $.colorPicker (ExtendScript Tools Guide) apre il selettore
 * del sistema e restituisce il colore come 0xRRGGBB, oppure -1 se annulli.
 */
function inflect_pickColor(hex) {
    try {
        var start = parseInt(String(hex || "#FFFFFF").replace("#", ""), 16);
        if (isNaN(start)) start = 0xFFFFFF;
        var c = $.colorPicker(start);
        if (c === -1 || c === undefined || c === null) return inflect_ok({ cancelled: true });
        var s = (c & 0xFFFFFF).toString(16).toUpperCase();
        while (s.length < 6) s = "0" + s;
        return inflect_ok({ hex: "#" + s });
    } catch (e) { return inflect_err("Selettore di colore non disponibile: " + e); }
}
/* ---------------------------------------------------- orientamento -- */
/*
 * Orientation dei layer 3D: After Effects la interpola come una rotazione nello spazio, lungo l'arco
 * piu' corto tra un keyframe e l'altro, non numero per numero come una posizione. Qui si lavora con i
 * quaternioni: il keyframe al 10% della curva sta al 10% dell'arco (oltre il 100% per un rimbalzo) e
 * la velocita' e' l'angolo dell'arco in gradi al secondo.
 * L'ordine degli assi con cui After Effects legge i tre angoli si ricava da After Effects stesso
 * (mt_orientOrder), cosi' non dipende da una convenzione indovinata.
 */

var MT_ORDERS = ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"];

function mt_qMul(a, b) {
    return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
            a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
            a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
            a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
}
function mt_qConj(a) { return [a[0], -a[1], -a[2], -a[3]]; }
function mt_qAxis(ax, deg) {
    var h = deg * Math.PI / 360, s = Math.sin(h), q = [Math.cos(h), 0, 0, 0];
    q[1 + ax] = s;
    return q;
}
/* Angoli [x, y, z] in gradi -> quaternione, componendo gli assi nell'ordine dato (es. "XYZ" = Rx*Ry*Rz). */
function mt_qFromEuler(e, order) {
    var q = [1, 0, 0, 0];
    for (var i = 0; i < 3; i++) {
        var ax = "XYZ".indexOf(order.charAt(i));
        q = mt_qMul(q, mt_qAxis(ax, e[ax]));
    }
    return q;
}
function mt_qToMat(q) {
    var w = q[0], x = q[1], y = q[2], z = q[3];
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
            [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
            [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];
}
/* Quaternione -> angoli [x, y, z] in gradi per l'ordine dato (Tait-Bryan, R = Ra * Rb * Rc). */
function mt_qToEuler(q, order) {
    var R = mt_qToMat(q);
    var i = "XYZ".indexOf(order.charAt(0)), j = "XYZ".indexOf(order.charAt(1)), k = "XYZ".indexOf(order.charAt(2));
    var cyc = (j === (i + 1) % 3);
    var s = cyc ? 1 : -1;
    var sb = Math.max(-1, Math.min(1, s * R[i][k]));
    var b = Math.asin(sb), a, c;
    if (Math.abs(sb) < 0.999999) {
        a = Math.atan2(-s * R[j][k], R[k][k]);
        c = Math.atan2(-s * R[i][j], R[i][i]);
    } else {
        // Blocco cardanico: un solo angolo conta, l'altro si mette a zero.
        a = Math.atan2(s * R[k][j], R[j][j]);
        c = 0;
    }
    var out = [0, 0, 0], d = 180 / Math.PI;
    out[i] = a * d; out[j] = b * d; out[k] = c * d;
    for (var n = 0; n < 3; n++) { out[n] = out[n] % 360; if (out[n] < 0) out[n] += 360; }
    return out;
}
function mt_qDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }
/* Rotazione relativa da a a b, sul lato corto: [angolo in gradi, asse]. */
function mt_qRel(a, b) {
    var r = mt_qMul(mt_qConj(a), b);
    if (r[0] < 0) r = [-r[0], -r[1], -r[2], -r[3]];
    var w = Math.max(-1, Math.min(1, r[0])), ang = 2 * Math.acos(w) * 180 / Math.PI, sn = Math.sqrt(Math.max(0, 1 - w * w));
    var axis = sn > 1e-9 ? [r[1] / sn, r[2] / sn, r[3] / sn] : [1, 0, 0];
    return { angle: ang, axis: axis };
}
/* Punto f lungo l'arco da a a b (f puo' uscire da 0..1). */
function mt_qAlong(a, b, f) {
    var R = mt_qRel(a, b), h = R.angle * f * Math.PI / 360, s = Math.sin(h);
    return mt_qMul(a, [Math.cos(h), R.axis[0] * s, R.axis[1] * s, R.axis[2] * s]);
}
/* Frazione dell'arco da a a b percorsa in q, con il segno (negativa se torna indietro). */
function mt_qFraction(a, b, q, hint) {
    var R = mt_qRel(a, b);
    if (R.angle < 1e-9) return 0;
    var r = mt_qMul(mt_qConj(a), q);
    var proj = r[1] * R.axis[0] + r[2] * R.axis[1] + r[3] * R.axis[2];
    // angolo con segno attorno all'asse dell'arco
    var ang = 2 * Math.atan2(proj, r[0]) * 180 / Math.PI;
    if (ang > 180) ang -= 360; else if (ang < -180) ang += 360;
    // Oltre mezzo giro l'angolo e' ambiguo: si sceglie il giro piu' vicino al valore atteso.
    if (hint !== undefined && hint !== null) {
        var want = hint * R.angle;
        while (ang - want > 180) ang -= 360;
        while (want - ang > 180) ang += 360;
    }
    return ang / R.angle;
}

function mt_isOrientation(prop) {
    try { return prop.matchName === "ADBE Orientation"; } catch (e) { return false; }
}

/*
 * Ordine degli assi usato da After Effects: tra i keyframe a e a+1, messi per un momento in lineare,
 * After Effects calcola il punto a meta' dell'arco. L'ordine giusto e' quello per cui la meta' calcolata
 * qui coincide con quella di After Effects. Le interpolazioni dei due keyframe tornano com'erano.
 */
function mt_orientOrder(prop, a) {
    var A = prop.keyValue(a), B = prop.keyValue(a + 1), t0 = prop.keyTime(a), t1 = prop.keyTime(a + 1);
    var inA = prop.keyInInterpolationType(a), outA = prop.keyOutInterpolationType(a);
    var inB = prop.keyInInterpolationType(a + 1), outB = prop.keyOutInterpolationType(a + 1);
    var eA = [prop.keyInTemporalEase(a), prop.keyOutTemporalEase(a)], eB = [prop.keyInTemporalEase(a + 1), prop.keyOutTemporalEase(a + 1)];
    var samples = [];
    try {
        prop.setInterpolationTypeAtKey(a, inA, KeyframeInterpolationType.LINEAR);
        prop.setInterpolationTypeAtKey(a + 1, KeyframeInterpolationType.LINEAR, outB);
        samples.push({ f: 0.5, v: prop.valueAtTime(t0 + 0.5 * (t1 - t0), true) });
        samples.push({ f: 0.25, v: prop.valueAtTime(t0 + 0.25 * (t1 - t0), true) });
    } catch (e) {}
    try {
        prop.setInterpolationTypeAtKey(a, inA, outA);
        prop.setInterpolationTypeAtKey(a + 1, inB, outB);
        prop.setTemporalEaseAtKey(a, eA[0], eA[1]);
        prop.setTemporalEaseAtKey(a + 1, eB[0], eB[1]);
    } catch (e2) {}
    var best = null, bestErr = 1e9;
    for (var o = 0; o < MT_ORDERS.length; o++) {
        var ord = MT_ORDERS[o], qa = mt_qFromEuler(A, ord), qb = mt_qFromEuler(B, ord), err = 0;
        for (var s = 0; s < samples.length; s++) {
            var want = mt_qAlong(qa, qb, samples[s].f), got = mt_qFromEuler(samples[s].v, ord);
            err += 1 - Math.abs(mt_qDot(want, got));
        }
        if (err < bestErr) { bestErr = err; best = ord; }
    }
    $.global.MT_ORIENT_ORDER = best;
    return { order: best || "XYZ", ok: samples.length > 0 && bestErr < 1e-4, err: bestErr };
}
/* ------------------------------------------------------- tracciati -- */
/*
 * Keyframe di tracciati (maschere e forme). Il valore non e' un numero ma un oggetto Shape: tra due
 * keyframe con gli stessi punti After Effects sposta ogni vertice e ogni maniglia in linea retta.
 * L'avanzamento si misura quindi proiettando tutti i numeri del tracciato sulla differenza tra il
 * primo e l'ultimo keyframe (0 all'inizio, 1 alla fine).
 * L'unita' della velocita' di un tracciato non e' documentata: si ricava da After Effects stesso,
 * misurando quanto avanza il tracciato subito dopo (o subito prima) il keyframe.
 */

function mt_isShapeProp(prop) {
    try { return prop.propertyValueType === PropertyValueType.SHAPE; } catch (e) { return false; }
}

function mt_shapeFlat(s) {
    var out = [], lists = [s.vertices, s.inTangents, s.outTangents];
    for (var l = 0; l < lists.length; l++) {
        var L = lists[l] || [];
        for (var i = 0; i < L.length; i++) { out.push(L[i][0]); out.push(L[i][1]); }
    }
    return out;
}

function mt_shapeCompat(a, b) {
    try { return a.vertices.length === b.vertices.length && a.vertices.length > 0; } catch (e) { return false; }
}

/* Tracciato a una frazione f tra a e b (f puo' uscire da 0..1: rimbalzi). */
function mt_shapeLerp(a, b, f) {
    var s = new Shape();
    var mix = function (A, B) { var o = []; for (var i = 0; i < A.length; i++) o.push([A[i][0] + (B[i][0] - A[i][0]) * f, A[i][1] + (B[i][1] - A[i][1]) * f]); return o; };
    s.vertices = mix(a.vertices, b.vertices);
    s.inTangents = mix(a.inTangents, b.inTangents);
    s.outTangents = mix(a.outTangents, b.outTangents);
    s.closed = a.closed;
    return s;
}

/* Misura dell'avanzamento tra due tracciati: funzione da Shape a numero (0 in a, 1 in b). */
function mt_shapeMeter(a, b) {
    var A = mt_shapeFlat(a), B = mt_shapeFlat(b), D = [], len2 = 0;
    for (var i = 0; i < A.length; i++) { D.push(B[i] - A[i]); len2 += (B[i] - A[i]) * (B[i] - A[i]); }
    if (len2 < 1e-12) return null;
    return function (s) {
        var F = mt_shapeFlat(s), d = 0;
        if (F.length !== A.length) return NaN;
        for (var j = 0; j < F.length; j++) d += (F[j] - A[j]) * D[j];
        return d / len2;
    };
}

/* Pendenza normalizzata (avanzamento per tempo normalizzato) appena dopo (side 1) o prima (side -1) del keyframe k. */
function mt_shapeSlope(prop, k, meter, T, side) {
    var tk = prop.keyTime(k), nb = prop.keyTime(k + side), h = Math.abs(nb - tk) * 0.0001;
    var p0 = meter(prop.valueAtTime(tk, true)), p1 = meter(prop.valueAtTime(tk + side * h, true));
    return side * (p1 - p0) / (h / T);
}

/*
 * Velocita' di un tracciato. Su un lato del keyframe si mette per un momento la velocita' 1 e si misura
 * quanto avanza il tracciato: il rapporto tra la pendenza voluta e quella misurata e' la velocita' da usare.
 */
function mt_shapeSetSpeeds(prop, a, used, pts, T, meter) {
    for (var u = 0; u < used.length; u++) {
        var k = a + u, pt = pts[used[u].pi];
        var sides = [];
        if (u > 0) sides.push(-1);
        if (u < used.length - 1) sides.push(1);
        for (var s = 0; s < sides.length; s++) {
            var side = sides[s], want = side < 0 ? pt.inSlope : pt.outSlope;
            var ei = prop.keyInTemporalEase(k), eo = prop.keyOutTemporalEase(k);
            var probe = function (speed) {
                var i2 = [], o2 = [], n;
                for (n = 0; n < ei.length; n++) i2.push(new KeyframeEase(side < 0 ? speed : ei[n].speed, ei[n].influence));
                for (n = 0; n < eo.length; n++) o2.push(new KeyframeEase(side > 0 ? speed : eo[n].speed, eo[n].influence));
                prop.setTemporalEaseAtKey(k, i2, o2);
            };
            try {
                // Due misure (velocita' 0 e 100) danno la retta pendenza/velocita'; una terza la corregge.
                probe(0); var g0 = mt_shapeSlope(prop, k, meter, T, side);
                probe(100); var g1 = mt_shapeSlope(prop, k, meter, T, side);
                var kk = (g1 - g0) / 100, speed = Math.abs(kk) > 1e-12 ? (want - g0) / kk : 0;
                if (!isFinite(speed)) speed = 0;
                if (speed < 0) speed = 0;
                probe(speed);
                var g2 = mt_shapeSlope(prop, k, meter, T, side);
                if (Math.abs(g2 - want) > 1e-3 && Math.abs(g2 - g1) > 1e-12 && Math.abs(speed - 100) > 1e-9) {
                    var s2 = speed + (want - g2) * (speed - 100) / (g2 - g1);
                    if (isFinite(s2) && s2 >= 0) probe(s2);
                }
            } catch (e) { try { probe(0); } catch (e2) {} }
        }
    }
}

/* Lettura dei keyframe di un tracciato in punti normalizzati, come per le proprieta' numeriche. */
function mt_readShape(prop, keys) {
    var first = keys[0], last = keys[keys.length - 1];
    var t0 = prop.keyTime(first), T = prop.keyTime(last) - t0;
    var a = prop.keyValue(first), b = prop.keyValue(last);
    if (!mt_shapeCompat(a, b)) return { error: "Il primo e l'ultimo keyframe del tracciato hanno un numero di punti diverso: non si può leggere la curva." };
    var meter = mt_shapeMeter(a, b);
    if (!meter) return { error: "Il primo e l'ultimo keyframe del tracciato sono uguali: non c'è una curva da leggere." };
    var points = [];
    for (var k = first; k <= last; k++) {
        var tn = (prop.keyTime(k) - t0) / T, vn = meter(prop.keyValue(k));
        if (isNaN(vn)) return { error: "Un keyframe del tracciato ha un numero di punti diverso dagli altri." };
        var ei = prop.keyInTemporalEase(k), eo = prop.keyOutTemporalEase(k);
        var segPrev = k > first ? tn - (prop.keyTime(k - 1) - t0) / T : 0;
        var segNext = k < last ? (prop.keyTime(k + 1) - t0) / T - tn : 0;
        var pt = { t: tn, v: vn, inSlope: 0, inHandleX: segPrev * ei[0].influence / 100, outSlope: 0, outHandleX: segNext * eo[0].influence / 100,
            inLinear: prop.keyInInterpolationType(k) !== KeyframeInterpolationType.BEZIER, outLinear: prop.keyOutInterpolationType(k) !== KeyframeInterpolationType.BEZIER };
        try { if (k > first) pt.inSlope = mt_shapeSlope(prop, k, meter, T, -1); } catch (e1) {}
        try { if (k < last) pt.outSlope = mt_shapeSlope(prop, k, meter, T, 1); } catch (e2) {}
        points.push(pt);
    }
    return { points: points, duration: T };
}
