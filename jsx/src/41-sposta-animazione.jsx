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


