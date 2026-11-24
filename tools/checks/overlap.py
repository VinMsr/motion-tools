import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
from playwright.sync_api import sync_playwright
JS = """() => {
  document.querySelectorAll('details').forEach(d => d.open = true);
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'; };
  const out = [];
  // testo che esce dal suo pulsante
  document.querySelectorAll('button, .plabel, label').forEach(e => { if (vis(e) && e.children.length === 0 && e.scrollWidth > e.clientWidth + 2) out.push('TAGLIATO: ' + e.textContent.trim().slice(0, 20) + ' (' + e.clientWidth + 'px)'); });
  // fratelli che si sovrappongono nella stessa riga
  document.querySelectorAll('.seg, .prow, .tools, .btnrow, .chiprow, .rephead, .btnpair').forEach(row => {
    const kids = [...row.children].filter(vis);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const r = kids[i].getBoundingClientRect(), q = kids[j].getBoundingClientRect();
      const w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (w > 2 && h > 2) out.push('SOVRAPPOSTI: ' + kids[i].textContent.trim().slice(0, 14) + ' / ' + kids[j].textContent.trim().slice(0, 14));
    }
  });
  return [...new Set(out)].slice(0, 15);
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--allow-file-access-from-files'])
    for w in [260, 320, 420]:
        pg = b.new_page(viewport={'width': w, 'height': 1200})
        pg.goto('file://'+os.path.join(ROOT,'index.html')); pg.wait_for_timeout(1200)
        for v in pg.evaluate("[...document.querySelectorAll('.tab[data-view]')].map(t => t.dataset.view)"):
            pg.evaluate(f"document.querySelector('.tab[data-view=\"{v}\"]').click()"); pg.wait_for_timeout(400)
            o = pg.evaluate(JS)
            if o: print(w, v, o)
        pg.close()
    b.close()
print('fine')
