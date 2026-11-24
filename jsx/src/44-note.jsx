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

