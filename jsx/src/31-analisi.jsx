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

