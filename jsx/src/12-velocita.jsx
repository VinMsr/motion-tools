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

