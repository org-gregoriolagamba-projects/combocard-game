# Parametri di gioco, parte 1: tabella, API e uso nel server — Piano di implementazione

> **Per chi esegue:** SUB-SKILL RICHIESTA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans per eseguire il piano un task alla volta. I passi usano la sintassi a caselle (`- [ ]`).

**Obiettivo:** i sei parametri di gioco passano dal codice a una tabella del database, modificabili solo dall'admin con motivo e audit; il server li legge da una cache in memoria, ogni partita ne porta una copia e l'attesa tra le estrazioni è imposta dal server con `429`.

**Architettura:** tabella `game_settings` a riga singola con `CHECK` sugli intervalli; metodi di store (memoria e PostgreSQL) per leggere e modificare in transazione con l'audit; `settings.service.js` tiene `gameState.settings` (caricata all'avvio) e `game.settings` (copia alla creazione); tre route nuove; `estrazione.service.js` e `game.controller.js` leggono i valori dalla partita.

**Stack:** Node 20, Express 5, Joi, `pg`, Jest (ESM), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-11-21-parametri-di-gioco-tabella-api-design.md`

**Issue e branch:** #117, branch `feature/parametri-di-gioco-tabella-api`. La PR chiude la #117 (`Closes #117`).

## Chiarimenti alla spec (decisi scrivendo il piano)

1. **Corpo della `PATCH`:** `{ values, reason }`, non `{ valori, motivo }`. Le altre route admin usano `reason` (`adminAdjustCreditsSchema`) e le chiavi dei parametri sono in inglese.
2. **Schema di creazione partita:** uno schema Joi è statico e non può conoscere i parametri correnti. Lo schema usa i limiti **assoluti** (`maxPlayers` 2–20, `requiredCredits` 1–10.000); il controller controlla `maxPlayers` fra `minPlayers` e `maxPlayers` correnti e risponde `400` con l'intervallo.
3. **E2E:** un admin esiste solo con PostgreSQL (`E2E_DATABASE_URL`, vedi `e2e/tests/helpers/admin.js`): il test end-to-end salta senza.
4. **Stati costruiti a mano nei test:** molti test creano `gameState` senza `settings`. Ogni lettura passa da `currentSettings` / `settingsOfGame`, che ricadono sui valori di oggi.

## Vincoli globali

- Node.js 20.19 o superiore; moduli ESM con estensione `.js` negli import.
- Ogni modifica a crediti o partite in `req.gameState` va salvata anche con `req.store`; nessuna risposta o evento contiene `mazzo` o la cartella di un altro giocatore.
- L'attore è sempre `req.auth.playerId`, mai il corpo; ogni route che riceve un corpo lo valida con uno schema di `backend/src/validation/schemas.js` tramite `validate`.
- Intervalli e predefiniti: minPlayers 2 (2–10), maxPlayers 10 (2–20, mai sotto minPlayers), requiredCredits 100 (1–10.000), jollyHoldSeconds 30 (10–120), jollyMaxDeclarations 3 (1–10), drawCooldownSeconds 8 (3–30).
- I test su PostgreSQL girano solo su `combocard_test`: `TEST_DATABASE_URL=postgresql://combocard:combocard@127.0.0.1:5432/combocard_test`. Mai su `combocard`.
- Non modificare file `.env`. Messaggi di commit in inglese, con la riga `Co-Authored-By` del repository.

## Punti da controllare (Review Focus)

Ognuno ha il suo test nel task indicato.

1. Valori come stringhe (`"5"`) o decimali nella `PATCH`: devono dare `400`, non essere convertiti (Task 5).
2. Una `PATCH` che porta solo `maxPlayers` sotto il `minPlayers` corrente (o solo `minPlayers` sopra il `maxPlayers` corrente): `400` sul risultato unito (Task 1 e 4).
3. Partita in attesa creata prima di una modifica e avviata dopo: usa la sua copia, non i valori nuovi (Task 6).
4. Riavvio del server: i valori tornano dal database; una partita salvata senza `settings` continua con i valori di oggi (Task 4 e 6).
5. Doppio clic su «Estrai» in modalità classica: la seconda richiesta, arrivata mentre la prima salva, riceve `429` (`attesaFino` si imposta prima di qualunque `await`) (Task 7).

