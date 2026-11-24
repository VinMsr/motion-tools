// Cartelle NEW e OLD: sposta gli elementi della comp attiva, anche dentro le precomp.
const fs = require('fs'), vm = require('vm');
const path = require('path'); const assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
const code = src;
test('sposta nella cartella nuova gli elementi usati dalla comp, anche nelle precomp', () => {
function Folder(name, id, parent) { this.name = name; this.id = id; this.parentFolder = parent || this; }
Folder.prototype = {};
function FolderItem() {} function CompItem() {} function FootageItem() {}
function mk(Ctor, name, id, parent) { const o = Object.create(Ctor.prototype); Object.assign(o, { name, id, parentFolder: parent }); return o; }
const root = Object.assign(Object.create(FolderItem.prototype), {name:'Root', id:1}); root.parentFolder = root;
const oldF = mk(FolderItem, 'OLD', 2, root), newF = mk(FolderItem, 'NEW', 3, root);
const logo = mk(FootageItem, 'Logo.mov', 10, oldF);
const pack = mk(CompItem, 'Pack', 11, oldF); pack.numLayers = 1; pack.frameDuration = 1/25;
pack.layer = (i) => ({ source: logo });
const other = mk(FootageItem, 'Altro.png', 12, newF);
const comp = mk(CompItem, 'main', 99, root); comp.numLayers = 2; comp.layer = (i) => ({ source: i === 1 ? pack : other });
const items = [root, oldF, newF, logo, pack, other, comp];
const ctx = { CompItem, FolderItem, FootageItem, $: { global: {} },
  app: { beginUndoGroup() {}, endUndoGroup() {}, project: { numItems: items.length, item: (i) => items[i - 1], activeItem: comp } } };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const r = JSON.parse(ctx.inflect_consolidate('OLD', 'NEW'));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.moved, 2);
assert.strictEqual(logo.parentFolder.name, 'NEW'); assert.strictEqual(pack.parentFolder.name, 'NEW'); assert.strictEqual(other.parentFolder.name, 'NEW');
});
