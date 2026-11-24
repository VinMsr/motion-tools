/* =============================================================== team == */
/*
 * Libreria di team: un file motion-tools-team.json in una cartella condivisa
 * (Drive, Dropbox, server). Contiene curve, animazioni di testo, palette e liste.
 */

function mt_teamDir() {
    var st = inflect_settings();
    var dir = st.teamFolder ? new Folder(st.teamFolder) : null;
    if (!dir || !dir.exists) {
        dir = new Folder(inflect_dataDir().fsName + "/Team");
        if (!dir.exists) dir.create();
    }
    return dir;
}

function mt_teamFile() { return new File(mt_teamDir().fsName + "/motion-tools-team.json"); }

function inflect_teamLoad() {
    try {
        var st = inflect_settings(), f = mt_teamFile();
        var isDefault = !st.teamFolder || !(new Folder(st.teamFolder)).exists;
        var lib = null;
        if (f.exists) lib = inflect_parse(inflect_readText(f));
        if (!lib) {
            lib = { format: "motion-tools-team", version: 1, name: "Team", curves: [], text: [], palettes: [], lists: [], updated: new Date().getTime() };
            // Le curve brand delle versioni precedenti entrano nella libreria di team.
            try {
                var old = inflect_libFiles(inflect_sharedDir());
                for (var i = 0; i < old.length; i++) {
                    var b = inflect_parse(inflect_readText(old[i]));
                    if (b && b.curves) for (var k = 0; k < b.curves.length; k++) lib.curves.push(b.curves[k]);
                }
            } catch (eO) {}
            inflect_writeText(f, inflect_stringify(lib));
        }
        return inflect_ok({ library: lib, folder: mt_teamDir().fsName, folderName: decodeURI(mt_teamDir().name), isDefault: isDefault, modified: f.modified ? f.modified.getTime() : 0 });
    } catch (e) { return inflect_err("Libreria di team non leggibile: " + e); }
}

function inflect_teamStat() {
    try { var f = mt_teamFile(); return inflect_ok({ modified: f.exists && f.modified ? f.modified.getTime() : 0 }); }
    catch (e) { return inflect_err(e); }
}

function inflect_teamSave(libJSON) {
    try {
        var f = mt_teamFile(), tmp = new File(f.fsName + ".tmp");
        if (!inflect_writeText(tmp, libJSON)) return inflect_err("Non riesco a scrivere nella cartella del team. Controlla i permessi.");
        if (f.exists) f.remove();
        tmp.rename(decodeURI(f.name));
        f = mt_teamFile();
        return inflect_ok({ modified: f.modified ? f.modified.getTime() : 0 });
    } catch (e) { return inflect_err("Salvataggio non riuscito: " + e); }
}

function inflect_teamChoose() {
    try {
        var dir = mt_teamDir().selectDlg("Scegli la cartella condivisa con il team");
        if (!dir) return inflect_ok({ cancelled: true });
        var st = inflect_settings();
        st.teamFolder = dir.fsName;
        inflect_saveSettings(st);
        return inflect_teamLoad();
    } catch (e) { return inflect_err(e); }
}

function inflect_teamReveal() {
    try { mt_teamDir().execute(); return inflect_ok({}); } catch (e) { return inflect_err(e); }
}

