# Avvisi e modalità manutenzione: piano di implementazione

> **Per chi esegue:** SOTTO-SKILL OBBLIGATORIA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans, un compito alla volta. I passi usano caselle `- [ ]`.

**Obiettivo:** l'admin pubblica un avviso a tutti i giocatori e accende una manutenzione che blocca ciò che è nuovo (registrazione, creazione, ingresso e avvio di partite) lasciando finire le partite in corso.

**Architettura:** due tabelle da una riga sola (migrazione 013) con audit nella stessa transazione, come `game_settings`. Il server le tiene in `gameState`, le cambia solo dopo la scrittura e le emette a tutti con gli eventi socket `avviso` e `manutenzione`. Una route pubblica `GET /api/status` serve a chi non ha accesso. Il frontend ha un banner, una schermata di manutenzione e una scheda «Avvisi» in amministrazione.

**Stack:** Express 5, Joi, PostgreSQL (`pg`), Socket.io, React 19, Redux Toolkit, Vitest, Jest, Playwright.

**Specifica:** `docs/superpowers/specs/2026-11-22-avvisi-e-manutenzione-design.md`. Issue #120, branch `feature/avvisi-e-manutenzione`.

## Vincoli globali

- **Messaggio:** testo di 1–280 caratteri (tagliato), mai HTML; gravità `info` o `importante`. Costanti in `backend/src/config/notices.js`: `NOTICE_MESSAGE_MAX = 280`, `NOTICE_SEVERITIES = ["info", "importante"]`.
- **Eventi socket:** `avviso` con `{ announcement }` (l'avviso visibile ora o `null`) e `manutenzione` con `{ maintenance }` (`{ active, message, endsAt }` o `null` se spenta), a tutti con `broadcastToAll`.
- **Azioni di audit** (`target_id` nullo): `announcement_published` (dettagli `version`, `message`, `severity`, `startsAt`, `endsAt`), `announcement_withdrawn` (`version`), `maintenance_enabled` (`message`, `endsAt`), `maintenance_disabled` (`{}`).
- **Blocco:** `503` con `code: "MAINTENANCE"` (e `retryAfter` in secondi se c'è `endsAt` futura), messaggio «The game is in maintenance»; un admin non è mai bloccato. In Italiano: «Il gioco è in manutenzione: riprova più tardi».
- **Date nei confini tra strati:** ISO 8601 (stringhe) o `null`; i metodi dello store le restituiscono già in questa forma.
- **Una riga sola per tabella:** `id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1)`, riga inserita dalla migrazione.
- **Regole del repository (CLAUDE.md):** ogni scrittura passa da `req.store`; l'attore è `req.auth`, mai il corpo; ogni corpo ha uno schema Joi in `schemas.js`; nessuna risposta mostra dati di altri giocatori. Le route admin stanno nel router che ha già `requireAuth` e `requireRole("admin")`.
- **Messaggi per l'utente in italiano; commenti e nomi del codice in inglese.**
- **Line ending:** questi file sono CRLF e restano CRLF (usa `edit()` di `/tmp/claude-1000/crlf/crlf.py`, o ricrealo: sostituzioni esatte che conservano `\r\n`): `routes/index.js`, `health.controller.js`, `config/index.js`, `game.controller.js`, `useSocket.jsx`, `api.js`, `AppContent.jsx`, `errors.utils.js`, `HomePage.jsx`, `docs/DEPLOYMENT.md`, `docs/GAME_DESIGN.md`, `README.md`. Gli altri sono LF; i file nuovi LF.
- **Comandi di prova:** backend `npm --prefix backend test -- <percorso>`; con il database `TEST_DATABASE_URL=postgresql://combocard:combocard@127.0.0.1:5432/combocard_test` (mai `combocard`); frontend `npm --prefix frontend run test:run -- <percorso>`; lint `npm run lint`; e2e come in `TEST_SUITE.md` (frontend costruito con `VITE_BACKEND_URL` uguale all'indirizzo del server). Un commit per compito, con `Part of #120` e il trailer di CLAUDE.md.

## Da rivedere (cosa la specifica non dice e può rompersi)

1. **Partita piena che aspetta la fine della manutenzione:** l'avvio automatico è sospeso, e quando la manutenzione si spegne qualcuno deve riprenderlo, altrimenti la partita resta ferma. Test: Compito 4.
2. **Chi è già nella partita non deve essere bloccato** dal blocco dell'ingresso (stesso punto del blocco dei termini). Test: Compito 4.
3. **Chi è esente dal blocco:** solo un admin, e il ruolo viene da `req.auth.role`; la registrazione non ha sessione e non è mai esente. Test: Compito 4.
4. **Un avviso con inizio futuro non deve comparire prima, e uno scaduto deve sparire da solo** (timer al bordo della finestra); il ritardo massimo di `setTimeout` (circa 24 giorni) non deve far scattare subito l'evento. Test: Compito 2.
5. **Messaggio con `<script>` o spazi attorno:** viene tagliato, mai interpretato; lo schermo lo mostra come testo. Test: Compiti 3 e 6.
6. **`localStorage` che manca o lancia:** il banner funziona e torna a ogni ricarica. Test: Compito 6.
7. **Una scrittura che fallisce lascia la cache com'era**, e non emette nessun evento. Test: Compito 2.
8. **Le prove che accendono la manutenzione bloccano gli altri giocatori in parallelo:** girano in un solo progetto (chromium), come quelle dei parametri. Test: Compito 8.

---

## Compito 1: Dati e store

**File:**
- Crea: `backend/db/migrations/013_notices.sql`, `backend/src/config/notices.js`
- Modifica: `backend/src/db/store.js` (store in memoria e store PostgreSQL)
- Prove: nuovo `backend/__tests__/db/store.notices.test.js` (memoria), `backend/__tests__/db/postgres.integration.test.js` (nuova `describe('notices')`)

**Interfacce:**
- Produce, su entrambi gli store (le date sono ISO o `null`):
  - `getAnnouncement(): Promise<{ version: number, active: boolean, message: string, severity: string, startsAt: string|null, endsAt: string|null, updatedAt: string|null, updatedBy: string|null }>`
  - `getMaintenance(): Promise<{ active: boolean, message: string, endsAt: string|null, updatedAt: string|null, updatedBy: string|null }>`
  - `publishAnnouncement({ message, severity, startsAt, endsAt }, { actor }): Promise<announcement>`: `version + 1`, `active = true`, audit `announcement_published`.
  - `withdrawAnnouncement({ actor }): Promise<announcement>`: `active = false`, la versione resta, audit `announcement_withdrawn`; se non è attivo non scrive nulla e restituisce lo stato.
  - `setMaintenance({ active, message, endsAt }, { actor }): Promise<{ maintenance, changed: boolean }>`: audit `maintenance_enabled` o `maintenance_disabled`; se lo stato non cambia non scrive nulla (`changed: false`).
  - `NOTICE_MESSAGE_MAX`, `NOTICE_SEVERITIES` da `config/notices.js`.
- Consuma: `assertActor` (già in `store.js`) e `pushAudit` / la scrittura dell'audit nella stessa transazione, come `updateGameSettings`.

- [ ] **Passo 1: prove che falliscono.** `store.notices.test.js` (store in memoria): lo stato iniziale è `version 0`, `active false`, messaggio vuoto; `publishAnnouncement` mette `version 1`, `active true`, il messaggio e la gravità, e una seconda pubblicazione dà `version 2`; `withdrawAnnouncement` mette `active false` e lascia `version 2`, e chiamato di nuovo non aggiunge audit; `setMaintenance({ active: true, message: 'Torno alle 22', endsAt })` dà `changed: true`, lo stesso comando due volte di fila dà `changed: false`, e `setMaintenance({ active: false })` dà `changed: true` poi `false`; l'audit (`listAuditEvents()`) contiene nell'ordine `announcement_published`, `announcement_withdrawn`, `maintenance_enabled`, `maintenance_disabled` con i dettagli dei Vincoli globali e `actorId` dell'attore; senza attore lancia `TypeError`. `postgres.integration.test.js` (con `TEST_DATABASE_URL`): la migrazione crea le due tabelle con la riga 1 inattiva; `publishAnnouncement` alza la versione e scrive l'audit nella stessa transazione (se l'audit fallisse non resta la modifica: simula con un `actor` non valido e verifica che la riga non cambi); un `CHECK` rifiuta `ends_at <= starts_at` con un `INSERT/UPDATE` diretto; `setMaintenance` senza cambiamento non scrive audit; due `publishAnnouncement` simultanee (`Promise.all`) danno le versioni 1 e 2.
- [ ] **Passo 2: eseguili e verifica che falliscano** (metodi e tabelle mancanti).
- [ ] **Passo 3: implementa.** Migrazione `013_notices.sql` con le due tabelle e la riga inserita (vedi la specifica, sezione Dati; commento in italiano come le altre). `config/notices.js` con le due costanti. Nello store in memoria uno stato locale come per le impostazioni (`settingsUpdatedAt`), con `pushAudit`. Nello store PostgreSQL, per ogni metodo di scrittura: `withTransaction`, `SELECT ... FOR UPDATE` sulla riga, `UPDATE` e `INSERT INTO audit_log` come `updateGameSettings`; conversione delle date con `toISOString()` (o `null`).
- [ ] **Passo 4: esegui** `store.notices.test.js`, le suite `__tests__/db` con il database: verdi.
- [ ] **Passo 5: commit** `Save the announcement and the maintenance mode with the audit`.

## Compito 2: Servizio, eventi e timer

**File:**
- Crea: `backend/src/services/notices.service.js`
- Modifica: `backend/src/server.js` (`loadNotices` e `armNoticeTimers` all'avvio)
- Prove: nuovo `backend/__tests__/services/notices.service.test.js`

**Interfacce:**
- Consuma: i metodi di store del Compito 1; `broadcastToAll(io, event, data)` da `backend/src/sockets/index.js`; `AppError`.
- Produce in `notices.service.js`:
  - `loadNotices(store, gameState): Promise<void>`: mette `gameState.announcement` e `gameState.maintenance` (gli oggetti degli store).
  - `visibleAnnouncement(gameState, now = new Date()): { version, message, severity, startsAt, endsAt } | null`: l'avviso se `active` e `startsAt` assente o ≤ `now` e `endsAt` assente o > `now`.
  - `visibleMaintenance(gameState): { active: true, message, endsAt } | null`.
  - `statusView(gameState, now = new Date()): { maintenance: visibleMaintenance, announcement: visibleAnnouncement }`.
  - `publishAnnouncement(store, gameState, io, input, actor): Promise<announcement>`, `withdrawAnnouncement(store, gameState, io, actor)`, `setMaintenance(store, gameState, io, input, actor): Promise<{ maintenance, changed }>`: scrivono con lo store, **solo dopo** aggiornano la cache, emettono l'evento (`avviso` o `manutenzione`) e riarmano i timer. Se la scrittura fallisce lanciano `AppError("Storage temporarily unavailable, please try again", 503)` e non toccano cache né eventi.
  - `isMaintenance(gameState): boolean`.
  - `assertNotInMaintenance(gameState, role = null): void`: se la manutenzione è accesa e `role !== "admin"` lancia `AppError("The game is in maintenance", 503)` con `code: "MAINTENANCE"` e `retryAfter` (secondi, intero ≥ 1) se `endsAt` è futura.
  - `armNoticeTimers(gameState, io): void`: un solo timer alla volta (`unref`), al prossimo bordo (`startsAt` futuro o `endsAt` futuro) dell'avviso attivo, con ritardo `min(bordo - adesso, 12 ore)`; allo scatto emette `avviso` con lo stato visibile e si riarma; nessun timer se non c'è un bordo futuro. Il timer precedente si cancella a ogni chiamata.

- [ ] **Passo 1: prove che falliscono** (store in memoria, `jest.useFakeTimers()`, `io` finto con `emit` registrato): `visibleAnnouncement` dà l'avviso senza finestra, `null` prima di `startsAt`, `null` da `endsAt` in poi, `null` se non attivo; `statusView` con manutenzione spenta dà `maintenance: null`; `publishAnnouncement` aggiorna la cache, emette `avviso` con `{ announcement: { version: 1, … } }` e l'audit esiste; un messaggio con `<script>` si conserva identico e un messaggio con spazi attorno arriva tagliato dallo schema (il servizio non lo trasforma); `withdrawAnnouncement` emette `avviso` con `{ announcement: null }`; `setMaintenance(active true)` emette `manutenzione` con `{ maintenance: { active: true, message, endsAt } }` e con `active false` `{ maintenance: null }`; con uno store che lancia, il servizio risponde `503`, la cache e gli eventi non cambiano; `assertNotInMaintenance` non fa nulla a manutenzione spenta, lancia `503` con `code: 'MAINTENANCE'` a manutenzione accesa, non lancia per `role: 'admin'`, e `retryAfter` è il numero di secondi fino a `endsAt`; timer: un avviso con `startsAt` tra 1 ora emette `avviso` (visibile) allo scoccare dell'ora, e uno con `endsAt` tra 1 ora emette `avviso` con `null` allo scoccare; con `startsAt` tra 40 giorni il timer scatta dopo 12 ore **senza** emettere un avviso visibile e si riarma (avanzando il tempo finto di 12 ore non emette nulla di visibile).
- [ ] **Passo 2: eseguilo e verifica che fallisca.**
- [ ] **Passo 3: implementa** `notices.service.js` come sopra; in `server.js`, dopo `loadSettings`, `await loadNotices(store, gameState)` e, accanto a `riarmaTurni`, `armNoticeTimers(gameState, io)`.
- [ ] **Passo 4: esegui** il file e tutta la suite del backend.
- [ ] **Passo 5: commit** `Publish and withdraw notices and switch the maintenance, with the events`.

## Compito 3: Schemi, route e controller

**File:**
- Crea: `backend/src/routes/status.routes.js`
- Modifica: `backend/src/validation/schemas.js`, `backend/src/controllers/admin.controller.js`, `backend/src/routes/admin.routes.js`, `backend/src/routes/index.js`, `backend/src/server.js` (monta `/api/status`), `backend/src/controllers/health.controller.js`
- Prove: `backend/__tests__/validation/schemas.test.js`, `backend/__tests__/routes/admin.routes.test.js`, nuovo `backend/__tests__/controllers/notices.controller.test.js`, `backend/__tests__/controllers/health.controller.test.js`

**Interfacce:**
- Consuma: `publishAnnouncement`, `withdrawAnnouncement`, `setMaintenance`, `statusView` (Compito 2); `NOTICE_MESSAGE_MAX`, `NOTICE_SEVERITIES`; `settingsLimiter`.
- Produce:
  - `adminAnnouncementSchema = Joi.object({ message: Joi.string().trim().min(1).max(NOTICE_MESSAGE_MAX).required(), severity: Joi.string().valid(...NOTICE_SEVERITIES).required(), startsAt: Joi.date().iso(), endsAt: Joi.date().iso().greater(Joi.ref("startsAt")) })` (`endsAt` deve venire dopo `startsAt` quando ci sono entrambe).
  - `adminMaintenanceSchema = Joi.object({ active: Joi.boolean().strict().required(), message: Joi.string().trim().min(1).max(NOTICE_MESSAGE_MAX), endsAt: Joi.date().iso() })` con `message` **obbligatorio** quando `active` è `true` (`Joi.when`).
  - Route admin: `GET /api/admin/notices` → `{ announcement, maintenance }` (stati completi dello store); `PUT /api/admin/announcement`; `DELETE /api/admin/announcement`; `PUT /api/admin/maintenance` (le tre scritture con `settingsLimiter`).
  - Route pubblica `GET /api/status` → `statusView(...)`, senza `requireAuth`; `/api/health` aggiunge `maintenance: isMaintenance(gameState)`.
  - Controller: `getNotices`, `publishAnnouncement`, `withdrawAnnouncement`, `setMaintenance` in `admin.controller.js` (attore `actorOf(req)`).

- [ ] **Passo 1: prove che falliscono.** Schemi: `adminAnnouncementSchema` accetta `{ message: 'Alle 22 manutenzione', severity: 'info' }` e con inizio e fine corretti, rifiuta senza messaggio, con messaggio vuoto, di 281 caratteri, con gravità `x`, con `endsAt` prima di `startsAt`, e **taglia** `'  ciao  '` in `'ciao'`; `adminMaintenanceSchema` accetta `{ active: false }`, rifiuta `{ active: true }` senza messaggio, rifiuta `active: 'true'` (stringa). `admin.routes.test.js`: le quattro route nuove esistono con i metodi giusti (`notices` solo `get`, `announcement` `put` e `delete`, `maintenance` `put`) e il router rispetta ancora «prima il login e il ruolo» (il test esistente). Controller (store in memoria, `io` finto): `getNotices` restituisce gli stati completi; `publishAnnouncement` risponde con l'avviso e `version 1`; `withdrawAnnouncement` ritira; `setMaintenance` accende e spegne e risponde `changed`; un messaggio `<script>alert(1)</script>` si salva e si restituisce **identico** (nessuna trasformazione, nessun HTML interpretato). `GET /api/status`: la risposta pubblica non ha campi di giocatori e coincide con `statusView`; `health.controller.test.js`: `healthCheck` ha `maintenance: false` e `true` con la manutenzione accesa.
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa** gli schemi, i controller e le route; `status.routes.js` monta un `Router` con `GET /` e si esporta da `routes/index.js` come `statusRoutes`; in `server.js` `app.use("/api/status", statusRoutes)`.
- [ ] **Passo 4: esegui** i cinque file e tutta la suite del backend.
- [ ] **Passo 5: commit** `Add the routes of the notices and the maintenance`.

## Compito 4: Blocchi della manutenzione

**File:**
- Modifica: `backend/src/controllers/auth.controller.js` (`register`), `backend/src/controllers/game.controller.js` (`createGame`, `joinGame`, `startGame`, `autoStartGame`, nuova `resumeWaitingGames`), `backend/src/controllers/admin.controller.js` (`setMaintenance` riprende le partite)
- Prove: nuovo `backend/__tests__/controllers/game.maintenance.test.js`, `backend/__tests__/controllers/auth.controller.test.js`, `backend/__tests__/controllers/admin.maintenance.test.js`

**Interfacce:**
- Consuma: `assertNotInMaintenance(gameState, role)`, `isMaintenance` (Compito 2); `setMaintenance` (Compito 3).
- Produce: `resumeWaitingGames(gameState, io, store): void` in `game.controller.js`: per ogni partita in attesa con `players.length === maxPlayers`, richiama `autoStartGame` (come l'avvio dopo l'ingresso dell'ultimo giocatore); `autoStartGame` esce subito se `isMaintenance(gameState)`.

- [ ] **Passo 1: prove che falliscono.** Con la manutenzione accesa, per un giocatore normale: `register` risponde `503` con `code: 'MAINTENANCE'` e non crea l'account (`ctx.gameState.players` resta vuoto); `createGame` `503`; `joinGame` di un giocatore nuovo `503` e il giocatore non entra; `startGame` `503`; **un admin** crea ed entra (`role: 'admin'` in `req.auth`); **chi è già nella partita** che ripete `joinGame` non riceve `503` (la risposta di sempre, sia per la partita in attesa sia per quella in corso); la partita già avviata continua a estrarre (`drawCard` ancora valido); `autoStartGame` con la manutenzione accesa **non avvia** una partita piena (resta `waiting`, nessuno ha pagato la quota); spegnendo la manutenzione con `setMaintenance` (controller admin) la partita piena in attesa **parte** e i crediti si scalano. Con la manutenzione spenta tutto funziona come prima (la suite esistente resta verde). `retryAfter` compare quando c'è `endsAt` futura.
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa.** `register`: subito all'inizio `assertNotInMaintenance(req.gameState)`. `createGame`: dopo il controllo del giocatore, `assertNotInMaintenance(req.gameState, req.auth.role)`; `joinGame`: nello stesso punto di `assertTermsAccepted` (dopo le risposte per chi è già nella partita), con il ruolo; `startGame`: dopo il controllo del creatore, con il ruolo; `autoStartGame`: `if (isMaintenance(gameState)) return;` come primo controllo; `resumeWaitingGames` esportata. Il controller admin `setMaintenance` chiama `resumeWaitingGames(req.gameState, req.io, req.store)` quando il risultato è `changed` e `active` è falso.
- [ ] **Passo 4: esegui** i tre file e tutta la suite del backend, con il database.
- [ ] **Passo 5: commit** `Keep what is new out of the game while it is in maintenance`.

## Compito 5: Strato dati del frontend

**File:**
- Crea: `frontend/src/services/statusService.js`, `frontend/src/store/slices/noticeSlice.js`, `frontend/src/utils/avvisoChiuso.js`
- Modifica: `frontend/src/services/adminService.js`, `frontend/src/services/index.js`, `frontend/src/store/index.js`, `frontend/src/hooks/useSocket.jsx`, `frontend/src/utils/errors.utils.js`, `frontend/src/__tests__/test-utils.jsx`
- Prove: nuovi `frontend/src/__tests__/store/noticeSlice.test.js`, `frontend/src/__tests__/utils/avvisoChiuso.test.js`, `frontend/src/__tests__/services/statusService.test.js`; `frontend/src/__tests__/services/adminService.test.js` (se esiste, altrimenti nuovo), `frontend/src/__tests__/utils/errors.utils.test.js`, `frontend/src/__tests__/hooks/useSocket.test.jsx`

**Interfacce:**
- Produce:
  - `statusService.getStatus(): Promise<{ maintenance, announcement }>` (`GET /status`).
  - `adminService.getNotices()`, `publishAnnouncement({ message, severity, startsAt, endsAt })` (`PUT /admin/announcement`), `withdrawAnnouncement()` (`DELETE /admin/announcement`), `setMaintenance({ active, message, endsAt })` (`PUT /admin/maintenance`).
  - `noticeSlice`: stato `{ announcement: null, maintenance: null, status: 'idle' }`; thunk `fetchStatus()` (a esito positivo mette entrambi e `status: 'ready'`; a esito negativo **non cancella** i valori già letti); azioni `setAnnouncement(announcement|null)` e `setMaintenance(maintenance|null)`.
  - `avvisoChiuso.js`: `versioneChiusa(): number` (0 se manca o se `localStorage` lancia) e `chiudiAvviso(version: number): void` (non lancia mai); chiave `combocard.avviso-chiuso`.
  - `useSocket`: ascolta `avviso` (→ `setAnnouncement(payload.announcement)`) e `manutenzione` (→ `setMaintenance(payload.maintenance)`); a ogni `connect` richiama `fetchStatus`.
  - `errors.utils.js`: «The game is in maintenance» → «Il gioco è in manutenzione: riprova più tardi».

- [ ] **Passo 1: prove che falliscono.** Slice: stato iniziale; `fetchStatus.fulfilled` mette annuncio e manutenzione; `fetchStatus.rejected` lascia quelli già letti; `setAnnouncement(null)` e `setMaintenance(null)` li azzerano. `avvisoChiuso`: scrive e rilegge `3`; senza `localStorage` (`getItem` che lancia) `versioneChiusa()` dà `0` e `chiudiAvviso(3)` non lancia. Servizi: `getStatus` chiama `GET /status`; `publishAnnouncement` chiama `PUT /admin/announcement` col corpo; `withdrawAnnouncement` `DELETE`; `setMaintenance` `PUT /admin/maintenance`. `errors.utils`: la nuova frase. `useSocket`: con un socket finto, l'evento `avviso` con `{ announcement: { version: 2 } }` aggiorna lo store e `manutenzione` con `{ maintenance: null }` lo azzera; alla `connect` parte `fetchStatus`.
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa** le interfacce; registra il reducer `notices` in `store/index.js` e in `createTestStore` di `test-utils.jsx` (gli stati dei test esistenti, che non lo contengono, usano lo stato iniziale).
- [ ] **Passo 4: esegui** i file e tutta la suite del frontend.
- [ ] **Passo 5: commit** `Give the frontend the notices and the maintenance state`.

## Compito 6: Banner e schermata di manutenzione

**File:**
- Crea: `frontend/src/components/notices/AvvisoBanner.jsx`, `frontend/src/components/notices/ManutenzioneScreen.jsx`, `frontend/src/components/notices/index.js`
- Modifica: `frontend/src/AppContent.jsx`
- Prove: nuovi `frontend/src/__tests__/components/AvvisoBanner.test.jsx`, `frontend/src/__tests__/components/ManutenzioneScreen.test.jsx`, `frontend/src/__tests__/AppContent.test.jsx`

**Interfacce:**
- Consuma: `noticeSlice` e `avvisoChiuso` (Compito 5); `logout` di `playerSlice`; `currentGameId`, `role` del giocatore.
- Produce:
  - `AvvisoBanner()`: legge lo stato; mostra (a) l'avviso se esiste e `announcement.version > versioneChiusa()`, con «Chiudi» (`min-h-[44px]`) che chiama `chiudiAvviso(version)` e lo nasconde; (b) se la manutenzione è accesa **e** il giocatore è admin o è in una partita, un banner «Manutenzione accesa: {messaggio}». Testo sempre come testo; `role="status"`, e `role="alert"` per `severity === "importante"`.
  - `ManutenzioneScreen({ onAdminLogin })`: titolo «Manutenzione», il messaggio, «Dovrebbe finire verso le {ora}» se `endsAt`, «Esci» se c'è una sessione, e (se `onAdminLogin` è dato, cioè senza sessione) il collegamento «Sono un amministratore» che lo chiama.
  - In `AppContent`, subito dopo le schermate di testo e prima del resto: `<AvvisoBanner />` in cima a ogni schermata; se la manutenzione è accesa: senza sessione → `ManutenzioneScreen` con un'opzione locale `mostraAccesso` che passa alla `HomePage`; con sessione, `role !== "admin"` e senza `currentGameId` → `ManutenzioneScreen`; negli altri casi la schermata di prima.

- [ ] **Passo 1: prove che falliscono.** Banner: un avviso `info` e uno `importante` si mostrano (`role` giusto); un `<b>x</b>` nel messaggio compare come testo (`getByText('<b>x</b>')`) e non come grassetto; «Chiudi» lo nasconde e salva la versione; con la stessa versione già chiusa non compare; con una **versione più alta** ricompare; se `localStorage` lancia il banner funziona e non rompe nulla; la manutenzione accesa mostra il banner solo a un admin o a chi è in partita. Schermata: messaggio, ora di fine (con `endsAt` finta), «Esci» che fa il logout, il collegamento «Sono un amministratore» solo senza sessione. `AppContent`: manutenzione accesa e nessuna sessione → schermata con il collegamento, che mostra il modulo di accesso; sessione di un giocatore senza partita → schermata di manutenzione; giocatore **in partita** → la schermata della partita con il banner; admin → hall con il banner; manutenzione spenta → nulla cambia (la suite esistente resta verde).
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa** i due componenti e l'ordine in `AppContent`; all'avvio `AppContent` richiama `fetchStatus` (anche senza sessione).
- [ ] **Passo 4: esegui** i tre file, la suite del frontend e `npm run lint`.
- [ ] **Passo 5: commit** `Show the notices and the maintenance screen`.

## Compito 7: Scheda «Avvisi» e registro

**File:**
- Crea: `frontend/src/components/admin/AvvisiPanel.jsx`
- Modifica: `frontend/src/components/admin/AdminScreen.jsx`, `frontend/src/components/admin/AuditPanel.jsx`, `frontend/src/components/admin/index.js`
- Prove: nuovo `frontend/src/__tests__/components/admin/AvvisiPanel.test.jsx`; `frontend/src/__tests__/components/admin/AuditPanel.test.jsx`

**Interfacce:**
- Consuma: `adminService.getNotices`, `publishAnnouncement`, `withdrawAnnouncement`, `setMaintenance` (Compito 5).
- Produce: `AvvisiPanel({ onForbidden })` con due moduli: avviso (testo con contatore `n/280`, gravità, inizio e fine facoltativi, «Pubblica», «Ritira», stato e versione) e manutenzione (interruttore, messaggio, ora di fine); scheda `{ id: "avvisi", label: "Avvisi" }` in `AdminScreen`. Frasi del registro (in `AuditPanel`): «{chi} ha pubblicato un avviso: «{messaggio}»», «{chi} ha ritirato l'avviso», «{chi} ha acceso la manutenzione: «{messaggio}»», «{chi} ha spento la manutenzione».

- [ ] **Passo 1: prove che falliscono.** Pannello: carica lo stato (`getNotices`); il contatore si aggiorna scrivendo; «Pubblica» chiama `publishAnnouncement` con testo, gravità e date e mostra la versione nuova; senza testo non invia e spiega; un `403` chiama `onForbidden`; «Ritira» chiama `withdrawAnnouncement`; l'interruttore della manutenzione senza messaggio non invia, con messaggio chiama `setMaintenance({ active: true, message, endsAt })`; spegnere chiama `setMaintenance({ active: false })`; un errore del server si legge nel modulo. `AdminScreen` ha la scheda «Avvisi». `AuditPanel`: le quattro nuove azioni producono le frasi sopra, senza dettagli mancanti (un `endsAt` assente non rompe la frase).
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa** il pannello (stessi componenti `Button` e `Input` e stesso stile di `ParametriPanel`), la scheda e le frasi.
- [ ] **Passo 4: esegui** i file, la suite del frontend e `npm run lint`.
- [ ] **Passo 5: commit** `Add the Avvisi tab for the admin`.

## Compito 8: Test end-to-end

**File:**
- Crea: `e2e/tests/api/notices.spec.js`, `e2e/tests/ui/avvisi.spec.js`

**Interfacce:**
- Consuma: `registerAdmin` (`E2E_DATABASE_URL`, come `settings.spec.js`), `registerPlayer`, `TERMS`; le etichette del Compito 7 e del Compito 6.
- Come `parametri-admin.spec.js`: `test.skip(!E2E_DATABASE_URL, …)` e, in `test.beforeEach`, `test.skip(testInfo.project.name !== 'chromium', 'it turns the maintenance on for the server: one project only')`; alla fine di ogni prova la manutenzione si spegne e l'avviso si ritira (`afterEach`).

- [ ] **Passo 1: scrivi le prove.** API (`notices.spec.js`): un utente normale riceve `403` da tutte e quattro le route admin; senza sessione `401`; l'admin pubblica un avviso e `GET /api/status` (senza sessione) lo restituisce con `version` che sale; ritirato, `announcement` è `null`; un messaggio con `<script>` torna identico; `PUT /api/admin/maintenance` con `active: true` senza messaggio dà `400`; con la manutenzione accesa un giocatore nuovo non si registra (`503`, `code: 'MAINTENANCE'`), un giocatore esistente non crea né entra in una partita (`503`) ma può fare il login, mentre l'admin crea una partita (`201`); spenta, tutto torna; `GET /api/health` ha `maintenance` coerente. UI (`avvisi.spec.js`, telefono 390×844): un giocatore connesso vede l'avviso pubblicato dall'admin **senza ricaricare**, lo chiude e dopo un ricaricamento non lo rivede, mentre un nuovo avviso lo fa ricomparire; con la manutenzione accesa chi apre l'app senza sessione vede la schermata e, con «Sono un amministratore», accede come admin e lavora; un giocatore in hall vede la schermata di manutenzione; la scheda «Avvisi» pubblica e ritira.
- [ ] **Passo 2: esegui** i due file con i server avviati come in `TEST_SUITE.md` (chromium e mobile-chrome: le prove della manutenzione si saltano da sole fuori da chromium): verdi.
- [ ] **Passo 3: commit** `Cover the notices and the maintenance with end-to-end tests`.

## Compito 9: Documentazione e verifica finale

**File:**
- Modifica: `docs/AUTH.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `README.md`, `docs/GAME_DESIGN.md`, `TEST_SUITE.md` (solo se cambia la struttura o i numeri)

- [ ] **Passo 1: documenta.** `AUTH.md`: le quattro route admin, `GET /api/status`, il blocco `503 MAINTENANCE` e chi è esente. `DATABASE.md`: le due tabelle e le quattro azioni di audit. `DEPLOYMENT.md`: come usare la manutenzione (accendere con messaggio, ora di fine solo informativa, spegnere; le partite in corso finiscono; `/api/health` ha `maintenance`; preavviso con un avviso). `README.md`: route ed eventi `avviso` e `manutenzione`. `GAME_DESIGN.md`: avvisi e manutenzione nel flusso.
- [ ] **Passo 2: controllo.** `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs`: `0 errori` (restano gli avvisi dei valori legali non impostati, attesi).
- [ ] **Passo 3: verifica completa.** `TEST_DATABASE_URL=… npm test`, `npm run lint`, e2e come nel Compito 8 e in più la suite completa su chromium e mobile-chrome. Riporta i numeri. Poi apri la PR verso `develop` con `Closes #120`, e nel testo scrivi che l'ora di fine della manutenzione è solo informativa e che le prove della manutenzione girano in un solo progetto.
- [ ] **Passo 4: commit** `Document the notices and the maintenance`.
