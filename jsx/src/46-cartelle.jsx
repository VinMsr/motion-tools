/* ============================================================ cartelle == */
/*
 * Sposta nella cartella nuova gli elementi usati dalla comp attiva (comp, filmati, immagini,
 * anche dentro le precomp) che si trovano ancora nella cartella vecchia. Non cancella nulla.
 */

function mt_folderByName(name) {
    var n = app.project.numItems;
    for (var i = 1; i <= n; i++) {
        var it = app.project.item(i);
        if (it && it instanceof FolderItem && it.name === name) return it;
    }
    return null;
}

// Vero se l'elemento sta dentro la cartella (anche in una sottocartella). Confronto per nome e id.
function mt_inFolder(item, folder) {
    var p = null, guard = 0;
    try { p = item.parentFolder; } catch (e) { return false; }
    while (p && guard++ < 50) {
        if (p.id === folder.id) return true;
        var up = null;
        try { up = p.parentFolder; } catch (e2) { up = null; }
        if (!up || up.id === p.id) break;
        p = up;
    }
    return false;
}

function inflect_consolidate(oldName, newName) {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_err("Apri la comp che usa gli elementi.");
        var oldF = mt_folderByName(oldName), newF = mt_folderByName(newName);
        if (!oldF) return inflect_err("Non trovo la cartella vecchia: " + oldName + ".");
        if (!newF) return inflect_err("Non trovo la cartella nuova: " + newName + ".");

        // Elementi usati dalla comp, anche dentro le precomp. Senza ricorsione: una lista da svuotare.
        var seen = {}, list = [], todo = [{ c: comp, d: 0 }];
        while (todo.length) {
            var cur = todo.shift();
            var nl = 0;
            try { nl = cur.c.numLayers; } catch (e0) { nl = 0; }
            for (var l = 1; l <= nl; l++) {
                var src = null;
                try { src = cur.c.layer(l).source; } catch (e1) { src = null; }
                if (!src) continue;
                var key = String(src.id);
                if (seen[key]) continue;
                seen[key] = true;
                list.push(src);
                var sub = 0;
                try { sub = src.numLayers || 0; } catch (e2) { sub = 0; }
                if (sub > 0 && cur.d < 8) todo.push({ c: src, d: cur.d + 1 });
            }
        }

        var moved = [], skipped = [];
        // Niente try/finally: nel motore di After Effects puo' far perdere il risultato.
        mt_begin("Motion Tools: sposta elementi in " + newName);
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (!mt_inFolder(it, oldF)) continue;
            try { it.parentFolder = newF; moved.push(String(it.name)); }
            catch (e3) { skipped.push(String(it.name) + ": " + e3); }
        }
        mt_end();
        return inflect_ok({ moved: moved.length, names: moved.slice(0, 6), skipped: skipped, used: list.length });
    } catch (e) {
        try { mt_end(); } catch (eE) {}
        return inflect_err("Spostamento non riuscito: " + e + (e && e.line ? " (riga " + e.line + ")" : ""));
    }
}
