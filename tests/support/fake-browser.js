
(function () {
  window.__FAKE_SETUP = function (hostSrc) {
    let W = null;
    const boot = () => { if (W) return W; W = realBoot(); return W; };
    window.__adobe_cep__ = {
      evalScript(src, cb) { setTimeout(() => { const w = boot(); let r; try { r = w.eval(src); } catch (e) { console.log('EVALERR ' + e); r = 'EvalScript error.'; } cb(r === undefined ? 'undefined' : String(r)); }, 3); },
      getHostEnvironment() { return JSON.stringify({ appName: 'AEFT', appVersion: '24.0', appSkinInfo: { baseFontFamily: 'Arial', baseFontSize: 11, panelBackgroundColor: { color: { red: 35, green: 35, blue: 35, alpha: 255 } }, appBarBackgroundColor: { color: { red: 35, green: 35, blue: 35, alpha: 255 } } } }); },
      getSystemPath() { return '/ext'; }, addEventListener() {}, removeEventListener() {}, registerKeyEventsInterest() {}, getExtensionId() { return 'x'; },
      dispatchEvent() {}, closeExtension() {}, getCurrentApiVersion() { return JSON.stringify({ major: 11, minor: 0, micro: 0 }); }, requestOpenExtension() {}, invokeSync() { return ''; }, invokeAsync() {},
    };
    function realBoot() {
    const fr = document.createElement('iframe'); fr.style.display = 'none'; document.documentElement.appendChild(fr);
    const W = fr.contentWindow;
    const factory = W.Function('hostSrc', `
  let nextId = 1000;
  function KeyframeEase(s, i) { this.speed = s; this.influence = i; }
  function CompItem() {} function AVLayer() {} function ShapeLayer() {} function TextLayer() {} function CameraLayer() {} function LightLayer() {} function SolidSource() {} function FolderItem() {}
  function MarkerValue(c) { this.comment = c; this.setParameters = () => {}; this.getParameters = () => ({}); }
  const PVT = { OneD: 6417, TwoD: 6418, ThreeD: 6419, TwoD_SPATIAL: 6413, ThreeD_SPATIAL: 6414, COLOR: 6416, NO_VALUE: 6412, CUSTOM_VALUE: 6420, MARKER: 6421, LAYER_INDEX: 6422, MASK_INDEX: 6423, SHAPE: 6415, TEXT_DOCUMENT: 6424 };
  function node(name, matchName, parent, value) {
    const n = { name, matchName, _parent: parent, _kids: [], enabled: true, expression: '', expressionError: '', expressionEnabled: true,
      value: value === undefined ? 0 : value, _keys: [], propertyType: 6212, propertyValueType: Array.isArray(value) ? (value.length === 3 ? PVT.ThreeD : PVT.TwoD) : PVT.OneD,
      canVaryOverTime: true, canSetExpression: true, isSpatial: false, dimensionsSeparated: false, propertyDepth: 1,
      get numProperties() { return this._kids.length; },
      get numKeys() { return this._keys.length; },
      get propertyIndex() { return parent ? parent._kids.indexOf(this) + 1 : 1; },
      propertyGroup() { return parent || this; },
      property(x) {
        if (typeof x === 'number') return this._kids[x - 1] || null;
        let k = this._kids.find((c) => c.name === x || c.matchName === x);
        if (!k && this.matchName === 'ADBE Effect Parade') return null;
        if (!k) { k = node(x, x, this, defaultFor(x)); this._kids.push(k); }
        return k;
      },
      addProperty(mn) {
        const k = node(mn.replace(/^ADBE /, ''), mn, this);
        if (/Control$/.test(mn)) k._kids.push(node('Valore', mn + '-0001', k, mn.indexOf('Point3D') >= 0 ? [0, 0, 0] : mn.indexOf('Point Control') >= 0 ? [0, 0] : mn.indexOf('Color') >= 0 ? [1, 1, 1, 1] : 0));
        if (mn === 'ADBE Fill') { k._kids.push(node('Colore', 'ADBE Fill-0002', k, [1, 0, 0, 1])); k._kids.push(node('Opacità', 'ADBE Fill-0005', k, 1)); }
        this._kids.push(k); return k;
      },
      remove() { if (parent) parent._kids.splice(parent._kids.indexOf(this), 1); },
      setPropertyParameters() { return this; },
      setValue(v) { this.value = v; }, valueAtTime(t) { return this._keys.length ? this._at(t) : this.value; },
      _at(t) { let b = this._keys[0]; for (const k of this._keys) if (k.t <= t + 1e-9) b = k; return b.v; },
      setValueAtTime(t, v) { const i = this._keys.findIndex((k) => Math.abs(k.t - t) < 1e-6); if (i >= 0) this._keys[i].v = v; else { this._keys.push({ t, v }); this._keys.sort((a, b) => a.t - b.t); } },
      keyValue(k) { return this._keys[k - 1].v; }, keyTime(k) { return this._keys[k - 1].t; }, removeKey(k) { this._keys.splice(k - 1, 1); },
      nearestKeyIndex(t) { let b = 0; this._keys.forEach((k, i) => { if (Math.abs(k.t - t) < Math.abs(this._keys[b].t - t)) b = i; }); return b + 1; },
      // Easing e selezione per keyframe, come in After Effects (per le prove di Copia e Incolla curva).
      setTemporalEaseAtKey(k, i, o) { const K = this._keys[k - 1]; K.ein = i; K.eout = o; },
      setInterpolationTypeAtKey(k, a, b) { const K = this._keys[k - 1]; K.it = a; K.ot = b; },
      keyInTemporalEase(k) { const K = this._keys[k - 1]; return (K && K.ein) || [new KeyframeEase(0, 33)]; },
      keyOutTemporalEase(k) { const K = this._keys[k - 1]; return (K && K.eout) || [new KeyframeEase(0, 33)]; },
      keyInInterpolationType(k) { const K = this._keys[k - 1]; return (K && K.it) || 6613; },
      keyOutInterpolationType(k) { const K = this._keys[k - 1]; return (K && K.ot) || 6613; },
      setTemporalContinuousAtKey() {}, setTemporalAutoBezierAtKey() {},
      setSelectedAtKey(k, on) { const K = this._keys[k - 1]; if (K) K.sel = !!on; },
      get selectedKeys() { const o = []; this._keys.forEach((K, i) => { if (K.sel) o.push(i + 1); }); return o; },
    };
    return n;
  }
  function defaultFor(x) {
    if (x === 'ADBE Position' || x === 'ADBE Anchor Point' || x === 'ADBE Scale') return x === 'ADBE Scale' ? [100, 100] : [0, 0];
    if (x === 'ADBE Opacity') return 100;
    return 0;
  }
  const project = { items: [], get numItems() { return this.items.length; }, item(i) { return this.items[i - 1]; }, activeItem: null,
    layerByID(id) { for (const c of this.items) if (c._layers) { const l = c._layers.find((x) => x.id === id); if (l) return l; } return null; },
    itemByID(id) { return this.items.find((x) => x.id === id) || null; }, file: null };
  function makeLayer(comp, name, kind) {
    const root = node(name, 'root', null);
    const L = Object.setPrototypeOf({ name, id: nextId++, comment: '', parent: null, enabled: true, threeDLayer: false, locked: false, shy: false, label: 0, guideLayer: false,
      inPoint: 0, outPoint: comp.duration, startTime: 0, selected: false, containingComp: comp, _root: root, source: null,
      get index() { return comp._layers.indexOf(this) + 1; },
      property(n) { if (n === 'ADBE Text Properties' && kind !== 'text') return null; return this._root.property(n); },
      sourceRectAtTime() { return { left: 0, top: 0, width: 200, height: 100 }; },
      duplicate() { const d = makeLayer(comp, this.name + ' copia', kind); d.comment = this.comment; d.parent = this.parent; d.threeDLayer = this.threeDLayer; d._root = deepCopy(this._root, null); comp._layers.splice(this.index - 1, 0, d); return d; },
      moveBefore(o) { const a = comp._layers; a.splice(a.indexOf(this), 1); a.splice(a.indexOf(o), 0, this); },
      moveAfter(o) { const a = comp._layers; a.splice(a.indexOf(this), 1); a.splice(a.indexOf(o) + 1, 0, this); },
      remove() { comp._layers.splice(comp._layers.indexOf(this), 1); } }, (kind === 'text' ? TextLayer : kind === 'shape' ? ShapeLayer : AVLayer).prototype);
    L.property('ADBE Transform Group').property('ADBE Position').value = [comp.width / 2, comp.height / 2];
    return L;
  }
  function deepCopy(n, parent) {
    const c = node(n.name, n.matchName, parent, JSON.parse(JSON.stringify(n.value)));
    c.expression = n.expression; c._keys = JSON.parse(JSON.stringify(n._keys)); c.enabled = n.enabled;
    c._kids = n._kids.map((k) => deepCopy(k, c));
    return c;
  }
  function makeComp(name) {
    const C = Object.setPrototypeOf({ name, id: nextId++, width: 1920, height: 1080, duration: 10, frameDuration: 1 / 25, time: 0, comment: '', _layers: [],
      get numLayers() { return this._layers.length; }, layer(i) { return this._layers[i - 1]; },
      get selectedLayers() { return this._layers.filter((l) => l.selected); },
      get selectedProperties() { return this._selProps || []; }, activeCamera: null }, CompItem.prototype);
    C.layers = { addNull() { const l = makeLayer(C, 'Null', 'null'); l.source = { width: 100, height: 100, mainSource: new SolidSource() }; C._layers.unshift(l); return l; },
      addShape() { const l = makeLayer(C, 'Forma', 'shape'); C._layers.unshift(l); return l; } };
    C.markerProperty = node('Marker', 'ADBE Marker', null);
    project.items.push(C);
    return C;
  }

      const G = window;
      Object.assign(G, { KeyframeEase, CompItem, AVLayer, ShapeLayer, TextLayer, CameraLayer, LightLayer, SolidSource, FolderItem, MarkerValue,
        PropertyValueType: PVT, PropertyType: { PROPERTY: 6212, INDEXED_GROUP: 6213, NAMED_GROUP: 6214 }, KeyframeInterpolationType: { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 },
        app: { project,
          beginUndoGroup(n) { G.__ud = (G.__ud || 0); if (G.__ud > 0) (G.__uderr = G.__uderr || []).push('gruppo dentro un gruppo: ' + n); G.__ud++; },
          endUndoGroup() { G.__ud = (G.__ud || 0); if (G.__ud <= 0) (G.__uderr = G.__uderr || []).push('chiuso senza aprire'); else G.__ud--; },
          executeCommand() { if ((G.__ud || 0) > 0) (G.__uderr = G.__uderr || []).push('comando di menu dentro un gruppo'); G.__undos = (G.__undos || 0) + 1; } } });
      G.$ = { global: G, evalFile() {} };
      function Folder(p) { this.fsName = p || '/tmp'; this.exists = false; this.name = 'x'; } Folder.prototype.create = function () { this.exists = true; }; Folder.prototype.getFiles = function () { return []; };
      Folder.userData = new Folder('/user'); Folder.myDocuments = new Folder('/docs');
      function File(p) { this.fsName = p; this.exists = false; this.name = 'f'; } File.prototype.open = function () { return false; }; File.prototype.read = function () { return ''; }; File.prototype.write = function () {}; File.prototype.close = function () {};
      G.Folder = Folder; G.File = File;
      G.eval(hostSrc);
      return { makeComp, makeLayer, project };
    `);
    const fake = factory.call(W, hostSrc);
    window.__FAKE = fake; window.__FAKEWIN = W;
    const comp = fake.makeComp('Main'); fake.project.activeItem = comp;
    const src = fake.makeLayer(comp, 'Logo', 'shape'); comp._layers.push(src); src.selected = true;
    return W;
    }
    window.__unused = {
      evalScript(src, cb) { setTimeout(() => { let r; try { r = W.eval(src); } catch (e) { console.log('EVALERR ' + e); r = 'EvalScript error.'; } cb(r === undefined ? 'undefined' : String(r)); }, 3); },
      getHostEnvironment() { return JSON.stringify({ appName: 'AEFT', appVersion: '24.0', appSkinInfo: { baseFontFamily: 'Arial', baseFontSize: 11, panelBackgroundColor: { color: { red: 35, green: 35, blue: 35, alpha: 255 } }, appBarBackgroundColor: { color: { red: 35, green: 35, blue: 35, alpha: 255 } } } }); },
      getSystemPath() { return '/ext'; }, addEventListener() {}, removeEventListener() {}, registerKeyEventsInterest() {}, getExtensionId() { return 'x'; },
      dispatchEvent() {}, closeExtension() {}, getCurrentApiVersion() { return JSON.stringify({ major: 11, minor: 0, micro: 0 }); }, requestOpenExtension() {}, invokeSync() { return ''; }, invokeAsync() {},
    };
  };
})();
