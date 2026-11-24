const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'jsx/host.jsx'), 'utf8');
const a = src.indexOf('var MT_READ_UNIT'), b = src.indexOf('/*\n * Il pannello lo chiama spesso');
const helpers = src.slice(a, b);
// Dipendenze esterne, finte.
const ctx = {
  inflect_ok: (o) => JSON.parse(JSON.stringify(Object.assign({ ok: true }, o))),
  inflect_err: (m) => ({ ok: false, error: m }),
  inflect_activeComp: () => ({ frameDuration: 1 / 25 }),
  mt_textLayers: () => [ctx.layer],
};
const code = helpers + '\n;this.inflect_textReadKeys = inflect_textReadKeys;';
const vm = require('vm');
vm.createContext(ctx);
vm.runInContext(code, ctx);
function prop(match, keys) {
  return { matchName: match, numKeys: keys.length, keyTime: (i) => keys[i - 1].t, keyValue: (i) => keys[i - 1].v,
    keyOutTemporalEase: (i) => [{ speed: keys[i - 1].so, influence: keys[i - 1].io }],
    keyInTemporalEase: (i) => [{ speed: keys[i - 1].si, influence: keys[i - 1].ii }] };
}
const pos = prop('ADBE Text Position', [{ t: 0, v: [0, 38], so: 0, io: 33, si: 0, ii: 33 }, { t: 1.1, v: [0, 0], so: 0, io: 33, si: 200, ii: 60 }]);
const op = prop('ADBE Text Opacity', [{ t: 0, v: 0, so: 0, io: 33, si: 0, ii: 33 }, { t: 1.1, v: 100, so: 0, io: 33, si: 0, ii: 33 }]);
const pgProps = [op, pos];
const anim = {
  property: (k) => (k === 'ADBE Text Selectors' ? { property: () => ({ property: () => ({ value: 3 }) }) } : { numProperties: pgProps.length, property: (i) => pgProps[i - 1] }),
};
const anims = { numProperties: 1, property: () => anim };
const tp = { property: (n) => (n === 'ADBE Text Document' ? { value: { fontSize: 100 } } : anims) };
ctx.layer = { property: () => tp };
test('lettore dei keyframe legge durata, unita e partenza', () => {
  const r = ctx.inflect_textReadKeys();
  assert(r.ok, 'errore: ' + r.error);
  assert(r.preset.unit === 'words', 'unita'); near(r.preset['in'].dur, 1.1, 1e-6, 'durata');
  assert(r.preset['in'].from.opacity === 0 && r.preset['in'].from.y === 38, 'partenza');
});
