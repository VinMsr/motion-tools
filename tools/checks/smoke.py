import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
import json
from playwright.sync_api import sync_playwright
host = open(os.path.join(ROOT,'jsx','host.jsx'), encoding='utf-8').read()
fake = open(os.path.join(ROOT,'tests','support','fake-browser.js'), encoding='utf-8').read()
init = fake + "\nwindow.__FAKE_SETUP(" + json.dumps(host) + ");"
with sync_playwright() as p:
    b = p.chromium.launch(args=['--allow-file-access-from-files'])
    pg = b.new_page(viewport={'width': 340, 'height': 1400})
    errs = []; evalerr = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
    pg.on('console', lambda m: evalerr.append(m.text[:160]) if 'EVALERR' in m.text else None)
    pg.on('dialog', lambda d: d.dismiss())
    pg.add_init_script(init)
    pg.goto('file://'+os.path.join(ROOT,'index.html')); pg.wait_for_timeout(2500)
    print('stato iniziale:', pg.evaluate("document.querySelector('.status').textContent").strip()[:150])
    views = pg.evaluate("[...document.querySelectorAll('.tab[data-view]')].map(t => t.dataset.view)")
    skip = {'rep-delete', 'tm-folder'}
    for v in views:
        pg.evaluate(f"document.querySelector('.tab[data-view=\"{v}\"]').click()"); pg.wait_for_timeout(600)
        acts = pg.evaluate(f"[...document.querySelectorAll('.view[data-view=\"{v}\"] [data-act]')].filter(e=>e.offsetParent).map(e=>e.dataset.act)")
        for a in dict.fromkeys(acts):
            if a in skip: continue
            pg.mouse.move(150, 300)
            pg.evaluate(f"(() => {{ const e=[...document.querySelectorAll('.view[data-view=\"{v}\"] [data-act=\"{a}\"]')].find(x=>x.offsetParent); if (e) e.click(); }})()")
            pg.wait_for_timeout(250)
            pg.keyboard.press('Escape')
        print(v, '->', len(acts), 'azioni provate')
    pg.wait_for_timeout(1000)
    print('errori JavaScript del pannello:', errs or 'nessuno')
    print('script che After Effects non riuscirebbe a eseguire:', evalerr or 'nessuno')
    ud = []
    for fr in pg.frames:
        try: ud += fr.evaluate("window.__uderr || []")
        except Exception: pass
    print('errori dei gruppi di annullamento:', sorted(set(ud)) or 'nessuno')
    b.close()
