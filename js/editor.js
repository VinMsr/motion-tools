/*
 * Curve · editor.js
 * Graph editor in SVG: punti, maniglie, aggiunta e rimozione, snap, vista velocità.
 */
(function (root) {
  'use strict';
  const C = root.InflectCore;
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs = {}, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  class GraphEditor {
    constructor(host, { onChange, onSelect, onCommit } = {}) {
      this.host = host;
      this.onChange = onChange || (() => {});
      this.onSelect = onSelect || (() => {});
      this.onCommit = onCommit || (() => {});
      this.curve = null;
      this.selected = -1;
      this.snap = false;
      this.showSpeed = true;
      this.playhead = null;
      this.view = { t0: -0.04, t1: 1.04, v0: -0.1, v1: 1.1 };
      this.drag = null;

      this.svg = el('svg', { class: 'graph', role: 'img', 'aria-label': 'Editor della curva' }, host);
      this.gGrid = el('g', { class: 'g-grid' }, this.svg);
      this.gSpeed = el('g', { class: 'g-speed' }, this.svg);
      this.gCurve = el('g', { class: 'g-curve' }, this.svg);
      this.gHandles = el('g', { class: 'g-handles' }, this.svg);
      this.gPlay = el('g', { class: 'g-play' }, this.svg);

      this.ro = new ResizeObserver(() => this.render());
      this.ro.observe(host);

      // Eventi mouse classici sulla finestra: nel pannello di After Effects sono
      // più affidabili dei pointer event e il trascinamento continua anche fuori dal grafico.
      this.svg.addEventListener('mousedown', (e) => { if (e.button === 0) this._down(e); });
      // Il mouse si muove piu' spesso di quanto lo schermo si aggiorna: si tiene l'ultimo movimento e si
      // ridisegna una volta per fotogramma (requestAnimationFrame), cosi' il trascinamento resta fluido.
      window.addEventListener('mousemove', (e) => {
        if (!this.drag) { this._move(e); return; }
        this._pending = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, altKey: e.altKey, target: e.target };
        if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; const ev = this._pending; this._pending = null; if (ev && this.drag) this._move(ev); });
      });
      window.addEventListener('mouseup', (e) => this._up(e));
      window.addEventListener('blur', () => this._up({}));
      this.svg.addEventListener('dblclick', (e) => this._dbl(e));
      this.svg.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    }

    setCurve(c, keepView = false) {
      this.curve = c;
      if (this.selected >= c.points.length) this.selected = -1;
      if (!keepView) this.fit();
      this.render();
    }

    fit() {
      if (!this.curve) return;
      const [lo, hi] = C.range(this.curve);
      const pad = Math.max(0.08, (hi - lo) * 0.08);
      this.view = { t0: -0.035, t1: 1.035, v0: lo - pad, v1: hi + pad };
    }

    /* ------------------------------------------------------- coordinate -- */
    get size() {
      const r = this.host.getBoundingClientRect();
      return { w: Math.max(80, r.width), h: Math.max(80, r.height) };
    }
    X(t) { const { w } = this.size; return ((t - this.view.t0) / (this.view.t1 - this.view.t0)) * w; }
    Y(v) { const { h } = this.size; return h - ((v - this.view.v0) / (this.view.v1 - this.view.v0)) * h; }
    T(x) { const { w } = this.size; return this.view.t0 + (x / w) * (this.view.t1 - this.view.t0); }
    V(y) { const { h } = this.size; return this.view.v0 + ((h - y) / h) * (this.view.v1 - this.view.v0); }

    local(e) {
      const r = this.svg.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    /* ------------------------------------------------------------ render -- */
    render() {
      if (!this.curve) return;
      const { w, h } = this.size;
      // La griglia si ridisegna solo quando cambiano misura o vista, non a ogni movimento del mouse.
      const gk = [w, h, this.view.t0, this.view.t1, this.view.v0, this.view.v1].join(',');
      if (gk !== this._gridKey) {
        this._gridKey = gk;
        this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        this.svg.setAttribute('width', w);
        this.svg.setAttribute('height', h);
        this._grid(w, h);
      }
      this._speed(w, h);
      this._curve();
      this._handles();
      this._play();
    }

    _grid(w, h) {
      const g = this.gGrid;
      g.textContent = '';
      // Zona oltre i limiti (overshoot / anticipo), tratteggiata leggera.
      const y1 = this.Y(1), y0 = this.Y(0), x0 = this.X(0), x1 = this.X(1);
      el('rect', { x: x0, y: Math.min(y0, y1), width: x1 - x0, height: Math.abs(y0 - y1), class: 'frame' }, g);
      for (let k = 1; k < 10; k++) {
        const t = k / 10;
        el('line', { x1: this.X(t), x2: this.X(t), y1: 0, y2: h, class: k === 5 ? 'grid mid' : 'grid' }, g);
      }
      for (let k = 1; k < 4; k++) {
        const v = k / 4;
        el('line', { x1: 0, x2: w, y1: this.Y(v), y2: this.Y(v), class: 'grid' }, g);
      }
      el('line', { x1: 0, x2: w, y1: y0, y2: y0, class: 'axis' }, g);
      el('line', { x1: 0, x2: w, y1: y1, y2: y1, class: 'axis' }, g);
      const lab = (txt, x, y, anchor = 'start') => {
        const t = el('text', { x, y, class: 'axis-label', 'text-anchor': anchor }, g);
        t.textContent = txt;
      };

    }

    _speed(w, h) {
      const g = this.gSpeed;
      g.textContent = '';
      if (!this.showSpeed) return;
      const s = C.sample(this.curve, this.drag ? 80 : 160);
      const maxS = Math.max(1.2, ...s.map((p) => Math.abs(p.speed)));
      // Il profilo di velocità occupa la fascia bassa del grafico.
      const band = Math.min(56, h * 0.22);
      const base = h - 4;
      let d = `M ${this.X(0)} ${base}`;
      for (const p of s) d += ` L ${this.X(p.t)} ${base - (Math.abs(p.speed) / maxS) * band}`;
      d += ` L ${this.X(1)} ${base} Z`;
      el('path', { d, class: 'speed-area' }, g);

    }

    _curve() {
      const g = this.gCurve;
      g.textContent = '';
      const P = this.curve.points;
      let d = `M ${this.X(P[0].t)} ${this.Y(P[0].v)}`;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1];
        d += ` C ${this.X(a.t + a.ho.x)} ${this.Y(a.v + a.ho.y)}, ${this.X(b.t + b.hi.x)} ${this.Y(b.v + b.hi.y)}, ${this.X(b.t)} ${this.Y(b.v)}`;
      }
      el('path', { d, class: 'curve-hit', 'data-role': 'curve' }, g);
      el('path', { d, class: 'curve-glow' }, g);
      el('path', { d, class: 'curve' }, g);
    }

    _handles() {
      const g = this.gHandles;
      g.textContent = '';
      const P = this.curve.points;
      const simple = P.length === 2;
      const showHandles = (i) => simple || P.length <= 4 || i === this.selected || i === this.selected - 1 || i === this.selected + 1;
      // Prima i punti, poi le maniglie: così una maniglia corta vicino al punto
      // resta sopra il quadratino e si trascina lei, non il keyframe.
      P.forEach((p, i) => {
        const px = this.X(p.t), py = this.Y(p.v);
        const isEnd = i === 0 || i === P.length - 1;
        const cls = 'pt' + (isEnd ? ' end' : '') + (i === this.selected ? ' sel' : '') + (p.broken ? ' broken' : '');
        el('rect', {
          x: px - 4, y: py - 4, width: 8, height: 8, rx: isEnd ? 1 : 0,
          class: cls, 'data-role': 'point', 'data-i': i,
          transform: isEnd ? '' : `rotate(45 ${px} ${py})`,
        }, g);
      });
      P.forEach((p, i) => {
        if (!showHandles(i)) return;
        const px = this.X(p.t), py = this.Y(p.v);
        if (i > 0) this._handle(g, i, 'hi', px, py, p.hi);
        if (i < P.length - 1) this._handle(g, i, 'ho', px, py, p.ho);
      });
    }

    _handle(g, i, side, px, py, h) {
      const hx = this.X(this.curve.points[i].t + h.x), hy = this.Y(this.curve.points[i].v + h.y);
      el('line', { x1: px, y1: py, x2: hx, y2: hy, class: 'stem' }, g);
      el('circle', { cx: hx, cy: hy, r: 4, class: 'knob', 'data-role': side, 'data-i': i }, g);
      // Influenza come in After Effects: lunghezza orizzontale della maniglia sul tratto, in percentuale.
      // L'etichetta sta dal lato opposto all'altro capo del tratto, cosi' non copre la curva.
      const P = this.curve.points, p = P[i], o = side === 'ho' ? P[i + 1] : P[i - 1];
      if (o) {
        const span = Math.abs(o.t - p.t);
        if (span > 1e-6) {
          const pct = Math.round(Math.min(100, Math.abs(h.x) / span * 100));
          const up = o.v < p.v; // l'altro capo sta sotto: etichetta sopra
          const w = this.size.w;
          const x = Math.max(14, Math.min(w - 14, hx));
          const dragging = this.drag && this.drag.i === i && this.drag.role === side;
          // Se dal lato preferito l'etichetta uscirebbe dal grafico, va dall'altro lato.
          const H = this.size.h;
          let y = up ? hy - 10 : hy + 18;
          if (y < 12 || y > H - 4) y = up ? hy + 18 : hy - 10;
          const t = el('text', { x, y, class: 'hpct' + (dragging ? ' on' : ''), 'text-anchor': 'middle' }, g);
          t.textContent = `${pct}%`;
        }
      }
      // Area di presa pi\u00f9 grande del disegno, per non dover mirare al pixel.
      el('circle', { cx: hx, cy: hy, r: 9, class: 'grab', 'data-role': side, 'data-i': i }, g);
    }

    _play() {
      const g = this.gPlay;
      g.textContent = '';
      if (this.playhead == null) return;
      const t = this.playhead;
      const v = C.evaluate(this.curve, t);
      const { h } = this.size;
      el('line', { x1: this.X(t), x2: this.X(t), y1: 0, y2: h, class: 'playline' }, g);
      el('circle', { cx: this.X(t), cy: this.Y(v), r: 4, class: 'playdot' }, g);
    }

    setPlayhead(t) {
      this.playhead = t;
      this._play();
    }

    /* ------------------------------------------------------- interazione -- */
    _snapT(t) { return this.snap ? Math.round(t * 20) / 20 : t; }
    _snapV(v) { return this.snap ? Math.round(v * 20) / 20 : v; }

    /* Maniglie visibili: stessa regola del disegno. */
    _showHandles(i) {
      const P = this.curve.points;
      return P.length === 2 || P.length <= 4 || i === this.selected || i === this.selected - 1 || i === this.selected + 1;
    }

    /*
     * Cerca il bersaglio per distanza dal mouse, non per l'elemento sotto il puntatore:
     * così un clic di un paio di pixel fuori dal cerchietto prende comunque la maniglia
     * più vicina, invece di deselezionare tutto. Le maniglie hanno un raggio un po' più
     * largo dei punti, a parità di distanza vincono loro.
     */
    _hit(e) {
      const m = this.local(e);
      const P = this.curve.points;
      let best = null, bd = Infinity;
      const test = (role, i, x, y, r, bias) => {
        const d = Math.hypot(m.x - x, m.y - y) - bias;
        if (d <= r && d < bd) { bd = d; best = { role, i }; }
      };
      P.forEach((p, i) => {
        if (!this._showHandles(i)) return;
        const px = this.X(p.t), py = this.Y(p.v);
        if (i > 0) test('hi', i, this.X(p.t + p.hi.x), this.Y(p.v + p.hi.y), 13, 2);
        if (i < P.length - 1) test('ho', i, this.X(p.t + p.ho.x), this.Y(p.v + p.ho.y), 13, 2);
      });
      P.forEach((p, i) => test('point', i, this.X(p.t), this.Y(p.v), 10, 0));
      return best;
    }

    _down(e) {
      if (e.button !== 0) return;
      const hit = this._hit(e);
      if (hit) {
        e.preventDefault();
        const { role, i } = hit;
        const p = this.curve.points[i];
        this.drag = {
          role, i, alt: e.altKey,
          start: this.local(e),
          orig: C.clone(p),
          moved: false,
        };
        if (role === 'point' || this.curve.points.length > 2) this.select(i);
        return;
      }
      // Il clic sulla curva (anche vicino) non deve deselezionare: serve al doppio clic per aggiungere un punto.
      const onCurve = e.target.getAttribute && e.target.getAttribute('data-role') === 'curve';
      if (!onCurve) this.select(-1);
    }

    _move(e) {
      const d = this.drag;
      if (!d) {
        if (!this.svg.contains(e.target)) return;
        const hit = this._hit(e);
        const onCurve = e.target.getAttribute && e.target.getAttribute('data-role') === 'curve';
        this.svg.style.cursor = hit ? 'grab' : (onCurve ? 'copy' : 'default');
        return;
      }
      const P = this.curve.points;
      const p = P[d.i];
      const m = this.local(e);
      let dt = this.T(m.x) - this.T(d.start.x);
      let dv = this.V(m.y) - this.V(d.start.y);
      if (e.shiftKey) { if (Math.abs(dt) > Math.abs(dv)) dv = 0; else dt = 0; }
      d.moved = true;

      if (d.role === 'point') {
        const isEnd = d.i === 0 || d.i === P.length - 1;
        if (isEnd) return; // gli estremi restano fissi a 0 e 1
        const lo = P[d.i - 1].t + 0.01, hi = P[d.i + 1].t - 0.01;
        p.t = C.clamp(this._snapT(d.orig.t + dt), lo, hi);
        p.v = this._snapV(d.orig.v + dv);
      } else {
        const side = d.role, other = side === 'hi' ? 'ho' : 'hi';
        const h = { x: d.orig[side].x + dt, y: d.orig[side].y + dv };
        if (this.snap) { h.x = Math.round((p.t + h.x) * 20) / 20 - p.t; h.y = Math.round((p.v + h.y) * 20) / 20 - p.v; }
        p[side] = h;
        if (d.alt || e.altKey) p.broken = true;
        // Maniglie allineate: l'altra ruota mantenendo la sua lunghezza.
        if (!p.broken && P.length > 2 && !(d.i === 0 || d.i === P.length - 1)) {
          const { w, h: hh } = this.size;
          const sx = w / (this.view.t1 - this.view.t0), sy = hh / (this.view.v1 - this.view.v0);
          const len = Math.hypot(d.orig[other].x * sx, d.orig[other].y * sy);
          const ang = Math.atan2(h.y * sy, h.x * sx);
          p[other] = { x: (-Math.cos(ang) * len) / sx, y: (-Math.sin(ang) * len) / sy };
        }
      }
      C.sanitize(this.curve);
      this.render();
      this.onChange(this.curve, true);
    }

    _up(e) {
      // L'ultimo movimento in attesa si applica prima di chiudere il trascinamento.
      if (this._pending && this.drag) { const ev = this._pending; this._pending = null; this._move(ev); }
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
      const d = this.drag;
      this.drag = null;
      if (d && d.moved) {
        const [lo, hi] = C.range(this.curve);
        if (lo < this.view.v0 + 0.02 || hi > this.view.v1 - 0.02) this.fit();
        this.render();
        this.onCommit(this.curve);
      }
    }

    _dbl(e) {
      const hit = this._hit(e);
      if (hit && hit.role === 'point') {
        if (C.removePoint(this.curve, hit.i)) { this.select(-1); this.render(); this.onCommit(this.curve); }
        return;
      }
      if (hit) return;
      const m = this.local(e);
      const t = this.T(m.x);
      if (t <= 0.01 || t >= 0.99) return;
      // Aggiunge solo vicino alla curva, per non creare punti per sbaglio.
      const v = C.evaluate(this.curve, t);
      if (Math.abs(this.Y(v) - m.y) > 18) return;
      const idx = C.addPointAt(this.curve, t);
      this.select(idx);
      this.render();
      this.onCommit(this.curve);
    }

    _wheel(e) {
      e.preventDefault();
      const k = Math.exp(e.deltaY * 0.0015);
      const m = this.local(e);
      const v = this.V(m.y);
      this.view.v0 = v + (this.view.v0 - v) * k;
      this.view.v1 = v + (this.view.v1 - v) * k;
      this.render();
    }

    select(i) {
      this.selected = i;
      this.render();
      this.onSelect(i);
    }

    deleteSelected() {
      if (C.removePoint(this.curve, this.selected)) {
        this.select(-1);
        this.onCommit(this.curve);
      }
    }
  }

  /** Miniatura statica per le card della libreria. */
  function thumb(curve, w = 56, h = 36) {
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'thumb', 'aria-hidden': 'true' });
    const [lo, hi] = C.range(curve);
    const pad = 4;
    const X = (t) => pad + t * (w - pad * 2);
    const Y = (v) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2);
    el('line', { x1: pad, x2: w - pad, y1: Y(0), y2: Y(0), class: 't-axis' }, svg);
    el('line', { x1: pad, x2: w - pad, y1: Y(1), y2: Y(1), class: 't-axis' }, svg);
    const s = C.sample(curve, 48);
    el('path', { d: s.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' '), class: 't-curve' }, svg);
    return svg;
  }

  root.InflectEditor = { GraphEditor, thumb };
})(window);
