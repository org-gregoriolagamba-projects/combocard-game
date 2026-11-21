# Parametri di gioco, parte 3: la schermata di amministrazione — Piano di implementazione

> **Per chi esegue:** SUB-SKILL RICHIESTA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans per eseguire il piano un task alla volta. I passi usano la sintassi a caselle (`- [ ]`).

**Obiettivo:** una scheda «Parametri» nella schermata Amministrazione, con un unico modulo per i sei parametri di gioco (valore attuale, intervallo, predefinito, motivo obbligatorio) e le frasi in italiano nel registro delle operazioni.

**Architettura:** un modulo `config/parametri.js` con le etichette; due funzioni nel servizio admin (`getSettings`, `updateSettings`); un pannello `ParametriPanel` con stato locale, nello stile di `StatsPanel`; una frase nuova in `AuditPanel`; traduzioni nuove in `errors.utils.js`.

**Stack:** React 18, Redux Toolkit (solo per il toast e la schermata), Vite, Vitest + Testing Library, Playwright. Backend invariato.

**Spec:** `docs/superpowers/specs/2026-11-21-parametri-di-gioco-schermata-admin-design.md`

**Issue e branch:** #119, branch `feature/parametri-di-gioco-schermata-admin`. La PR chiude la #119 (`Closes #119`).

## Chiarimenti alla spec (decisi scrivendo il piano)

1. **Traduzioni in più:** il `503` del server («Storage temporarily unavailable, please try again») non è tradotto oggi e cadrebbe nel messaggio generico; lo traduco insieme a quelli dei parametri, perché un salvataggio che non riesce deve dirlo bene.
2. **Messaggi di Joi:** con `abortEarly` falso il server può unire più messaggi; la traduzione guarda il primo che riconosce.
3. **Parametro del test e2e che modifica:** `jollyMaxDeclarations` da 3 a 4. Nessun e2e esistente controlla quel limite (ricerca fatta), e il valore più permissivo non rompe i test che girano nello stesso momento; gli altri parametri sì (minimo di giocatori, attesa, durata del Jolly) o sono già usati da altri spec (`maxPlayers`, `requiredCredits`).
4. **Fine riga:** `errors.utils.js` è CRLF; i file di `components/admin/`, `adminService.js` e i test sono LF. Prima di modificare un file controlla `git ls-files --eol <file>`; dopo ogni task `git diff --stat` non deve mostrare file con tutte le righe cambiate.

## Vincoli globali

- Node.js 20.19 o superiore; moduli ESM; testi dell'interfaccia in italiano.
- L'area admin è per soli admin: il server decide (`403` → `onForbidden`); nessuna logica di ruolo nuova nel client.
- Parametri e limiti (predefiniti): `minPlayers` 2 (2–10), `maxPlayers` 10 (2–20), `requiredCredits` 100 (1–10.000), `jollyHoldSeconds` 30 (10–120), `jollyMaxDeclarations` 3 (1–10), `drawCooldownSeconds` 8 (3–30). Il motivo è obbligatorio, fino a 200 caratteri.
- Una prova su PostgreSQL gira solo su `combocard_test`: `TEST_DATABASE_URL=postgresql://combocard:combocard@127.0.0.1:5432/combocard_test`. Mai su `combocard`.
- Non modificare file `.env`. Messaggi di commit in inglese, con la riga `Co-Authored-By` del repository.
- Nei test Vitest, una funzione restituita da `beforeEach` viene eseguita come pulizia: usa le graffe (`beforeEach(() => { x.mockReset(); })`).

## Punti da controllare (Review Focus)

Ognuno ha il suo test nel task indicato.

1. Minimo e massimo cambiati insieme (minimo sopra il massimo attuale, massimo sopra il nuovo minimo): il modulo accetta e invia entrambi; solo il massimo sotto il minimo scritto nel modulo è un errore (Task 6).
2. Il server rifiuta il salvataggio: i campi restano come l'admin li ha scritti, «Attuale» non cambia, nessun avviso di successo (Task 6).
3. Due tocchi rapidi su «Salva»: una sola richiesta (Task 6).
4. Un altro admin ha salvato nel frattempo: dopo il mio salvataggio i campi si riallineano alla risposta del server, non ai valori che ho scritto (Task 6).
5. A 180 px niente testo fuori dal riquadro né scorrimento orizzontale, anche con suggerimenti lunghi e un errore sul campo (Task 7).

## Struttura dei file

