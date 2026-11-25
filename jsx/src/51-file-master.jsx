/*
 * File master del team: progetti .aep sul NAS che si importano nel progetto aperto, anche piu' volte.
 * Ogni importazione crea una cartella nuova con comp tutte nuove. La cartella riceve nel commento
 * "MT_MASTER=<id>", cosi' si contano le copie anche dopo averla rinominata.
 * API usate (After Effects Scripting Guide): ImportOptions, ImportAsType.PROJECT, Project.importFile,
 * Item.comment, FootageItem.mainSource (FileSource), AVItem.usedIn, AVLayer.replaceSource, Item.remove.
 */

/** Finestra per scegliere un .aep. Restituisce il percorso completo, o cancelled. */
function inflect_masterPick(startPath) {
    try {
        var start = startPath ? new File(startPath) : null;
        var f = (start && start.parent && start.parent.exists) ? start.parent.openDlg("Scegli il file master .aep") : File.openDialog("Scegli il file master .aep");
        if (!f) return inflect_ok({ cancelled: true });
        if (!/\.aepx?$/i.test(f.name)) return inflect_err("Scegli un progetto di After Effects (.aep).");
        return inflect_ok({ path: f.fsName, name: decodeURI(f.name) });
    } catch (e) { return inflect_err(e); }
}

/** Per ogni percorso: se esiste, quando e' stato modificato e se c'e' un PNG con lo stesso nome. */
function inflect_masterStat(paths) {
    try {
        var out = [];
        for (var i = 0; i < paths.length; i++) {
            var f = new File(paths[i]), o = { path: paths[i], exists: f.exists, modified: 0, png: "" };
            if (f.exists) {
                try { o.modified = f.modified ? f.modified.getTime() : 0; } catch (eM) {}
                var p = new File(String(paths[i]).replace(/\.aepx?$/i, ".png"));
                if (p.exists) o.png = p.fsName;
            }
            out.push(o);
        }
        return inflect_ok({ list: out });
    } catch (e) { return inflect_err(e); }
}

/** Quante cartelle di ogni master ci sono nel progetto aperto. */
function inflect_masterCounts() {
    try {
        var counts = {};
        if (!app.project) return inflect_ok({ counts: counts });
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (!(it instanceof FolderItem)) continue;
            var m = String(it.comment || "").match(/MT_MASTER=([^|\n]+)/);
            if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
        }
        return inflect_ok({ counts: counts });
    } catch (e) { return inflect_err(e); }
}

/* Chiave di un file sorgente: lo stesso file con le stesse impostazioni principali. */
function mt_footKey(it) {
    try {
        if (!(it instanceof FootageItem) || !(it.mainSource instanceof FileSource) || !it.mainSource.file) return "";
        var s = it.mainSource;
        return s.file.fsName + "|" + s.conformFrameRate + "|" + s.alphaMode + "|" + s.fieldSeparationType + "|" + s.loop;
    } catch (e) { return ""; }
}

/* Tutti gli elementi dentro una cartella, anche nelle sottocartelle. */
function mt_folderItems(folder, out) {
    for (var i = 1; i <= folder.numItems; i++) {
        var it = folder.item(i);
        out.push(it);
        if (it instanceof FolderItem) mt_folderItems(it, out);
    }
    return out;
}

/**
 * Importa il master. reuse: i video e le immagini identici a quelli gia' nel progetto
 * restano uno solo (le comp nuove usano quelli esistenti). Le comp non si uniscono mai.
 */
function inflect_masterImport(path, id, reuse) {
    try {
        if (!app.project) app.newProject();
        var f = new File(path);
        if (!f.exists) return inflect_err("Non trovo il file sul NAS. Controlla che il NAS sia collegato.");
        var io = new ImportOptions(f);
        if (!io.canImportAs(ImportAsType.PROJECT)) return inflect_err("Questo file non si importa come progetto. Forse è stato salvato con una versione di After Effects più nuova.");
        io.importAs = ImportAsType.PROJECT;

        // I file sorgente che c'erano gia', per riconoscere i doppioni dopo l'importazione.
        var before = {}, seen = {};
        if (reuse) {
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                seen[it.id] = true;
                var k = mt_footKey(it);
                if (k && !before[k]) before[k] = it;
            }
        }

        mt_begin("Motion Tools: importa master");
        var folder, reused = 0;
        try {
            folder = app.project.importFile(io);
            if (folder && id) { try { folder.comment = "MT_MASTER=" + id; } catch (eC) {} }
            if (reuse && folder instanceof FolderItem) {
                var items = mt_folderItems(folder, []);
                for (var j = 0; j < items.length; j++) {
                    var n = items[j], key = mt_footKey(n);
                    if (!key || seen[n.id] || !before[key]) continue;
                    var keep = before[key], comps = n.usedIn;
                    for (var c = 0; c < comps.length; c++) {
                        for (var l = 1; l <= comps[c].numLayers; l++) {
                            var ly = comps[c].layer(l);
                            try { if (ly.source === n) ly.replaceSource(keep, false); } catch (eR) {}
                        }
                    }
                    if (n.usedIn.length === 0) { n.remove(); reused++; }
                }
            }
        } catch (eI) { mt_end(); return inflect_err("Non riesco a importare il master: " + eI.toString()); }
        mt_end();
        return inflect_ok({ name: folder ? folder.name : decodeURI(f.name), reused: reused });
    } catch (e) { return inflect_err(e); }
}

/** Apre nel Finder la cartella che contiene il master. */
function inflect_masterReveal(path) {
    try {
        var f = new File(path);
        var dir = f.exists ? f.parent : new Folder(String(path).replace(/[\/\\][^\/\\]*$/, ""));
        if (!dir || !dir.exists) return inflect_err("La cartella non esiste più.");
        dir.execute();
        return inflect_ok({});
    } catch (e) { return inflect_err(e); }
}
