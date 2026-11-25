# Motion Tools, nuova interfaccia: collegamenti alle funzioni

Riferimento per la 3.0 beta. Ogni controllo dei mockup è collegato a quello che il pannello 2.31 sa già fare.

- **C** collega: usa un'azione o una chiamata che esiste già.
- **S** sposta: la funzione esiste ma cambia posto, per esempio finisce in un menu.
- **N** nuovo: va scritto. Accanto c'è cosa serve.

## Accento azzurro, contrasti calcolati (WCAG 2.1)

| Uso | Colori | Contrasto | Minimo |
|---|---|---|---|
| Curva, keyframe, selezione, focus su fondo grafico | #4aa3ff su #141416 | 6,99:1 | 3:1 |
| Stessi elementi sul pannello | #4aa3ff su #1d1d20 | 6,39:1 | 3:1 |
| Riga selezionata | #4aa3ff su #26262a | 5,72:1 | 3:1 |
| Testo sul pulsante principale | #0c1a2e su #4aa3ff | 6,63:1 | 4,5:1 |
| Pulsante principale al passaggio | #0c1a2e su #6cb8ff | 8,26:1 | 4,5:1 |
| Testo secondario sul fondo più chiaro | #b4b4bc su #2f2f34 | oltre 6:1 | 4,5:1 |
| Testo attenuato sul fondo della riga | #9b9ba4 su #26262a | 4,95:1 | 4,5:1 |

Il testo bianco sull'azzurro si ferma a 2,63:1, quindi sul blu il testo è sempre scuro. Per confronto, il blu di After Effects (#2d8ceb) col testo bianco arriva a 3,46:1 e non passa.

## Barra in alto (tutte le schede)

| Elemento | Stato | Collegamento |
|---|---|---|
| Menu gruppo Anima, Disponi, Progetto | N | Raggruppa le 9 `.tab[data-view]` esistenti: `showView(name)` resta uguale |
| Schede col nome | C | `.tab[data-view]` e `showView` |
| Impostazioni | S | Menu con Controlla aggiornamenti (`updateCheck(true)`), cartella aggiornamenti (`inflect_updateChooseFolder`), cartella team (`tm-folder`) |
| Barra di stato | C | `#selinfo` e `#toast` |

## Curve

| Elemento | Stato | Collegamento |
|---|---|---|
| Nome curva modificabile, tipo "Semplice" | C | `#curveName`, `#curveKind` |
| Dal vivo | C | `data-act="live"`, `setLive()` |
| Leggi | C | `data-act="read"` |
| Copia, Incolla sui keyframe | C | `copy-keys`, `paste-keys` |
| Annulla, Ripeti nella curva | C | `undo`, `redo` |
| Griglia, Velocità | C | `snap`, `speed` |
| Menu "Altro" | S | `paste-curve` (incolla da testo), `smooth`, `invert`, aiuto (`.help`) |
| Grafico, maniglie, velocità in grigio | C | `editor.js` |
| Striscia dei fotogrammi e play | C | `#spacing`, `drawSpacing()`, `data-act="play"` |
| 600 ms a 25 fps | S | `#durMs`, `#fps`, spostati sotto la striscia |
| Valori x1 y1 x2 y2 | C | `renderInspector()`. Le curve a più punti mostrano il punto selezionato, come oggi |
| Copia come CSS | C | Formati da `renderInspector` (CSS, Lottie, SwiftUI, Android, JSON). Nella beta diventa "Copia come…" con il formato |
| Genera | C | `#gens`, `renderGen()`, chip `data-gen` |
| Velocità, reset | C | `#speed`, `speed-reset`, `#speedNote` |
| Entrata, Entrambi, Uscita | C | `#modeSeg` |
| Salva, Applica | C | `save-user`, `apply` (Invio) |
| Stato vuoto | C | `#emptyCurve` con "Disegna comunque". Nel mockup non si vede, resta |

## Testo

| Elemento | Stato | Collegamento |
|---|---|---|
| Nome del layer | C | `#txSel` |
| Riga sotto il nome (ha già X, nessuna animazione) | C | `#txSub`, da `inflect_textState` |
| Menu "Altro" | C | `tx-more`: leggi dal layer, salva dal layer, `txImport`, `txRemove` |
| Anteprima grande con riparti | C | Pozzetto fisso `#txStage`, `tx-replay`, `txPreview()`, sul testo del layer (`txSampleText`) |
| Rombi delle parole nella striscia | N | Calcolabili da `txDelays()`: posizione di ogni unità nel tempo |
| Leggi dal layer | C | `txReadButton()` |
| Preset, I miei, Team | C | Schede `#txTabs` con i conteggi, `TX_BUILTIN`, `txUserSection()` con cartelle, `TEAM.text`. Ricorda la scheda in `mt.txTab` |
| Elenco al posto della griglia di riquadri | C | Stessi dati di `txCard()`. Il passaggio del mouse anima l'anteprima grande |
| Anima, Fase, Durata, Sfalsamento, Spostamento, Opacità, Curva | C | Righe di `txEditor()` |
| "Scala, rotazione, sfocatura e altri 5" | S | Le altre righe di `txEditor()`, chiuse per partire da quelle principali |
| Aggiorna il layer mentre modifichi | C | Check "Dal vivo" di `txEditor()` |
| Salva come preset, Applica (barra in basso) | C | `tx-save` (animazione aperta, oppure quella del layer), `tx-apply` |

