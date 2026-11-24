const acorn = require('acorn'), fs = require('fs');
const f = process.argv[2], src = fs.readFileSync(f, 'utf8');
try { acorn.parse(src, { ecmaVersion: 3, allowReserved: false }); console.log('ES3 OK', f); }
catch (e) { const l = src.split('\n')[e.loc.line - 1]; console.log('ES3 ERRORE', f, e.message, '\n', l); }
