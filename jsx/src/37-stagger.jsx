/* -------------------------------------------------------- stagger -- */

function inflect_staggerLayers(optsJSON) {
    var comp = inflect_activeComp();
    if (!comp) return inflect_err("Apri una composizione.");
    var o = inflect_parse(optsJSON), sel = comp.selectedLayers, L = [], i;
    for (i = 0; i < sel.length; i++) L.push(sel[i]);
    if (L.length < 2) return inflect_err("Seleziona almeno due layer.");
    var fd = comp.frameDuration, t = comp.time;
    var cx = function (l) { try { var b = inflect_bounds(l, t, false); return [(b.l + b.r) / 2, (b.t + b.b) / 2]; } catch (e) { var p = inflect_layerPos(l, t); return [p[0], p[1]]; } };
    var ord = o.order || "sel";
    if (ord === "top") L.sort(function (a, b) { return a.index - b.index; });
    else if (ord === "bottom") L.sort(function (a, b) { return b.index - a.index; });
    else if (ord === "left" || ord === "right" || ord === "up" || ord === "down" || ord === "center") {
        var key = {};
        for (i = 0; i < L.length; i++) {
            var c = cx(L[i]);
            key[L[i].id] = ord === "left" ? c[0] : ord === "right" ? -c[0] : ord === "up" ? c[1] : ord === "down" ? -c[1]
                : Math.sqrt(Math.pow(c[0] - comp.width / 2, 2) + Math.pow(c[1] - comp.height / 2, 2));
        }
        L.sort(function (a, b) { return key[a.id] - key[b.id]; });
    } else if (ord === "random") {
        var s = Math.max(1, Math.round(o.seed || 1)) * 9301 + 49297;
        var rnd = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        for (i = L.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = L[i]; L[i] = L[j]; L[j] = tmp; }
    }
    var base = o.from === "cti" ? t : 1e12;
    if (o.from !== "cti") for (i = 0; i < L.length; i++) base = Math.min(base, L[i].inPoint);
    var n = L.length, span = (o.step || 2) * fd * (n - 1);
    mt_begin("Motion Tools: sfalsa layer");
    try {
        for (i = 0; i < n; i++) {
            var u = n > 1 ? i / (n - 1) : 0;
            if (o.curve === 1) u = u * u; else if (o.curve === 2) u = 1 - (1 - u) * (1 - u); else if (o.curve === 3) u = u * u * (3 - 2 * u);
            var target = inflect_frameRound(comp, base + span * u);
            var ly = L[i], wasLocked = ly.locked;
            if (wasLocked) ly.locked = false;
            ly.startTime += target - ly.inPoint;
            if (wasLocked) ly.locked = true;
        }
        mt_end();
        return inflect_ok({ count: n, span: Math.round(span / fd) });
    } catch (e) { mt_end(); return inflect_err("Sfalsamento non riuscito: " + e.toString()); }
}

