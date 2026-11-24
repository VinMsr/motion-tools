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

