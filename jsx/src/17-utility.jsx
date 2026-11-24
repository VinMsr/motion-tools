/* -------------------------------------------------------- utility -- */

/** Misure tra i layer selezionati, come il righello di Figma. */
function inflect_measure() {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_ok({ count: 0 });
        var layers = inflect_alignLayers(comp), t = comp.time;
        if (!layers.length) return inflect_ok({ count: 0 });
        var A = inflect_bounds(layers[0], t);
        var o = { count: layers.length, comp: { w: comp.width, h: comp.height }, a: { name: layers[0].name, l: A.l, r: A.r, t: A.t, b: A.b } };
        if (layers.length >= 2) {
            var B = inflect_bounds(layers[1], t);
            o.b = { name: layers[1].name, l: B.l, r: B.r, t: B.t, b: B.b };
            // Positivo: spazio vuoto tra i bordi. Negativo: i layer si sovrappongono di quel tanto.
            o.gapX = B.l >= A.r ? B.l - A.r : (A.l >= B.r ? A.l - B.r : -(Math.min(A.r, B.r) - Math.max(A.l, B.l)));
            o.gapY = B.t >= A.b ? B.t - A.b : (A.t >= B.b ? A.t - B.b : -(Math.min(A.b, B.b) - Math.max(A.t, B.t)));
            o.dx = (B.l + B.r) / 2 - (A.l + A.r) / 2;
            o.dy = (B.t + B.b) / 2 - (A.t + A.b) / 2;
            o.dist = Math.sqrt(o.dx * o.dx + o.dy * o.dy);
        }
        return inflect_ok(o);
    } catch (e) { return inflect_err(e); }
}

/** Imposta lo spazio tra i primi due layer selezionati spostando il secondo. axis: x | y. */
function inflect_setGap(axis, value) {
    try {
        var comp = inflect_activeComp();
        if (!comp) return inflect_err("Apri una composizione.");
        var layers = inflect_alignLayers(comp), t = comp.time;
        if (layers.length < 2) return inflect_err("Seleziona due layer.");
        var A = inflect_bounds(layers[0], t), B = inflect_bounds(layers[1], t), Dx = 0, Dy = 0;
        if (axis === "x") Dx = ((B.l + B.r) >= (A.l + A.r)) ? (A.r + value - B.l) : (A.l - value - B.r);
        else Dy = ((B.t + B.b) >= (A.t + A.b)) ? (A.b + value - B.t) : (A.t - value - B.b);
        mt_begin("Motion Tools: imposta spazio");
        try { inflect_moveComp(layers[1], t, Dx, Dy); }
        catch (e1) { mt_end(); return inflect_err(layers[1].name + (layers[1].locked ? " \u00e8 bloccato." : ": " + e1.toString())); }
        mt_end();
        return inflect_ok({ moved: layers[1].name });
    } catch (e) { return inflect_err(e); }
}


