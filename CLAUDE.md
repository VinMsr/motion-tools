# Motion Tools

Pannello CEP per After Effects di Vin (Vincenzo Misuraca), motion designer a Milano.
Curve di easing con libreria di team, Cloner in stile Cavalry, allineamento, guide e righello, animazioni del testo, analisi della timeline, note e libreria condivisa.
Lo usano i colleghi di Vin. In futuro potrebbe essere venduto.

## Regole di lavoro

- **Lingua:** testi dell'interfaccia, note di versione e messaggi in italiano. Frasi brevi e umane, niente lineette lunghe (em dash), niente toni da pubblicità, niente punti esclamativi.
- **Fonti:** il codice per After Effects si basa sulle API ufficiali (After Effects Scripting Guide, CEP Resources di Adobe). Non inventare metodi.
- **Codice altrui:** non copiare codice proprietario di altri plugin (per esempio Kease).
- **Prima le prove:** ogni modifica passa dai controlli qui sotto prima di essere impacchettata.

## Struttura

| Percorso | Cosa contiene |
|---|---|
| `CSXS/manifest.xml` | ID `tools.inflect.panel`, CEP 11, Node attivo. La versione va cambiata in due punti (`ExtensionBundleVersion` e `Version`) |
| `index.html` | Caricatore stabile: legge `panel.html`, CSS e JS dal disco ogni volta (`?t=`). Non va cambiato tra le versioni |
| `panel.html`, `css/style.css`, `css/fonts/` | Interfaccia. Geist è incluso (licenza OFL in `css/fonts/OFL.txt`). In fondo a `style.css` c'è il blocco "2.32 · nuova grafica" che vince su quello storico |
| `js/core.js` | Matematica delle curve |
| `js/editor.js` | Grafico |
| `js/app.js` | Tutto il pannello |
| `js/update.js` | Aggiornamenti da GitHub (testabile in Node) |
| `jsx/src/NN-*.jsx` | Parte che gira in After Effects, **ExtendScript ES3**: niente `let`/`const`, niente arrow function, niente template literal, niente `JSON` nativo |
| `jsx/host.jsx` | Generato da `node tools/build.js`. Non va modificato a mano |
| `tests/*.test.js` | Test in Node. `tests/support/fakeae.js` e `fake-browser.js` simulano After Effects, e sono severi sui gruppi di annullamento |
| `docs/ui-map.md` | Mappa dell'interfaccia: ogni controllo e la funzione a cui è collegato, più le regole di accessibilità |
| `update.json` | Da dove arrivano gli aggiornamenti: `{"github": "utente/repo", "channel": "stable"}` |

## Controlli prima di ogni versione

```bash
node tools/build.js                                    # rigenera jsx/host.jsx e js/build.js
(cd tools/checks && npm install --silent) && node tools/checks/es3-check.js jsx/host.jsx
node tests/run.js                                      # tutti i test devono passare
python3 tools/checks/smoke.py                          # pannello nel browser col finto After Effects (serve Playwright)
python3 tools/checks/overlap.py                        # niente elementi che si sovrappongono
```

## Fare una versione

1. Cambia la versione in `CSXS/manifest.xml`, in tutti e due i punti.
2. Aggiungi le novità in cima a `NOVITA.txt`, nello stile delle voci già presenti: è il testo che finisce nella release.
3. Lancia i controlli qui sopra.
4. Lavora su un ramo `versione-X.Y.Z` e apri una pull request verso `main`.
5. Quando Vin fa il merge, `.github/workflows/release.yml` fa la build, lancia i controlli, crea gli zip e pubblica la release `vX.Y.Z`. Allega `motion-tools-X.Y.Z.zip` e `.sha256` per gli aggiornamenti automatici e `Motion Tools.zip` per l'installazione a mano.

In locale `bash tools/pack.sh` crea gli stessi file in `dist/`.

## Design

La direzione si chiama "esatto, tattile, rapido".

| Elemento | Valori |
|---|---|
| Accento | Uno solo, azzurro `#4aa3ff`. Testo scuro `#0c1a2e` sull'accento, mai bianco |
| Grigi | Ricalcolati dal tema di After Effects (`applyTheme`) |
| Testo | Tre ruoli: `--strong`, `--muted`, `--faint`, tutti sopra 4,5:1 |
| Spazi e controlli | Griglia di 4 px, controlli alti 24 px, raggi 6 (controlli) e 8 (contenitori) |
| Font | Geist 11 px, pesi 400 e 500 |
| Rombo | Il segno del prodotto. Solo su keyframe e scheda attiva |
| Pulsanti | Un solo pulsante azzurro per schermata |

I mockup approvati sono nel canvas "Motion Tools, nuova interfaccia" su claude.ai.

## Beta 3.0 (da fare qui con Claude Code)

- **Stack:** Bolt CEP, cioè Vite, TypeScript e Svelte, con un ID diverso (`tools.inflect.beta`) così la 2.x resta installata accanto.
- **Parte After Effects:** porta le funzioni host esistenti in TypeScript compilato in ES3, senza riscriverne la logica: sono testate.
- **Matematica delle curve:** in un modulo condiviso, così in futuro si porta a UXP.
- **Interfaccia:** riparti dalla mappa in `docs/ui-map.md`.
- **Aggiornamenti:** riusa `js/update.js`, con canale `beta` e release segnate come pre-release su GitHub.
