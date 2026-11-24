/*
 * Curve · core.js
 * Modello delle curve, valutazione, generatori ed esportazioni.
 * Nessuna dipendenza dal DOM: si testa anche con Node.
 *
 * Una curva vive nello spazio normalizzato: tempo 0..1, valore 0 → 1.
 * points: [{ t, v, hi:{x,y}, ho:{x,y}, broken }]
 *   hi = maniglia in entrata (x ≤ 0), ho = maniglia in uscita (x ≥ 0), relative al punto.
 */
(function (root) {
  'use strict';

  const EPS = 1e-6;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const uid = () => 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const round = (x, n = 3) => Math.round(x * 10 ** n) / 10 ** n;

  /* ----------------------------------------------------------- costruzione -- */

  function point(t, v, hi, ho, broken = false) {
    return { t, v, hi: { x: hi[0], y: hi[1] }, ho: { x: ho[0], y: ho[1] }, broken };
  }

  /** Curva semplice da notazione cubic-bezier(x1, y1, x2, y2). */
  function fromCubic(x1, y1, x2, y2, meta = {}) {
    return makeCurve([
      point(0, 0, [0, 0], [x1, y1]),
      point(1, 1, [x2 - 1, y2 - 1], [0, 0]),
    ], meta);
  }

  function makeCurve(points, meta = {}) {
    return sanitize({
      id: meta.id || uid(),
      name: meta.name || 'Senza nome',
      group: meta.group || '',
      notes: meta.notes || '',
      tags: meta.tags || [],
      points,
      updated: Date.now(),
    });
  }

  function clone(c) { return JSON.parse(JSON.stringify(c)); }

  function isSimple(c) { return c.points.length === 2; }

  function toCubic(c) {
    if (!isSimple(c)) return null;
    const [a, b] = c.points;
    return [round(a.ho.x), round(a.ho.y), round(1 + b.hi.x), round(1 + b.hi.y)];
  }

  /** Tiene le maniglie dentro il proprio segmento (AE non accetta influenze oltre il 100%). */
  function sanitize(c) {
    const P = c.points;
    P.sort((a, b) => a.t - b.t);
    P[0].t = 0; P[0].v = 0;
    P[P.length - 1].t = 1; P[P.length - 1].v = 1;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const prevDt = i > 0 ? p.t - P[i - 1].t : 0;
      const nextDt = i < P.length - 1 ? P[i + 1].t - p.t : 0;
      p.hi.x = clamp(p.hi.x, -prevDt, 0);
      p.ho.x = clamp(p.ho.x, 0, nextDt);
      if (i === 0) { p.hi.x = 0; p.hi.y = 0; }
      if (i === P.length - 1) { p.ho.x = 0; p.ho.y = 0; }
    }
    return c;
  }

  /* ----------------------------------------------------------- valutazione -- */

  function bez(p0, p1, p2, p3, u) {
    const m = 1 - u;
    return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3;
  }
  function bezD(p0, p1, p2, p3, u) {
    const m = 1 - u;
    return 3 * m * m * (p1 - p0) + 6 * m * u * (p2 - p1) + 3 * u * u * (p3 - p2);
  }

  function segmentCtrl(c, i) {
    const a = c.points[i], b = c.points[i + 1];
    return {
      x: [a.t, a.t + a.ho.x, b.t + b.hi.x, b.t],
      y: [a.v, a.v + a.ho.y, b.v + b.hi.y, b.v],
    };
  }

  /** Risolve u tale che x(u) = t (x è monotona grazie a sanitize). */
  function solveU(x, t) {
    let lo = 0, hi = 1, u = (t - x[0]) / Math.max(EPS, x[3] - x[0]);
    for (let k = 0; k < 8; k++) {
      const err = bez(x[0], x[1], x[2], x[3], u) - t;
      if (Math.abs(err) < 1e-7) return u;
      const d = bezD(x[0], x[1], x[2], x[3], u);
      if (Math.abs(d) < 1e-6) break;
      u = clamp(u - err / d, 0, 1);
    }
    for (let k = 0; k < 40; k++) {
      u = (lo + hi) / 2;
      if (bez(x[0], x[1], x[2], x[3], u) < t) lo = u; else hi = u;
    }
    return u;
  }

  function evaluate(c, t) {
    t = clamp(t, 0, 1);
    const P = c.points;
    let i = 0;
    while (i < P.length - 2 && t > P[i + 1].t) i++;
    const s = segmentCtrl(c, i);
    const u = solveU(s.x, t);
    return bez(s.y[0], s.y[1], s.y[2], s.y[3], u);
  }

  /** Campiona la curva: [{t, v, speed}] con velocità normalizzata (1 = lineare). */
  function sample(c, n = 120) {
    const out = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      out.push({ t, v: evaluate(c, t) });
    }
    for (let k = 0; k <= n; k++) {
      const a = out[Math.max(0, k - 1)], b = out[Math.min(n, k + 1)];
      out[k].speed = (b.v - a.v) / Math.max(EPS, b.t - a.t);
    }
    return out;
  }

  function range(c) {
    let lo = 0, hi = 1;
    for (const p of c.points) {
      lo = Math.min(lo, p.v, p.v + p.hi.y, p.v + p.ho.y);
      hi = Math.max(hi, p.v, p.v + p.hi.y, p.v + p.ho.y);
    }
    return [lo, hi];
  }

  /* ------------------------------------------------- conversione per AE -- */

  /**
   * Piano da passare a host.jsx: slope = dv/dt normalizzato, handleX = lunghezza
   * orizzontale della maniglia. AE ricava l'influenza dividendo per la durata del segmento.
   */
  function toAEPlan(c, mode = 'both', snapFrames = true) {
    const points = c.points.map((p) => ({
      t: p.t,
      v: p.v,
      inSlope: Math.abs(p.hi.x) > EPS ? p.hi.y / p.hi.x : 0,
      inHandleX: Math.abs(p.hi.x),
      outSlope: Math.abs(p.ho.x) > EPS ? p.ho.y / p.ho.x : 0,
      outHandleX: Math.abs(p.ho.x),
    }));
    return { points, mode, snapFrames };
  }

  /** Inverso: dai dati letti in AE a una curva modificabile. */
  function fromAEPoints(pts, meta = {}) {
    const points = pts.map((p, i) => {
      const prevDt = i > 0 ? p.t - pts[i - 1].t : 0;
      const nextDt = i < pts.length - 1 ? pts[i + 1].t - p.t : 0;
      let hx = -p.inHandleX, hy = p.inSlope * p.inHandleX * -1;
      let ox = p.outHandleX, oy = p.outSlope * p.outHandleX;
      if (p.inLinear && i > 0) { hx = -prevDt / 3; hy = -(p.v - pts[i - 1].v) / 3; }
      if (p.outLinear && i < pts.length - 1) { ox = nextDt / 3; oy = (pts[i + 1].v - p.v) / 3; }
      const broken = Math.abs(Math.atan2(hy, -hx) - Math.atan2(oy, ox)) > 0.02;
      return point(p.t, p.v, [hx, hy], [ox, oy], broken);
    });
    // Normalizza per sicurezza: primo 0, ultimo 1.
    return makeCurve(points, meta);
  }

  /* ------------------------------------------------------------- modifica -- */

  /** Rotazione di 180°: scambia accelerazione e decelerazione (ease-in ⇄ ease-out). */
  function invert(c) {
    const P = c.points.slice().reverse().map((p) => point(
      1 - p.t, 1 - p.v,
      [-p.ho.x, -p.ho.y], [-p.hi.x, -p.hi.y], p.broken));
    return sanitize(Object.assign(clone(c), { points: P }));
  }

  /** Maniglie automatiche (tipo Catmull-Rom) con estremi piatti. */
  function smooth(c, tension = 1) {
    const P = c.points;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const prev = P[i - 1], next = P[i + 1];
      let slope = 0;
      if (prev && next) {
        const isExtreme = (p.v - prev.v) * (next.v - p.v) <= 0;
        slope = isExtreme ? 0 : (next.v - prev.v) / (next.t - prev.t);
      }
      if (prev) { const dx = (p.t - prev.t) / 3 * tension; p.hi = { x: -dx, y: -slope * dx }; }
      if (next) { const dx = (next.t - p.t) / 3 * tension; p.ho = { x: dx, y: slope * dx }; }
      p.broken = false;
    }
    return sanitize(c);
  }

  function addPointAt(c, t) {
    const v = evaluate(c, t);
    const dt = 0.002;
    const slope = (evaluate(c, t + dt) - evaluate(c, t - dt)) / (2 * dt);
    const P = c.points;
    let i = 0;
    while (i < P.length - 1 && P[i + 1].t < t) i++;
    const prevDt = t - P[i].t, nextDt = P[i + 1].t - t;
    const hx = prevDt / 3, ox = nextDt / 3;
    const np = point(t, v, [-hx, -slope * hx], [ox, slope * ox]);
    P.splice(i + 1, 0, np);
    // Accorcia le maniglie vicine per non uscire dai nuovi segmenti.
    sanitize(c);
    return i + 1;
  }

  function removePoint(c, idx) {
    if (idx <= 0 || idx >= c.points.length - 1) return false;
    c.points.splice(idx, 1);
    sanitize(c);
    return true;
  }

  /* ----------------------------------------------------------- generatori -- */

  const SINE = 0.3642; // maniglia che approssima mezzo periodo di coseno

  function flatPoint(t, v, prevDt, nextDt, k = SINE) {
    return point(t, v, [-prevDt * k, 0], [nextDt * k, 0]);
  }

  /**
   * Molla: overshoot = ampiezza del primo picco (0.02–0.8), cycles = numero di picchi,
   * attack = quanto è più lungo il primo tratto rispetto ai rimbalzi.
   */
  function genSpring({ overshoot = 0.25, cycles = 3, attack = 1.2, launch = 0.6 } = {}) {
    const n = Math.max(1, Math.round(cycles));
    const decay = Math.pow(0.012 / Math.max(0.012, overshoot), 1 / Math.max(1, n));
    const durs = [attack];
    for (let k = 0; k < n; k++) durs.push(1);
    const total = durs.reduce((a, b) => a + b, 0);
    let t = 0;
    const raw = [{ t: 0, v: 0 }];
    for (let k = 0; k < n; k++) {
      t += durs[k];
      const amp = overshoot * Math.pow(decay, k);
      raw.push({ t: t / total, v: 1 + (k % 2 === 0 ? amp : -amp) });
    }
    raw.push({ t: 1, v: 1 });
    const pts = raw.map((r, i) => {
      const prevDt = i > 0 ? r.t - raw[i - 1].t : 0;
      const nextDt = i < raw.length - 1 ? raw[i + 1].t - r.t : 0;
      return flatPoint(r.t, r.v, prevDt, nextDt);
    });
    // Partenza: 0 = morbida, 1 = scattante.
    const d0 = raw[1].t;
    pts[0].ho = { x: d0 * (SINE - 0.12 * launch), y: 0.5 * launch * raw[1].v * (SINE - 0.12 * launch) };
    return makeCurve(pts, { name: 'Molla' });
  }

  /** Rimbalzo a terra: bounces = numero di rimbalzi, elasticity = coefficiente di restituzione. */
  function genBounce({ bounces = 3, elasticity = 0.45 } = {}) {
    const n = Math.max(1, Math.round(bounces));
    const e = clamp(elasticity, 0.1, 0.9);
    // Caduta: metà arco di durata 1. Ogni rimbalzo: arco intero di durata 2·e^k, altezza e^(2k).
    const segs = [{ dur: 1, kind: 'fall' }];
    for (let k = 1; k <= n; k++) segs.push({ dur: 2 * Math.pow(e, k), h: Math.pow(e, 2 * k), kind: 'arc' });
    const total = segs.reduce((a, s) => a + s.dur, 0);
    const pts = [];
    let t = 0;
    pts.push(point(0, 0, [0, 0], [(1 / total) / 3, 0])); // apice iniziale: velocità nulla
    t = 1 / total;
    let impact = point(t, 1, [-(1 / total) / 3, -2 / 3], [0, 0], true);
    pts.push(impact);
    for (let k = 1; k < segs.length; k++) {
      const d = segs[k].dur / total, h = segs[k].h;
      const half = d / 2;
      // Parabola esatta: maniglie a 1/3 della durata, 2/3 del dislivello all'impatto.
      impact.ho = { x: half / 3, y: -(2 / 3) * h };
      const apex = point(t + half, 1 - h, [-half / 3, 0], [half / 3, 0]);
      pts.push(apex);
      t += d;
      impact = point(Math.min(1, t), 1, [-half / 3, -(2 / 3) * h], [0, 0], true);
      pts.push(impact);
    }
    pts[pts.length - 1].t = 1;
    return makeCurve(pts, { name: 'Rimbalzo' });
  }

  /** Anticipo + overshoot: carica all'indietro, scatta, supera e si assesta. */
  function genAnticipate({ anticipation = 0.12, overshoot = 0.1, windup = 0.3 } = {}) {
    const raw = [{ t: 0, v: 0 }];
    let start = 0;
    if (anticipation > 0.001) { start = clamp(windup, 0.1, 0.6); raw.push({ t: start, v: -anticipation }); }
    if (overshoot > 0.001) raw.push({ t: start + (1 - start) * 0.5, v: 1 + overshoot });
    raw.push({ t: 1, v: 1 });
    const c = makeCurve(raw.map((r) => point(r.t, r.v, [0, 0], [0, 0])), { name: 'Anticipo' });
    return smoothFlat(c);
  }

  /** Come smooth, ma con tutti i punti interni piatti (estremi del movimento). */
  function smoothFlat(c) {
    const P = c.points;
    for (let i = 0; i < P.length; i++) {
      const prevDt = i > 0 ? P[i].t - P[i - 1].t : 0;
      const nextDt = i < P.length - 1 ? P[i + 1].t - P[i].t : 0;
      P[i].hi = { x: -prevDt * SINE, y: 0 };
      P[i].ho = { x: nextDt * SINE, y: 0 };
    }
    return sanitize(c);
  }

  /* --------------------------------------------------------------- preset -- */

  const PRESETS = [
    ['Lineare', 'Base', [0, 0, 1, 1]],
    ['Easy Ease (AE)', 'Base', [0.333, 0, 0.667, 1]],
    ['Ease', 'Base', [0.25, 0.1, 0.25, 1]],
    ['Sine in-out', 'In-out', [0.37, 0, 0.63, 1]],
    ['Cubic in-out', 'In-out', [0.65, 0, 0.35, 1]],
    ['Quint in-out', 'In-out', [0.83, 0, 0.17, 1]],
    ['Expo in-out', 'In-out', [0.87, 0, 0.13, 1]],
    ['Cubic out', 'Uscita veloce', [0.33, 1, 0.68, 1]],
    ['Quint out', 'Uscita veloce', [0.22, 1, 0.36, 1]],
    ['Expo out', 'Uscita veloce', [0.16, 1, 0.3, 1]],
    ['Back out', 'Uscita veloce', [0.34, 1.56, 0.64, 1]],
    ['Cubic in', 'Entrata lenta', [0.32, 0, 0.67, 0]],
    ['Expo in', 'Entrata lenta', [0.7, 0, 0.84, 0]],
    ['Back in', 'Entrata lenta', [0.36, 0, 0.66, -0.56]],
    ['Material standard', 'Sistemi', [0.2, 0, 0, 1]],
    ['Material emphasized', 'Sistemi', [0.05, 0.7, 0.1, 1]],
    ['iOS default', 'Sistemi', [0.25, 0.1, 0.25, 1]],
    ['Fluent rapid', 'Sistemi', [0, 0, 0, 1]],
  ];

  function presetLibrary() {
    const curves = PRESETS.map(([name, group, b], i) => {
      const c = fromCubic(b[0], b[1], b[2], b[3], { name, group, id: 'preset_' + i });
      c.readonly = true;
      return c;
    });
    const gens = [
      Object.assign(genSpring({ overshoot: 0.22, cycles: 3 }), { name: 'Molla morbida', group: 'Multi punto', id: 'preset_spring' }),
      Object.assign(genSpring({ overshoot: 0.45, cycles: 5 }), { name: 'Molla vivace', group: 'Multi punto', id: 'preset_spring2' }),
      Object.assign(genBounce({ bounces: 3, elasticity: 0.45 }), { name: 'Rimbalzo', group: 'Multi punto', id: 'preset_bounce' }),
      Object.assign(genAnticipate({}), { name: 'Anticipo e overshoot', group: 'Multi punto', id: 'preset_antic' }),
    ];
    gens.forEach((g) => (g.readonly = true));
    return curves.concat(gens);
  }

  /* ----------------------------------------------------------- esportazioni -- */

  function exportsFor(c, durationMs = 600) {
    const out = {};
    const cb = toCubic(c);
    if (cb) {
      const s = cb.join(', ');
      out.css = `cubic-bezier(${s})`;
      out.lottie = JSON.stringify({ o: { x: [cb[0]], y: [cb[1]] }, i: { x: [cb[2]], y: [cb[3]] } });
      out.swiftui = `.timingCurve(${s}, duration: ${round(durationMs / 1000, 2)})`;
      out.android = `PathInterpolator(${cb.map((n) => n + 'f').join(', ')})`;
      out.figma = `Custom bezier ${s}`;
    } else {
      out.css = cssLinear(c);
    }
    out.json = JSON.stringify({ name: c.name, points: c.points }, null, 0);
    return out;
  }

  /** Funzione CSS linear() per curve multi punto: campioni fitti dove la curva cambia. */
  function cssLinear(c, n = 48) {
    const parts = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      parts.push(`${round(evaluate(c, t), 4)} ${round(t * 100, 2)}%`);
    }
    return `linear(${parts.join(', ')})`;
  }

  /* ------------------------------------------------------ curve da testo -- */

  /*
   * Curve incollate come testo (per esempio da Inter Motion Lab). Accetta:
   *  (a) una curva: { name, group, notes, points: [{ t, v, hi:{x,y}, ho:{x,y}, broken }] }
   *  (b) una libreria: { curves: [...] }, come i file .inflect.json
   *  (c) un array di curve
   *  (d) quattro numeri "x1, y1, x2, y2" (anche dentro cubic-bezier(...)): una curva semplice
   * I valori v intermedi possono uscire da 0..1 (rimbalzi, cariche) e le maniglie spezzate restano
   * spezzate. Restituisce { curves, name } oppure { error } con il problema scritto in italiano.
   */
  function parseCurvesText(text) {
    let s = String(text == null ? '' : text).trim();
    if (!s) return { error: 'Il riquadro è vuoto: incolla il testo della curva con Cmd+V.' };
    // Blocchi di codice copiati da una chat o da un editor: ```json ... ```
    const fence = /^```[a-z]*\s*([\s\S]*?)\s*```$/i.exec(s);
    if (fence) s = fence[1].trim();
    let data;
    try { data = JSON.parse(s); }
    catch (e) {
      const nums = s.replace(/^cubic-bezier\s*\(/i, '').replace(/\)\s*;?$/, '').split(/[\s,;]+/).filter(Boolean);
      if (nums.length === 4 && nums.every((n) => /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(n))) {
        const [x1, y1, x2, y2] = nums.map(Number);
        if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return { error: `x1 e x2 devono stare tra 0 e 1 (hai scritto ${x1} e ${x2}). y1 e y2 invece possono uscire, per un rimbalzo o una carica.` };
        return { curves: [fromCubic(x1, y1, x2, y2, { name: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})` })], name: '' };
      }
      if (nums.length && nums.length !== 4 && nums.every((n) => /^[-+]?[\d.]+$/.test(n))) return { error: `Servono quattro numeri, x1, y1, x2, y2: ne ho trovati ${nums.length}.` };
      return { error: 'Il testo non è JSON valido e non sono quattro numeri. Controlla di averlo copiato tutto, dalla prima { o [ all’ultima } o ].' };
    }
    let list, name = '';
    if (Array.isArray(data)) list = data;
    else if (data && typeof data === 'object' && Array.isArray(data.curves)) { list = data.curves; name = typeof data.name === 'string' ? data.name : ''; }
    else if (data && typeof data === 'object' && Array.isArray(data.points)) list = [data];
    else if (data && typeof data === 'object' && 'curves' in data) return { error: '"curves" deve essere un elenco di curve, tra parentesi quadre.' };
    else return { error: 'Non trovo curve: serve un oggetto con "points", una libreria con "curves" oppure un elenco di curve.' };
    if (!list.length) return { error: 'L’elenco delle curve è vuoto.' };
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const r = curveFromData(list[i], list.length > 1 ? `curva ${i + 1}` : 'curva');
      if (r.error) return r;
      out.push(r.curve);
    }
    return { curves: out, name };
  }

  function curveFromData(c, where) {
    const num = (x) => typeof x === 'number' ? x : (typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN);
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: `La ${where} non è un oggetto con name e points.` };
    const label = c.name ? `${where} "${c.name}"` : where;
    if (!Array.isArray(c.points)) return { error: `Nella ${label} manca "points", l’elenco dei punti.` };
    if (c.points.length < 2) return { error: `La ${label} ha ${c.points.length} ${c.points.length === 1 ? 'punto' : 'punti'}: ne servono almeno 2, l’inizio e la fine.` };
    const pts = [];
    const n = c.points.length;
    for (let k = 0; k < n; k++) {
      const p = c.points[k], at = `il punto ${k + 1} della ${label}`;
      if (!p || typeof p !== 'object') return { error: `${cap(at)} non è un oggetto { t, v, hi, ho }.` };
      const t = num(p.t), v = num(p.v);
      if (!isFinite(t)) return { error: `A ${at} manca "t", il tempo da 0 a 1.` };
      if (!isFinite(v)) return { error: `A ${at} manca "v", il valore.` };
      const hd = (h, nm, need) => {
        if (h == null) return need ? { error: `A ${at} manca "${nm}" (${nm === 'hi' ? 'maniglia in entrata' : 'maniglia in uscita'}), con x e y.` } : { x: 0, y: 0 };
        const x = num(h.x), y = num(h.y);
        if (!isFinite(x) || !isFinite(y)) return { error: `In ${at} la maniglia "${nm}" deve avere x e y numerici.` };
        return { x, y };
      };
      const hi = hd(p.hi, 'hi', k > 0), ho = hd(p.ho, 'ho', k < n - 1);
      if (hi.error) return hi;
      if (ho.error) return ho;
      if (hi.x > 1e-9) return { error: `In ${at} la maniglia in entrata "hi" deve avere x ≤ 0 (è relativa al punto e guarda indietro).` };
      if (ho.x < -1e-9) return { error: `In ${at} la maniglia in uscita "ho" deve avere x ≥ 0.` };
      pts.push(point(t, v, [hi.x, hi.y], [ho.x, ho.y], !!p.broken));
    }
    for (let k = 1; k < n; k++) if (!(pts[k].t > pts[k - 1].t)) return { error: `Nella ${label} i tempi "t" devono crescere: il punto ${k + 1} (t ${pts[k].t}) non viene dopo il punto ${k} (t ${pts[k - 1].t}).` };
    if (Math.abs(pts[0].t) > 1e-3 || Math.abs(pts[n - 1].t - 1) > 1e-3) return { error: `La ${label} deve andare da t 0 a t 1: va da ${pts[0].t} a ${pts[n - 1].t}.` };
    if (Math.abs(pts[0].v) > 1e-3 || Math.abs(pts[n - 1].v - 1) > 1e-3) return { error: `La ${label} deve partire da v 0 e arrivare a v 1 (i punti in mezzo possono uscire da 0..1): parte da ${pts[0].v} e arriva a ${pts[n - 1].v}.` };
    const tags = Array.isArray(c.tags) ? c.tags.filter((x) => typeof x === 'string') : [];
    const curve = makeCurve(pts, { id: typeof c.id === 'string' && c.id ? c.id : undefined, name: String(c.name || 'Curva incollata'), group: String(c.group || ''), notes: String(c.notes || ''), tags });
    return { curve };
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ------------------------------------------------------------- libreria -- */

  function emptyLibrary(name = 'Brand') {
    return { format: 'inflect-library', version: 1, name, owner: '', locked: false, curves: [], updated: Date.now() };
  }

  function validateLibrary(lib) {
    if (!lib || typeof lib !== 'object' || !Array.isArray(lib.curves)) return null;
    lib.curves = lib.curves.filter((c) => c && Array.isArray(c.points) && c.points.length >= 2).map((c) => {
      c.id = c.id || uid();
      c.name = c.name || 'Senza nome';
      c.group = c.group || '';
      c.points = c.points.map((p) => point(+p.t, +p.v, [+p.hi.x, +p.hi.y], [+p.ho.x, +p.ho.y], !!p.broken));
      return sanitize(c);
    });
    lib.format = 'inflect-library';
    lib.version = 1;
    return lib;
  }

  /** Confronto tra due curve semplici (per l'audit e per evidenziare il preset attivo). */
  function sameCurve(a, b, tol = 0.01) {
    if (a.points.length !== b.points.length) return false;
    for (let i = 0; i < a.points.length; i++) {
      const p = a.points[i], q = b.points[i];
      if (Math.abs(p.t - q.t) > tol || Math.abs(p.v - q.v) > tol) return false;
      if (Math.abs(p.ho.x - q.ho.x) > tol || Math.abs(p.ho.y - q.ho.y) > tol) return false;
      if (Math.abs(p.hi.x - q.hi.x) > tol || Math.abs(p.hi.y - q.hi.y) > tol) return false;
    }
    return true;
  }

  const api = {
    point, fromCubic, makeCurve, clone, isSimple, toCubic, sanitize,
    evaluate, sample, range, toAEPlan, fromAEPoints,
    invert, smooth, smoothFlat, addPointAt, removePoint,
    genSpring, genBounce, genAnticipate, presetLibrary,
    exportsFor, cssLinear, emptyLibrary, validateLibrary, sameCurve, uid, round, clamp, parseCurvesText,
  };
  // In After Effects il pannello gira con Node attivo, quindi "module" esiste:
  // l'API va comunque esposta sulla finestra.
  root.InflectCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
