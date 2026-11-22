# Informativa privacy e termini d'uso: piano di implementazione

> **Per chi esegue:** SOTTO-SKILL OBBLIGATORIA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans, un compito alla volta. I passi usano caselle `- [ ]`.

**Obiettivo:** due schermate pubbliche (informativa e termini), accettazione dei termini registrata con data e versione alla registrazione e, per chi è già registrato, in una schermata «Prima di continuare».

**Architettura:** due colonne nuove su `players` (migrazione 012) e due campi nel giocatore in memoria. Il server calcola `terminiDaAccettare`, rifiuta la registrazione senza accettazione e blocca creazione, ingresso e acquisto finché non è accettata. Il frontend ha due schermate di testo, una casella alla registrazione e una schermata di accettazione prima delle regole. Lo script di controllo della documentazione impedisce la release con i valori non impostati.

**Stack:** Express 5, Joi, PostgreSQL (`pg`), React 19, Redux Toolkit, Vitest, Jest, Playwright.

**Specifica:** `docs/superpowers/specs/2026-11-22-informativa-privacy-e-termini-design.md`. Issue #116, branch `feature/informativa-privacy-e-termini`.

## Vincoli globali

- **Versione corrente:** `"2026-1"`, una costante per lato: `TERMS_VERSION` in `backend/src/config/legale.js` e `LEGALE.versione` in `frontend/src/config/legale.js`.
- **Campi del giocatore (memoria e vista):** `terminiAccettatiIl` (ISO o `null`), `terminiVersione` (stringa o `null`); la vista aggiunge `terminiDaAccettare` (booleano calcolato dal server). Colonne: `players.terms_accepted_at TIMESTAMPTZ`, `players.terms_version TEXT`.
- **Età minima:** 14 anni (`LEGALE.etaMinima`).
- **Titolare:** Gregorio La Gamba, come persona (`LEGALE.titolare`).
- **Valori non impostati a oggi:** `CONTATTI.email`, `LEGALE.hosting.nome`, `LEGALE.hosting.paese`, `LEGALE.conservazioneLog`, `LEGALE.vigenteDal`, tutti `null`. Con un valore `null` la schermata mostra «[da indicare]».
- **Messaggi per l'utente in italiano; commenti e nomi del codice in inglese**, come nel resto del repository.
- **Regole del repository (CLAUDE.md):** ogni scrittura passa da `req.store`; il giocatore è `req.auth.playerId` e non il corpo; ogni corpo ha il suo schema Joi; nessuna risposta o evento mostra dati di altri giocatori.
- **Line ending:** questi file sono CRLF e restano CRLF (modifica con `python3` e `newline=''`, o con `edit()` di `scratchpad/crlf.py`): `player.controller.js`, `game.controller.js`, `player.service.js`, `player.routes.js`, `errorHandler.js`, `playerSlice.js`, `uiSlice.js`, `playerService.js`, `HomePage.jsx`, `AppContent.jsx`, `components/common/index.js`, `e2e/tests/ui/home.spec.js`, `README.md`, `docs/GAME_DESIGN.md`, `docs/DEPLOYMENT.md`. I file nuovi sono LF.
- **Comandi di prova:** backend `npm --prefix backend test -- <percorso>`; con il database `TEST_DATABASE_URL=postgresql://combocard:combocard@127.0.0.1:5432/combocard_test` (mai il database `combocard`); frontend `npm --prefix frontend run test:run -- <percorso>`; lint `npm run lint`. Un commit per compito, con `Part of #116` e il trailer `Co-Authored-By` di CLAUDE.md.

## Da rivedere (cosa la specifica non dice e può rompersi)

