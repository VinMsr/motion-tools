# Motion Tools

Pannello per After Effects: curve di easing con la libreria del team, Cloner, allineamento, guide e righello, animazioni del testo, analisi della timeline e note.

Funziona con After Effects 2022 e successivi, su Mac e su Windows.

## Installazione

### Mac

1. Chiudi After Effects.
2. Apri il **Terminale** (Applicazioni > Utility > Terminale).
3. Incolla questa riga e premi Invio:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/VinMsr/motion-tools/main/install.sh | bash
   ```

4. Riapri After Effects e vai su **Finestra > Estensioni > Motion Tools**.

Lo script scarica l'ultima versione, verifica che il file sia integro e la installa nella cartella del tuo utente. Non chiede la password.

### Windows

1. Chiudi After Effects.
2. Apri **PowerShell** (menu Start, scrivi "PowerShell").
3. Incolla questa riga e premi Invio:

   ```powershell
   irm https://raw.githubusercontent.com/VinMsr/motion-tools/main/install.ps1 | iex
   ```

4. Riapri After Effects e vai su **Finestra > Estensioni > Motion Tools**.

### A mano

Se il Terminale non si può usare, scarica `Motion Tools.zip` dall'ultima release e aprilo:
- su Mac, apri il Terminale, scrivi `bash ` (con lo spazio), trascina dentro **Installa Motion Tools.command** e premi Invio;
- su Windows, fai doppio clic su **Installa Motion Tools (Windows).bat**.

## Aggiornamenti

Motion Tools si aggiorna da solo.

- **All'apertura** del pannello cerca una versione nuova. Se c'è, la scarica, la verifica, la installa e si ricarica.
- **Mentre lavori** controlla ogni 30 minuti. Se trova una versione nuova, compare in alto "Versione X installata, Ricarica".

Dall'icona delle **Impostazioni** (in alto a destra nel pannello) puoi:
- controllare subito se c'è una versione nuova;
- tornare alla versione precedente con un clic;
- passare al canale **beta** per provare le versioni in anteprima.

## Disinstallare

- **Mac:** nel Terminale

  ```bash
  rm -rf ~/Library/Application\ Support/Adobe/CEP/extensions/tools.inflect.panel
  ```

- **Windows:** cancella la cartella `%APPDATA%\Adobe\CEP\extensions\tools.inflect.panel`.

Le curve salvate nei progetti restano nei file .aep.

## Problemi

- **Il pannello non compare nel menu Estensioni:** chiudi After Effects del tutto (Cmd+Q su Mac) e riaprilo. Se ancora non c'è, rilancia l'installazione.
- **Un errore in rosso nella barra in basso:** fai clic sul messaggio per copiarlo e mandalo a Vin. Dentro ci sono già la versione e i dettagli.
