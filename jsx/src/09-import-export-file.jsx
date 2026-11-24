/* ------------------------------------------------ import / export file -- */

function inflect_exportFile(libJSON, suggestedName) {
    try {
        var f = new File(Folder.desktop.fsName + "/" + (suggestedName || "brand-curves") + ".curve.json");
        var target = f.saveDlg("Esporta curve", "JSON:*.json");
        if (!target) return inflect_ok({ cancelled: true });
        if (!inflect_writeText(target, libJSON)) return inflect_err("Non riesco a scrivere il file.");
        return inflect_ok({ path: target.fsName });
    } catch (e) { return inflect_err(e); }
}

function inflect_importFile() {
    try {
        var f = File.openDialog("Importa curve", "JSON:*.json", false);
        if (!f) return inflect_ok({ cancelled: true });
        var s = inflect_readText(f);
        return inflect_ok({ library: inflect_parse(s), name: f.displayName });
    } catch (e) { return inflect_err("File non valido: " + e); }
}

