/*
 * Motion Tools · aggiornamenti da GitHub
 *
 * Il pannello legge l'ultima release di un repository pubblico, scarica lo zip
 * "motion-tools-X.Y.Z.zip", controlla l'impronta SHA-256, lo apre in una cartella
 * di appoggio e passa la cartella a After Effects per l'installazione.
 * Niente di quello che c'e' qui tocca l'estensione installata: se qualcosa va storto
 * resta la versione di prima.
 *
 * Funziona sia nel pannello (window.MTUpdate) sia in Node per i test (module.exports).
 */
(function (root) {
  'use strict';

  const ASSET_RE = /^motion-tools-(\d+(?:\.\d+){1,3})\.zip$/i;

  function verCmp(a, b) {
    const x = String(a).split('.'), y = String(b).split('.');
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  // "owner/repo", anche incollato come URL di GitHub.
  function normRepo(s) {
    const m = String(s || '').trim().replace(/\.git$/, '').match(/(?:github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/?$/);
    return m ? `${m[1]}/${m[2]}` : '';
  }

  function releasesUrl(repo, channel) {
    return channel === 'beta'
      ? `https://api.github.com/repos/${repo}/releases?per_page=10`
      : `https://api.github.com/repos/${repo}/releases/latest`;
  }

  // Dalla risposta di GitHub (una release o un elenco) alla versione da scaricare.
  function pickRelease(json, channel) {
    const list = Array.isArray(json) ? json : [json];
    for (const r of list) {
      if (!r || r.draft) continue;
      if (r.prerelease && channel !== 'beta') continue;
      const assets = r.assets || [];
      const zip = assets.find((a) => ASSET_RE.test(a.name || ''));
      if (!zip) continue;
      const version = zip.name.match(ASSET_RE)[1];
      const shaAsset = assets.find((a) => a.name === zip.name + '.sha256');
      const digest = /^sha256:([0-9a-f]{64})$/i.test(zip.digest || '') ? zip.digest.slice(7).toLowerCase() : null;
      return {
        version,
        tag: r.tag_name || '',
        prerelease: !!r.prerelease,
        zipUrl: zip.browser_download_url,
        zipName: zip.name,
        size: zip.size || 0,
        sha256: digest,
        shaUrl: shaAsset ? shaAsset.browser_download_url : null,
        notes: String(r.body || '').slice(0, 800),
      };
    }
    return null;
  }

  // Lettore ZIP minimo: file salvati o compressi con deflate, senza ZIP64.
  function unzip(buf, zlib) {
    const u32 = (o) => buf.readUInt32LE(o), u16 = (o) => buf.readUInt16LE(o);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (u32(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Lo zip è rovinato: manca la fine dell’archivio.');
    const count = u16(eocd + 10);
    let p = u32(eocd + 16);
    const out = [];
    for (let k = 0; k < count; k++) {
      if (u32(p) !== 0x02014b50) throw new Error('Lo zip è rovinato: indice non valido.');
      const method = u16(p + 10), csize = u32(p + 20), usize = u32(p + 24);
      const nlen = u16(p + 28), elen = u16(p + 30), clen = u16(p + 32), off = u32(p + 42);
      const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
      p += 46 + nlen + elen + clen;
      if (u32(off) !== 0x04034b50) throw new Error('Lo zip è rovinato: file ' + name + ' non trovato.');
      const start = off + 30 + u16(off + 26) + u16(off + 28);
      const raw = buf.slice(start, start + csize);
      const clean = name.replace(/\\/g, '/');
      if (/^\//.test(clean) || /(^|\/)\.\.(\/|$)/.test(clean) || /^[A-Za-z]:/.test(clean)) throw new Error('Lo zip contiene un percorso non valido: ' + name);
      if (clean.endsWith('/')) { out.push({ name: clean, dir: true }); continue; }
      let data;
      if (method === 0) data = raw;
      else if (method === 8) data = zlib.inflateRawSync(raw);
      else throw new Error('Compressione non supportata in ' + name);
      if (data.length !== usize) throw new Error('Lo zip è rovinato: ' + name + ' ha una dimensione diversa.');
      out.push({ name: clean, data });
    }
    return out;
  }

  // Le cartelle che contengono CSXS/manifest.xml, dalla piu' vicina alla radice.
  function findPackageRoot(entries) {
    const roots = entries.filter((e) => !e.dir && /(^|\/)CSXS\/manifest\.xml$/.test(e.name))
      .map((e) => e.name.replace(/CSXS\/manifest\.xml$/, ''))
      .sort((a, b) => a.split('/').length - b.split('/').length);
    return roots.length ? roots[0] : null;
  }

  function manifestInfo(text) {
    const id = (String(text).match(/ExtensionBundleId="([^"]+)"/) || [])[1] || '';
    const version = (String(text).match(/ExtensionBundleVersion="([0-9.]+)"/) || [])[1] || '';
    return { id, version };
  }

  /* --- parti che usano Node: rete e disco --------------------------------- */

  function get(node, url, opts, hops) {
    opts = opts || {};
    hops = hops || 0;
    return new Promise((resolve, reject) => {
      if (hops > 5) return reject(new Error('Troppi reindirizzamenti da GitHub.'));
      const req = node.https.get(url, {
        headers: Object.assign({ 'User-Agent': 'MotionTools-Updater', Accept: opts.json ? 'application/vnd.github+json' : 'application/octet-stream' }, opts.headers || {}),
        timeout: opts.timeout || 20000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(get(node, new URL(res.headers.location, url).toString(), opts, hops + 1));
        }
        if (res.statusCode === 404) { res.resume(); return reject(new Error('Repository o release non trovati su GitHub. Il repository deve essere pubblico.')); }
        if (res.statusCode === 403) { res.resume(); return reject(new Error('GitHub ha limitato le richieste da questa rete. Riprovo più tardi.')); }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('GitHub ha risposto ' + res.statusCode + '.')); }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('GitHub non risponde. Controlla la connessione.')));
      req.on('error', (e) => reject(e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN' ? new Error('Nessuna connessione a GitHub.') : e));
    });
  }

  async function latest(node, repo, channel) {
    const buf = await get(node, releasesUrl(repo, channel), { json: true, timeout: 12000 });
    return pickRelease(JSON.parse(buf.toString('utf8')), channel);
  }

  function mkdirp(node, dir) { node.fs.mkdirSync(dir, { recursive: true }); }
  function rmrf(node, p) {
    try {
      if (!node.fs.existsSync(p)) return;
      if (node.fs.rmSync) node.fs.rmSync(p, { recursive: true, force: true });
      else node.fs.rmdirSync(p, { recursive: true });
    } catch (e) {}
  }

  // Scarica, verifica e apre lo zip. Restituisce la cartella del pacchetto pronta da installare.
  async function download(node, rel, stageDir, expectedId, onProgress) {
    const dir = node.path.join(stageDir, rel.version);
    rmrf(node, dir);
    mkdirp(node, dir);
    if (onProgress) onProgress('download');
    const zip = await get(node, rel.zipUrl, { timeout: 60000 });
    let want = rel.sha256;
    if (!want && rel.shaUrl) {
      const t = (await get(node, rel.shaUrl, { timeout: 15000 })).toString('utf8');
      want = (t.match(/[0-9a-f]{64}/i) || [])[0];
      want = want ? want.toLowerCase() : null;
    }
    const have = node.crypto.createHash('sha256').update(zip).digest('hex');
    if (want && want !== have) throw new Error('Il file scaricato non corrisponde alla release (impronta diversa). Non installo niente.');
    if (onProgress) onProgress('unzip');
    const entries = unzip(zip, node.zlib);
    const rootRel = findPackageRoot(entries);
    if (rootRel === null) throw new Error('Nello zip non c’è Motion Tools (manca CSXS/manifest.xml).');
    for (const e of entries) {
      if (!e.name.startsWith(rootRel)) continue;
      const dest = node.path.join(dir, 'motion-tools', e.name.slice(rootRel.length));
      if (e.dir) { mkdirp(node, dest); continue; }
      mkdirp(node, node.path.dirname(dest));
      node.fs.writeFileSync(dest, e.data);
    }
    const pkg = node.path.join(dir, 'motion-tools');
    const info = manifestInfo(node.fs.readFileSync(node.path.join(pkg, 'CSXS', 'manifest.xml'), 'utf8'));
    if (expectedId && info.id !== expectedId) throw new Error('Lo zip contiene un’altra estensione (' + info.id + ').');
    if (verCmp(info.version, rel.version) !== 0) throw new Error('Lo zip dice ' + info.version + ' ma la release è ' + rel.version + '.');
    return { pkg, version: info.version, verified: !!want };
  }

  const api = { verCmp, normRepo, releasesUrl, pickRelease, unzip, findPackageRoot, manifestInfo, get, latest, download, ASSET_RE };
  // In CEP con Node attivo esiste anche "module": il pannello legge sempre window.MTUpdate.
  if (typeof window !== 'undefined') window.MTUpdate = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
