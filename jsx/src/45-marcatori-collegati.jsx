/* ================================================ marcatori collegati == */
/*
 * Un marcatore messo nella composizione principale viene copiato in tutte le composizioni
 * collegate (precomposizioni dentro, composizioni che la contengono), nello stesso istante
 * del video anche se i layer sono sfasati. La principale e' segnata nel suo commento ("MT_MAIN").
 */
function mt_mainComp() {
    // Prima quella gia' trovata (senza scorrere tutto il progetto), poi la ricerca completa.
    var id = $.global.MT_MAINID;
    if (id) {
        try {
            var c = app.project.itemByID(id);
            if (c && (c instanceof CompItem) && String(c.comment).indexOf("MT_MAIN") >= 0) return c;
        } catch (e) {}
    }
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if ((it instanceof CompItem) && String(it.comment).indexOf("MT_MAIN") >= 0) { $.global.MT_MAINID = it.id; return it; }
    }
    $.global.MT_MAINID = 0;
    return null;
}

function mt_markerParams(mv) { try { return mv.getParameters() || {}; } catch (e) { return {}; } }

function inflect_mainGet() {
    var m = mt_mainComp(), c = inflect_activeComp();
    return inflect_ok({ main: m ? { id: m.id, name: m.name } : null, active: c ? { id: c.id, name: c.name } : null, masters: m ? mt_masters(m) : [], fps: m ? 1 / m.frameDuration : 25 });
}

function inflect_mainSet() {
    var c = inflect_activeComp();
    if (!c) return inflect_err("Apri la composizione da usare come principale.");
    mt_begin("Motion Tools: composizione principale");
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if ((it instanceof CompItem) && String(it.comment).indexOf("MT_MAIN") >= 0) it.comment = String(it.comment).replace(/\s*MT_MAIN/g, "");
    }
    c.comment = (String(c.comment || "") + " MT_MAIN").replace(/^\s+/, "");
    mt_end();
    return inflect_mainGet();
}

function mt_masters(main) {
    var M = main.markerProperty, out = [];
    for (var k = 1; k <= M.numKeys; k++) {
        var P = mt_markerParams(M.keyValue(k));
        if (P.mt_sync === "1" && P.mt_master === "1") out.push({ id: P.mt_id, text: String(P.mt_text || M.keyValue(k).comment), author: String(P.mt_author || ""), time: M.keyTime(k) });
    }
    return out;
}

/* Toglie le copie (una o tutte) da tutte le composizioni tranne la principale. */
function mt_syncClear(main, id) {
    var n = 0;
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (!(it instanceof CompItem) || it.id === main.id) continue;
        var M = it.markerProperty;
        for (var k = M.numKeys; k >= 1; k--) {
            var P = mt_markerParams(M.keyValue(k));
            if (P.mt_sync === "1" && P.mt_master !== "1" && (!id || P.mt_id === id)) { M.removeKey(k); n++; }
        }
    }
    return n;
}

/* Copia un marcatore principale in tutte le composizioni collegate. */
function mt_syncPropagate(main, m, report) {
    for (var i = 1; i <= app.project.numItems; i++) {
        var C = app.project.item(i);
        if (!(C instanceof CompItem) || C.id === main.id) continue;
        var r = mt_mapTime(main.id, m.time, C.id);
        if (!r || !r.strict) continue;
        var t = inflect_frameRound(C, r.t);
        if (t < -1e-6 || t > C.duration + 1e-6) continue;
        var M = C.markerProperty;
        if (M.numKeys) {
            var j = M.nearestKeyIndex(t);
            if (Math.abs(M.keyTime(j) - t) < 1e-4) {
                var P0 = mt_markerParams(M.keyValue(j));
                if (P0.mt_sync !== "1") { report.skipped.push(C.name); continue; }
            }
        }
        var mv = new MarkerValue(m.text);
        mv.setParameters({ mt_sync: "1", mt_master: "0", mt_id: m.id, mt_text: m.text, mt_author: m.author || "" });
        try { mv.label = 13; } catch (eL) {}
        M.setValueAtTime(t, mv);
        report.copies++;
        if (report.comps.join("|").indexOf(C.name) < 0) report.comps.push(C.name);
    }
}

function inflect_syncAdd(optsJSON) {
    var main = mt_mainComp();
    if (!main) return inflect_err("Prima scegli la composizione principale.");
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var o = inflect_parse(optsJSON);
    if (!o.text) return inflect_err("Scrivi il testo del marcatore.");
    var t = comp.time;
    if (comp.id !== main.id) {
        var r = mt_mapTime(comp.id, t, main.id);
        if (!r) return inflect_err(comp.name + " non è collegata alla principale " + main.name + ".");
        t = inflect_frameRound(main, r.t);
    }
    var Mm = main.markerProperty;
    if (Mm.numKeys && Math.abs(Mm.keyTime(Mm.nearestKeyIndex(t)) - t) < 1e-4) {
        var P0 = mt_markerParams(Mm.keyValue(Mm.nearestKeyIndex(t)));
        if (P0.mt_master !== "1") return inflect_err("In " + main.name + " c'è già un marcatore in quel momento.");
    }
    var m = { id: "s" + new Date().getTime() + Math.floor(Math.random() * 1000), text: o.text, author: o.author || "", time: t };
    var report = { copies: 0, comps: [], skipped: [] };
    mt_begin("Motion Tools: marcatore collegato");
    try {
        var mv = new MarkerValue(m.text);
        mv.setParameters({ mt_sync: "1", mt_master: "1", mt_id: m.id, mt_text: m.text, mt_author: m.author });
        try { mv.label = 13; } catch (eL) {}
        Mm.setValueAtTime(t, mv);
        mt_syncPropagate(main, m, report);
        mt_end();
        report.time = t; report.main = main.name; report.fps = 1 / main.frameDuration;
        return inflect_ok(report);
    } catch (e) { mt_end(); return inflect_err("Marcatore non creato: " + e.toString()); }
}

