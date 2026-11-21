# Parametri di gioco, parte 3: la schermata di amministrazione

Issue #119 (parte della #73, dipende dalla #117 e dalla #118, già unite). Branch `feature/parametri-di-gioco-schermata-admin`.

## Obiettivo

Una sezione «Parametri» nella schermata Amministrazione (solo admin) in cui l'admin vede i sei parametri di gioco con valore attuale, intervallo ammesso e predefinito, e li cambia con **un unico modulo** e un motivo obbligatorio. Un valore fuori intervallo mostra l'errore e non salva; se il server rifiuta il salvataggio il valore non cambia. Un avviso dice che la modifica vale solo per le partite create dopo. Le modifiche compaiono nel registro delle operazioni con frasi in italiano. La sezione è pensata per il telefono: nessuno scorrimento orizzontale a 320 e 180 px.

**Fuori da questa parte:** mostrare il nome di chi ha fatto l'ultima modifica (c'è già nel registro; `updatedBy` è un id e qui la lista utenti non è caricata) e lo storico delle versioni dei parametri.

## Decisioni già prese

- **Un unico modulo** con tutti e sei i campi e un solo motivo, non un parametro alla volta: il server controlla `maxPlayers >= minPlayers` sul risultato unito, quindi per portare il minimo sopra il massimo attuale servono i due valori in una richiesta.
- **Stato locale al pannello**, come gli altri pannelli admin (`StatsPanel`, `AuditPanel`): legge `GET /api/admin/settings` quando si apre e salva con `PATCH`. Non usa lo slice `settings` della #118 (la vista admin ha campi in più e lo slice si svuota all'uscita dall'account); la Hall rilegge i parametri quando si apre.
- **Backend invariato:** `GET` e `PATCH /api/admin/settings` esistono già (la `PATCH` prende `{ values, reason }`; la `GET` dà `values`, `limits`, `defaults`, `updatedAt`, `updatedBy`).

## Struttura e flusso dei dati

- **Scheda:** una quinta scheda «Parametri» in `frontend/src/components/admin/AdminScreen.jsx` (`id: "parametri"`). Visibile solo a un admin, come il resto; il server decide e un `403` riporta alla Hall (`onForbidden`).
- **Servizio** (`frontend/src/services/adminService.js`): `getSettings()` → `GET /admin/settings`; `updateSettings({ values, reason })` → `PATCH /admin/settings`. Entrambe restituiscono `{ values, limits, defaults, updatedAt, updatedBy }`.
- **Etichette in un posto solo:** `frontend/src/config/parametri.js` elenca i sei parametri con chiave, etichetta, unità e una frase di spiegazione in italiano («Attesa tra le estrazioni», «secondi»…). Lo usano il pannello, la frase del registro e le traduzioni degli errori.
- **Pannello** `frontend/src/components/admin/ParametriPanel.jsx`:
  - Caricamento, errore e «Riprova» come in `StatsPanel`; un `403` chiama `onForbidden`.
  - Un campo numerico per parametro, con `min` e `max` dai limiti del server e il suggerimento «Attuale 8 · Da 3 a 30 · Predefinito 8». Per i giocatori massimi si aggiunge «mai meno dei minimi».
  - Un pulsante «Ripristina» per campo, che riporta il campo al predefinito (disattivato se ci è già).
  - Un solo campo «Motivo», obbligatorio, fino a 200 caratteri (come nelle altre rettifiche).
  - «Salva» è attivo solo se almeno un valore è diverso dall'attuale; manda solo i valori cambiati e il motivo ripulito dagli spazi. Un doppio tocco non manda due richieste.
- **Dopo il salvataggio:** la risposta del server diventa il nuovo stato; i campi si riallineano, il motivo si svuota e compare un avviso di conferma. Se il server rifiuta, i campi restano come l'admin li ha scritti, il valore «attuale» non cambia e l'errore compare sopra «Salva».
- **Avviso fisso** sopra il modulo: «Le modifiche valgono solo per le partite create dopo: quelle in attesa o in corso continuano con i parametri che avevano.»
- **Ultima modifica:** la data da `updatedAt`, se c'è (prima di ogni modifica è nulla).

