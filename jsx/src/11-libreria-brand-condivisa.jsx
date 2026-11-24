/* ------------------------------------------- libreria brand condivisa -- */
/*
 * Le librerie brand sono file .inflect.json in una cartella. Di default la cartella
 * sta dentro i dati del plugin; si puo' spostare su una cartella sincronizzata
 * (Synology Drive, Dropbox, Creative Cloud Files, server) per condividerla col team.
 */

function inflect_dataDir() {
    var root = Folder.userData.fsName;
    var dir = new Folder(root + "/Motion Tools");
    if (!dir.exists) {
        // Dati delle versioni precedenti (Curve, Inflect): si rinomina la cartella.
        var olds = ["Curve", "Inflect"];
        for (var i = 0; i < olds.length; i++) {
            var old = new Folder(root + "/" + olds[i]);
            if (old.exists) { try { old.rename("Motion Tools"); } catch (e) {} break; }
        }
        dir = new Folder(root + "/Motion Tools");
        if (!dir.exists) dir.create();
    }
    return dir;
}

function inflect_settings() {
    var f = new File(inflect_dataDir().fsName + "/settings.json");
    var s = f.exists ? inflect_readText(f) : null;
    var obj = {};
    try { if (s) obj = inflect_parse(s); } catch (e) { obj = {}; }
    return obj;
}

function inflect_saveSettings(obj) {
    inflect_writeText(new File(inflect_dataDir().fsName + "/settings.json"), inflect_stringify(obj));
}

// Una sola impostazione alla volta, solo tra quelle previste.
function inflect_settingSet(key, value) {
    try {
        var allowed = { githubRepo: 1, updateChannel: 1 };
        if (!allowed[key]) return inflect_err("Impostazione sconosciuta: " + key);
        var st = inflect_settings();
        if (value === "" || value === null) delete st[key]; else st[key] = String(value);
        inflect_saveSettings(st);
        return inflect_ok({ key: key, value: st[key] || "" });
    } catch (e) { return inflect_err(e); }
}

function inflect_sharedDir() {
    var st = inflect_settings();
    var dir = st.sharedFolder ? new Folder(st.sharedFolder) : null;
    if (!dir || !dir.exists) {
        dir = new Folder(inflect_dataDir().fsName + "/Brand");
        if (!dir.exists) dir.create();
    }
    return dir;
}

function inflect_libFiles(dir) {
    var files = dir.getFiles(function (f) { return (f instanceof File) && /\.(curve|inflect)\.json$/i.test(f.name); });
    return files || [];
}

function inflect_slug(name) {
    var s = String(name || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "brand";
}

/** Elenco delle librerie nella cartella condivisa e quella attiva. */
function inflect_sharedList() {
    try {
        var st = inflect_settings();
        var dir = inflect_sharedDir();
        var files = inflect_libFiles(dir);
        if (!files.length) {
            // Prima volta: crea una libreria vuota.
            var first = new File(dir.fsName + "/brand.curve.json");
            inflect_writeText(first, inflect_stringify({ format: "inflect-library", version: 1, name: "Brand", owner: "", locked: false, curves: [], updated: new Date().getTime() }));
            files = [first];
        }
        var out = [], active = null;
        for (var i = 0; i < files.length; i++) {
            var f = files[i], name = decodeURI(f.name), count = 0, title = name;
            try {
                var lib = inflect_parse(inflect_readText(f));
                count = lib.curves ? lib.curves.length : 0;
                title = lib.name || name;
            } catch (e) {}
            out.push({ file: decodeURI(f.name), name: title, count: count, modified: f.modified ? f.modified.getTime() : 0 });
            if (st.activeLibrary === decodeURI(f.name)) active = st.activeLibrary;
        }
        if (!active) active = out[0].file;
        var isDefault = !st.sharedFolder || !(new Folder(st.sharedFolder)).exists;
        return inflect_ok({ folder: dir.fsName, folderName: decodeURI(dir.name), isDefault: isDefault, libraries: out, active: active });
    } catch (e) { return inflect_err("Non riesco a leggere la cartella brand: " + e); }
}

function inflect_sharedChooseFolder() {
    try {
        var cur = inflect_sharedDir();
        var dir = cur.selectDlg("Scegli la cartella condivisa con le curve brand");
        if (!dir) return inflect_ok({ cancelled: true });
        var st = inflect_settings();
        st.sharedFolder = dir.fsName;
        st.activeLibrary = null;
        inflect_saveSettings(st);
        return inflect_sharedList();
    } catch (e) { return inflect_err(e); }
}

function inflect_sharedResetFolder() {
    var st = inflect_settings();
    st.sharedFolder = null;
    st.activeLibrary = null;
    inflect_saveSettings(st);
    return inflect_sharedList();
}

function inflect_sharedSetActive(fileName) {
    var st = inflect_settings();
    st.activeLibrary = fileName;
    inflect_saveSettings(st);
    return inflect_ok({});
}

function inflect_sharedFile(fileName) {
    return new File(inflect_sharedDir().fsName + "/" + fileName);
}

function inflect_sharedLoad(fileName) {
    try {
        var f = inflect_sharedFile(fileName);
        if (!f.exists) return inflect_err("La libreria " + fileName + " non esiste piu' nella cartella condivisa.");
        var s = inflect_readText(f);
        return inflect_ok({ library: inflect_parse(s), modified: f.modified.getTime() });
    } catch (e) { return inflect_err("Libreria non leggibile: " + e); }
}

/** Data di modifica: il pannello la controlla per accorgersi delle modifiche dei colleghi. */
function inflect_sharedStat(fileName) {
    try {
        var f = inflect_sharedFile(fileName);
        return inflect_ok({ exists: f.exists, modified: f.exists ? f.modified.getTime() : 0 });
    } catch (e) { return inflect_err(e); }
}

function inflect_sharedSave(fileName, libJSON) {
    try {
        var f = inflect_sharedFile(fileName);
        // Scrive su un file temporaneo e poi lo sostituisce, cosi' la sincronizzazione non legge file a meta'.
        var tmp = new File(f.fsName + ".tmp");
        if (!inflect_writeText(tmp, libJSON)) return inflect_err("Non riesco a scrivere nella cartella condivisa. Controlla i permessi.");
        if (f.exists) f.remove();
        tmp.rename(decodeURI(f.name));
        f = inflect_sharedFile(fileName);
        return inflect_ok({ modified: f.modified ? f.modified.getTime() : 0 });
    } catch (e) { return inflect_err("Salvataggio della libreria non riuscito: " + e); }
}

function inflect_sharedCreate(name) {
    try {
        var dir = inflect_sharedDir();
        var base = inflect_slug(name), fname = base + ".curve.json", n = 2;
        while ((new File(dir.fsName + "/" + fname)).exists) { fname = base + "-" + n + ".curve.json"; n++; }
        var lib = { format: "inflect-library", version: 1, name: name || "Brand", owner: "", locked: false, curves: [], updated: new Date().getTime() };
        inflect_writeText(new File(dir.fsName + "/" + fname), inflect_stringify(lib));
        inflect_sharedSetActive(fname);
        return inflect_ok({ file: fname });
    } catch (e) { return inflect_err(e); }
}

function inflect_revealShared() {
    try { inflect_sharedDir().execute(); return inflect_ok({}); } catch (e) { return inflect_err(e); }
}