## Libreria

| Elemento | Stato | Collegamento |
|---|---|---|
| Cerca in tutte le curve | C | `#search`, `matches()` |
| Sezione del team con menu | C | `#secBrand`, `brandmenu` |
| Conteggi nei titoli delle sezioni | C | `#cntBrand`, `#cntUser`, `#cntProject`, `#cntPreset` |
| Righe con i quattro valori | C | `.meta` di `renderList()` |
| Le mie curve, Progetto, Preset | C | `#secUser`/`usermenu`, `#secProject`/`projectmenu`, `#secPreset` |
| Curva selezionata aperta, Apri in Curve, Applica | C | Clic = `setCurve()` e la riga si allarga. Apri in Curve = `showView('curve')`, Applica e doppio clic o Invio = `apply()`. Nella scheda Libreria la barra Curve è nascosta |
| "Altre 4" | N | Solo interfaccia: mostra il resto della sezione |
| Avviso "2.31 installato, Ricarica" | S | Oggi è un toast. Ricarica = `reloadPanel()`, Dopo = chiude l'avviso. Il testo segue il caso `pending()` di `updateCheck` |

## Cloner, nuovo

| Elemento | Stato | Collegamento |
|---|---|---|
| Anteprima | C | `#repPreview`, `drawNewPreview()` |
| Intestazione "Da Logo e Pallino" | C | `selLabel()`, nomi da `inflect_state` (`selNames`) |
| 7 distribuzioni | C | Riquadri `distTiles()` con `DIST_GLYPH`, anche nella modifica |
| Torna al Cloner | C | `rep-back`, visibile dopo Nuovo |
| Colonne, Righe (o Quantità, Livelli) | C | `renderRepeatNew()` |
| Sorgenti, Posizione, Davanti, 3D, Nascondi | C | `N.pick`, `N.place`, `N.front`, `N.threeD`, `N.hide` |
| Crea Cloner | C | `rep-create`, `inflect_repeatCreate` |

## Cloner, modifica

| Elemento | Stato | Collegamento |
|---|---|---|
| Nome e riepilogo | C | `#repName`, `#repMeta` |
| Nuovo, Animazioni, Rileggi, Altro | C | `rep-new`, `rep-recipe`, `rep-refresh`, `rep-menu` |
| Conteggi di Falloff, Comportamenti, Input | C | `#repFallN`, `#repBehN`, `#repSrcN` |
| Rombo keyframe accanto ai valori | C | `kf()` e `inflect_repeatKey`: vuoto, animato, keyframe al tempo corrente |
| Distribuzione e parametri | C | `renderRepeatBody()`, `inflect_repeatSet` |
| Falloff, forma, Dimensione, Morbidezza, Intensità | C | `falloffBlock()`, `rep-add-fall`, `inflect_falloffSet` |
| "Sulle copie: Scala, colore" | C | `fallLinkRow()` (comportamenti legati al falloff) e colore input |
| Mantieni gli spazi | C | Opzione `mtPush` già nel Cloner |
| Comportamenti | C | `behaviourBlock()`, `rep-add-beh` |
| Colori e testi, Trasforma, Input | C | `#repListBody`, `#repTrBody`, `#repSrcBody` |
| Modifiche dal vivo (nessun "Aggiorna") | C | Ogni valore chiama già `setParam()` |

## Note

| Elemento | Stato | Collegamento |
|---|---|---|
| Intestazione: comp, note da fare, marcatori | C | `ntHead()` |
| Ritmo della comp in alto, Rileggi | C | `#ntSvg`, `drawNoteRhythm()`, `analyze` |
| Timeline della comp con marcatori e note (mockup) | S | Durata e fps arrivano già da `inflect_state`, i tempi delle note da `inflect_notesList`, i marcatori da `renderSync()`. **Manca il tempo corrente:** va aggiunto a `inflect_state`. Clic su un punto = `inflect_noteGo` |
| Nuova nota, Firma, Comp o Layer selezionato | C | `renderNoteNew()` |
| Aggiungi al tempo attuale, Cmd+Invio | C | `inflect_noteAdd` |
| Elenco, Questa comp o Progetto, Mostra le fatte | C | `renderNotes()` |
| Timecode che porta al momento | C | `inflect_noteGo` |
| Modifica, Elimina, fatta | C | `inflect_noteSet` |
| Marcatori collegati, comp principale, Usa questa | C | `renderSync()`, `inflect_mainSet` |
| Aggiungi ovunque, togli, Riallinea tutte, comp nuove | C | `inflect_syncAdd`, `inflect_syncRemove`, `inflect_syncAll`, `inflect_syncAuto` |

