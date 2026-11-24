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