## Struttura dei file

| File | Ruolo |
|---|---|
| `backend/src/config/gameSettings.js` (nuovo) | Chiavi, predefiniti e limiti; `checkGameSettings` |
| `backend/db/migrations/011_game_settings.sql` (nuovo) | Tabella a riga singola con `CHECK` |
| `backend/src/db/store.js` | `getGameSettings` e `updateGameSettings` (memoria e PostgreSQL), `INVALID_SETTINGS` |
| `backend/src/services/settings.service.js` (nuovo) | Cache `gameState.settings`, letture con ripiego, modifica |
| `backend/src/validation/schemas.js` | `adminUpdateSettingsSchema`; `createGameSchema` con limiti assoluti |
| `backend/src/controllers/settings.controller.js` (nuovo) | `GET /api/settings` |
| `backend/src/controllers/admin.controller.js` | `getSettings`, `updateSettings` |
| `backend/src/routes/settings.routes.js` (nuovo), `admin.routes.js`, `index.js` | Le tre route |
| `backend/src/server.js` | `loadSettings` dopo `initializePersistence` |
| `backend/src/controllers/game.controller.js` | Creazione, avvio, Jolly e attesa classica |
| `backend/src/services/estrazione.service.js` | Attesa a turno da `game.settings`, `429`, pausa del Jolly |

## Task 1: modulo dei limiti

**Files:**
- Create: `backend/src/config/gameSettings.js`
- Test: `backend/__tests__/config/gameSettings.test.js`

**Interfaces:**
- Produces: `GAME_SETTING_KEYS` (array delle sei chiavi, in quest'ordine: `minPlayers`, `maxPlayers`, `requiredCredits`, `jollyHoldSeconds`, `jollyMaxDeclarations`, `drawCooldownSeconds`); `GAME_SETTING_LIMITS` (`{ [chiave]: { default, min, max } }`); `defaultGameSettings(): object` (copia dei predefiniti); `checkGameSettings(values: object): string | null` (messaggio d'errore o `null`).

- [ ] **Step 1: test** (`gameSettings.test.js`):
  - `defaultGameSettings()` vale `{ minPlayers: 2, maxPlayers: 10, requiredCredits: 100, jollyHoldSeconds: 30, jollyMaxDeclarations: 3, drawCooldownSeconds: 8 }` e modificarne il risultato non cambia il successivo.
  - `checkGameSettings` dà `null` sui predefiniti e sui due estremi di ogni chiave.
  - Per ogni chiave, `min - 1` e `max + 1` danno un messaggio che contiene il nome della chiave e l'intervallo (`2` e `10` per `minPlayers`).
  - Un valore non intero (`2.5`) o stringa (`"5"`) dà un messaggio.
  - `{ ...predefiniti, minPlayers: 8, maxPlayers: 6 }` dà un messaggio che nomina `maxPlayers` e `minPlayers`.
  - Una chiave sconosciuta dà un messaggio.
