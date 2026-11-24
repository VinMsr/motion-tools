/* ---------------------------------------------------------- utilita' -- */

/** Sposta nel tempo i layer delle copie (utile se le sorgenti hanno gia' una loro animazione). */
function inflect_repeatSequence(frames, mode, seed) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var clones = mt_clones(comp, ctrl), n = clones.length, i;
    if (!n) return inflect_err("Questo Cloner non ha copie.");
    var base = clones[0].layer.startTime;
    for (i = 1; i < n; i++) if (clones[i].layer.startTime < base) base = clones[i].layer.startTime;
    var x = (Math.round(seed) * 9301 + 49297) % 233280, mid = (n - 1) / 2;
    mt_begin("Motion Tools: sfalsa copie");
    try {
        for (i = 0; i < n; i++) {
            var r = i;
            if (mode === 2) r = n - 1 - i;
            else if (mode === 3) r = Math.abs(i - mid);
            else if (mode === 4) r = mid - Math.abs(i - mid);
            else if (mode === 5) { x = (x * 9301 + 49297) % 233280; r = (x / 233280) * (n - 1); }
            clones[i].layer.startTime = base + Math.round(r * frames) * comp.frameDuration;
        }
    } catch (e) { mt_end(); return inflect_err("Sfalsamento non riuscito: " + e.toString()); }
    mt_end();
    return inflect_ok({ count: n });
}

function inflect_repeatSelect(what) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    var clones = mt_clones(comp, ctrl);
    for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
    if (what === "clones") for (var i = 0; i < clones.length; i++) clones[i].layer.selected = true;
    else ctrl.selected = true;
    return inflect_ok({ count: clones.length });
}

/** Elimina controllo e copie e riattiva le sorgenti. I falloff restano: possono servire ad altri Cloner. */
function inflect_repeatRemove() {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var ctrl = mt_findCtrl(comp);
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner o una sua copia.");
    mt_begin("Motion Tools: elimina Cloner");
    try {
        var meta = mt_meta(ctrl), clones = mt_clones(comp, ctrl), name = ctrl.name;
        for (var i = clones.length - 1; i >= 0; i--) clones[i].layer.remove();
        ctrl.remove();
        for (var s = 0; s < meta.src.length; s++) {
            try { var src = mt_layerById(meta.src[s]); if (src) { src.enabled = true; src.selected = true; } } catch (e1) {}
        }
        mt_end();
        return inflect_ok({ name: name });
    } catch (e) { mt_end(); return inflect_err("Eliminazione non riuscita: " + e.toString()); }
}

