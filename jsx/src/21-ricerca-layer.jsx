/* -------------------------------------------------- ricerca layer -- */

function mt_isCtrl(l) {
    try { return !!l && String(l.comment).indexOf(MT_TAG) === 0 && mt_fxProp(l, "Distribuzione") !== null; }
    catch (e) { return false; }
}

function mt_isFalloff(l) {
    try { return !!l && String(l.comment).indexOf(MT_FALLOFF_TAG) === 0; } catch (e) { return false; }
}

function mt_findCtrl(comp) {
    var sel = comp.selectedLayers, i;
    for (i = 0; i < sel.length; i++) {
        if (mt_isCtrl(sel[i])) { $.global.MT_LASTCTRL = sel[i].id; return sel[i]; }
        try { if (sel[i].parent && mt_isCtrl(sel[i].parent)) { $.global.MT_LASTCTRL = sel[i].parent.id; return sel[i].parent; } } catch (e) {}
    }
    // Un falloff selezionato porta al Cloner che lo usa: il pannello resta sul suo Cloner.
    for (i = 0; i < sel.length; i++) {
        if (!mt_isFalloff(sel[i])) continue;
        var c = mt_ctrlForFalloff(comp, sel[i]);
        if (c) return c;
    }
    // Mentre scegli nella composizione i layer da aggiungere come input, il Cloner resta quello di prima.
    var pin = mt_pinnedCtrl(comp);
    if (pin) return pin;
    return null;
}

/* Cloner "fissato" dal pannello per due minuti al massimo. */
function mt_pinnedCtrl(comp) {
    var id = $.global.MT_PINCTRL;
    if (!id) return null;
    if (new Date().getTime() - ($.global.MT_PINAT || 0) > 120000) { $.global.MT_PINCTRL = null; return null; }
    for (var l = 1; l <= comp.numLayers; l++) if (comp.layer(l).id === id && mt_isCtrl(comp.layer(l))) return comp.layer(l);
    return null;
}

function inflect_repeatPin(on) {
    var comp = inflect_activeComp();
    if (!on || on === "false") { $.global.MT_PINCTRL = null; return inflect_ok({}); }
    var ctrl = comp ? mt_findCtrl(comp) : null;
    if (!ctrl) return inflect_err("Seleziona il controllo di un Cloner.");
    $.global.MT_PINCTRL = ctrl.id;
    $.global.MT_PINAT = new Date().getTime();
    return inflect_ok({ name: ctrl.name });
}

function mt_ctrlForFalloff(comp, F) {
    var ctrls = [], j, l;
    for (l = 1; l <= comp.numLayers; l++) if (mt_isCtrl(comp.layer(l))) ctrls.push(comp.layer(l));
    if (!ctrls.length) return null;
    var tag = String(F.comment), m = tag.match(/MT_FALLOFF (\d+)/);
    if (m) for (j = 0; j < ctrls.length; j++) if (String(ctrls[j].id) === m[1]) return ctrls[j];
    for (j = 0; j < ctrls.length; j++) {
        var nb = 0;
        try { nb = Math.round(mt_get(ctrls[j], "Comportamenti")); } catch (e) {}
        for (var k = 1; k <= nb; k++) {
            var fp = mt_fxProp(ctrls[j], "B" + k + " Falloff");
            try { if (fp && fp.value === F.index) return ctrls[j]; } catch (e2) {}
        }
    }
    var last = $.global.MT_LASTCTRL;
    for (j = 0; j < ctrls.length; j++) if (ctrls[j].id === last) return ctrls[j];
    return ctrls[0];
}

function mt_meta(ctrl) {
    var o = { src: [], pick: "cycle", front: "last" };
    var parts = String(ctrl.comment).split("|");
    for (var i = 1; i < parts.length; i++) {
        var kv = parts[i].split("=");
        if (kv[0] === "src" && kv[1]) { var ids = kv[1].split(","); for (var j = 0; j < ids.length; j++) o.src.push(parseInt(ids[j], 10)); }
        if (kv[0] === "pick") o.pick = kv[1];
        if (kv[0] === "anch" && kv[1]) { var af = kv[1].split(","); o.anchorSet = true; o.ax = parseFloat(af[0]); o.ay = parseFloat(af[1]); if (isNaN(o.ax)) o.ax = 0.5; if (isNaN(o.ay)) o.ay = 0.5; }
        if (kv[0] === "front") o.front = kv[1];
        if (kv[0] === "v") o.ver = parseInt(kv[1], 10) || 0;
    }
    if (!o.ver) o.ver = 0;
    return o;
}