| File | Ruolo |
|---|---|
| `frontend/src/config/parametri.js` (nuovo) | I sei parametri: chiave, etichetta, unità, spiegazione; `etichettaParametro`, `fraseCambio` |
| `frontend/src/services/adminService.js` | `getSettings`, `updateSettings` |
| `frontend/src/utils/errors.utils.js` | Traduzioni dei messaggi dei parametri, del `503` e del limite di richieste |
| `frontend/src/components/admin/AuditPanel.jsx` | Frase per `settings_changed` |
| `frontend/src/components/admin/ParametriPanel.jsx` (nuovo) | Il pannello: lettura, modulo, salvataggio |
| `frontend/src/components/admin/AdminScreen.jsx` | Quinta scheda |
| `e2e/tests/ui/parametri-admin.spec.js` (nuovo) | Scheda a 320 e 180 px, giocatore senza ruolo, cambio con registro |

## Task 1: etichette dei parametri

**Files:**
- Create: `frontend/src/config/parametri.js`
- Test: `frontend/src/__tests__/config/parametri.test.js` (nuovo)

**Interfaces:**
- Produces:
  - `PARAMETRI`: array di `{ chiave, etichetta, unita, spiegazione }`, nell'ordine `minPlayers`, `maxPlayers`, `requiredCredits`, `jollyHoldSeconds`, `jollyMaxDeclarations`, `drawCooldownSeconds`. Etichette: «Giocatori minimi per avviare», «Giocatori massimi», «Quota d'ingresso predefinita», «Pausa del Jolly», «Dichiarazioni del Jolly per partita», «Attesa tra le estrazioni». Unità: `giocatori`, `giocatori`, `crediti`, `secondi`, `dichiarazioni`, `secondi`.
  - `etichettaParametro(chiave): string` (l'etichetta, o la chiave stessa se sconosciuta).
  - `fraseCambio(chiave, da, a): string`: «{etichetta} da {da} a {a} {unità}» (per una chiave sconosciuta: «{chiave} da {da} a {a}»).

- [ ] **Step 1: test:** le chiavi sono esattamente le sei del server, in quest'ordine; ognuna ha etichetta, unità e spiegazione non vuote; `etichettaParametro('drawCooldownSeconds')` è «Attesa tra le estrazioni»; `etichettaParametro('cheat')` è `cheat`; `fraseCambio('drawCooldownSeconds', 8, 12)` è «Attesa tra le estrazioni da 8 a 12 secondi»; `fraseCambio('cheat', 1, 2)` è «cheat da 1 a 2».
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/config/parametri.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** implementa il modulo con le firme sopra.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5:** commit `Add the labels of the game settings`.

## Task 2: servizio admin

**Files:**
- Modify: `frontend/src/services/adminService.js`
- Test: `frontend/src/__tests__/services/adminService.test.js`

**Interfaces:**
- Produces: `getSettings(): Promise<{ values, limits, defaults, updatedAt, updatedBy }>` (`GET /admin/settings`); `updateSettings({ values, reason }): Promise<{ values, limits, defaults, updatedAt, updatedBy }>` (`PATCH /admin/settings` con corpo `{ values, reason }`). Entrambe restituiscono `response.data`.

- [ ] **Step 1: test** (stesso stile del file: `api` mockato): `getSettings` chiama `api.get('/admin/settings')` e restituisce la risposta; `updateSettings({ values: { drawCooldownSeconds: 12 }, reason: 'più tempo' })` chiama `api.patch('/admin/settings', { values: { drawCooldownSeconds: 12 }, reason: 'più tempo' })` e restituisce la risposta.
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/services/adminService.test.js` → FAIL.
- [ ] **Step 3:** aggiungi le due funzioni, con la doc come le altre.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5:** commit `Add the game settings to the admin service`.

## Task 3: traduzioni degli errori

**Files:**
- Modify: `frontend/src/utils/errors.utils.js` (`EXACT` e `PATTERNS`; importa `etichettaParametro` da `../config/parametri`)
- Test: `frontend/src/__tests__/utils/errors.utils.test.js`

**Interfaces:**
- Consumes: `etichettaParametro` (Task 1).
- Produces, da `translateServerError`:
  - `Storage temporarily unavailable, please try again` → «Non sono riuscito a salvare: riprova tra poco».
  - `Too many changes to the settings, please try again later.` → «Troppe modifiche in poco tempo: riprova fra un minuto».
  - `maxPlayers cannot be below minPlayers` → «I giocatori massimi non possono essere meno dei minimi».
  - `drawCooldownSeconds must be a whole number from 3 to 30` → «Attesa tra le estrazioni: da 3 a 30».
  - `"values.drawCooldownSeconds" must be less than or equal to 30` → «Attesa tra le estrazioni: al massimo 30»; `... must be greater than or equal to 3` → «Attesa tra le estrazioni: almeno 3»; `"values.requiredCredits" must be an integer` e `... must be a number` → «Quota d'ingresso predefinita: scrivi un numero intero».

- [ ] **Step 1: test** con `test.each` dei messaggi sopra (almeno due chiavi diverse per i pattern con la chiave, per provare che l'etichetta cambia) e un messaggio unito `"values.minPlayers" must be greater than or equal to 2, "reason" is not allowed to be empty` che dà la traduzione del primo.
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/utils/errors.utils.test.js` → FAIL.
- [ ] **Step 3:** aggiungi le voci. I pattern con la chiave stanno in `PATTERNS`, prima della regola generica sui messaggi con `" must "`.
- [ ] **Step 4:** stesso comando e suite del frontend → PASS.
- [ ] **Step 5:** commit `Translate the errors of the game settings`.

## Task 4: frase nel registro

**Files:**
- Modify: `frontend/src/components/admin/AuditPanel.jsx` (`frase`)
- Test: `frontend/src/__tests__/components/admin/AdminRegistro.test.jsx`

**Interfaces:**
- Consumes: `fraseCambio` (Task 1).
- Produces: per `e.action === "settings_changed"`: «{chi} ha cambiato i parametri di gioco: {cambio}; {cambio}: «{motivo}»», con un `cambio` per ogni chiave di `details.changes` (`{ chiave: { from, to } }`), nell'ordine in cui arrivano. Senza modifiche nei dettagli: «{chi} ha cambiato i parametri di gioco: «{motivo}»».

- [ ] **Step 1: test** (nel file esistente, evento con `targetId: null, targetName: null`): una modifica → «Dario ha cambiato i parametri di gioco: Attesa tra le estrazioni da 8 a 12 secondi: «più tempo»»; due modifiche separate da «; »; una chiave sconosciuta col nome grezzo; dettagli senza `changes` → frase senza elenco; azione eseguita dal sistema → «Il sistema ha cambiato…».
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/components/admin/AdminRegistro.test.jsx` → FAIL (compare «Dario: settings_changed»).
- [ ] **Step 3:** aggiungi il ramo in `frase`.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5:** commit `Show the changes of the game settings in the audit log`.

## Task 5: scheda «Parametri», lettura

**Files:**
- Create: `frontend/src/components/admin/ParametriPanel.jsx`
- Modify: `frontend/src/components/admin/AdminScreen.jsx` (`TABS` e pannello)
- Test: `frontend/src/__tests__/components/admin/AdminParametri.test.jsx` (nuovo)

**Interfaces:**
- Consumes: `adminService.getSettings` (Task 2), `PARAMETRI` (Task 1).
- Produces: `ParametriPanel({ onForbidden })`, esportato di default; scheda `{ id: "parametri", label: "Parametri" }` come quinta. In lettura il pannello mostra: l'avviso «Le modifiche valgono solo per le partite create dopo: quelle in attesa o in corso continuano con i parametri che avevano.»; per ogni parametro un campo numerico con etichetta, `min` e `max` dai limiti, valore iniziale l'attuale, e il suggerimento «Attuale {v} · Da {min} a {max} · Predefinito {d}» (per i giocatori massimi anche «· mai meno dei giocatori minimi»); un pulsante «Ripristina {etichetta}» per campo; il campo «Motivo» (massimo 200 caratteri, suggerimento «Resta nel registro delle azioni.»); il pulsante «Salva» (qui ancora non fa niente: il Task 6); «Ultima modifica: {data}» se `updatedAt` c'è.

- [ ] **Step 1: test** (come `AdminStats.test.jsx`: `adminService` mockato, `adminState()`, apri la scheda «Parametri»): la scheda c'è e apre il pannello; mentre carica dice «Caricamento dei parametri…»; `getSettings` chiamata una volta; i sei campi per etichetta con `min`/`max`/valore giusti (usa valori diversi dai predefiniti, per esempio `minPlayers` 3, `maxPlayers` 8); il suggerimento di un campo; l'avviso «solo per le partite create dopo»; «Ultima modifica» presente solo se `updatedAt` c'è; un errore di caricamento mostra il messaggio e «Riprova» ricarica; un `403` chiama la logica di `AdminScreen` (torna alla Hall, toast «Non hai più i permessi dell'amministrazione»); `AdminScreen` mostra cinque schede.
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/components/admin/AdminParametri.test.jsx` → FAIL.
- [ ] **Step 3:** implementa il pannello (caricamento/errore/«Riprova»/`403` come `StatsPanel`; una voce di stato per campo, come testo, per poterlo svuotare) e la scheda.
- [ ] **Step 4:** stesso comando e suite del frontend → PASS (i test esistenti di `AdminScreen` che contano le schede si aggiornano a cinque).
- [ ] **Step 5:** commit `Add the Parametri tab to the admin screen`.

## Task 6: modulo e salvataggio

**Files:**
- Modify: `frontend/src/components/admin/ParametriPanel.jsx`
- Test: `frontend/src/__tests__/components/admin/AdminParametri.test.jsx`

**Interfaces:**
- Consumes: `adminService.updateSettings` (Task 2), `addToast` (`uiSlice`).
- Produces: comportamento del modulo:
  - «Salva» attivo solo se almeno un valore è diverso dall'attuale e non si sta inviando; invia `updateSettings({ values: <solo i cambiati, come numeri>, reason: <motivo senza spazi> })`.
  - Errori nel campo, mai inviando: vuoto o non numerico «Scrivi un numero»; fuori limiti «Da {min} a {max} {unità}»; massimo sotto il minimo **del modulo** «Non può essere meno dei giocatori minimi ({min})»; motivo vuoto «Scrivi il motivo». Scrivere in un campo toglie il suo errore.
  - «Ripristina {etichetta}» mette nel campo il predefinito (disattivato se ci è già).
  - Successo: stato = risposta del server (campi riallineati ai valori della risposta, «Attuale» aggiornato, «Ultima modifica» aggiornata), motivo svuotato, toast «Parametri di gioco aggiornati» (tipo `success`).
  - Rifiuto del server: avviso (`role="alert"`) sopra «Salva» col messaggio dell'errore; campi, motivo e «Attuale» invariati; `403` → `onForbidden`.
  - Una ref `inFlight` impedisce una seconda richiesta durante l'invio.

- [ ] **Step 1: test** (stesso file del Task 5):
  - nessuna modifica → «Salva» disattivato; scrivere 12 nell'attesa → attivo;
  - invia **solo** i valori cambiati: cambia l'attesa e la quota, `updateSettings` riceve `{ values: { drawCooldownSeconds: 12, requiredCredits: 150 }, reason: 'più tempo' }` con il motivo senza spazi ai bordi;
  - minimo e massimo insieme (punto 1): con `minPlayers` 2 e `maxPlayers` 10 porto il minimo a 10 e il massimo a 12 → inviati entrambi, nessun errore; il massimo a 4 con il minimo a 6 scritti nel modulo → errore «Non può essere meno dei giocatori minimi (6)» e nessuna richiesta;
  - fuori limiti (attesa 31 e 2) → «Da 3 a 30 secondi» e nessuna richiesta; campo vuoto e testo → «Scrivi un numero»; motivo vuoto o di soli spazi → «Scrivi il motivo»;
  - «Ripristina» riporta il campo al predefinito ed è disattivato quando il campo lo ha già;
  - successo: dopo la risposta (con valori diversi da quelli scritti, per esempio il server ha già un altro valore) i campi sono quelli della risposta (punto 4), il motivo è vuoto, «Attuale» è aggiornato, il toast c'è;
  - rifiuto (`failure('Non sono riuscito a salvare: riprova tra poco', 503)`): avviso sopra «Salva», campi e motivo come scritti, «Attuale» invariato, nessun toast di successo (punto 2); un `400` mostra il suo messaggio; un `403` torna alla Hall;
  - due click rapidi su «Salva» con `updateSettings` che non risolve → una sola chiamata (punto 3).
- [ ] **Step 2:** `npm --prefix frontend run test:run -- src/__tests__/components/admin/AdminParametri.test.jsx` → FAIL.
- [ ] **Step 3:** implementa il modulo (stato del modulo come testo per campo; stile di `CreditsDialog` per errori, `inFlight` e motivo; layout in una colonna con `overflow-wrap`, «Ripristina» sotto il campo a tutta larghezza, controlli da 44 px).
- [ ] **Step 4:** stesso comando e suite del frontend → PASS; `npm --prefix frontend run lint` → nessun errore nuovo.
- [ ] **Step 5:** commit `Change the game settings from the admin screen`.

## Task 7: end-to-end

**Files:**
- Create: `e2e/tests/ui/parametri-admin.spec.js`

**Interfaces:**
- Consumes: `registerPlayer`, `registerAdmin`, `E2E_DATABASE_URL` (`e2e/tests/helpers/`), `GET /api/settings`, `PATCH /api/admin/settings` (`{ values, reason }`), il modello di `admin-games-screen.spec.js` (accesso, «Amministrazione», schede).

- [ ] **Step 1: test** (`test.skip(!E2E_DATABASE_URL, …)`):
  - **in entrambi i progetti, a 320 e 180 px:** l'admin apre «Amministrazione» → «Parametri»; vede i sei campi; nessuno scorrimento orizzontale (`scrollWidth <= innerWidth`) anche con un errore sul campo (scrive un valore fuori limiti e prova «Salva») e un motivo lungo (200 caratteri); i controlli (campi, «Ripristina», «Salva», schede) misurano almeno 44 px di altezza (punto 5);
  - **in entrambi:** un giocatore senza ruolo non vede il pulsante «Amministrazione» nella Hall;
  - **solo in `chromium`** (`test.beforeEach` con `testInfo.project.name`, come in `parametri-di-gioco.spec.js`): l'admin porta `jollyMaxDeclarations` da 3 a 4 con un motivo, vede il toast «Parametri di gioco aggiornati» e «Attuale 4»; nel «Registro» compare «ha cambiato i parametri di gioco: Dichiarazioni del Jolly per partita da 3 a 4 dichiarazioni» con il motivo; `GET /api/settings` dà 4; un valore fuori limiti non salva e mostra l'errore; il test ripristina nel `finally` il predefinito (`defaults.jollyMaxDeclarations`, letto da `GET /api/settings`) con `PATCH`.
- [ ] **Step 2:** avvia backend (`DATABASE_URL` su `combocard_test`, `PORT=3001`, `RATE_LIMIT_DISABLED=true`) e frontend (`npx vite --port 3000`), poi `E2E_DATABASE_URL=…combocard_test npm --prefix e2e test -- tests/ui/parametri-admin.spec.js --project=chromium --project=mobile-chrome` → PASS, due volte. Se non si possono avviare, dichiaralo nella PR («Da sapere»).
- [ ] **Step 3:** lancia tutti gli spec UI (`tests/ui`, i due progetti) → PASS.
- [ ] **Step 4:** ferma i server cercando il processo con `ss -ltnp | grep ':3000\|:3001'` (non con `pkill -f`), poi commit `Test the admin screen of the game settings`.

## Task 8: documentazione e verifica finale

**Files:**
- Modify: `docs/AUTH.md`, `docs/GAME_DESIGN.md`, `README.md`, `frontend/README.md`, `TEST_SUITE.md`

- [ ] **Step 1:** controlla `git ls-files --eol` di ciascun file, poi aggiorna: `docs/AUTH.md` (la scheda «Parametri» usa le due route admin dei parametri; per soli admin), `docs/GAME_DESIGN.md` («Game settings»: la schermata admin, un unico modulo, avviso «solo per le partite create dopo», frase nel registro; togli la voce «da fare» sulla schermata admin se c'è), `README.md` (le funzioni: gli admin cambiano i parametri dalla schermata Amministrazione), `frontend/README.md` (`ParametriPanel` e `config/parametri.js`), `TEST_SUITE.md` (cosa coprono i test nuovi).
- [ ] **Step 2:** `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs` → 0 errori.
- [ ] **Step 3:** `npm --prefix frontend run test:run` e `npm --prefix frontend run lint` → verdi, nessun errore nuovo; con PostgreSQL attivo `TEST_DATABASE_URL=…combocard_test npm --prefix backend test` → verde (il backend non cambia, ma è la verifica di non aver rotto niente); `git diff --stat origin/develop` senza file con tutte le righe cambiate.
- [ ] **Step 4:** commit `Document the admin screen of the game settings`, push della branch e PR verso `develop` con `Closes #119`; nelle note scrivi cosa cambia (la quinta scheda, le frasi del registro, le traduzioni nuove compreso il `503`) e cosa resta fuori (il nome di chi ha fatto l'ultima modifica, lo storico dei valori). La PR la unisce l'utente.
