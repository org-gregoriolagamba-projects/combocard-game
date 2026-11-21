# Parametri di gioco, parte 2: il frontend legge i valori dal server — Piano di implementazione

> **Per chi esegue:** SUB-SKILL RICHIESTA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans per eseguire il piano un task alla volta. I passi usano la sintassi a caselle (`- [ ]`).

**Obiettivo:** il frontend non ha più valori di gioco scritti a mano: modulo «Crea partita», attesa tra le estrazioni, conto alla rovescia del Jolly e Regole prendono i numeri dal server; il `429` si gestisce col tempo che resta.

**Architettura:** un servizio e uno slice Redux (`settings`) caricano `GET /api/settings` quando il giocatore è noto e ogni volta che si apre la Hall o il modulo; le partite usano la copia `game.settings` che il server mette nella loro vista; il client dell'API porta `retryAfter` degli errori `429`.

**Stack:** React 18, Redux Toolkit, Vite, Vitest + Testing Library, Playwright; backend Express (una piccola modifica a `gameViewFor`).

**Spec:** `docs/superpowers/specs/2026-11-21-parametri-di-gioco-frontend-design.md`

**Issue e branch:** #118, branch `feature/parametri-di-gioco-frontend`. La PR chiude la #118 (`Closes #118`).

## Chiarimenti alla spec (decisi scrivendo il piano)

