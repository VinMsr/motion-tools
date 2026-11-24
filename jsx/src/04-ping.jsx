/* ----------------------------------------------------------------- ping -- */

function inflect_ping() {
    try {
        var name = (app.project && app.project.file) ? app.project.file.displayName : "Progetto senza titolo";
        return inflect_ok({ version: INFLECT_VERSION, ae: app.version, project: name });
    } catch (e) { return inflect_err(e); }
}

/** Info leggere per l'interfaccia: quante propriet\u00e0 e coppie sono selezionate. */
function inflect_selectionInfo() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_ok({ props: 0, pairs: 0, duration: 0, fps: 0 });
        var list = inflect_selectedKeyedProps(comp);
        var pairs = 0, dur = 0;
        for (var i = 0; i < list.length; i++) {
            var k = list[i].keys;
            for (var j = 0; j < k.length - 1; j++) {
                if (k[j + 1] === k[j] + 1) {
                    pairs++;
                    if (!dur) dur = list[i].prop.keyTime(k[j + 1]) - list[i].prop.keyTime(k[j]);
                }
            }
        }
        return inflect_ok({ props: list.length, pairs: pairs, duration: dur, fps: 1 / comp.frameDuration, comp: comp.name });
    } catch (e) { return inflect_err(e); }
}

