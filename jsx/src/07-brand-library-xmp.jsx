/* ------------------------------------------------ brand library (XMP) -- */

function inflect_loadXMPLib() {
    if (ExternalObject.AdobeXMPScript === undefined) {
        ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
    }
}

/** Legge la libreria brand salvata dentro il file di progetto (.aep). */
function inflect_loadProject() {
    try {
        if (!app.project) return inflect_ok({ library: null });
        inflect_loadXMPLib();
        var xmp = new XMPMeta(app.project.xmpPacket);
        XMPMeta.registerNamespace(INFLECT_NS, INFLECT_PREFIX);
        var prop = xmp.getProperty(INFLECT_NS, "library");
        var lib = prop ? inflect_parse(String(prop.value)) : null;
        return inflect_ok({ library: lib });
    } catch (e) { return inflect_err("Lettura della libreria brand non riuscita: " + e); }
}

/** Scrive la libreria brand nel progetto e segnala la modifica nel pannello Progetto. */
function inflect_saveProject(libJSON) {
    try {
        if (!app.project) return inflect_err("Nessun progetto aperto.");
        var lib = inflect_parse(libJSON);
        inflect_loadXMPLib();
        mt_begin("Motion Tools: aggiorna curve del progetto");
        var xmp = new XMPMeta(app.project.xmpPacket);
        XMPMeta.registerNamespace(INFLECT_NS, INFLECT_PREFIX);
        xmp.setProperty(INFLECT_NS, "library", libJSON);
        xmp.setProperty(INFLECT_NS, "updated", new Date().toUTCString());
        app.project.xmpPacket = xmp.serialize(XMPConst.SERIALIZE_USE_COMPACT_FORMAT);

        // Cartella segnaposto: rende visibile che il progetto contiene brand curves
        // e marca il progetto come modificato, cos\u00ec Cmd+S lo salva davvero.
        var count = (lib && lib.curves) ? lib.curves.length : 0;
        var folder = inflect_findFolder();
        if (count > 0) {
            if (!folder) folder = app.project.items.addFolder(INFLECT_FOLDER_NAME);
            folder.comment = count + " curve salvate nel progetto \u00b7 aggiornato " + new Date().toLocaleString();
            folder.label = 0;
        } else if (folder && folder.numItems === 0) {
            folder.remove();
        }
        mt_end();
        return inflect_ok({ count: count });
    } catch (e) {
        try { mt_end(); } catch (e2) {}
        return inflect_err("Salvataggio nel progetto non riuscito: " + e);
    }
}

function inflect_findFolder() {
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof FolderItem && (it.name === INFLECT_OLD_FOLDER_NAMES[0] || it.name === INFLECT_OLD_FOLDER_NAMES[1])) it.name = INFLECT_FOLDER_NAME;
        if (it instanceof FolderItem && it.name === INFLECT_FOLDER_NAME) return it;
    }
    return null;
}