/** Rifa' tutte le copie: serve dopo aver spostato o accorciato i layer delle precomposizioni. */
function inflect_syncAll() {
    var main = mt_mainComp();
    if (!main) return inflect_err("Prima scegli la composizione principale.");
    var masters = mt_masters(main), report = { copies: 0, comps: [], skipped: [], removed: 0 };
    mt_begin("Motion Tools: aggiorna marcatori collegati");
    try {
        report.removed = mt_syncClear(main, null);
        for (var i = 0; i < masters.length; i++) mt_syncPropagate(main, masters[i], report);
        mt_end();
        report.masters = masters.length;
        return inflect_ok(report);
    } catch (e) { mt_end(); return inflect_err("Aggiornamento non riuscito: " + e.toString()); }
}

function inflect_syncRemove(id) {
    var main = mt_mainComp();
    if (!main) return inflect_err("Nessuna composizione principale.");
    mt_begin("Motion Tools: togli marcatore collegato");
    try {
        var M = main.markerProperty;
        for (var k = M.numKeys; k >= 1; k--) { var P = mt_markerParams(M.keyValue(k)); if (P.mt_sync === "1" && P.mt_id === id) M.removeKey(k); }
        var n = mt_syncClear(main, id);
        mt_end();
        return inflect_ok({ removed: n });
    } catch (e) { mt_end(); return inflect_err(e.toString()); }
}

function inflect_syncGo(id) {
    var main = mt_mainComp();
    if (!main) return inflect_err("Nessuna composizione principale.");
    var comp = inflect_activeComp(), ms = mt_masters(main);
    for (var i = 0; i < ms.length; i++) {
        if (ms[i].id !== id) continue;
        try {
            if (comp && comp.id !== main.id) {
                var r = mt_mapTime(main.id, ms[i].time, comp.id);
                if (r) { comp.time = Math.max(0, Math.min(comp.duration, inflect_frameRound(comp, r.t))); return inflect_ok({ comp: comp.name }); }
            }
            try { main.openInViewer(); } catch (e0) {}
            main.time = ms[i].time;
            return inflect_ok({ comp: main.name });
        } catch (e) { return inflect_err(e.toString()); }
    }
    return inflect_err("Marcatore non trovato.");
}

/*
 * Controllo leggero e frequente: se nella principale (anche dentro precomposizioni di
 * precomposizioni) compare una composizione nuova, riceve i marcatori collegati che le mancano.
 * Non tocca quelli gia' presenti e non crea passaggi di annullamento se non c'e' nulla da fare.
 */
function inflect_syncAuto() {
    try {
        var main = mt_mainComp();
        if (!main) return inflect_ok({ added: 0 });
        var E = mt_compEdges(), seen = {}, Q = [main.id], ids = [];
        seen[main.id] = true;
        while (Q.length) {
            var cur = Q.shift();
            for (var k = 0; k < E.length; k++) {
                var nx = E[k].p === cur ? E[k].c : (E[k].c === cur ? E[k].p : null);
                if (nx === null || seen[nx]) continue;
                seen[nx] = true; Q.push(nx); ids.push(nx);
            }
        }
        ids.sort(inflect_sortNum);
        var masters = mt_masters(main);
        var sig = main.id + ":" + ids.join(",") + ":" + masters.length;
        if ($.global.MT_SYNCSIG === sig) return inflect_ok({ added: 0 });
        $.global.MT_SYNCSIG = sig;
        if (!masters.length) return inflect_ok({ added: 0 });
        // Cosa manca, prima di toccare il progetto.
        var todo = [];
        for (var i = 0; i < ids.length; i++) {
            var C = app.project.itemByID(ids[i]);
            if (!C || !(C instanceof CompItem)) continue;
            var have = {}, M = C.markerProperty;
            for (var j = 1; j <= M.numKeys; j++) { var P = mt_markerParams(M.keyValue(j)); if (P.mt_sync === "1") have[P.mt_id] = true; }
            for (var m = 0; m < masters.length; m++) if (!have[masters[m].id]) todo.push({ C: C, m: masters[m] });
        }
        if (!todo.length) return inflect_ok({ added: 0 });
        var report = { copies: 0, comps: [], skipped: [] };
        var opened = false;
        for (var t = 0; t < todo.length; t++) {
            var it = todo[t], r = mt_mapTime(main.id, it.m.time, it.C.id);
            if (!r || !r.strict) continue;
            var tt = inflect_frameRound(it.C, r.t);
            if (tt < -1e-6 || tt > it.C.duration + 1e-6) continue;
            var MM = it.C.markerProperty;
            if (MM.numKeys && Math.abs(MM.keyTime(MM.nearestKeyIndex(tt)) - tt) < 1e-4) { report.skipped.push(it.C.name); continue; }
            if (!opened) { mt_begin("Motion Tools: marcatori collegati nelle composizioni nuove"); opened = true; }
            var mv = new MarkerValue(it.m.text);
            mv.setParameters({ mt_sync: "1", mt_master: "0", mt_id: it.m.id, mt_text: it.m.text, mt_author: it.m.author || "" });
            try { mv.label = 13; } catch (eL) {}
            MM.setValueAtTime(tt, mv);
            report.copies++;
            if (report.comps.join("|").indexOf(it.C.name) < 0) report.comps.push(it.C.name);
        }
        if (opened) mt_end();
        report.added = report.copies;
        return inflect_ok(report);
    } catch (e) { return inflect_err(e.toString()); }
}
