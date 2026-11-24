/* ------------------------------------------------- gruppi di annullamento -- */
/*
 * After Effects segnala "Undo group mismatch, will attempt to fix" (e annulla da solo qualche passo)
 * quando si apre un gruppo di annullamento prima di aver chiuso il precedente, o se ne chiude uno
 * che non c'e'. Qui c'e' un solo gruppo vero per volta: le funzioni che ne chiamano altre (per
 * esempio Collega falloff, che aggiunge un comportamento) contano solo il livello, e il gruppo vero
 * si apre al primo mt_begin e si chiude all'ultimo mt_end. Alla fine di ogni chiamata del pannello
 * mt_flushUndo chiude quello rimasto aperto per un errore, una volta sola.
 */
function mt_begin(name) {
    var d = $.global.MT_UD || 0;
    if (d === 0) app.beginUndoGroup(name);
    $.global.MT_UD = d + 1;
}
function mt_end() {
    var d = $.global.MT_UD || 0;
    if (d <= 0) return;
    $.global.MT_UD = d - 1;
    if (d === 1) app.endUndoGroup();
}
function mt_flushUndo() {
    if (($.global.MT_UD || 0) > 0) { $.global.MT_UD = 0; try { app.endUndoGroup(); } catch (e) {} }
    return "";
}

function inflect_ok(obj) { obj = obj || {}; obj.ok = true; return inflect_stringify(obj); }
function inflect_err(msg) { return inflect_stringify({ ok: false, error: String(msg) }); }


/* Annulla (o ripeti) in After Effects, times volte: un gesto del pannello puo' aver fatto piu' passi. */
function inflect_aeUndo(redo, times) {
    try {
        mt_flushUndo();
        var n = Math.max(1, Math.min(60, Math.round(times || 1)));
        for (var i = 0; i < n; i++) app.executeCommand(redo ? 2035 : 16);
        return inflect_ok({ steps: n });
    } catch (e) { return inflect_err("Annulla non riuscito: " + e); }
}
