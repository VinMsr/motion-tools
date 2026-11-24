# Motion Tools: aggiornamenti da GitHub e beta con Claude Code

## 1. Come si aggiorna da solo

Il pannello controlla GitHub due volte:

- **All'apertura**, dopo 8 secondi. Se c'è una versione nuova la scarica, la installa e si ricarica da solo. Non si perde niente, perché il pannello è appena stato aperto.
- **Ogni 30 minuti** mentre è aperto. Se trova una versione nuova la scarica e la installa, poi in alto compare "Versione X installata, Ricarica". Finché non premi Ricarica continui a lavorare con quella di prima.

Per ogni versione nuova il pannello fa questi passi:
1. chiede a GitHub qual è l'ultima release del repository;
2. confronta il numero con la versione installata;
3. scarica `motion-tools-X.Y.Z.zip` e controlla che la sua impronta SHA-256 sia quella pubblicata;
4. apre lo zip in una cartella di appoggio, `~/Library/Application Support/Motion Tools/updates`, e verifica che dentro ci sia proprio Motion Tools con la versione giusta;
5. salva una copia della versione in uso in `.../Motion Tools/backup/precedente`;
6. copia i file nuovi nella cartella dell'estensione e svuota la cache di CEP.

Se uno di questi passi non va a buon fine, non cambia niente e resta la versione di prima.
Da **Impostazioni**, l'icona in alto a destra, puoi tornare alla versione precedente con un clic.

Se il repository non è impostato, il pannello continua a usare la cartella condivisa sul NAS, come prima.

## 2. Preparare GitHub (una volta sola)

1. Crea un account su github.com, il piano gratuito basta.
2. In alto a destra apri **+** e poi **New repository**:
   - nome: `motion-tools`;
   - **Public**: deve essere pubblico, altrimenti i pannelli non possono scaricare senza password;
   - spunta "Add a README";
   - premi **Create repository**.
3. Scrivimi il nome completo, per esempio `vinmsr/motion-tools`. Lo metto in `update.json` e da quella versione in poi tutti i pannelli guardano GitHub da soli.
   Per provarlo subito sul tuo computer: **Impostazioni**, poi **Aggiornamenti da GitHub…**, scrivi `utente/motion-tools`, canale `stable`.

> Attenzione: in un repository pubblico chiunque può scaricare gli zip, e il codice dentro si può leggere. Per i colleghi va bene. Quando lo venderai, i download passeranno da licenze personali, come spiegato al punto 5.

## 3. Pubblicare una versione

Per ogni versione ti mando la cartella `github` con due file:

- `motion-tools-X.Y.Z.zip`
- `motion-tools-X.Y.Z.zip.sha256`

Per pubblicarli:

1. Apri il repository su GitHub e, nella colonna a destra, premi **Releases** e poi **Draft a new release**.
2. In **Choose a tag** scrivi `vX.Y.Z`, per esempio `v2.32.0`, e premi **Create new tag**.
3. In **Release title** scrivi `Motion Tools X.Y.Z`. Nella descrizione incolla le novità prese da `NOVITA.txt`.
4. Trascina i due file nel riquadro "Attach binaries".
5. Lascia **spento** "Set as a pre-release" e premi **Publish release**.

Entro mezz'ora tutti i pannelli aperti la trovano. Gli altri la trovano alla prossima apertura.

### Canale beta

Puoi provare una versione su una persona sola:

1. Pubblicala come sopra, ma con **"Set as a pre-release" acceso**.
2. Sul computer di chi la prova: **Impostazioni**, poi **Aggiornamenti da GitHub…**, canale `beta`.

Gli altri restano su `stable` e non la vedono.

### Limiti

GitHub permette 60 controlli all'ora per ogni rete senza login. Ogni pannello ne fa 2 all'ora, quindi con un ufficio fino a una ventina di persone non ci sono problemi.

## 4. Beta 3.0 con Claude Code

### Cosa serve

- **Claude Code sul Mac.** Scaricalo dalla pagina ufficiale, https://docs.anthropic.com/en/docs/claude-code/overview, con lo stesso account che usi qui.
- **Node.js LTS**, da nodejs.org: serve per la build e i test.
- **Il sorgente di Motion Tools**, lo zip `motion-tools-sorgente.zip`. Aprilo in una cartella di lavoro, per esempio `~/Sviluppo/motion-tools`.

### Primo avvio

1. Apri il Terminale nella cartella del sorgente:
   ```bash
   cd ~/Sviluppo/motion-tools
   claude
   ```
2. Come primo messaggio puoi scrivere:
   > Leggi CLAUDE.md, docs/ui-map.md e docs/GUIDA.md. Prepara il progetto della beta 3.0 con Bolt CEP (TypeScript e Svelte) in una cartella `beta/` con ID `tools.inflect.beta`, porta la parte After Effects esistente senza cambiarne la logica e collega la cartella di build alle estensioni di After Effects così la provo subito. Prima di scrivere codice proponimi il piano.

Claude Code legge `CLAUDE.md` da solo: lì ci sono regole, struttura, controlli e stile.

### Provare in After Effects

La beta si installa con un ID suo, quindi in **Finestra > Estensioni** compaiono sia Motion Tools sia Motion Tools Beta.
Claude Code può collegare la cartella della build a `~/Library/Application Support/Adobe/CEP/extensions`. Così ogni modifica si vede chiudendo e riaprendo il pannello, senza zip.

## 5. Più avanti, per venderlo

- **Firma:** pacchetto ZXP firmato con un certificato e una marca temporale.
- **Aggiornamenti:** il guscio firmato non cambia mai e scarica il resto in una cartella a parte. È già il sistema descritto al punto 1.
- **Licenze:** per esempio Lemon Squeezy, che attiva e controlla una chiave per ogni computer.
- **Download:** quelli pubblici di GitHub vanno sostituiti con download legati alla licenza.
- **Installer** per Mac e Windows.