## Allinea

| Elemento | Stato | Collegamento |
|---|---|---|
| Intestazione con i layer e la comp | C | `#alSel`, `#alSub` in `applyState()`, nomi da `selNames` |
| Alla comp, Alla selezione, Come blocco | C | `#alignTarget`, `#alignGroup` (interruttore) |
| Striscia: allinea, centra, distribuisci | C | `[data-align]`, `[data-dist]`. Distribuisci spento sotto i tre layer (`applyState()`) |
| Punto di ancoraggio | C | `#anchorGrid`, `inflect_anchor` |
| Gruppi con conteggio, Salva la selezione | C | `#groupList`, `#groupN`, `group-new` |
| Guide | C | `#gBody` |

## Utility

| Elemento | Stato | Collegamento |
|---|---|---|
| Intestazione con i layer | C | `#utSel`, `#utSub` |
| Righello nel pozzetto, didascalia | C | `#rulerSvg`, `#rulerCap`, `refreshRuler()`, `drawRuler()` |
| Spazio X e Y scrivibili | C | `#rulerData`, `inflect_setGap` |
| Animazione: Copia e incolla, Sposta, Sfalsa | C | Schede `#utTabs` (`mt.utTab`), `#cpBody`, `#ofBody`, `#stBody` |
| Composizione, Liste, Cartelle del progetto | C | `precomp-fit`, `comp-fit`, `#liBody`, `consolida` |

## Analisi

| Elemento | Stato | Collegamento |
|---|---|---|
| Comp, durata, ora della lettura, Aggiorna | C | `#anComp`, `#anMeta`, `analyze` |
| Ritmo nel pozzetto | C | `#anSvg`, `drawChart()`, clic = `seek()` |
| Tre numeri | C | `#anStats` |
| Riquadro dei passaggi lineari, Selezionali | C | `#anTodo`, `select-linear` |
| Momenti, layer, easing | C | `renderAnalysis()` |

## Team

| Elemento | Stato | Collegamento |
|---|---|---|
| Nome, cartella con lo stato, Altro | C | `#tmName`, `#tmFolder` (pallino verde, grigio solo qui, arancio irraggiungibile), `tm-menu` |
| File master: elenco, + Master | C | `#tmMasters`, `renderMasters()`, `tm-master-add`, dati in `TEAM.masters` ({id, name, desc, path, reuse}) |
| Riga aperta: Importa, Mostra nel Finder, Modifica, Togli | C | `masterImport()` su `inflect_masterImport`, `inflect_masterReveal`, `masterSheet()` |
| Quante volte nel progetto, data, anteprima PNG, non trovato | C | `inflect_masterCounts` (commento `MT_MASTER=id` sulla cartella), `inflect_masterStat` |
| Nuovo master: File con Sfoglia, Nome, Descrizione, Riusa i file | C | `masterSheet()`, `inflect_masterPick` |
| Prima volta: Scegli la cartella, Per ora solo qui | C | `#tmSetup`, `tm-folder`, `tm-later` (`mt.teamLater`) |
| Palette a strisce, clic su un colore | C | `.tmpal`, `applyColor()`, `tm-palette` |
| Animazioni di testo, curve, liste | C | Si aprono in Testo, Curve, Utility. Sezioni vuote con l'azione per crearle |

## Accessibilità, da rispettare nella beta (WCAG 2.1 AA, più la 2.5.8 della 2.2)

| Controllo | Regola |
|---|---|
| Valori trascinabili | `role="spinbutton"` con `aria-valuenow`, min e max, e un nome (`aria-labelledby` sull'etichetta). Le frecce cambiano il valore, Shift+freccia ×10, Invio apre il campo per scrivere |
| Dal vivo, 3D | `role="switch"` con `aria-checked`, e si attiva anche con Spazio |
| Caselle | `role="checkbox"` con `aria-checked`, con il testo dentro il bersaglio |
| Rombo keyframe | Bersaglio di 24 × 24 px (il disegno resta di 10 px), `aria-pressed` e un nome che dice cosa succede ("Aggiungi keyframe a Distanza") |
| Segmentati | Pulsanti alti 24 px. Si comportano come `radiogroup` e si scorrono con le frecce |
| Focus | Anello azzurro da 2 px (#4aa3ff, oltre 5:1 su ogni fondo). Mai togliere `outline` senza sostituirlo |
| Stati | Selezione = fondo più chiaro + bordo azzurro, non solo colore. Pulsanti disattivati con `disabled` e il motivo scritto vicino |
| Stato vuoto Curve | Si vede `#emptyCurve` con il motivo, e la fascia in basso dice perché Velocità e Applica sono spente |
