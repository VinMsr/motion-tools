# Motion Tools

Pannello per After Effects con otto sezioni: Curve, Testo, Allinea, Utility, Cloner (prima Repeat), Analisi, Note e Team.

## Come si usa l'interfaccia

- **Schede:** in alto a sinistra scegli il gruppo (Anima, Disponi, Progetto). Accanto vedi le sue schede con il nome. Il rombo azzurro segna quella aperta.
- **Valori trascinabili:** sono bianchi con una sottolineatura tratteggiata. Trascinali in orizzontale per cambiarli, come in Controlli effetti. Shift va più veloce, Cmd più fine. Un clic per scrivere il numero, Invio per confermare, Esc per annullare.
- **Sezioni:** la freccia apre e chiude ogni sezione e il pannello ricorda come le hai lasciate. Mentre scorri, l'intestazione resta in cima.
- **Fascia in basso:** nella scheda Curve ci sono Velocità, Entrata/Entrambi/Uscita, Salva e Applica.
- **Barra di stato:** mostra la selezione in After Effects e il risultato dell'ultima azione. Gli errori compaiono in rosso: un clic li copia.
- **Impostazioni**, l'icona in alto a destra: aggiornamenti, canale beta e ritorno alla versione precedente.
- **Suggerimenti:** fermati con il mouse su un pulsante per sapere cosa fa.

## Installazione (Mac, senza password)

1. Chiudi After Effects.
2. Apri il Terminale, incolla questa riga e premi Invio:
   `curl -fsSL https://raw.githubusercontent.com/VinMsr/motion-tools/main/install.sh | bash`
   In alternativa scrivi `bash` seguito da uno spazio, trascina dentro **Installa Motion Tools.command** e premi Invio.
3. Riapri After Effects e vai su **Finestra > Estensioni > Motion Tools**.

Da qui in poi si aggiorna da solo da GitHub.

Sostituisce le versioni precedenti (Curve, Inflect) e tiene le curve già salvate. Su Windows c'è **Installa Motion Tools (Windows).bat**.

## Curve

Editor di curve di easing, semplici o a più punti.

- **Senza keyframe selezionati** il pannello è grigio e ti chiede di selezionarli. Con "Disegna comunque una curva" puoi preparare una curva lo stesso.
- **Disegnare:** trascina punti e maniglie. Doppio clic sulla curva aggiunge un punto, sul punto lo toglie. Alt spezza le maniglie, Shift vincola.
- **Applicare:** seleziona due o più keyframe vicini e premi Applica. I keyframe restano selezionati, quindi puoi provare un'altra curva subito. Se riapplichi sopra una curva a più punti, i keyframe intermedi di prima vengono sostituiti e non si accumulano.
- **Velocità:** lo slider cambia il picco di velocità dei segmenti selezionati senza spostare i keyframe. Accelerando, la partenza e l'arrivo restano morbidi: non torna mai indietro.
- **Assestamento:** Fine aggiunge un keyframe dopo l'ultimo con lo stesso valore. L'animazione arriva al keyframe originale ancora in movimento e da lì rallenta in modo continuo fino a fermarsi, senza pause. La percentuale è la parte del movimento che finisce nella frenata: se i frame sono pochi si riduce da sola. Cambiando frame o percentuale il keyframe aggiunto viene tolto e rimesso. "Togli" rimette tutto com'era. Inizio fa lo stesso all'avvio: se prima del primo keyframe non c'è spazio (inizio del layer o della composizione), sposta in avanti l'animazione di quella proprietà invece di uscire dal layer. Se poi cambi la velocità con lo slider selezionando anche la coda, la coda si ricalcola sul nuovo movimento.
- **Libreria:** Team (cartella condivisa), Le mie curve (in tutti i progetti), Progetto (dentro il file .aep), Preset. Dal menu di una curva: Copia nel team.

## Testo

Animazioni del testo con gli animatori nativi di After Effects, regolabili dal vivo.

- **Animazioni:** in stile Apple, con movimenti brevi, tempi lunghi e curve che rallentano a lungo: parola per parola, rivelazione da sotto una linea, righe, sfumatura, titolo che si posa, spaziatura che si chiude. Ogni scheda si muove come verrà in After Effects. Clic per modificarla, doppio clic per applicarla.
- **Ritaglio:** il testo entra da sotto una linea invisibile (una maschera per riga).
- **Dimensioni:** spostamenti e sfocatura sono pensati per un testo da 100 px e si adattano da soli al corpo del layer.
- **Modifica:** anima per lettere, parole o righe; entrata e uscita separate; durata, sfalsamento e ritardo in frame; ordine (in avanti, al contrario, dal centro, dai lati, casuale) e ritmo; curva bezier, una delle tue curve, del team o del progetto (anche a più punti) o quella della scheda Curve oppure molla con rimbalzo, come su iOS; stato di partenza con opacità, spostamento, scala, rotazione, sfocatura e spaziatura.
- **Applica** aggiunge gli animatori "MT Entrata" e "MT Uscita" ai layer di testo selezionati. L'entrata parte dal punto di attacco del layer, l'uscita finisce sul punto di stacco: sposta o accorcia il layer e l'animazione lo segue.
- **Dal vivo:** se il layer ha già un'animazione di Motion Tools, il pannello la rilegge e ogni modifica arriva subito in After Effects.
- **Salva nei miei, Salva nel team, Esporta, Importa.** I file si chiamano `.mt-testo.json`. Mandami un video con l'effetto che ti piace: ti preparo il file e lo carichi con Importa.

