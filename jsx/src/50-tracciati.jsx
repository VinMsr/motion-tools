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