1. **Test esistenti che registrano giocatori senza accettazione:** decine di test del backend chiamano `registerPlayer(gameState, 'Anna')` e poi i controller. Per non romperli, il servizio considera accettata la versione corrente per impostazione predefinita; lo stato «non accettato» si ottiene con `termsVersion: null`. Test: Compito 2.
2. **Il blocco non deve interrompere chi è già in una partita** (join ripetuto dello stesso giocatore). Test: Compito 3.
3. **Stato dei mock nei test del frontend senza `terminiDaAccettare`:** la schermata di accettazione compare solo con `terminiDaAccettare === true`, così i test esistenti restano validi. Test: Compito 6.
4. **Versione del client diversa da quella del server** (cache del browser): la registrazione e l'accettazione si rifiutano e il messaggio dice di ricaricare la pagina. Test: Compiti 2 e 6.
5. **Doppio tocco sul pulsante «Accetto e continuo»:** una sola richiesta, come in `RegoleScreen`. Test: Compito 6.
6. **Il giocatore con la password provvisoria:** la schermata di cambio password viene prima dell'accettazione. Test: Compito 6.
7. **Deviazione dalla specifica, per i test e2e:** un account «esistente» senza accettazione non si può creare dall'esterno (il server tiene i giocatori in memoria: modificare il database non cambia lo stato). Il caso è coperto con test del backend (caricamento da database con colonne `NULL`) e del frontend (`AppContent`), non con un test e2e.

---

## Compito 1: Dati e persistenza

**File:**
- Crea: `backend/db/migrations/012_terms_acceptance.sql`, `backend/src/config/legale.js`
- Modifica: `backend/src/db/store.js` (`insertPlayer`, `loadState`, `createMemoryStore`, store PostgreSQL)
- Prove: `backend/__tests__/db/store.test.js`, `backend/__tests__/db/postgres.integration.test.js`

**Interfacce:**
- Produce: `TERMS_VERSION` (`"2026-1"`) da `backend/src/config/legale.js`; metodo di store `recordTermsAccepted(playerId: string, isoDate: string, version: string): Promise<void>` (in memoria: non fa nulla, come `recordRulesAccepted`); `loadState()` porta `terminiAccettatiIl` e `terminiVersione` in ogni giocatore; `createAccount(player, …)` scrive le due colonne dal giocatore.

