/* ---------------------------------------------------------- stato -- */

/**
 * Una sola chiamata con tutto quello che serve al pannello per restare allineato ad After Effects.
 * view = scheda aperta nel pannello: le letture che servono a una scheda sola (Cloner, code di
 * assestamento) si fanno solo quando quella scheda e' aperta, cosi' ogni giro pesa meno.
 */
function inflect_state(view) {
    try {
        var o = { version: INFLECT_VERSION, project: "", comp: null, props: 0, pairs: 0, keys: 0, duration: 0, fps: 0, layers: 0, sig: "", tails: 0 };
        o.project = (app.project && app.project.file) ? app.project.file.displayName : "Progetto senza titolo";
        var comp = inflect_activeComp();
        if (comp) {
            o.comp = comp.name;
            o.fps = 1 / comp.frameDuration;
            o.layers = comp.selectedLayers.length;
            var list = inflect_selectedKeyedProps(comp);
            o.props = list.length;
            for (var i = 0; i < list.length; i++) {
                var k = list[i].keys;
                o.keys += k.length;
                for (var j = 0; j < k.length - 1; j++) {
                    if (k[j + 1] === k[j] + 1) {
                        o.pairs++;
                        if (!o.duration) o.duration = list[i].prop.keyTime(k[j + 1]) - list[i].prop.keyTime(k[j]);
                    }
                }
            }
            o.sig = comp.id + "|" + inflect_selectionSignature(list);
            if (list.length && o.sig !== $.global.MT_LASTSIG) { try { mt_autoClip(comp, list); } catch (eA) {} }
            $.global.MT_LASTSIG = o.sig;
            if (list.length) {
                try { o.propName = list[0].prop.name; } catch (eN) {}
                try { var ly = list[0].prop.propertyGroup(list[0].prop.propertyDepth); o.layerName = ly ? ly.name : ""; } catch (eL) {}
            }
            if (!view || view === "curve") o.tails = mt_tails().length;
            if (!view || view === "repeat") { try { o.repeat = mt_repeatInfo(comp); } catch (eR) { o.repeat = null; } }
        }
        return inflect_ok(o);
    } catch (e) { return inflect_err(e); }
}

