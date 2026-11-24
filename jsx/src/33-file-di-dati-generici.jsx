/* ------------------------------------------- file di dati generici -- */

function inflect_dataLoad(name) {
    try {
        var f = new File(inflect_dataDir().fsName + "/" + name + ".json");
        if (!f.exists) return inflect_ok({ data: null });
        var s = inflect_readText(f);
        return inflect_ok({ data: s ? inflect_parse(s) : null });
    } catch (e) { return inflect_err(e); }
}

function inflect_dataSave(name, json) {
    try {
        var f = new File(inflect_dataDir().fsName + "/" + name + ".json");
        if (!inflect_writeText(f, json)) return inflect_err("Non riesco a scrivere " + f.fsName);
        return inflect_ok({ path: f.fsName });
    } catch (e) { return inflect_err(e); }
}

function inflect_fileSave(json, suggestedName, title) {
    try {
        var f = new File(Folder.desktop.fsName + "/" + suggestedName);
        var target = f.saveDlg(title || "Esporta", "JSON:*.json");
        if (!target) return inflect_ok({ cancelled: true });
        if (!inflect_writeText(target, json)) return inflect_err("Non riesco a scrivere il file.");
        return inflect_ok({ path: target.fsName });
    } catch (e) { return inflect_err(e); }
}

function inflect_fileOpen(title) {
    try {
        var f = File.openDialog(title || "Importa", "JSON:*.json", false);
        if (!f) return inflect_ok({ cancelled: true });
        return inflect_ok({ data: inflect_parse(inflect_readText(f)), name: f.displayName });
    } catch (e) { return inflect_err("File non valido: " + e); }
}