- [ ] **Passo 1: prove che falliscono.** In `store.test.js`: `loadState` di un database simulato con una riga con `terms_accepted_at` e `terms_version` dà `terminiAccettatiIl` ISO e `terminiVersione: '2026-1'`, e una riga con `NULL` dà `null` e `null` (come il test delle righe 134-135 per le regole). In `postgres.integration.test.js`: la migrazione aggiunge le due colonne; `createAccount` con un giocatore che ha le due proprietà le scrive; `recordTermsAccepted('p1', '2026-11-22T10:00:00.000Z', '2026-1')` aggiorna la riga; un giocatore esistente prima della migrazione resta `NULL`; **`deleteAccount` non azzera le due colonne** (`SELECT terms_accepted_at, terms_version FROM players WHERE id='p1'` dopo l'eliminazione restano uguali, mentre il nome è «Utente eliminato»).
- [ ] **Passo 2: eseguili e verifica che falliscano** (`store.test.js`, `postgres.integration.test.js` con `TEST_DATABASE_URL`): colonne e metodo mancanti.
- [ ] **Passo 3: implementa.** La migrazione aggiunge `terms_accepted_at TIMESTAMPTZ` e `terms_version TEXT` con un commento come quello della 003. `insertPlayer` scrive anche le due colonne da `player.terminiAccettatiIl ?? null` e `player.terminiVersione ?? null`. `loadState` le seleziona e le converte come `rules_accepted_at`. Il metodo PostgreSQL esegue un `UPDATE players SET terms_accepted_at=$2, terms_version=$3, updated_at=now() WHERE id=$1`.
- [ ] **Passo 4: esegui le suite del database** (le due sopra, più `store.history.test.js`): tutte verdi.
- [ ] **Passo 5: commit** `Save the acceptance of the terms with the player`.

## Compito 2: Servizio, schema, registrazione e route di accettazione

**File:**
- Modifica: `backend/src/services/player.service.js`, `backend/src/validation/schemas.js`, `backend/src/controllers/auth.controller.js` (`register`, `startSession`), `backend/src/controllers/player.controller.js`, `backend/src/routes/player.routes.js`, `backend/src/middleware/errorHandler.js`
- Prove: `backend/__tests__/services/player.service.test.js`, `backend/__tests__/validation/schemas.test.js`, `backend/__tests__/controllers/auth.controller.test.js`, nuovo `backend/__tests__/controllers/player.terms.test.js`

**Interfacce:**
- Consuma: `TERMS_VERSION`, `store.recordTermsAccepted` (Compito 1).
- Produce:
  - `registerPlayer(gameState, playerName, { termsVersion = TERMS_VERSION } = {})`: con `termsVersion` crea il giocatore con `terminiAccettatiIl` (ora) e `terminiVersione`; con `termsVersion: null` entrambi `null`.
  - `acceptTerms(gameState, playerId, version): Object` (il giocatore aggiornato; scrive i due campi se la versione del giocatore è diversa).
  - `toPlayerView(player): Object`: copia del giocatore con `terminiDaAccettare: player.terminiVersione !== TERMS_VERSION`.
  - `registerSchema` richiede `acceptTerms: true` e `termsVersion` uguale a `TERMS_VERSION` (altrimenti 400); `acceptTermsSchema = Joi.object({ version: Joi.string().max(32).required() })`.
  - `POST /api/players/:playerId/accept-terms` (con `requireAuth`, `requireSelf`, `validate(acceptTermsSchema)`): `409` con `code: "TERMS_VERSION_OUTDATED"` se `version !== TERMS_VERSION`; altrimenti `200 { success: true, terminiAccettatiIl, terminiVersione }`, e una ripetizione non riscrive; se il salvataggio fallisce ripristina i valori precedenti e risponde `503`.
  - `errorHandler` aggiunge al corpo della risposta il campo `code` quando l'errore ha un `code` stringa (accanto a `retryAfter`).
  - `startSession` e `getPlayer` rispondono con `toPlayerView(player)`.

- [ ] **Passo 1: prove che falliscono.** Servizio: `registerPlayer(gs,'Anna')` dà `terminiVersione === '2026-1'`; con `{ termsVersion: null }` dà `null`/`null`; `toPlayerView` dà `terminiDaAccettare: false` per `'2026-1'`, `true` per `null` e per `'2025-1'`. Schema: `registerSchema` accetta `{ username, password, acceptTerms: true, termsVersion: '2026-1' }` e rifiuta senza `acceptTerms`, con `acceptTerms: false`, con `termsVersion: '2025-1'` e senza `termsVersion`. `auth.controller.test.js` (`register`): la risposta ha `player.terminiDaAccettare === false` e `store.createAccount` riceve un giocatore con le due proprietà; `login` di un giocatore con `terminiVersione: null` restituisce `terminiDaAccettare: true`. `player.terms.test.js`: prima accettazione (200, salva con `recordTermsAccepted` chiamato una volta con la versione), ripetizione (200, `recordTermsAccepted` non richiamato), versione vecchia (409 con `code: 'TERMS_VERSION_OUTDATED'`), salvataggio fallito (503 e il giocatore torna a `terminiVersione: null`). `errorHandler`: un errore con `code: 'X'` produce `body.code === 'X'`.
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa** le interfacce sopra. `register` legge `termsVersion` dal corpo e lo passa a `registerPlayer`; `createAccount` riceve già il giocatore con i campi.
- [ ] **Passo 4: esegui** i cinque file e poi tutta la suite del backend (`npm --prefix backend test`): nessun test esistente deve rompersi (vedi punto 1 di «Da rivedere»).
- [ ] **Passo 5: commit** `Accept the terms at registration and through a route of their own`.

## Compito 3: Blocco finché i termini non sono accettati

**File:**
- Modifica: `backend/src/services/player.service.js`, `backend/src/controllers/game.controller.js` (`createGame`, `joinGame`), `backend/src/controllers/player.controller.js` (`buyCredits`)
- Prove: nuovo `backend/__tests__/controllers/game.terms-gate.test.js`, `backend/__tests__/controllers/game.visibility.test.js`

**Interfacce:**
- Consuma: `toPlayerView` / `TERMS_VERSION` (Compito 2).
- Produce: `assertTermsAccepted(player): void` in `player.service.js`: se `player.terminiVersione !== TERMS_VERSION` lancia `AppError("You must accept the terms of use first", 403)` con `err.code = "TERMS_REQUIRED"`.

- [ ] **Passo 1: prove che falliscono** (`game.terms-gate.test.js`, con lo schema dei test delle regole): un giocatore con `terminiVersione: null` ottiene `403` con `code: 'TERMS_REQUIRED'` da `createGame`, da `joinGame` e da `buyCredits`; lo stesso giocatore dopo `acceptTerms` li esegue; **un giocatore già dentro la partita che ripete `joinGame` con `terminiVersione: null` ottiene la risposta di sempre, non il 403** (punto 2 di «Da rivedere»). In `game.visibility.test.js`: la vista di una partita (`gameViewFor`) di un giocatore non contiene mai `terminiVersione`, `terminiAccettatiIl` né `terminiDaAccettare` di nessuno.
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa** `assertTermsAccepted` e chiamalo: in `createGame` subito dopo aver trovato il giocatore; in `joinGame` solo se il giocatore non è già nella partita; in `buyCredits` prima di `playerService.buyCredits`.
- [ ] **Passo 4: esegui tutta la suite del backend.**
- [ ] **Passo 5: commit** `Block creating, joining and buying until the terms are accepted`.

## Compito 4: Strato dati del frontend

**File:**
- Crea: `frontend/src/config/legale.js`
- Modifica: `frontend/src/services/authService.js`, `frontend/src/services/playerService.js`, `frontend/src/store/slices/playerSlice.js`, `frontend/src/store/slices/uiSlice.js`
- Prove: `frontend/src/__tests__/services/authService.test.js`, `frontend/src/__tests__/store/playerSlice.test.js`, `frontend/src/__tests__/store/uiSlice.test.js`, nuovo `frontend/src/__tests__/config/legale.test.js`

**Interfacce:**
- Produce:
  - `LEGALE = { versione: '2026-1', titolare: 'Gregorio La Gamba', etaMinima: 14, hosting: { nome: null, paese: null }, conservazioneLog: null, vigenteDal: null }` (esportato da `config/legale.js`).
  - `authService.register(username, password)` invia anche `acceptTerms: true` e `termsVersion: LEGALE.versione`.
  - `playerService.acceptTerms(playerId): Promise<{ success, terminiAccettatiIl, terminiVersione }>` (`POST /players/:id/accept-terms` con `{ version: LEGALE.versione }`).
  - `playerSlice`: stato `terminiDaAccettare` (booleano, falso di partenza), valorizzato da `applyPlayer` con `player.terminiDaAccettare === true`; thunk `acceptTerms(playerId)` che a esito positivo porta `terminiDaAccettare` a `false`; a esito negativo mette in `error` il messaggio del server.
  - `uiSlice`: stato `legalReturn: null`; azioni `showLegal('informativa' | 'termini')` (salva in `legalReturn` la schermata corrente solo se non è già una delle due, poi imposta `currentScreen`) e `closeLegal()` (torna a `legalReturn ?? 'home'` e lo azzera).

- [ ] **Passo 1: prove che falliscono.** `legale.test.js`: `LEGALE.versione === '2026-1'`, `etaMinima === 14`. `authService.test.js`: `register('Anna','password1')` chiama `api.post('/auth/register', { username: 'Anna', password: 'password1', acceptTerms: true, termsVersion: '2026-1' })`. `playerSlice.test.js`: dopo `login.fulfilled` con `player.terminiDaAccettare: true` lo stato lo ha vero; `acceptTerms.fulfilled` lo porta a falso; `acceptTerms.rejected` imposta `error`. `uiSlice.test.js`: da `hall`, `showLegal('informativa')` dà `currentScreen: 'informativa'` e `legalReturn: 'hall'`; da lì `showLegal('termini')` tiene `legalReturn: 'hall'`; `closeLegal()` torna a `hall`; senza ritorno torna a `home`.
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa** le interfacce sopra.
- [ ] **Passo 4: esegui i quattro file e tutta la suite del frontend.**
- [ ] **Passo 5: commit** `Give the frontend the version of the terms and the state of the acceptance`.

## Compito 5: Le due schermate di testo

**File:**
- Crea: `frontend/src/components/legal/Dato.jsx`, `frontend/src/components/legal/LegalLayout.jsx`, `frontend/src/components/legal/InformativaScreen.jsx`, `frontend/src/components/legal/TerminiScreen.jsx`, `frontend/src/components/legal/index.js`
- Prove: nuovo `frontend/src/__tests__/components/Legal.test.jsx`

**Interfacce:**
- Consuma: `LEGALE`, `CONTATTI`, `closeLegal`, `showLegal` (Compito 4).
- Produce:
  - `Dato({ valore })`: mostra `valore`, oppure `<mark data-testid="da-indicare">[da indicare]</mark>` se è `null`/vuoto.
  - `LegalLayout({ titolo, children })`: pagina intera con `h1 {titolo}`, riga «Versione {versione} · in vigore dal {data}» (la data con `Dato`) e pulsante «Indietro» che chiama `closeLegal`.
  - `InformativaScreen` e `TerminiScreen` (esportate da `components/legal/index.js`), con `h1` «Informativa sulla privacy» e «Termini d'uso».

- [ ] **Passo 1: prove che falliscono** (`Legal.test.jsx`): le due schermate hanno il loro `h1`; «Indietro» fa tornare alla schermata di provenienza (`legalReturn`); con `LEGALE.hosting.nome === null` compare `[da indicare]` almeno una volta e con tutti i valori impostati (mock di `LEGALE` e `CONTATTI.email`) non compare mai; l'informativa contiene le voci elencate sotto e i termini contengono «14 anni».
- [ ] **Passo 2: eseguilo e verifica che fallisca.**
- [ ] **Passo 3: scrivi i testi** in italiano semplice, con queste sezioni (titoli verbatim):
  - **Informativa:** «Chi è il titolare» (Gregorio La Gamba, persona; contatto con `CONTATTI.email`); «Quali dati trattiamo» (nome utente, password solo come hash, ruolo, crediti e movimenti, partite e statistiche, registro delle azioni degli amministratori, cookie di sessione tecnico, log del server); «Perché e su quale base» (esecuzione del servizio, art. 6.1.b; sicurezza, art. 6.1.f); «Per quanto tempo li conserviamo» (account finché esiste; dopo l'eliminazione restano senza il nome «Utente eliminato» i movimenti, le partite concluse, il registro e le due date di accettazione; log: `LEGALE.conservazioneLog`); «A chi li comunichiamo» (il fornitore di hosting: `LEGALE.hosting.nome` e `paese`; nessuna vendita né pubblicità); «I tuoi diritti» (artt. 15-22, come esercitarli scrivendo al contatto o eliminando l'account dall'app, reclamo al Garante); «Cookie» (solo tecnico, nessun avviso richiesto).
  - **Termini:** «Chi può giocare» (almeno `LEGALE.etaMinima` anni); «I crediti» (di gioco, senza valore reale, non rimborsabili, l'eliminazione chiude il saldo senza rimborso); «Sospensione ed eliminazione» (da parte dell'amministrazione, comportamenti non ammessi); «Licenza e responsabilità» (uso personale ed educativo, `LICENSE`, esclusione di responsabilità); «Crediti delle illustrazioni» (mazzo napoletano del 1875, British Museum, `CREDITI_MAZZO`).
  - Ogni frase sull'app va confermata contro il codice (per esempio la conservazione dopo l'eliminazione contro `deleteAccount` in `store.js`, i dati contro `loadState` e le migrazioni), non scritta a memoria; i collegamenti tra le due schermate usano `showLegal`.
- [ ] **Passo 4: esegui `Legal.test.jsx`, la suite del frontend e `npm run lint`.**
- [ ] **Passo 5: commit** `Write the privacy notice and the terms of use`.

## Compito 6: Footer, registrazione, accettazione per gli esistenti

**File:**
- Crea: `frontend/src/components/legal/TerminiGate.jsx`
- Modifica: `frontend/src/components/common/Footer.jsx`, `frontend/src/pages/HomePage.jsx`, `frontend/src/AppContent.jsx`
- Prove: `frontend/src/__tests__/components/Footer.test.jsx`, `frontend/src/__tests__/pages/HomePage.test.jsx`, nuovo `frontend/src/__tests__/components/TerminiGate.test.jsx`, `frontend/src/__tests__/AppContent.test.jsx`

**Interfacce:**
- Consuma: `showLegal`, `acceptTerms`, `terminiDaAccettare`, `InformativaScreen`, `TerminiScreen`, `LEGALE` (Compiti 4 e 5).
- Produce: nel footer i pulsanti «Informativa» e «Termini» (altezza minima 44 px) che chiamano `showLegal`; nella registrazione la casella «Ho letto l'informativa sulla privacy e accetto i termini d'uso» (con i due collegamenti come pulsanti `type="button"`); `TerminiGate` («Prima di continuare»); in `AppContent`, ordine: schermate di testo (se `currentScreen` è `informativa` o `termini`) → password provvisoria → `TerminiGate` (se `playerId && terminiDaAccettare === true`) → regole.

- [ ] **Passo 1: prove che falliscono.** Footer: i due pulsanti esistono e portano a `currentScreen` `informativa`/`termini`. `HomePage`: in registrazione, senza spunta l'invio non chiama `register`, mostra `role="alert"` «Per registrarti devi accettare l'informativa e i termini d'uso» e sposta il fuoco sulla casella; con la spunta l'invio parte; in accesso la casella non c'è. `TerminiGate`: titolo «Prima di continuare»; il pulsante «Accetto e continuo» è spento finché la casella non è spuntata; un doppio clic invia **una** richiesta; un `409` mostra «I testi sono cambiati: ricarica la pagina»; «Esci» fa il logout. `AppContent`: un giocatore con `terminiDaAccettare: true` vede il gate prima delle regole; con `mustChangePassword` vede prima il cambio password; con `terminiDaAccettare: undefined` (stato dei test esistenti) non vede il gate; le schermate di testo si aprono anche senza `playerId`.
- [ ] **Passo 2: eseguili e verifica che falliscano.**
- [ ] **Passo 3: implementa.** `HomePage` aggiunge uno stato per la casella e l'errore (stesso schema degli altri errori del modulo, con `aria-describedby`); `Footer` usa `useDispatch`; `AppContent` rende le schermate di testo subito dopo il controllo `sessionChecked`.
- [ ] **Passo 4: esegui i quattro file, la suite del frontend e `npm run lint`.**
- [ ] **Passo 5: commit** `Ask for the acceptance at registration and for the players already registered`.

## Compito 7: Test end-to-end

**File:**
- Modifica: `e2e/tests/helpers/auth.js`, `e2e/tests/api/auth.spec.js`, `e2e/tests/api/account-delete.spec.js`, `e2e/tests/api/admin-delete.spec.js`, `e2e/tests/ui/home.spec.js`, `e2e/tests/ui/rules-gate.spec.js`, `e2e/tests/ui/admin-games-screen.spec.js`
- Crea: `e2e/tests/api/terms.spec.js`, `e2e/tests/ui/termini.spec.js`

**Interfacce:**
- Consuma: `LEGALE.versione` (`frontend/src/config/legale.js`, importabile dai test perché è JavaScript semplice); la casella e il testo del Compito 6.
- Produce: `registerPlayer` in `helpers/auth.js` invia `acceptTerms: true` e `termsVersion: LEGALE.versione` (importato dal file del frontend), così i test passano solo se la versione del frontend coincide con quella del server.

- [ ] **Passo 1: prove che falliscono.** `terms.spec.js` (API): registrare senza `acceptTerms` dà `400`; con `termsVersion: '2025-1'` dà `400`; `accept-terms` con `version: '2025-1'` dà `409` e `code: 'TERMS_VERSION_OUTDATED'`; con la versione giusta dà `200` due volte di fila; `GET /api/players/:id` ha `terminiDaAccettare: false` dopo la registrazione. `termini.spec.js` (UI, telefono 390×844): la registrazione non parte senza la casella e mostra l'errore; con la casella passa alle regole; da non connesso, i pulsanti «Informativa» e «Termini» del footer aprono le due schermate e «Indietro» riporta all'accesso.
- [ ] **Passo 2: aggiorna** tutti i punti che registrano un account: le 9 chiamate a `/auth/register` e i tre file UI che cliccano «Registrati» devono spuntare la casella (o inviare i campi). Poi esegui le suite e2e con i server avviati come in `TEST_SUITE.md` (backend con `RATE_LIMIT_DISABLED=true`, database `combocard_e2e`): `npm --prefix e2e test -- --project=chromium --project=mobile-chrome`. Tutto verde.
- [ ] **Passo 3: commit** `Cover the acceptance of the terms with end-to-end tests`.

## Compito 8: Script di controllo e processo di release

**File:**
- Modifica: `.claude/skills/controllo-documentazione-release/scripts/check-docs.mjs`, `.claude/skills/controllo-documentazione-release/SKILL.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/release.md`, `.github/PULL_REQUEST_TEMPLATE/release.md`

**Interfacce:**
- Consuma: `backend/src/config/legale.js` (`TERMS_VERSION`), `frontend/src/config/legale.js` (`versione`, valori `null`), `frontend/src/config/contatti.js` (`email`).
- Produce: opzione `--release` di `check-docs.mjs` (anche come secondo argomento: `node check-docs.mjs [radice] --release`); errore sempre se le due versioni sono diverse; per ogni valore `null` di `legale.js` e per `email: null` di `contatti.js`, un `AVVISO` senza opzione e un `ERRORE` con `--release`.

- [ ] **Passo 1: verifica che oggi manchi** (rosso): `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs --release` esce con 0 e non cita `legale.js`.
- [ ] **Passo 2: implementa** i controlli. Le versioni si leggono con un'espressione regolare dai due file (`TERMS_VERSION = "…"` e `versione: '…'`); i valori `null` si cercano come `chiave: null` nel solo file `legale.js` (compreso l'oggetto `hosting`) e come `email: null` in `contatti.js`.
- [ ] **Passo 3: prova le tre situazioni.** Senza opzione: avvisi per i cinque valori e `0 errori`. Con `--release`: cinque errori ed `exit 1`. Con tutti i valori impostati in una copia del repository (percorso passato come primo argomento): `0 errori, 0 avvisi` ed `exit 0`. Con una versione cambiata a mano in un solo file: errore anche senza opzione.
- [ ] **Passo 4: aggiorna** `SKILL.md` (nuovo comando con `--release` al passo 1, e la riga nella tabella «Che cosa controlla lo script»), `CONTRIBUTING.md` (passo 2 della release: comando con `--release`; nota che senza i valori impostati la release non parte) e le due liste dei modelli di release (casella «Valori di `legale.js` e `contatti.js` impostati»; «Nelle note: gli utenti esistenti vedono la schermata di accettazione al prossimo accesso»).
- [ ] **Passo 5: commit** `Stop a release that still has the legal values unset`.

