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