1. **`gameViewFor` porta già `settings`**: la vista copia tutti i campi della partita meno quelli nascosti (`{ ...game }`), quindi `game.settings` arriva già ai client. Il lavoro sul backend è solo il ripiego per le partite salvate senza copia (`settingsOfGame`) e i test che lo fissano.
2. **`retryAfter` nello slice:** `drawCard` rifiuta con `rejectWithValue(messaggio, { retryAfter })`: il testo resta una stringa per chi usa `.unwrap()`, e il reducer legge `action.meta.retryAfter`.
3. **Test esistenti:** `createTestStore` (in `frontend/src/__tests__/test-utils.jsx`) deve avere il nuovo reducer `settings`; i test che montano la Hall o le Regole mockano `settingsService` o precaricano `settings: readySettings`, altrimenti la lettura all'apertura parte davvero.
4. **Fine riga:** molti file del frontend sono CRLF (`HallScreen.jsx`, `api.js`, `gameSlice.js`, `errors.utils.js`, …), altri LF. Un editor o uno script che li riscrive cambia ogni riga (è già successo nella #156). Prima di modificare un file controlla `git ls-files --eol <file>`; dopo ogni task `git diff --stat` non deve mostrare file con tutte le righe cambiate.

## Vincoli globali

- Node.js 20.19 o superiore; moduli ESM; testi dell'interfaccia in italiano; nessun valore di gioco scritto a mano nel frontend (la ricerca finale deve essere vuota).
- Ogni route che riceve un corpo è validata dal backend; nessuna risposta o evento contiene `mazzo` o la cartella di un altro giocatore.
- I test su PostgreSQL girano solo su `combocard_test`: `TEST_DATABASE_URL=postgresql://combocard:combocard@127.0.0.1:5432/combocard_test`. Mai su `combocard`.
- Valori usati nei test (i predefiniti del server): `minPlayers` 2, `maxPlayers` 10, `requiredCredits` 100, `jollyHoldSeconds` 30, `jollyMaxDeclarations` 3, `drawCooldownSeconds` 8; limiti: `minPlayers` 2–10, `maxPlayers` 2–20, `requiredCredits` 1–10.000, `jollyHoldSeconds` 10–120, `jollyMaxDeclarations` 1–10, `drawCooldownSeconds` 3–30.
- Non modificare file `.env`. Messaggi di commit in inglese, con la riga `Co-Authored-By` del repository.

## Punti da controllare (Review Focus)

Ognuno ha il suo test nel task indicato.

1. Prima lettura fallita, senza valori: il modulo «Crea partita» resta disattivato, mostra il messaggio e «Riprova» funziona; mai numeri di ripiego (Task 5).
2. Due letture in volo: vince l'ultima, anche se quella vecchia risponde dopo (Task 2).
3. Una partita senza `game.settings`: nessun conto alla rovescia del client, nessun errore in `BarraAzione`, `LobbyScreen` e `ConteggioJolly` (Task 6, 7 e 8).
4. `429` con e senza `retryAfter`: il conto riparte dal tempo del server, altrimenti non si inventa (Task 7).
5. Modulo aperto mentre i valori cambiano: quello che l'utente ha scritto resta, ma l'invio valida coi limiti nuovi (Task 5).

## Struttura dei file

| File | Ruolo |
|---|---|
| `backend/src/services/game.service.js` | `gameViewFor` con `settings` (ripiego per le partite vecchie) |
| `frontend/src/services/settingsService.js` (nuovo) | `getSettings()` |
| `frontend/src/store/slices/settingsSlice.js` (nuovo) | Stato `settings`, `fetchSettings`, `clearSettings` |
| `frontend/src/store/index.js`, `frontend/src/__tests__/test-utils.jsx` | Registrano il reducer; `readySettings` per i test |
| `frontend/src/services/api.js` | `retryAfter` negli errori |
| `frontend/src/store/sessionThunks.js` | Lettura all'ingresso |
| `frontend/src/utils/errors.utils.js` | Due traduzioni nuove |
| `frontend/src/components/game/HallScreen.jsx` | Modulo «Crea partita» |
| `frontend/src/components/game/LobbyScreen.jsx` | Minimo e massimo di giocatori |
| `frontend/src/store/slices/gameSlice.js`, `GameScreen.jsx`, `BarraAzione.jsx` | Attesa e `429` |
| `frontend/src/components/game/ConteggioJolly.jsx` | Durata del Jolly |
| `frontend/src/components/game/RegoleGioco.jsx`, `RegoleScreen.jsx`, `CollezioniPanel.jsx` | Regole con i numeri del server |
| `e2e/tests/ui/parametri-di-gioco.spec.js` (nuovo) | Modulo a 320 e 180 px, cambio dell'admin |

## Task 1: backend, la vista della partita porta `settings`

**Files:**
- Modify: `backend/src/services/game.service.js` (`gameViewFor`, riga ~220; import da `./settings.service.js`)
- Test: `backend/__tests__/services/game.service.test.js`, `backend/__tests__/controllers/game.visibility.test.js`

**Interfaces:**
- Consumes: `settingsOfGame(game): object` (`settings.service.js`).
- Produces: `gameViewFor(game, playerId)` restituisce sempre `settings` (sei interi): la copia della partita, o i valori di oggi se la partita non ne ha.

- [ ] **Step 1: test.** In `game.service.test.js`: la vista di una partita con `settings` ne ha la stessa copia; la vista di una partita senza `settings` ha `settings` uguale a `legacySettings()`; la vista non contiene `mazzo`, `codaEstrattori`, `turno` né le cartelle degli altri giocatori. In `game.visibility.test.js`: la risposta di `createGame` e quella di `getGame` per un altro giocatore contengono `game.settings` e nessun `mazzo`.
- [ ] **Step 2:** `npm --prefix backend test -- __tests__/services/game.service.test.js __tests__/controllers/game.visibility.test.js` → il caso senza `settings` FALLISCE (e solo quello).
- [ ] **Step 3:** in `gameViewFor` imposta `visible.settings = settingsOfGame(game)`.
- [ ] **Step 4:** stessi comandi → PASS; poi `npm --prefix backend test` con `TEST_DATABASE_URL` → tutto verde.
- [ ] **Step 5:** commit `Always carry the settings in the view of a game`.

## Task 2: servizio, slice e client dell'API

**Files:**
- Create: `frontend/src/services/settingsService.js`, `frontend/src/store/slices/settingsSlice.js`
- Modify: `frontend/src/services/index.js` (export), `frontend/src/store/index.js`, `frontend/src/__tests__/test-utils.jsx`, `frontend/src/services/api.js`
- Test: `frontend/src/__tests__/services/settingsService.test.js`, `frontend/src/__tests__/store/settingsSlice.test.js` (nuovi), `frontend/src/__tests__/services/api.test.js`

**Interfaces:**
- Produces:
  - `getSettings(): Promise<{ values, limits, defaults }>` (`GET /settings`, restituisce `response.data`).
  - `settingsSlice` (nome `settings`), stato `{ values: object|null, limits: object|null, status: 'idle'|'loading'|'ready'|'error', error: string|null, requestId: string|null }`; thunk `fetchSettings()` (rifiuta con `rejectWithValue(error.message)`); azione `clearSettings()`; export di default il reducer.
  - Regole del reducer: `pending` memorizza `meta.requestId` e mette `status: 'loading'` solo se non ci sono già `values`; `fulfilled` e `rejected` valgono solo se `meta.requestId` è l'ultimo (le risposte vecchie sono ignorate); un `rejected` con `values` già presenti non cambia nulla; senza `values` mette `status: 'error'` e il messaggio. `logout.fulfilled`, `logout.rejected` e `clearPlayer` riportano lo stato iniziale.
  - `readySettings` (in `test-utils.jsx`): stato `ready` con i valori e i limiti dei vincoli globali; `createTestStore` registra `settings`.
  - Gli errori di `api.js` portano `retryAfter` (numero) quando la risposta del server lo ha.

- [ ] **Step 1: test.**
  - `settingsService`: `getSettings` chiama `api.get('/settings')` e restituisce `values`, `limits`, `defaults`.
  - Slice: stato iniziale `idle`; `pending` → `loading`; `fulfilled` → `ready` con `values` e `limits`; `rejected` senza valori → `error` col messaggio; `rejected` con valori già presenti → resta `ready` coi valori; **due letture in volo**: la seconda parte, la prima risponde dopo → vince la seconda (punto 2 del Review Focus); `logout.fulfilled`, `logout.rejected` e `clearPlayer` svuotano.
  - `api.test.js`: una risposta `429` con `{ message, retryAfter: 5 }` lancia un errore con `status: 429` e `retryAfter: 5`; senza `retryAfter` l'errore non ha la proprietà.
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/services src/__tests__/store/settingsSlice.test.js` → FAIL (moduli mancanti, `retryAfter` assente).
- [ ] **Step 3:** implementa servizio, slice, registrazione nello store e in `createTestStore`, `readySettings`, e `retryAfter` in `fetchApi` (solo se è un numero).
- [ ] **Step 4:** stessi comandi → PASS; poi `npm --prefix frontend run test:run` → verde.
- [ ] **Step 5:** commit `Read the game settings from the server into the store`.

## Task 3: lettura all'ingresso

**Files:**
- Modify: `frontend/src/store/sessionThunks.js` (`enterGameOrHall`)
- Test: `frontend/src/__tests__/store/sessionThunks.test.js` (nuovo)

**Interfaces:**
- Consumes: `fetchSettings` (Task 2).
- Produces: `enterGameOrHall(player)` lancia `fetchSettings()` senza aspettarla e senza bloccare l'ingresso.

- [ ] **Step 1: test** (store reale con `createTestStore`, `gameService` e `settingsService` mockati): chiamare `enterGameOrHall({ id: 'p1', currentGameId: null })` mette lo schermo su `hall` e `settingsService.getSettings` è stato chiamato una volta; con `getSettings` che rifiuta, lo schermo va comunque su `hall` e lo stato `settings` va in `error` senza eccezioni; con una partita in corso lo schermo va sulla partita e i parametri vengono letti lo stesso.
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/store/sessionThunks.test.js` → FAIL.
- [ ] **Step 3:** in `enterGameOrHall` fai `dispatch(fetchSettings())` come prima azione, senza `await`.
- [ ] **Step 4:** stesso comando e suite del frontend → PASS.
- [ ] **Step 5:** commit `Read the game settings when the player enters`.

## Task 4: traduzioni degli errori

**Files:**
- Modify: `frontend/src/utils/errors.utils.js` (`PATTERNS`)
- Test: `frontend/src/__tests__/utils/errors.utils.test.js`

**Interfaces:**
- Produces: `translateServerError('Wait 5 seconds before drawing')` → `Attendi 5 secondi prima di estrarre un'altra carta`; `translateServerError('maxPlayers must be from 2 to 8')` → `Da 2 a 8 giocatori`.

- [ ] **Step 1: test** dei due messaggi sopra, con numeri diversi (`1` e `30`; `3` e `20`).
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/utils/errors.utils.test.js` → FAIL (cadono nel messaggio generico).
- [ ] **Step 3:** aggiungi i due pattern in `PATTERNS`, prima della regola generica sui messaggi con `" must "`.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5:** commit `Translate the wait and the players range errors`.

## Task 5: modulo «Crea partita»

**Files:**
- Modify: `frontend/src/components/game/HallScreen.jsx` (stati iniziali righe ~34–43, validazione ~92–103, `Input` del modulo ~370–395)
- Test: `frontend/src/__tests__/components/HallScreen.test.jsx`

**Interfaces:**
- Consumes: `fetchSettings`, stato `settings` (Task 2); `readySettings` (test).
- Produces: nel modulo, `Crediti richiesti per partecipare` ha `min` e `max` da `limits.requiredCredits`, suggerimento e errore «Da {min} a {max} crediti»; `Numero massimo giocatori` ha `min` da `values.minPlayers`, `max` da `values.maxPlayers`, suggerimento e errore «Da {min} a {max} giocatori».

- [ ] **Step 1: test** (i test esistenti precaricano `settings: readySettings` e mockano `settingsService`; quelli che assumono «Da 2 a 10» restano veri coi valori predefiniti):
  - con `values: { minPlayers: 3, maxPlayers: 8, … }` il campo giocatori ha `min=3`, `max=8`, descrizione «Da 3 a 8 giocatori» e valore iniziale `8`;
  - la quota iniziale è il più basso fra `values.requiredCredits` e i crediti del giocatore: `150` con 500 crediti, `30` con 30 crediti, e mai sotto `limits.requiredCredits.min`;
  - una quota di `5` è accettata e inviata (il minimo di 10 non esiste più); `0` e `10001` danno «Da 1 a 10000 crediti» e non inviano nulla;
  - con `status: 'loading'` e senza valori il pulsante `Crea Partita` è disattivato; con `status: 'error'` e senza valori compaiono il messaggio e il pulsante `Riprova`, che richiama `getSettings`; mai un numero di ripiego nei campi (punto 1);
  - aprire il modulo rilegge i parametri: se `getSettings` risponde con `maxPlayers: 8` la descrizione diventa «Da 2 a 8 giocatori»;
  - modulo aperto e valori che cambiano: il numero scritto dall'utente resta, e all'invio un valore ora fuori dai limiti nuovi è rifiutato con la descrizione aggiornata (punto 5);
  - al montaggio della Hall `getSettings` è chiamato.
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/components/HallScreen.test.jsx` → FAIL.
- [ ] **Step 3:** in `HallScreen` leggi `state.settings`; lancia `fetchSettings()` al montaggio e all'apertura del modulo; i campi partono vuoti e prendono il valore iniziale quando i parametri sono pronti e l'utente non ha ancora scritto; `min`, `max`, suggerimenti e messaggi dai valori e dai limiti; `Crea Partita` disattivato senza `values`; un blocco con il messaggio e `Riprova` quando lo stato è `error` e mancano i valori.
- [ ] **Step 4:** stesso comando e suite del frontend → PASS.
- [ ] **Step 5:** commit `Take the limits of the new game form from the server`.

## Task 6: sala d'attesa

**Files:**
- Modify: `frontend/src/components/game/LobbyScreen.jsx` (righe ~129, 145, 191)
- Test: `frontend/src/__tests__/components/LobbyScreen.test.jsx`

**Interfaces:**
- Consumes: `game.settings.minPlayers` e `game.maxPlayers` (con `game.settings.maxPlayers` come ripiego).

- [ ] **Step 1: test:** con `game.settings.minPlayers: 3` e un solo giocatore la frase è «Servono almeno 3 giocatori per iniziare»; con `maxPlayers: 6` il contatore dice `1/6`; senza `game.settings` né `maxPlayers` la sala si disegna senza errori, senza frase con numeri e senza `10` (punto 3).
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/components/LobbyScreen.test.jsx` → FAIL.
- [ ] **Step 3:** sostituisci il «2» fisso e il ripiego `|| 10`; senza `minPlayers` la frase è «Non ci sono ancora abbastanza giocatori per iniziare».
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5:** commit `Show the players needed from the settings of the game`.

## Task 7: attesa tra le estrazioni e `429`

**Files:**
- Modify: `frontend/src/store/slices/gameSlice.js` (`drawCard` riga ~59, reducer `drawCard.fulfilled` riga ~263), `frontend/src/components/game/GameScreen.jsx` (righe ~114, 339), `frontend/src/components/game/BarraAzione.jsx` (`COOLDOWN_SECONDS` riga 20, barra riga ~171)
- Test: `frontend/src/__tests__/store/gameSlice.test.js`, `frontend/src/__tests__/components/BarraAzione.test.jsx`, `frontend/src/__tests__/components/GameScreen.test.jsx`

**Interfaces:**
- Consumes: `error.retryAfter` (Task 2), `game.settings.drawCooldownSeconds`.
- Produces: `drawCard` rifiuta con `rejectWithValue(error.message, { retryAfter: error.retryAfter })`; `drawCard.fulfilled` imposta `drawCooldown = state.game?.settings?.drawCooldownSeconds ?? 0`; `drawCard.rejected` con `meta.retryAfter > 0` imposta `drawCooldown = meta.retryAfter`; `BarraAzione` ha la prop `attesaTotale` (secondi) e la barra è `drawCooldown / attesaTotale` (0 se `attesaTotale` manca o è 0).

- [ ] **Step 1: test:**
  - `gameSlice`: dopo `drawCard.fulfilled` con `game.settings.drawCooldownSeconds: 12`, `drawCooldown` vale `12` (non 8); con `drawCooldownSeconds: 5` vale `5`; senza `game.settings` vale `0` (punto 3); `drawCard.rejected` con `meta.retryAfter: 4` mette `drawCooldown` a `4`; senza `retryAfter` lo lascia com'è (punto 4);
  - `BarraAzione`: con `attesaTotale={12}` e `drawCooldown={6}` la barra è al 50%; con `attesaTotale` assente non lancia e la barra è a 0%;
  - `GameScreen`: con `game.settings.drawCooldownSeconds: 12` passa `attesaTotale: 12`; un `429` con `retryAfter: 3` mostra «Attendi 3 secondi prima di estrarre un'altra carta» e il pulsante mostra «Attendi 3s».
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/store/gameSlice.test.js src/__tests__/components/BarraAzione.test.jsx src/__tests__/components/GameScreen.test.jsx` → FAIL.
- [ ] **Step 3:** implementa; togli `COOLDOWN_SECONDS` da `BarraAzione`; in `GameScreen` passa `attesaTotale={game.settings?.drawCooldownSeconds}` (anche in modalità a turno, dove l'attesa resta quella di `turno.attesaIn`).
- [ ] **Step 4:** stessi comandi e suite del frontend → PASS.
- [ ] **Step 5:** commit `Take the wait between draws from the game, and follow the 429`.

## Task 8: durata del Jolly

**Files:**
- Modify: `frontend/src/components/game/ConteggioJolly.jsx` (togli `SECONDI_PAUSA_JOLLY`), `frontend/src/components/game/BarraAzione.jsx` (righe ~131, 145), `frontend/src/components/game/GameScreen.jsx` (import riga 49, uso riga ~136)
- Test: `frontend/src/__tests__/components/BarraAzione.test.jsx`, `frontend/src/__tests__/components/GameScreen.test.jsx`; nuovo `frontend/src/__tests__/components/ConteggioJolly.test.jsx`

**Interfaces:**
- Produces: `ConteggioJolly` ha la prop `durata` (secondi, facoltativa): il conto non supera `durata`; senza `durata` non c'è tetto. `BarraAzione` passa `durata` da una prop `durataJolly`; `GameScreen` la ricava da `game.settings?.jollyHoldSeconds`.

- [ ] **Step 1: test:** `ConteggioJolly` con `scadenza` fra 100 secondi e `durata={45}` mostra `45 s`; con `durata={120}` e 100 secondi mostra `100 s`; senza `durata` mostra `100 s` (punto 3); `BarraAzione` con `durataJolly={45}` lo passa; `GameScreen` con `jollyHoldSeconds: 45` e una pausa lontana limita a 45.
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/components/ConteggioJolly.test.jsx src/__tests__/components/BarraAzione.test.jsx src/__tests__/components/GameScreen.test.jsx` → FAIL.
- [ ] **Step 3:** implementa; senza durata `GameScreen` non applica il tetto sul timer di chiusura (`Math.max(pausaScadenza - Date.now(), 0)`).
- [ ] **Step 4:** stessi comandi e suite del frontend → PASS.
- [ ] **Step 5:** commit `Take the time to choose the jolly from the game`.

## Task 9: Regole con i numeri del server

**Files:**
- Modify: `frontend/src/components/game/RegoleGioco.jsx` (righe ~60 e ~64), `frontend/src/components/game/RegoleScreen.jsx`, `frontend/src/components/game/CollezioniPanel.jsx`
- Test: `frontend/src/__tests__/components/RegoleGioco.test.jsx`, `RegoleScreen.test.jsx`, `CollezioniPanel.test.jsx`

**Interfaces:**
- Produces: `RegoleGioco` ha la prop `parametri` (`{ minPlayers, maxPlayers, drawCooldownSeconds }` o `null`). Con i parametri: «Si gioca da {min} a {max}» e «almeno {n} secondi tra una e l'altra». Senza: «Il numero di giocatori lo decide chi gestisce il gioco» e «con una breve attesa tra una e l'altra». `RegoleScreen` passa `state.settings.values`, li legge al montaggio se mancano e, con lo stato `error` e senza valori, mostra il messaggio con `Riprova`; `CollezioniPanel` passa `game.settings`.

- [ ] **Step 1: test:** con `parametri` `{ 3, 8, 12 }` il testo contiene «da 3 a 8» e «12 secondi» e non «da 2 a 10» né «8 secondi»; con `parametri` `null` nessuna delle due frasi ha un numero; `RegoleScreen` con stato `idle` e senza valori chiama `getSettings`; con `error` mostra il messaggio e `Riprova` lo richiama; `CollezioniPanel` con `game.settings.maxPlayers: 6` mostra «da 2 a 6».
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/components/RegoleGioco.test.jsx src/__tests__/components/RegoleScreen.test.jsx src/__tests__/components/CollezioniPanel.test.jsx` → FAIL.
- [ ] **Step 3:** implementa; adegua il test esistente di `RegoleGioco` che cerca «8 secondi» passando i parametri.
- [ ] **Step 4:** stessi comandi e suite del frontend → PASS.
- [ ] **Step 5:** commit `Take the numbers of the rules from the game settings`.

## Task 10: end-to-end a 320 e 180 px, e cambio dell'admin

**Files:**
- Create: `e2e/tests/ui/parametri-di-gioco.spec.js`
- Modify: eventuali e2e che contano sui vecchi valori della Hall (`e2e/tests/ui/mobile-game.spec.js`, riga ~378: il test del modulo continua a scrivere i suoi valori)

**Interfaces:**
- Consumes: `registerPlayer`, `registerAdmin`, `E2E_DATABASE_URL` (`e2e/tests/helpers/`), `GET /api/settings`, `PATCH /api/admin/settings` (`{ values, reason }`); controlli di larghezza come in `e2e/tests/ui/narrow-screens.spec.js`.

- [ ] **Step 1: test:** per le larghezze 320 e 180 px: il giocatore apre «Crea Nuova Partita», i campi hanno `min` e `max` uguali ai valori di `GET /api/settings`, il suggerimento dice «Da {min} a {max} giocatori», `document.documentElement.scrollWidth <= window.innerWidth` e i controlli del modulo misurano almeno 44 px di altezza. Test con admin (`test.skip(!E2E_DATABASE_URL, …)`, in serie): porta `maxPlayers` a 8, ricarica la pagina e vede «Da 2 a 8 giocatori»; ripristina il valore in un `finally`.
- [ ] **Step 2:** avvia backend (`DATABASE_URL` su `combocard_test` per il test con admin) e frontend (`npx vite --port 3000`), poi `npm --prefix e2e test -- tests/ui/parametri-di-gioco.spec.js --project=chromium --project=mobile-chrome` → PASS. Se non si può avviare qui, dichiaralo nella PR («Da sapere»).
- [ ] **Step 3:** lancia gli altri spec UI che toccano la Hall e la partita (`mobile-game`, `narrow-screens`, `estrazione-a-turno`, `jolly-pause`, `zoom-carte`) → PASS.
- [ ] **Step 4:** ferma i server locali (cerca il processo con `ss -ltnp | grep ':3000\|:3001'`, non con `pkill -f`) e commit `Test the settings in the new game form on narrow screens`.

## Task 11: documentazione e verifica finale

**Files:**
- Modify: `README.md`, `docs/GAME_DESIGN.md`, `frontend/README.md`, `TEST_SUITE.md`

- [ ] **Step 1:** aggiorna `README.md` (le funzioni: i valori di gioco si leggono dal server), `docs/GAME_DESIGN.md` («Game settings»: il frontend le legge da `GET /api/settings` e da `game.settings`; il `429` con `retryAfter`; il minimo di 10 crediti del modulo non c'è più), `frontend/README.md` (servizio e slice `settings`) e `TEST_SUITE.md` (cosa coprono i test nuovi). Controlla `git ls-files --eol` prima di modificare ciascun file.
- [ ] **Step 2:** `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs` → 0 errori.
- [ ] **Step 3:** ricerca «niente a mano»: `grep -rnE "COOLDOWN_SECONDS|SECONDI_PAUSA_JOLLY|Da 2 a 10|useState\(\"6\"\)|min=\"10\"|\|\| 10\b" frontend/src --include=*.js --include=*.jsx | grep -v __tests__` → nessun risultato.
- [ ] **Step 4:** con PostgreSQL attivo, `TEST_DATABASE_URL=…combocard_test npm --prefix backend test` e `npm --prefix frontend run test:run` → verdi; `npm --prefix backend run lint` e `npm --prefix frontend run lint` → nessun errore nuovo; `git diff --stat origin/develop` senza file con tutte le righe cambiate.
- [ ] **Step 5:** commit `Document the settings read by the frontend`, push della branch e PR verso `develop` con `Closes #118`; nelle note scrivi cosa cambia (il minimo di 10 crediti sparisce, il valore iniziale dei giocatori è il massimo del server, il conto dell'attesa si riallinea col `429`) e cosa resta (#119, `attesaIn` in modalità classica). La PR la unisce l'utente.
