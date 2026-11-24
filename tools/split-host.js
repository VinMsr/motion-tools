// Spezza jsx/host.jsx in parti per sezione in jsx/src/. Una tantum: poi si lavora sulle parti.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const text = fs.readFileSync(path.join(root, 'jsx/host.jsx'), 'utf8');
const lines = text.split('\n');
const header = /^\/\* [-=]{2,} .+? [-=]{2,} \*\/$/;
const chunks = [];
let cur = { name: 'prelude', lines: [] };
for (const l of lines.slice(0, -1)) {
  if (header.test(l)) { chunks.push(cur); cur = { name: l.replace(/^\/\* [-=]+ /, '').replace(/ [-=]+ \*\/$/, ''), lines: [] }; }
  cur.lines.push(l);
}

chunks.push(cur);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'parte';
fs.mkdirSync(path.join(root, 'jsx/src'), { recursive: true });
chunks.forEach((c, i) => {
  const name = String(i).padStart(2, '0') + '-' + slug(c.name) + '.jsx';
  fs.writeFileSync(path.join(root, 'jsx/src', name), c.lines.join('\n') + '\n');
});
console.log('parti:', chunks.length);
