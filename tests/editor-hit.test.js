// Clic sulle maniglie: il bersaglio si trova per distanza dal mouse.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function node() {
  return { children: [], style: {}, setAttribute() {}, getAttribute() { return null; }, appendChild(c) { this.children.push(c); },
    set textContent(v) { this.children = []; }, get textContent() { return ''; }, addEventListener() {}, contains() { return false; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 300 }; } };
}
global.window = global; global.addEventListener = () => {};
global.document = { createElementNS: node, addEventListener() {} };
global.ResizeObserver = class { observe() {} };
eval(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'));
eval(fs.readFileSync(path.join(root, 'js/editor.js'), 'utf8'));
const C = global.InflectCore, GE = global.InflectEditor.GraphEditor;

function editor() {
  const ed = new GE(node(), {});
  ed.host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 });
  ed.svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 });
  ed.curve = { points: [
    { t: 0, v: 0, ho: { x: 0.1, y: 0 }, hi: { x: 0, y: 0 } },
    { t: 0.5, v: 0.5, hi: { x: -0.02, y: 0 }, ho: { x: 0.02, y: 0 } },
    { t: 1, v: 1, hi: { x: -0.1, y: 0 }, ho: { x: 0, y: 0 } } ] };
  ed.selected = 1;
  return ed;
}

test('clic sul punto prende il punto', () => {
  const ed = editor(), p = ed.curve.points[1];
  const h = ed._hit({ clientX: ed.X(p.t), clientY: ed.Y(p.v) });
  assert(h && h.role === 'point' && h.i === 1, JSON.stringify(h));
});
test('clic a pochi pixel dalla maniglia prende la maniglia', () => {
  const ed = editor(), p = ed.curve.points[1];
  const hx = ed.X(p.t + p.ho.x), hy = ed.Y(p.v + p.ho.y);
  const h = ed._hit({ clientX: hx + 3, clientY: hy });
  assert(h && h.role === 'ho' && h.i === 1, JSON.stringify(h));
});
test('clic lontano non prende niente', () => {
  const ed = editor(), p = ed.curve.points[1];
  assert(ed._hit({ clientX: ed.X(p.t) + 60, clientY: ed.Y(p.v) + 60 }) === null, 'doveva essere null');
});
