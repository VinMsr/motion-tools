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