function mt_writeMeta(ctrl, meta) {
    ctrl.comment = MT_TAG + "|src=" + meta.src.join(",") + "|pick=" + meta.pick + "|front=" + meta.front + (meta.anchorSet ? "|anch=" + (meta.ax === undefined ? 0.5 : meta.ax) + "," + (meta.ay === undefined ? 0.5 : meta.ay) : "") + (meta.ver ? "|v=" + meta.ver : "");
}

/* Ogni copia ricorda inizio, punto d'attacco e fine della sorgente, per lo stagger nel tempo. */
function mt_cloneComment(sIdx, src) {
    return MT_CLONE_TAG + "|s=" + sIdx + "|st=" + src.startTime + "|in=" + src.inPoint + "|out=" + src.outPoint;
}

function mt_cloneTimes(l) {
    var c = String(l.comment), o = { st: null, ip: null, op: null };
    var m1 = /\|st=([-0-9.e]+)/.exec(c), m2 = /\|in=([-0-9.e]+)/.exec(c), m3 = /\|out=([-0-9.e]+)/.exec(c);
    if (m1) o.st = parseFloat(m1[1]);
    if (m2) o.ip = parseFloat(m2[1]);
    if (m3) o.op = parseFloat(m3[1]);
    return o;
}

/*
 * Stagger nel tempo: ogni copia viene spostata nella timeline del ritardo calcolato dai
 * comportamenti sul Tempo, come quando si sfalsano i layer a mano. Si spostano anche i
 * keyframe propri della copia. Inizio e fine visibili restano quelli della sorgente.
 */
function mt_syncTime(comp, ctrl) {
    var clones = mt_clones(comp, ctrl), fd = comp.frameDuration, moved = 0;
    for (var i = 0; i < clones.length; i++) {
        var L = clones[i].layer, T = mt_cloneTimes(L);
        if (T.st === null) continue;
        var d = 0;
        try { d = mt_fxProp(L, "MT Extra").value[2]; } catch (e) { d = 0; }
        if (!isFinite(d)) d = 0;
        var target = T.st + Math.round(d) * fd;
        if (Math.abs(L.startTime - target) > fd / 4) {
            var wasLocked = L.locked;
            if (wasLocked) L.locked = false;
            L.startTime = target;
            try { L.inPoint = T.ip; } catch (e1) {}
            try { L.outPoint = T.op + Math.max(0, Math.round(d)) * fd; } catch (e2) {}
            if (wasLocked) L.locked = true;
            moved++;
        }
    }
    return moved;
}

function mt_cloneSrc(l) {
    var m = /s=(\d+)/.exec(String(l.comment));
    return m ? parseInt(m[1], 10) : 0;
}

function mt_clones(comp, ctrl) {
    var out = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        try { if (!l.parent || l.parent.index !== ctrl.index) continue; } catch (e) { continue; }
        var ip = mt_fxProp(l, "MT Indice");
        if (ip) out.push({ layer: l, i: Math.round(ip.value), s: mt_cloneSrc(l) });
    }
    out.sort(function (a, b) { return a.i - b.i; });
    return out;
}

function mt_pad(n) { var s = String(n + 1); while (s.length < 3) s = "0" + s; return s; }

function mt_uniqueName(comp, base) {
    var k = 1, name, found;
    do {
        name = base + " " + k; found = false;
        for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) { found = true; break; }
        k++;
    } while (found && k < 1000);
    return name;
}

/*
 * Quale input usa la copia i: cycle (a turno), random, pingpong (avanti e indietro),
 * stretch (a blocchi: il primo input per le prime copie, e cosi' via), only:N (sempre lo stesso).
 */
function mt_pick(i, nSrc, pick, seed, n) {
    if (nSrc <= 1) return 0;
    var om = /^only:(\d+)$/.exec(String(pick));
    if (om) return Math.min(nSrc - 1, parseInt(om[1], 10));
    if (pick === "pingpong") { var p = i % (2 * nSrc - 2); return p < nSrc ? p : 2 * nSrc - 2 - p; }
    if (pick === "stretch") return Math.min(nSrc - 1, Math.floor(i * nSrc / Math.max(1, n || nSrc)));
    if (pick === "random") {
        var x = ((i + 1) * 9301 + 49297 + Math.round(seed) * 233) % 233280;
        x = (x * 9301 + 49297) % 233280;
        return Math.floor(x / 233280 * nSrc);
    }
    return i % nSrc;
}