## Allinea

- **Punto di ancoraggio:** il riquadro rappresenta il layer. Clicca un angolo, un lato o il centro: l'ancoraggio va lì e il layer resta fermo, anche se è ruotato, scalato, imparentato o ha keyframe di posizione.
- **Allinea:** sei direzioni, rispetto alla composizione o tra i layer selezionati, più "centra nella composizione".
- **Come gruppo (Mantieni le distanze):** i layer selezionati si muovono come un blocco unico e le distanze tra loro restano uguali. Verso la composizione si allinea tutto il blocco; con Selezione ogni gruppo salvato fa da blocco e si allinea agli altri. I keyframe di posizione si spostano tutti insieme, quindi l'animazione non cambia.
- **Gruppi:** Crea gruppo salva i layer selezionati con un nome (resta nel progetto). Un clic sul gruppo lo riseleziona, Maiusc lo aggiunge alla selezione, tasto destro lo scioglie.
- **Distribuisci:** stessa distanza tra i centri, in orizzontale o verticale (almeno tre layer).

Funziona su tutti i layer visibili, testo e forme compresi, e tiene conto dei genitori. Sui layer 3D ruotati in X o Y il risultato è approssimato.

**Guide.** Lo schema mostra la composizione con le sue guide; clicca una guida per selezionarla.
- Nuova guida verticale o orizzontale a una posizione in px o in %.
- Dalla guida selezionata: una o più guide a una distanza fissa (negativa per andare a sinistra o in alto).
- Dai layer selezionati: bordi e centro, con un margine.
- Griglia di colonne e righe con margine e spazio, centro della composizione, area sicura al 5% e al 10%.
- Elenco delle guide con la posizione modificabile, per toglierle una per una o tutte.
- Se verticali e orizzontali escono scambiate (succede in alcune versioni di After Effects), premi "Verticali e orizzontali sono invertite?": il pannello se lo ricorda.

## Utility

**Composizione**
- **Precomponi e ritaglia:** i layer selezionati passano, con keyframe, effetti e maschere, in una precomposizione grande quanto il loro contenuto durante tutta l'animazione. Nella composizione di partenza il risultato resta esattamente dov'era.
- **Keyframe sul layer della precomposizione:** con questa spunta e un solo layer, posizione, scala, rotazione e opacità (con i loro keyframe ed easing) restano fuori, sul layer della precomposizione. Dentro, il contenuto resta fermo e centrato. Comodo quando vuoi animare il blocco intero o aggiungerci effetti.
- **Adatta la composizione:** ridimensiona la composizione attorno ai layer selezionati, come sono nel frame corrente. Tutti i layer si spostano insieme, camere e luci comprese.
- **Margine:** spazio in più attorno al contenuto, per entrambe le funzioni.

**Copia e incolla.** Non serve premere Copia: Motion Tools ricorda gli ultimi keyframe selezionati. Altrimenti Copia i keyframe selezionati (con easing e tangenti), oppure i valori delle proprietà selezionate, oppure le trasformazioni dei layer. "Incolla allo stesso momento" funziona anche dentro un'altra precomposizione: Motion Tools segue i layer che collegano le composizioni (inizio, stiramento, rimappatura del tempo) e mette i keyframe nello stesso istante del video. "All'indicatore" incolla dal tempo corrente.

**Momento.** Prendi ricorda l'istante attuale. Entrando in una precomposizione, "Vai al momento" porta l'indicatore del tempo nello stesso punto. Marker ne lascia uno lì.

**Sposta animazione.** Sposta la posizione dei layer selezionati su tutti i keyframe insieme, senza cambiare tempi ed easing: scrivi X e Y oppure usa le frecce (Maiusc per passi 10 volte più grandi). Con delle proprietà selezionate, per esempio Scala, sposta quelle.

**Sfalsa layer.** Sposta i layer selezionati nella timeline uno dopo l'altro, con tutti i loro keyframe: passo in frame, ordine (selezione, timeline, posizione nella scena, dal centro, casuale) e ritmo.

