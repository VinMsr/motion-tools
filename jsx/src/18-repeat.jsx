/* --------------------------------------------------------- repeat -- */
/*
 * Cloner: duplicatore in stile Cavalry costruito con strumenti nativi di After Effects.
 *
 *  Controllo   un oggetto nullo con i parametri come controlli espressione:
 *              distribuzione, trasformazioni e comportamenti. Si regola dal pannello
 *              o dai Controlli effetti, e si anima come qualsiasi effetto.
 *  Copie       layer veri, figli del controllo. Ogni copia calcola la propria posizione
 *              e somma i comportamenti con espressioni lette dal controllo.
 *  Comportam.  Stagger, Casuale, Rumore, Oscillatore, Valore. Ognuno ha una destinazione
 *              (posizione, rotazione, scala, opacita', tempo) e puo' usare un falloff.
 *  Falloff     layer guida con forma, dimensione, morbidezza, intensita', inverti e
 *              probabilita': moltiplica la forza dei comportamenti collegati.
 *  Tempo       il ritardo di ogni copia sposta i controlli Trasforma e, per precomp e
 *              video, anche il tempo interno tramite il remapping del tempo.
 */

var MT_TAG = "MT_REPEAT";
var MT_CLONE_TAG = "MT_CLONE";
var MT_FALLOFF_TAG = "MT_FALLOFF";
var MT_MAX = 400;
// Versione delle espressioni: i Cloner piu' vecchi si aggiornano da soli alla prima modifica.
var MT_REPEAT_VER = 7;
var MT_DEST_COLOR = 10;

var MT_LISTS = {
    "Distribuzione": ["Lineare", "Griglia", "Cerchio", "Casuale", "Spirale", "Tracciato", "Punto"],
    "Modo misura": ["Passo", "Adatta", "Distanza"],
    "Direzione griglia": ["Per righe", "Per colonne"],
    "Piano": ["XY", "XZ", "YZ"],
    "Tipo": ["Stagger", "Casuale", "Rumore", "Oscillatore", "Valore", "Lista"],
    "Destinazione": ["Posizione X", "Posizione Y", "Posizione Z", "Rotazione", "Rotazione X", "Rotazione Y", "Scala", "Opacit\u00e0", "Tempo", "Colore"],
    "Curva": ["Lineare", "Ease in", "Ease out", "Ease in-out"],
    "Ordine": ["Indice", "Inverso", "Dal centro", "Verso il centro", "Casuale", "Asse X", "Asse Y"],
    "Forma": ["Cerchio", "Rettangolo", "Lineare"],
    "Allinea copie": ["Centro del contenuto", "Punto di ancoraggio"]
};

/* Parametri del controllo: nome, tipo, valore di partenza. */
var MT_PARAMS = [
    ["Distribuzione", "dd", 1],
    ["Quantit\u00e0", "sl", 8],
    ["Colonne", "sl", 5],
    ["Righe", "sl", 4],
    ["Livelli", "sl", 1],
    ["Modo misura", "dd", 1],
    ["Passo", "p3", [120, 0, 0]],
    ["Distanza", "p3", [30, 30, 30]],
    ["Dimensione copia", "p3", [100, 100, 100]],
    ["Direzione griglia", "dd", 1],
    ["Sfalsa righe", "sl", 0],
    ["Centra", "cb", 1],
    ["Raggio", "sl", 300],
    ["Angolo iniziale", "an", 0],
    ["Arco", "an", 360],
    ["Scorrimento", "sl", 0],
    ["Orienta", "cb", 0],
    ["Inverti senso", "cb", 0],
    ["Piano", "dd", 1],
    ["Area", "p3", [1200, 700, 0]],
    ["Tracciato", "ly", 0],
    ["Seme", "sl", 1],
    ["Allinea copie", "dd", 1],
    ["Trasforma posizione", "p3", [0, 0, 0]],
    ["Trasforma scala", "sl", 100],
    ["Trasforma rotazione", "an", 0],
    ["Trasforma opacit\u00e0", "sl", 100],
    ["Comportamenti", "sl", 0]
];

/* Parametri di ogni comportamento, con il prefisso "B<k> ". */
var MT_BPARAMS = [
    ["Tipo", "dd", 1],
    ["Destinazione", "dd", 9],
    ["Attivo", "cb", 1],
    ["Min", "sl", 0],
    ["Max", "sl", 20],
    ["Curva", "dd", 1],
    ["Ordine", "dd", 1],
    ["Seme", "sl", 1],
    ["Frequenza", "sl", 1],
    ["Fase", "sl", 30],
    ["Falloff", "ly", 0],
    ["Colore", "cl", [1, 0.35, 0.12, 1]],
    ["Mantieni spazi", "cb", 0]
];

var MT_FPARAMS = [
    ["Forma", "dd", 1],
    ["Dimensione", "p2", [500, 500]],
    ["Profondit\u00e0", "sl", 0],
    ["Morbidezza", "sl", 100],
    ["Intensit\u00e0", "sl", 100],
    ["Inverti", "cb", 0],
    ["Probabilit\u00e0", "cb", 0],
    ["Seme", "sl", 1]
];

