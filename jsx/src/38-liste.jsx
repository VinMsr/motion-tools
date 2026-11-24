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