## Validazione e errori

- Nel pannello (il server resta l'autorità, ma l'admin vede subito l'errore nel campo): ogni campo è un numero intero dentro i suoi limiti («Da 3 a 30 secondi»; vuoto: «Scrivi un numero»); il massimo di giocatori non può essere sotto il minimo **scritto nel modulo** («Non può essere meno dei giocatori minimi (4)»), così minimo e massimo si cambiano insieme; il motivo è obbligatorio («Scrivi il motivo»). Con un errore nel modulo non parte nessuna richiesta.
- Errori del server (`400`, `503`, `429`): compaiono sopra «Salva» in italiano; i campi restano come l'admin li ha scritti. `frontend/src/utils/errors.utils.js` aggiunge le traduzioni dei messaggi dei parametri (il «must be a whole number from N to M», il «cannot be below minPlayers», i messaggi di intervallo di Joi col nome del parametro dall'etichetta) e quella del limite di richieste («Troppe modifiche in poco tempo: riprova fra un minuto»).
- Un `403` riporta alla Hall.

## Registro delle operazioni

`frontend/src/components/admin/AuditPanel.jsx` (`frase`) aggiunge `settings_changed`: «{chi} ha cambiato i parametri di gioco: Attesa tra le estrazioni da 8 a 12 secondi; Giocatori massimi da 10 a 8: «{motivo}»». Usa le etichette di `config/parametri.js`; una chiave sconosciuta compare col nome grezzo. I dati vengono da `details.changes` (`{ chiave: { from, to } }`) e `details.reason`.

## Layout da telefono (320 e 180 px)

Una sola colonna: l'etichetta sopra il campo, «Ripristina» sotto il campo a tutta larghezza, i testi vanno a capo (`overflow-wrap`). Tutti i controlli misurano almeno 44 px e non c'è scorrimento orizzontale.

## Test

- **Frontend (Vitest):**
  - servizio: `getSettings` e `updateSettings`;
  - pannello: caricamento, errore e «Riprova», `403`; i sei campi con limiti e predefiniti; «Salva» disattivato senza modifiche; invio con **solo** i valori cambiati e il motivo ripulito; motivo mancante, fuori intervallo e massimo sotto il minimo con nulla inviato; «Ripristina»; errore del server con campi e «attuale» invariati; successo con campi riallineati, motivo svuotato e avviso di conferma; doppio tocco; avviso «solo per le partite nuove»; data dell'ultima modifica;
  - `AdminScreen`: la quinta scheda c'è e apre il pannello;
  - `AuditPanel`: la frase con più modifiche e con una chiave sconosciuta;
  - `errors.utils`: le nuove traduzioni.
- **End-to-end** (serve PostgreSQL, `E2E_DATABASE_URL`; senza, salta), in `chromium` e `mobile-chrome`: l'admin cambia un parametro con un motivo, lo rivede nel registro, e un giocatore lo vede nel modulo della Hall; un valore fuori intervallo non salva; un giocatore senza ruolo non vede «Amministrazione»; a 320 e 180 px nessuno scorrimento orizzontale e controlli da 44 px. Il test che modifica i parametri gira in un solo progetto e ripristina i predefiniti (due progetti in parallelo si pestano i piedi, come emerso nella #158).
- **Prima di chiudere:** suite del frontend, lint, e gli e2e dell'interfaccia in locale.

## Documentazione

`docs/AUTH.md` e `docs/GAME_DESIGN.md` (la schermata admin dei parametri), `README.md`, `frontend/README.md` (il pannello e `config/parametri.js`), `TEST_SUITE.md`. Poi `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs` deve dare 0 errori.

## Criteri di accettazione (dalla #119)

- L'admin modifica un parametro con un motivo e lo rivede nel registro; un utente senza ruolo non vede la sezione.
- Un valore fuori intervallo mostra l'errore e non salva; se il server rifiuta il valore non cambia.
- Un avviso dice che la modifica vale solo per le partite nuove.
- Nessuno scorrimento orizzontale a 320 e 180 px.
- Test del frontend ed end-to-end (`chromium` e `mobile-chrome`).