- [ ] **Step 2:** `npm --prefix backend test -- __tests__/config/gameSettings.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** implementa il modulo con le firme sopra; `checkGameSettings` richiede l'oggetto completo (tutte e sei le chiavi).
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5:** commit `Add the limits of the game settings`.

## Task 2: migrazione e store PostgreSQL

**Files:**
- Create: `backend/db/migrations/011_game_settings.sql`
- Modify: `backend/src/db/store.js` (store PostgreSQL, vicino a `setAccountRole`; esporta `INVALID_SETTINGS`)
- Modify: `backend/__tests__/db/postgres.integration.test.js`, `backend/__tests__/db/store.history.test.js` (aggiungi `game_settings` a ogni `DROP TABLE IF EXISTS …`: sono tre punti)
- Test: `backend/__tests__/db/postgres.integration.test.js`

**Interfaces:**
- Consumes: `GAME_SETTING_KEYS`, `GAME_SETTING_LIMITS`, `checkGameSettings`, `defaultGameSettings` (Task 1).
- Produces (store): `getGameSettings(): Promise<{ settings, updatedAt: Date|null, updatedBy: string|null }>`; `updateGameSettings(patch, { actor, reason }): Promise<{ before, after, changed: string[] }>`. Lancia `TypeError` senza attore o motivo (come `assertAccountAction`), e un errore con `code === INVALID_SETTINGS` se il risultato unito non passa `checkGameSettings`. Con `changed` vuoto non scrive né audit né `updated_at`.
- Audit: azione `settings_changed`, `target_id` nullo, `details = { changes: { [chiave]: { from, to } }, reason }`, scritta nella stessa transazione.

- [ ] **Step 1: test** in un nuovo `describe('game settings')` di `postgres.integration.test.js`, con lo store creato con `NO_RETRY` come gli altri:
  - dopo le migrazioni `getGameSettings()` dà i predefiniti con `updatedBy: null`;
  - `updateGameSettings({ drawCooldownSeconds: 12 }, …)` restituisce `before`/`after`/`changed: ['drawCooldownSeconds']`, `getGameSettings()` rilegge 12 e c'è una riga `settings_changed` con `details.changes.drawCooldownSeconds` `{ from: 8, to: 12 }`, il motivo e `actor_id`;
  - una modifica che non cambia nulla non aggiunge righe di audit;
  - fuori intervallo e `min > max` rifiutati con `INVALID_SETTINGS`, senza riga di audit;
  - `UPDATE game_settings SET min_players = 1` e `SET min_players = 8, max_players = 6` falliscono con codice `23514` (i `CHECK`, aggirando lo store);
  - `INSERT INTO game_settings (id, …) VALUES (2, …)` fallisce con `23514`;
  - due `updateGameSettings` simultanee su chiavi diverse (`Promise.all`) si sommano entrambe;
  - senza motivo o senza attore: `TypeError`.
- [ ] **Step 2:** `TEST_DATABASE_URL=…combocard_test npm --prefix backend test -- __tests__/db/postgres.integration.test.js -t "game settings"` → FAIL.
- [ ] **Step 3:** scrivi la migrazione (`id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1)`, sei colonne `INTEGER NOT NULL` con `DEFAULT` e `CHECK` dei limiti del Task 1, `CHECK (max_players >= min_players)`, `updated_at TIMESTAMPTZ`, `updated_by TEXT`, riga iniziale con i predefiniti) con un commento in italiano in testa come le altre. Implementa i due metodi nello store PostgreSQL con `withTransaction`: `SELECT … FOR UPDATE`, unione, `checkGameSettings`, `UPDATE`, `INSERT INTO audit_log` come in `setAccountRole`.
- [ ] **Step 4:** stesso comando → PASS; poi tutta la cartella `__tests__/db` → PASS.
- [ ] **Step 5:** commit `Add the game settings table and its PostgreSQL store`.

## Task 3: store in memoria

**Files:**
- Modify: `backend/src/db/store.js` (`createMemoryStore`)
- Test: `backend/__tests__/db/store.settings.test.js` (nuovo)

**Interfaces:**
- Consumes: Task 1; stessa firma e stessi errori del Task 2.
- Produces: `createMemoryStore({ drawCooldownSeconds } = {})`: il valore iniziale dell'attesa se è intero fra 3 e 30, altrimenti 8; tutti gli altri parametri partono dai predefiniti. `pushAudit` esistente scrive l'audit (`target_id` nullo).

- [ ] **Step 1: test**, gli stessi casi del Task 2 che non riguardano i `CHECK` del database, più: `createMemoryStore({ drawCooldownSeconds: 12 })` parte da 12; con `2` o `"x"` parte da 8; la modifica compare in `listAuditEvents()` con `action: 'settings_changed'`; il risultato di `getGameSettings()` modificato dal chiamante non cambia lo store.
- [ ] **Step 2:** `npm --prefix backend test -- __tests__/db/store.settings.test.js` → FAIL.
- [ ] **Step 3:** implementa i due metodi nello store in memoria (stesso confronto prima/dopo del Task 2).
- [ ] **Step 4:** stesso comando e `__tests__/db/store.test.js` → PASS.
- [ ] **Step 5:** controlla con `grep -rn "role_changed" backend/src frontend/src` se un elenco di azioni di audit (schema, etichette) rifiuterebbe o mostrerebbe male `settings_changed`; se serve, aggiungila e aggiungi un test. Commit `Add the game settings to the in-memory store`.

## Task 4: servizio e caricamento all'avvio

**Files:**
- Create: `backend/src/services/settings.service.js`
- Modify: `backend/src/server.js` (chiama `loadSettings` dopo `store = await initializePersistence(gameState)`; lo store in memoria creato alla riga 50 riceve `{ drawCooldownSeconds: config.drawCooldownSeconds }`)
- Modify: `backend/src/db/index.js` (stesso argomento per il `createMemoryStore()` di `initializePersistence` quando manca `DATABASE_URL`)
- Test: `backend/__tests__/services/settings.service.test.js` (nuovo)

**Interfaces:**
- Consumes: Task 1, 2, 3.
- Produces:
  - `currentSettings(gameState): object`: `gameState.settings` se c'è, altrimenti `legacySettings()`.
  - `legacySettings(): object`: i valori di oggi (`GAME_DEFAULTS.MIN_PLAYERS`, `MAX_PLAYERS`, `REQUIRED_CREDITS`, `JOLLY_HOLD_MS / 1000`, `JOLLY_MAX_DECLARATIONS`, `config.drawCooldownSeconds`).
  - `settingsOfGame(game, gameState): object`: `game.settings` se c'è, altrimenti `currentSettings(gameState)`.
  - `loadSettings(store, gameState): Promise<void>`.
  - `getSettingsView(store, gameState, { admin }): Promise<{ values, limits, defaults, updatedAt?, updatedBy? }>` (`updatedAt` e `updatedBy` solo se `admin`; `limits` e `defaults` da `GAME_SETTING_LIMITS`).
  - `updateSettings(store, gameState, { values, reason, actor }): Promise<{ before, after, changed }>`: `INVALID_SETTINGS` → `AppError` 400 con il messaggio; qualunque altro errore dello store → `AppError` 503 «Storage temporarily unavailable, please try again»; la cache cambia solo se lo store ha scritto.

- [ ] **Step 1: test** (store in memoria): `loadSettings` mette i valori in `gameState.settings`; `currentSettings` e `settingsOfGame` ricadono su `legacySettings()` per uno stato senza `settings` e una partita senza `settings`, e `settingsOfGame` preferisce `game.settings`; `updateSettings` aggiorna la cache dopo la scrittura; `maxPlayers` sotto il `minPlayers` corrente → `AppError` 400 che nomina le due chiavi e la cache non cambia (punto 2 del Review Focus); un `store.updateGameSettings` che lancia → 503 e la cache non cambia; `getSettingsView({ admin: false })` non contiene `updatedBy`; un secondo `loadSettings` dopo la modifica con lo stesso store rilegge i nuovi valori (riavvio, punto 4).
- [ ] **Step 2:** `npm --prefix backend test -- __tests__/services/settings.service.test.js` → FAIL.
- [ ] **Step 3:** implementa il servizio con le firme sopra. In `server.js` chiama `await loadSettings(store, gameState)` subito dopo `initializePersistence`. Lo store in memoria creato in `server.js` e in `initializePersistence` riceve `{ drawCooldownSeconds: config.drawCooldownSeconds }`.
- [ ] **Step 4:** stesso comando e `npm --prefix backend test` → PASS.
- [ ] **Step 5:** commit `Add the settings service and load the settings at startup`.

## Task 5: schemi e route

**Files:**
- Modify: `backend/src/validation/schemas.js`, `backend/src/routes/admin.routes.js`, `backend/src/routes/index.js`, `backend/src/controllers/admin.controller.js`, `backend/src/middleware/rateLimiter.middleware.js`
- Create: `backend/src/routes/settings.routes.js`, `backend/src/controllers/settings.controller.js`
- Test: `backend/__tests__/validation/schemas.test.js`, `backend/__tests__/routes/admin.routes.test.js`, `backend/__tests__/controllers/settings.controller.test.js` (nuovo), `backend/__tests__/controllers/admin.controller.test.js`

**Interfaces:**
- Consumes: `getSettingsView`, `updateSettings` (Task 4); limiti (Task 1).
- Produces: `adminUpdateSettingsSchema` (`{ values: { …sei chiavi opzionali, integer strict con i limiti assoluti, nessuna chiave sconosciuta; almeno una }, reason: string trim 1–200 obbligatorio }`); `settingsLimiter` (come `strictLimiter`, 10 richieste al minuto, spento nei test); route `GET /api/settings` (`requireAuth`), `GET /api/admin/settings`, `PATCH /api/admin/settings` (`settingsLimiter`, `validate(adminUpdateSettingsSchema)`, poi il controller); risposta `sendSuccess(res, view)` con `values`, `limits`, `defaults`.

- [ ] **Step 1: test:**
  - schema: accetta `{ values: { drawCooldownSeconds: 12 }, reason: 'x' }`; rifiuta `values` vuoto, chiave sconosciuta, `"5"`, `5.5`, `reason` mancante o vuoto, fuori intervallo (punto 1 del Review Focus);
  - `admin.routes.test.js`: aggiungi `['/settings', 'get', 1]` e `['/settings', 'patch', 3]` (limite, validazione, handler) alla tabella delle route, e verifica che il router resti dietro `requireAuth` e `requireRole('admin')`;
  - controller (stile `call(handler, …)` di `game.turns.test.js`): `GET /api/settings` risponde con valori, limiti e predefiniti e **non** con `updatedBy`; l'admin `GET` li ha; la `PATCH` chiama il servizio con l'attore `{ type: 'player', id: req.auth.playerId }` e ignora un `actor` nel corpo; l'audit è visibile in `store.listAuditEvents()`.
- [ ] **Step 2:** `npm --prefix backend test -- __tests__/validation/schemas.test.js __tests__/routes/admin.routes.test.js __tests__/controllers/settings.controller.test.js` → FAIL.
- [ ] **Step 3:** implementa schema, limitatore, controller e route; registra `settings.routes.js` in `routes/index.js` sotto `/settings`.
- [ ] **Step 4:** stessi comandi più `npm --prefix backend test` → PASS.
- [ ] **Step 5:** commit `Add the routes of the game settings`.

## Task 6: uso dei parametri nelle partite

**Files:**
- Modify: `backend/src/controllers/game.controller.js` (creazione riga ~96–112, elenco riga ~62, avvio riga ~257, Jolly riga ~483–492), `backend/src/validation/schemas.js` (`createGameSchema`), `backend/src/config/constants.js` (commento: ora sono i valori «di oggi» per le partite senza parametri)
- Test: `backend/__tests__/controllers/game.settings.test.js` (nuovo); aggiorna `backend/__tests__/validation/schemas.test.js`

**Interfaces:**
- Consumes: `currentSettings`, `settingsOfGame` (Task 4).
- Produces: `game.settings` (copia a sei chiavi) in ogni partita nuova; `createGameSchema` con `requiredCredits: integer.min(1).max(GAME_SETTING_LIMITS.requiredCredits.max)` e `maxPlayers: integer.min(2).max(20)`.

- [ ] **Step 1: test** (`game.settings.test.js`, stile `game.turns.test.js`, store in memoria):
  - la partita creata ha `game.settings` uguale ai parametri correnti e, dopo `updateSettings`, una partita già creata **non cambia** mentre la nuova sì;
  - `requiredCredits: 0` dà `400` (schema); `maxPlayers` fuori da `minPlayers`–`maxPlayers` correnti dà `400` con l'intervallo nel messaggio;
  - senza `maxPlayers` nel corpo la partita usa il `maxPlayers` corrente; senza `requiredCredits` usa la quota corrente;
  - avvio: con `minPlayers` portato a 3 dopo la creazione, la partita in attesa si avvia ancora con 2 (la sua copia) (punto 3); una partita nuova con `minPlayers: 3` rifiuta l'avvio con 2 con `400`;
  - Jolly: con `jollyMaxDeclarations: 1` la seconda dichiarazione dà `429`; `jollyHoldSeconds: 10` imposta `scadenza` a circa 10 s;
  - una partita costruita a mano senza `settings` usa i valori di oggi (punto 4).
- [ ] **Step 2:** `npm --prefix backend test -- __tests__/controllers/game.settings.test.js` → FAIL.
- [ ] **Step 3:** implementa: `createGame` copia `currentSettings(req.gameState)` in `game.settings`, controlla `maxPlayers` e usa la quota corrente al posto di `GAME_DEFAULTS`; `startGame`, l'elenco e il Jolly leggono `settingsOfGame(game, req.gameState)`; aggiorna lo schema.
- [ ] **Step 4:** stesso comando e `npm --prefix backend test` → PASS. Correggi i test esistenti che mandavano `requiredCredits: 0`.
- [ ] **Step 5:** commit `Use the game settings when a game is created and played`.

## Task 7: attesa tra le estrazioni imposta dal server (`429`)

**Files:**
- Modify: `backend/src/services/estrazione.service.js` (`attesaMs`, `verificaAttesa`, `riprendiTurno`, nuova verifica classica), `backend/src/controllers/game.controller.js` (`drawCard`, `endJollyHold`)
- Test: `backend/__tests__/controllers/game.turns.test.js` (aggiorna), `backend/__tests__/controllers/game.draw-wait.test.js` (nuovo)

**Interfaces:**
- Consumes: `settingsOfGame` (Task 4).
- Produces: `AppError` con `statusCode` 429 e campo `retryAfter` (secondi, `Math.ceil`), messaggio `Wait N seconds before drawing`; la risposta di errore porta `retryAfter` e l'intestazione `Retry-After` (guarda `errorHandler.js` e `AppError.js` per il punto giusto). `game.attesaFino` (ms) per la modalità classica. `verificaAttesaClassica(game)` e l'impostazione `game.attesaFino = Date.now() + attesaMs(game)` avvengono in `drawCard` prima di qualunque `await`.

- [ ] **Step 1: test:**
  - `game.turns.test.js`: il test «too soon is refused with 409» diventa `429` (due asserzioni); `COOLDOWN` usa `game.settings.drawCooldownSeconds`; con `drawCooldownSeconds: 5` l'attesa e il timer di estrazione automatica seguono 5 s;
  - `game.draw-wait.test.js` (modalità classica, `jest.useFakeTimers`): la prima estrazione passa; la seconda subito dopo dà `429` con `retryAfter` uguale ai secondi che restano; dopo `COOLDOWN - 1` ms ancora `429`; dopo `COOLDOWN` passa;
  - due `drawCard` lanciate insieme (`Promise.allSettled`): una riesce e l'altra dà `429` (punto 5);
  - pausa del Jolly: l'attesa che resta quando inizia la scelta resta uguale quando finisce (per annullamento, per uso e per scadenza), quindi non si accorcia né si allunga; durante la scelta `drawCard` dà ancora `409`;
  - una partita senza `settings` usa `config.drawCooldownSeconds`.
- [ ] **Step 2:** `npm --prefix backend test -- __tests__/controllers/game.draw-wait.test.js __tests__/controllers/game.turns.test.js` → FAIL.
- [ ] **Step 3:** implementa. `attesaMs(game)` legge `game.settings` con ripiego su `config`; `verificaAttesa` passa a `429`; in modalità classica la pausa si registra all'inizio della scelta (accanto a `sospendiTurno`) e `riprendiTurno` sposta `game.attesaFino` della durata della pausa prima del controllo su `game.turno`, quindi anche quando non c'è turno.
- [ ] **Step 4:** stessi comandi, poi `npm --prefix backend test` → PASS; poi `npm --prefix backend run lint`.
- [ ] **Step 5:** commit `Keep the wait between draws on the server, with 429`.

## Task 8: test end-to-end sull'API

**Files:**
- Create: `e2e/tests/api/settings.spec.js`

**Interfaces:**
- Consumes: le tre route (Task 5), `registerAdmin`, `registerPlayer`, `E2E_DATABASE_URL` (vedi `admin-users.spec.js`).

- [ ] **Step 1: test** (`test.skip(!E2E_DATABASE_URL, …)` e tag `@api @admin` come `admin-users.spec.js`): un `player` riceve `403` su `PATCH /api/admin/settings` e `GET /api/admin/settings` e `200` su `GET /api/settings`; l'admin porta `requiredCredits` a 150, un giocatore crea una partita senza quota e la partita ha `requiredCredits: 150`; l'admin riporta il valore a 100 (il test non lascia modifiche); `PATCH` fuori intervallo → `400`; l'audit (`GET /api/admin/audit`) contiene `settings_changed` con il motivo.
- [ ] **Step 2:** avvia il backend su PostgreSQL di prova e lancia `npm run test:e2e -- tests/api/settings.spec.js` (con `E2E_DATABASE_URL` che finisce in `combocard_test`) → PASS. Se non c'è un modo di avviarlo qui, dichiaralo nella PR («Da sapere») invece di darlo per verificato.
- [ ] **Step 3:** commit `Test the game settings through the API`.

## Task 9: documentazione e verifica finale

**Files:**
- Modify: `docs/DATABASE.md`, `docs/AUTH.md`, `docs/GAME_DESIGN.md`, `docs/DEPLOYMENT.md`, `README.md`, `backend/README.md`, `TEST_SUITE.md`

- [ ] **Step 1:** aggiorna `docs/DATABASE.md` (tabella `game_settings` e azione `settings_changed` nell'elenco di `audit_log`), `docs/AUTH.md` (le tre route e chi può usarle), `docs/GAME_DESIGN.md` (i sei parametri con gli intervalli, la copia nella partita, l'attesa imposta dal server con `429`), `docs/DEPLOYMENT.md` (`DRAW_COOLDOWN_SECONDS` vale solo come valore iniziale senza database), `README.md` e `backend/README.md` (elenco delle rotte) e `TEST_SUITE.md` (numeri dei test, presi dall'esecuzione vera).
- [ ] **Step 2:** `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs` → 0 errori (restano solo gli avvisi del segnaposto `feature/release-X.Y.Z`; le rotte e i percorsi della spec e del piano ora esistono).
- [ ] **Step 3:** con PostgreSQL attivo, `TEST_DATABASE_URL=…combocard_test npm --prefix backend test` per tre volte consecutive → tutto verde; `npm --prefix backend run lint` e `npm --prefix frontend test` → nessun errore.
- [ ] **Step 4:** commit `Document the game settings`, push della branch e PR verso `develop` con `Closes #117`; nelle note scrivi il cambio di comportamento (`requiredCredits: 0` dà `400`, l'attesa dà `429` e non più `409`) e che frontend e schermata admin arrivano con la #118 e la #119. La PR la unisce l'utente.