## Compito 9: Documentazione e verifica finale

**File:**
- Modifica: `docs/AUTH.md`, `docs/DATABASE.md`, `docs/GAME_DESIGN.md`, `README.md`, `docs/DEPLOYMENT.md`

- [ ] **Passo 1: documenta.** `AUTH.md`: registrazione con `acceptTerms` e `termsVersion`, `POST /api/players/:playerId/accept-terms` (`409` con `TERMS_VERSION_OUTDATED`), `terminiDaAccettare` e il `403 TERMS_REQUIRED` su creazione, ingresso e acquisto. `DATABASE.md`: le due colonne, il valore `NULL` per gli esistenti e che l'eliminazione dell'account le tiene. `GAME_DESIGN.md`: registrazione e accettazione nel flusso, la schermata «Prima di continuare» prima delle regole. `README.md`: la rotta nella tabella. `DEPLOYMENT.md`: sezione «Prima di aprire al pubblico» con i valori da impostare (e-mail del dominio, hosting, conservazione dei log, data), la nota di revisione legale e che gli utenti esistenti vedranno la schermata al primo accesso dopo l'aggiornamento.
- [ ] **Passo 2: controllo.** `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs` (senza `--release`): `0 errori` (restano gli avvisi dei valori non impostati, attesi).
- [ ] **Passo 3: verifica completa.** `npm test` (con `TEST_DATABASE_URL` per il backend), `npm run lint`, e2e come nel Compito 7. Riporta i numeri. Poi apri la PR verso `develop` con `Closes #116`, nel testo la deviazione e2e del punto 7 e i cinque valori ancora da impostare prima di pubblicare.
- [ ] **Passo 4: commit** `Document the acceptance of the terms`.
