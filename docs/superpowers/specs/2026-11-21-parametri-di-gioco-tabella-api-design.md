# Parametri di gioco, parte 1: tabella, API e uso nel server

Issue #117 (parte della #73). Branch `feature/parametri-di-gioco-tabella-api`.

## Obiettivo

I sei parametri di gioco che oggi sono costanti nel codice diventano valori nel database, con intervalli ammessi. Solo l'admin li modifica, con un motivo, e ogni modifica lascia una riga di audit. Il server li legge da lì e non più da `GAME_DEFAULTS` né dall'ambiente. Ogni partita porta con sé la copia dei parametri alla creazione. L'attesa tra le estrazioni la impone il server.

**Fuori da questa parte:** frontend che legge i valori (#118), schermata di amministrazione (#119), `drawTurnSeconds` (60 s), `GRID_SIZE`, stanze (#121).

## Decisioni già prese

- **Intervalli e predefiniti:** quelli della #73 (tabella sotto).
- **Dove vivono i valori (approccio A):** tabella `game_settings` nel database e copia in `gameState.settings`, caricata all'avvio come già avviene per giocatori e partite. Il codice sincrono (timer dei turni, Jolly, creazione partita) legge dalla cache. Va bene perché il server è un solo processo con lo stato in memoria. Scartate: leggere dal database a ogni uso (rende asincroni i timer di `estrazione.service.js`) e modificare `config` a runtime (stato globale nascosto, nessun punto per la copia nella partita).
- **Codice dell'attesa troppo breve:** `429` ovunque, con i secondi che restano. Oggi la modalità a turno risponde `409`: cambia.
- **Partite salvate prima di questa modifica:** senza `settings` usano i valori di oggi, senza migrare i dati.

| Chiave | Predefinito | Intervallo |
|---|---|---|
| `minPlayers` | 2 | 2–10 |
| `maxPlayers` | 10 | 2–20, mai meno di `minPlayers` |
| `requiredCredits` | 100 | 1–10.000 |
| `jollyHoldSeconds` | 30 | 10–120 |
| `jollyMaxDeclarations` | 3 | 1–10 |
| `drawCooldownSeconds` | 8 | 3–30 |

Il tetto di 20 giocatori è prudente e non è stato provato con tante persone: se non lo si prova, il massimo resta 10.

## Dati

**Migrazione `backend/db/migrations/011_game_settings.sql`**
- Tabella `game_settings` con una sola riga: `id INTEGER PRIMARY KEY CHECK (id = 1)`.
- Sei colonne intere, una per parametro, con i predefiniti e un `CHECK` per intervallo. `CHECK (max_players >= min_players)` è un vincolo della riga.
- `updated_at TIMESTAMPTZ` e `updated_by TEXT` (id del giocatore o nullo).
- La migrazione inserisce la riga con i predefiniti (8 secondi per l'attesa: una migrazione SQL non legge l'ambiente). `DRAW_COOLDOWN_SECONDS` non è più letta dalle estrazioni: resta solo come valore iniziale dello store in memoria, se è dentro l'intervallo 3–30 (altrimenti vale 8), e va documentata così in `docs/DEPLOYMENT.md`.

**Modulo `backend/src/config/gameSettings.js`**
Chiavi, predefiniti e limiti in un solo posto. Lo usano lo schema Joi, il servizio e i test, che confrontano questi limiti con i vincoli del database. Nel frontend (#118) i limiti arrivano dalla `GET`.

**Partita**
`game.settings = { minPlayers, maxPlayers, requiredCredits, jollyHoldSeconds, jollyMaxDeclarations, drawCooldownSeconds }`, copiato alla creazione e salvato con lo stato della partita (`saveGameSafely`). `game.attesaFino` (millisecondi) serve all'attesa della modalità classica. `gameViewFor` non cambia in questa parte.

## Store

Metodi nuovi sia nello store in memoria sia in quello PostgreSQL:
- `getGameSettings()`: la riga corrente con `updatedAt` e `updatedBy`.
- `updateGameSettings(patch, { actor, reason })`: in una transazione legge la riga con `FOR UPDATE`, applica la modifica, controlla `maxPlayers >= minPlayers` sul risultato e scrive la riga di audit `settings_changed` (`target_id` nullo; dettagli: per ogni chiave cambiata `{ from, to }`, più il motivo) nella stessa transazione. Restituisce valori prima e dopo. Una modifica senza chiavi cambiate non scrive nulla.
- Lo store in memoria parte dai predefiniti, si modifica a runtime e tiene il suo audit come gli altri metodi.

## Servizio `backend/src/services/settings.service.js`

- `loadSettings(store, gameState)`: all'avvio in `initializePersistence`, accanto a `loadState`. Mette la riga in `gameState.settings`.
- `updateSettings(store, gameState, patch, { actor, reason })`: unisce la modifica ai valori correnti, valida il risultato completo (limiti e `min <= max`), scrive con lo store e solo dopo aggiorna `gameState.settings`. Se la scrittura fallisce, la cache non cambia.
- `gameSettingsOf(game, gameState)`: `game.settings`, oppure i valori di oggi (`GAME_DEFAULTS` e `config`) per le partite salvate prima.

## Route

- `GET /api/settings`: ogni utente autenticato. Risponde con valori, limiti e predefiniti.
- `GET /api/admin/settings`: stessa risposta, più `updatedAt` e `updatedBy`.
- `PATCH /api/admin/settings`: solo admin. Corpo `{ valori: { ... }, motivo }`: almeno una chiave, `motivo` obbligatorio.

Il corpo si valida con uno schema di `backend/src/validation/schemas.js`, applicato da `validate`. Le route admin stanno nel router che ha già `requireAuth` e `requireRole("admin")`. L'attore è sempre `req.auth`, mai il corpo. La `PATCH` ha un limite di richieste proprio, sul modello di `strictLimiter`.

## Uso nel server

- `createGame`: quota predefinita e `maxPlayers` dai parametri correnti; copia in `game.settings`. Lo schema di creazione accetta `maxPlayers` fra il minimo e il massimo correnti e `requiredCredits` da 1 al limite. **Cambio di comportamento:** `requiredCredits: 0`, oggi trasformato nel predefinito, diventa `400`.
- `startGame`: `game.settings.minPlayers`. Ingresso: `game.settings.maxPlayers`.
- Dichiarazione del Jolly: `jollyMaxDeclarations` e `jollyHoldSeconds` della partita.
- **Attesa, modalità a turno:** `verificaAttesa` risponde `429` (non più `409`) e legge `game.settings.drawCooldownSeconds`; il timer che estrae da solo usa lo stesso valore.
- **Attesa, modalità classica:** a ogni estrazione `game.attesaFino = adesso + attesa`. Una `drawCard` prima di quel momento dà `429`, messaggio «Wait N seconds before drawing», campo `retryAfter` e intestazione `Retry-After`.
- **Pausa del Jolly:** l'estrazione resta rifiutata con `409` mentre un giocatore sceglie. Alla fine o all'annullamento della pausa, `attesaFino` si sposta in avanti di quanto è durata (in modalità a turno lo fa già `turno.attesaFino`).

## Errori

- Corpo non valido: `400`; chiavi sconosciute, valori non interi e motivo mancante rifiutati; il messaggio dice la chiave e l'intervallo. Nessuna correzione silenziosa.
- `maxPlayers >= minPlayers` si controlla sul risultato unito: portare solo `minPlayers` a 8 con `maxPlayers` a 6 dà `400`.
- Database non scrivibile: `503` «Storage temporarily unavailable»; la cache non cambia.
- Due `PATCH` simultanee: la riga si blocca con `FOR UPDATE` e la seconda parte dal valore già modificato.
- Nessuna route restituisce `mazzo` o la cartella di un altro giocatore.

## Test

- **Unitari:** i limiti di `gameSettings.js` coincidono con lo schema Joi; il servizio rifiuta ogni caso fuori intervallo e `min > max`.
- **Store, memoria e PostgreSQL (`combocard_test`):** predefiniti, modifica con audit prima e dopo, un `UPDATE` diretto fuori intervallo rifiutato dai `CHECK` anche aggirando lo schema, seconda riga impossibile, due modifiche simultanee che si sommano. I test PostgreSQL usano uno store senza nuovi tentativi (`NO_RETRY`).
- **Route:** `401` senza token; `403` come `player` su `GET` e `PATCH` admin; `400` per fuori intervallo, chiave sconosciuta e motivo mancante; `200` per l'admin con audit visibile; il test che controlla che ogni route admin stia dietro `requireRole` resta valido.
- **Partite:** una modifica non cambia le partite già create; la nuova porta la copia; una partita senza `settings` usa i valori di oggi; `requiredCredits: 0` dà `400`; `429` con `retryAfter` in modalità classica e a turno, con l'orologio simulato, e passa dopo l'attesa; la pausa del Jolly sposta `attesaFino`.
- **End-to-end sull'API** (server in memoria): l'admin modifica un valore, una partita nuova lo usa, un `player` riceve `403`.
- I test esistenti sul `409` dell'attesa passano a `429`.
- **Verifica finale:** `npm test` del backend con PostgreSQL attivo, tre esecuzioni consecutive dei test database, `npm run lint`.

## Documentazione

`docs/DATABASE.md` (tabella e azione di audit `settings_changed`), `docs/AUTH.md` (le tre route), `docs/GAME_DESIGN.md` (parametri, intervalli, attesa imposta dal server), `docs/DEPLOYMENT.md` (`DRAW_COOLDOWN_SECONDS` come valore iniziale), `README.md` (elenco delle rotte) e `TEST_SUITE.md` (numeri). Poi `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs` deve dare 0 errori.

## Criteri di accettazione (dalla #117)

- Valori fuori intervallo rifiutati con `400` dallo schema, e dal database anche aggirando lo schema.
- Solo l'admin modifica; un `user` riceve `403` su ogni route di modifica.
- Una modifica non cambia le partite già create.
- Un'estrazione prima dell'attesa configurata è rifiutata con `429`, una dopo passa.
- Test del backend (PostgreSQL compreso) ed end-to-end sull'API.
- Documenti aggiornati.
