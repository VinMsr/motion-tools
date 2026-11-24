/* ======================================================== aggiornamenti == */
/*
 * Aggiornamento da una cartella condivisa (NAS, Drive, Dropbox): dentro c'e' la cartella
 * "motion-tools" della nuova versione. Se e' piu' recente di quella installata, i file
 * vengono copiati nella cartella dell'estensione (nella Libreria dell'utente, niente password).
 */
function mt_updateDir() {
    var st = inflect_settings();
    if (st.updateFolder && (new Folder(st.updateFolder)).exists) return new Folder(st.updateFolder);
    return new Folder(mt_teamDir().fsName + "/Aggiornamenti");
}

// Un pacchetto e' una cartella con CSXS/manifest.xml. Cerca nelle forme previste:
// dir/motion-tools, dir stessa, dir/Motion Tools/motion-tools.
function mt_packageAt(dir) {
    if (!dir || !dir.exists) return null;
    var direct = new Folder(dir.fsName + "/motion-tools");
    if ((new File(direct.fsName + "/CSXS/manifest.xml")).exists) return direct;
    if ((new File(dir.fsName + "/CSXS/manifest.xml")).exists) return dir;
    var inner = new Folder(dir.fsName + "/Motion Tools/motion-tools");
    if ((new File(inner.fsName + "/CSXS/manifest.xml")).exists) return inner;
    return null;
}

// Cerca nella cartella degli aggiornamenti e nelle sue sottocartelle (due livelli, es. Aggiornamenti/2.12.2/motion-tools).
// Sceglie il pacchetto con la versione piu' alta. Non cancella ne' sposta niente: le versioni restano affiancate.
function mt_findPackage(dir) {
    if (!dir || !dir.exists) return null;
    var best = null, bestV = "0", seen = 0;
    function consider(f) {
        if (!f) return;
        var v = mt_manifestVersion(f);
        if (!best || mt_versionCmp(v, bestV) > 0) { best = f; bestV = v; }
    }
    consider(mt_packageAt(dir));
    var level1 = dir.getFiles();
    for (var i = 0; i < level1.length && seen < 200; i++) {
        if (!(level1[i] instanceof Folder)) continue;
        seen++;
        consider(mt_packageAt(level1[i]));
        var level2 = level1[i].getFiles();
        for (var j = 0; j < level2.length && seen < 200; j++) {
            if (!(level2[j] instanceof Folder)) continue;
            seen++;
            consider(mt_packageAt(level2[j]));
        }
    }
    return best;
}

function mt_manifestVersion(folder) {
    try {
        var s = inflect_readText(new File(folder.fsName + "/CSXS/manifest.xml"));
        var m = s.match(/ExtensionBundleVersion="([0-9.]+)"/);
        return m ? m[1] : "0";
    } catch (e) { return "0"; }
}