**Liste.** Come gli Array di Cavalry: una lista di colori, numeri o testi che i layer selezionati prendono uno per uno (a turno, avanti e indietro, distribuita o casuale). I colori vanno sul riempimento del testo, sui riempimenti delle forme o in un effetto Riempimento. I numeri vanno su rotazione, opacità, scala, posizione o tempo, anche sommati al valore attuale.

**Righello.** Con due layer selezionati mostra lo spazio tra i bordi, la distanza tra i centri e le dimensioni. Scrivi un valore nello spazio e il secondo layer si sposta per ottenerlo. Con un solo layer mostra le distanze dai bordi della composizione.

## Cloner

Duplicatore sul modello di quello di Cavalry. Le copie sono layer veri, guidati da un layer di controllo, e tutto si regola e si anima dal pannello.

**Creare.** Seleziona uno o più layer (testo, forme, solidi, precomp, video), scegli la distribuzione e premi Crea Cloner. Con più layer, le copie li usano a turno o a caso. L'animazione che il layer ha già (keyframe di scala, posizione, testo, effetti) resta su ogni copia.

**Animare dal pannello.** Accanto a ogni valore c'è il rombo del keyframe, come il cronometro di After Effects. Vuoto: il valore non è animato, un clic crea il primo keyframe al tempo corrente. Bordo blu: animato. Pieno: c'è un keyframe in questo frame, un clic lo toglie. Sposta l'indicatore del tempo, cambia il valore e il keyframe si aggiorna da solo.

**Animazioni pronte** (pulsante in alto). Partono dal tempo corrente e si regolano come tutto il resto:
- Entrata a cascata: le copie compaiono una dopo l'altra
- Pop casuale: compaiono in ordine casuale con un piccolo rimbalzo
- Onda: un'onda continua attraversa le copie
- Anello 3D che gira: anello inclinato in rotazione, le copie che passano davanti si ingrandiscono grazie a un falloff

**Distribuzioni**
- Lineare e Griglia, con Passo (distanza tra copie) o Adatta (dimensione totale), ordine per righe o colonne, righe sfalsate, livelli in 3D
- Cerchio, con raggio, angolo iniziale, arco, scorrimento animabile, orientamento e piano XY, XZ o YZ
- Casuale dentro un'area, Spirale (Fibonacci), Tracciato (maschera o tracciato di un livello forma), Punto

**Allinea copie.** In Sorgenti. Con Centro ogni copia si posa sul punto con il centro del suo contenuto, quindi un testo resta centrato anche se il suo ancoraggio è sulla linea di base. Con Ancoraggio conta il punto di ancoraggio di ogni layer. Se modifichi il layer originale (ancoraggio, contenuto, effetti), dal menu ••• usa **Aggiorna copie dalle sorgenti** per rifare le copie.

**Posizione e ancoraggio.** Un Cloner nuovo nasce in 2D e al centro della composizione (oppure sul layer, se lo scegli). In Trasforma > Gruppo c'è il punto di ancoraggio del Cloner: è il punto attorno a cui ruota e scala tutto il gruppo, e le copie non si spostano. "Centra nella composizione" porta il centro delle copie al centro della scena. Aggiornando le copie dalle sorgenti, l'ancoraggio scelto si ricalcola.

**2D e 3D.** Si cambia in qualsiasi momento da Distribuzione > Spazio. In 3D usa il piano XZ per un anello orizzontale e Gruppo > Inclinazione X per inclinarlo.

**Trasforma.** Posizione, scala, rotazione e opacità di ogni copia. Sotto, in Gruppo, rotazione X, Y, Z e scala di tutto il Cloner: anima Rotazione Y o Scorrimento per far girare un anello.

**Comportamenti.** Come i Behaviour di Cavalry: un tipo, una destinazione e un falloff opzionale.
- Tipi: Stagger, Casuale, Rumore (animato), Oscillatore, Valore
- Destinazioni: posizione X, Y, Z, rotazione (anche X e Y in 3D), scala, opacità e tempo

**Stagger nel tempo.** Con la destinazione Tempo, ogni copia viene spostata nella timeline di tot frame, esattamente come quando sfalsi i layer a mano: parte prima la prima e poi le altre, con tutta la loro animazione. L'ordine può essere sequenziale, inverso, dal centro, verso il centro, casuale o lungo un asse, e la curva decide come si distribuiscono i ritardi. I tempi si aggiornano ogni volta che modifichi qualcosa dal pannello.

**Lista** (comportamento). Una lista di numeri distribuita sulle copie, per esempio rotazioni 0, 90, 180. Si combina con i falloff come gli altri comportamenti.

**Colori e testi.** Una lista di colori riempie le copie, una di testi cambia il testo delle copie di layer di testo. Si può partire da una palette del team.

