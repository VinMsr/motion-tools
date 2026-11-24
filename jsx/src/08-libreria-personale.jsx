/* ------------------------------------------------- libreria personale -- */

function inflect_userFile() {
    var dir = inflect_dataDir();
    return new File(dir.fsName + "/library.json");
}

function inflect_readText(f) {
    f.encoding = "UTF-8";
    if (!f.open("r")) return null;
    var s = f.read();
    f.close();
    return s;
}

function inflect_writeText(f, s) {
    f.encoding = "UTF-8";
    if (!f.open("w")) return false;
    f.write(s);
    f.close();
    return true;
}

function inflect_loadUser() {
    try {
        var f = inflect_userFile();
        if (!f.exists) return inflect_ok({ library: null });
        var s = inflect_readText(f);
        return inflect_ok({ library: s ? inflect_parse(s) : null });
    } catch (e) { return inflect_err(e); }
}

function inflect_saveUser(libJSON) {
    try {
        var f = inflect_userFile();
        if (!inflect_writeText(f, libJSON)) return inflect_err("Non riesco a scrivere " + f.fsName);
        return inflect_ok({ path: f.fsName });
    } catch (e) { return inflect_err(e); }
}