function mt_versionCmp(a, b) {
    var A = String(a).split("."), B = String(b).split(".");
    for (var i = 0; i < Math.max(A.length, B.length); i++) {
        var x = parseInt(A[i] || "0", 10), y = parseInt(B[i] || "0", 10);
        if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
}

function inflect_updateCheck(extPath) {
    try {
        var cur = mt_manifestVersion(new Folder(extPath));
        var dir = mt_updateDir(), pkg = mt_findPackage(dir);
        var out = { current: cur, folder: dir.fsName, folderName: decodeURI(dir.name), found: !!pkg, available: false };
        if (!pkg) return inflect_ok(out);
        out.version = mt_manifestVersion(pkg);
        out.available = mt_versionCmp(out.version, cur) > 0;
        try { var n = new File(pkg.fsName + "/NOVITA.txt"); if (n.exists) out.notes = inflect_readText(n).substring(0, 600); } catch (eN) {}
        return inflect_ok(out);
    } catch (e) { return inflect_err("Controllo aggiornamenti non riuscito: " + e); }
}

function mt_copyTree(src, dst) {
    if (!dst.exists) dst.create();
    var items = src.getFiles(), n = 0;
    for (var i = 0; i < items.length; i++) {
        var it = items[i], name = decodeURI(it.name);
        if (name.charAt(0) === ".") continue;
        if (it instanceof Folder) n += mt_copyTree(it, new Folder(dst.fsName + "/" + name));
        else { var t = new File(dst.fsName + "/" + name); if (t.exists) t.remove(); if (!it.copy(t.fsName)) throw new Error("Non riesco a copiare " + name); n++; }
    }
    return n;
}

function inflect_updateInstall(extPath) {
    try {
        var upd = mt_updateDir(), pkg = mt_findPackage(upd);
        if (!pkg) return inflect_err("Non trovo Motion Tools in: " + upd.fsName + ". Dentro deve esserci la cartella motion-tools (con CSXS/manifest.xml).");
        var ext = new Folder(extPath);
        var ver = mt_manifestVersion(pkg), cur = mt_manifestVersion(ext);
        if (mt_versionCmp(ver, cur) <= 0) return inflect_ok({ installed: false, version: cur });
        var manifestChanged = false;
        try { manifestChanged = inflect_readText(new File(pkg.fsName + "/CSXS/manifest.xml")).replace(/ExtensionBundleVersion="[0-9.]+"|Version="[0-9.]+"/g, "") !== inflect_readText(new File(ext.fsName + "/CSXS/manifest.xml")).replace(/ExtensionBundleVersion="[0-9.]+"|Version="[0-9.]+"/g, ""); } catch (eM) {}
        var n = mt_copyTree(pkg, ext);
        var cleared = mt_clearCepCache();
        return inflect_ok({ installed: true, version: ver, from: cur, files: n, restart: manifestChanged, cache: cleared });
    } catch (e) { return inflect_err("Aggiornamento non riuscito: " + e + ". Puoi sempre reinstallare dallo zip."); }
}

/*
 * Installa da una cartella gia' pronta (lo zip scaricato da GitHub e aperto dal pannello).
 * Prima copia la versione in uso in backupPath, cosi' si puo' tornare indietro.
 * force = installa anche se la versione non e' piu' recente (serve per tornare indietro).
 */
function inflect_updateInstallFrom(extPath, pkgPath, backupPath, force) {
    try {
        var pkg = new Folder(pkgPath), ext = new Folder(extPath);
        if (!(new File(pkg.fsName + "/CSXS/manifest.xml")).exists) return inflect_err("La cartella scaricata non contiene Motion Tools.");
        var ver = mt_manifestVersion(pkg), cur = mt_manifestVersion(ext);
        if (!force && mt_versionCmp(ver, cur) <= 0) return inflect_ok({ installed: false, version: cur });
        var idNew = "", idCur = "";
        try { idNew = (inflect_readText(new File(pkg.fsName + "/CSXS/manifest.xml")).match(/ExtensionBundleId="([^"]+)"/) || [])[1]; } catch (e1) {}
        try { idCur = (inflect_readText(new File(ext.fsName + "/CSXS/manifest.xml")).match(/ExtensionBundleId="([^"]+)"/) || [])[1]; } catch (e2) {}
        if (idNew && idCur && idNew !== idCur) return inflect_err("La cartella scaricata contiene un'altra estensione.");
        var manifestChanged = false;
        try { manifestChanged = inflect_readText(new File(pkg.fsName + "/CSXS/manifest.xml")).replace(/ExtensionBundleVersion="[0-9.]+"|Version="[0-9.]+"/g, "") !== inflect_readText(new File(ext.fsName + "/CSXS/manifest.xml")).replace(/ExtensionBundleVersion="[0-9.]+"|Version="[0-9.]+"/g, ""); } catch (eM) {}
        var backed = false;
        if (backupPath) {
            try {
                var b = new Folder(backupPath);
                if (b.exists) mt_removeTree(b);
                mt_copyTree(ext, b);
                backed = true;
            } catch (eB) {}
        }
        var n = mt_copyTree(pkg, ext);
        var cleared = mt_clearCepCache();
        return inflect_ok({ installed: true, version: ver, from: cur, files: n, restart: manifestChanged, cache: cleared, backup: backed });
    } catch (e) { return inflect_err("Aggiornamento non riuscito: " + e + ". La versione di prima resta in uso."); }
}

function inflect_updateChooseFolder() {
    try {
        var dir = mt_updateDir().selectDlg("Scegli la cartella con gli aggiornamenti di Motion Tools");
        if (!dir) return inflect_ok({ cancelled: true });
        var st = inflect_settings(); st.updateFolder = dir.fsName; inflect_saveSettings(st);
        return inflect_ok({ folder: dir.fsName, folderName: decodeURI(dir.name) });
    } catch (e) { return inflect_err(e); }
}


/*
 * Cache dei pannelli di CEP: Mac ~/Library/Caches/CSXS/cep_cache, Windows %TEMP%/cep_cache.
 * Le cartelle di Motion Tools (nome con l'ID dell'estensione) si cancellano, cosi' alla prossima
 * apertura After Effects legge i file nuovi.
 */
function mt_removeTree(f) {
    if (f instanceof Folder) { var list = f.getFiles(); for (var i = 0; i < list.length; i++) mt_removeTree(list[i]); }
    try { f.remove(); } catch (e) {}
}
function mt_clearCepCache() {
    var n = 0, roots = [];
    try { roots.push(new Folder("~/Library/Caches/CSXS/cep_cache")); } catch (e0) {}
    try { roots.push(new Folder(Folder.temp.fsName + "/cep_cache")); } catch (e1) {}
    for (var r = 0; r < roots.length; r++) {
        if (!roots[r].exists) continue;
        var kids = roots[r].getFiles();
        for (var i = 0; i < kids.length; i++) {
            if (kids[i] instanceof Folder && decodeURI(kids[i].name).indexOf("tools.inflect.panel") >= 0) { mt_removeTree(kids[i]); n++; }
        }
    }
    return n;
}