**Falloff.** Layer guida a forma di cerchio (sfera in 3D), rettangolo o gradiente lineare, con posizione, dimensione, morbidezza, intensità, inverti e probabilità. Collegalo a uno o più comportamenti: la loro forza dipende da quanto le copie sono dentro l'area. In 3D, una Z negativa lo porta verso la camera, così agisce sulle copie davanti.

Limite: 400 copie. Oltre le 150 circa After Effects rallenta, perché ogni copia calcola le sue espressioni.

## Analisi

Una lettura della timeline della composizione attiva, per capire il ritmo del video.

- **Ritmo:** il grafico mostra dove si concentrano i keyframe (barre grigie) e quanto si muove la scena (curva blu, da posizione, scala, rotazione e opacità). I punti gialli sono i picchi. Clicca o trascina sul grafico per spostare l'indicatore del tempo.
- **Panoramica:** keyframe totali, layer animati, keyframe al secondo, espressioni e quanta parte del video è ferma.
- **Momenti più intensi** e **Layer più animati:** un clic porta al momento o seleziona il layer.
- **Easing:** quanti passaggi usano curve personalizzate, Easy Ease, lineare o hold. "Seleziona i lineari" li seleziona nella timeline così puoi sistemarli con una curva.

L'analisi parte da sola quando apri la scheda o cambi composizione. Dopo aver modificato l'animazione premi Aggiorna.

## Note

Note sulla timeline per il team. Ognuna è un marcatore di After Effects, quindi resta nel file .aep e la vede chiunque apra il progetto, anche senza Motion Tools (nel commento del marcatore).

- **Firma:** scrivi il tuo nome una volta, il pannello lo ricorda.
- **Nuova nota:** scrivi il testo e premi Aggiungi al tempo attuale (o Cmd+Invio). Va sulla composizione o sul layer selezionato: sul layer si sposta insieme a lui.
- **Elenco:** le note di questa composizione o di tutto il progetto, in ordine di tempo. Un clic porta a quel momento (aprendo la composizione giusta), la spunta la segna come fatta, la matita la modifica.

**Marcatori collegati.** Scegli una composizione principale (quella finale) con Usa questa composizione. Un marcatore aggiunto con Aggiungi ovunque va nella principale e in tutte le composizioni collegate (precomposizioni dentro, anche annidate, e composizioni che la contengono), nello stesso istante del video anche se i layer sono sfasati, stirati o rimappati. Puoi aggiungerlo anche da dentro una precomposizione: il pannello calcola il momento giusto. Quando aggiungi una composizione nella principale, anche dentro precomposizioni di precomposizioni, riceve da sola i marcatori collegati entro pochi secondi. Se invece sposti o accorci i layer delle precomposizioni, premi Riallinea in tutte le composizioni. Se in una composizione c'è già un altro marcatore nello stesso punto, quella composizione viene saltata e il pannello te lo dice.

## Team

Una libreria condivisa: un file `motion-tools-team.json` in una cartella che il team vede (Drive, Dropbox, un server). Con **Cartella…** la scegli; finché non lo fai resta solo sul tuo computer. Il pannello si accorge da solo quando un collega la modifica.

- **Palette:** un clic su un colore lo applica ai layer selezionati. Dal menu ••• puoi distribuirla sui layer, usarla nel Cloner o nelle Liste.
- **Animazioni di testo, curve e liste** salvate dalle altre schede.
- Dal menu in alto: rinomina, esporta e importa tutta la libreria.

## Aggiornamenti

Si installa una volta sola con lo script. Le versioni successive arrivano da una cartella condivisa.

**Prima volta (per ogni computer):** installa con lo script, apri Motion Tools, scheda Team > Cartella… e scegli la cartella del team sul NAS.

**Dove vanno gli aggiornamenti:** di base nella sottocartella `Aggiornamenti` della cartella del team. Si può cambiare dal menu ••• della scheda Team > Cartella degli aggiornamenti…

**Pubblicare una versione nuova:** scompatta lo zip e copia la cartella `motion-tools` dentro `Aggiornamenti`, sostituendo quella vecchia. Fine.

**Cosa succede sui computer del team:** a ogni apertura il pannello confronta la sua versione con quella nella cartella. Se è più nuova copia i file e si ricarica da solo. Se il pannello è già aperto, entro mezz'ora avvisa di chiuderlo e riaprirlo. Dal menu ••• della scheda Team c'è anche Controlla aggiornamenti. Raramente (quando cambia la configurazione dell'estensione) chiede di riavviare After Effects.

## Se qualcosa non va

- Scritta rossa in alto a destra: è l'errore esatto di After Effects, mandamela.
- Il registro è in `~/Library/Logs/CSXS/`.
- Un'espressione di Cloner in errore mostra il triangolo giallo sul layer: clicca per leggere il messaggio.
