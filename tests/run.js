// Esegue i test in tests/*.test.js. Uso: node tests/run.js
const fs = require('fs');
const path = require('path');
const dir = __dirname;
let fail = 0, pass = 0;
global.test = (name, fn) => {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); }
};
global.assert = (cond, msg) => { if (!cond) throw new Error(msg || 'asserzione fallita'); };
global.near = (a, b, eps, msg) => assert(Math.abs(a - b) <= (eps || 1e-6), (msg || 'valore') + ': ' + a + ' vs ' + b);
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort()) require(path.join(dir, f));
console.log(`\n${pass} ok, ${fail} falliti`);
process.exit(fail ? 1 : 0);
