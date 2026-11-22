# Avvisi a tutti i giocatori e modalità manutenzione

Issue #120. Branch `feature/avvisi-e-manutenzione`.

## Obiettivo

Due strumenti dell'admin per parlare con tutti i giocatori e per fermare l'app in modo ordinato. **Avvisi:** l'admin scrive un messaggio breve, con gravità e (facoltativi) inizio e fine; compare come banner a chi è connesso e a chi entra mentre è visibile; il giocatore lo chiude e non lo rivede finché non cambia. **Manutenzione:** l'admin la accende con un messaggio e, se vuole, l'ora prevista di fine; finché è accesa un utente normale non si registra, non crea partite, non entra in una partita né la avvia; le partite già avviate finiscono; chi apre l'app vede una schermata chiara.

**Fuori da questa attività:** avvisi per singola stanza (#121), spegnimento automatico della manutenzione all'ora di fine, conto alla rovescia, più avvisi insieme, notifiche fuori dall'app.

## Decisioni già prese

- Le partite in corso **finiscono**: la manutenzione blocca solo ciò che è nuovo. Per fermarne una, l'admin usa l'annullamento con rimborso che esiste già (#87).
- Il **preavviso è un avviso**: la manutenzione si accende subito; chi vuole dare preavviso pubblica prima un avviso.
- **Un solo avviso alla volta:** pubblicarne uno sostituisce il precedente.
- **Solo globali.** Per le Game Room si deciderà con la #121.
- L'ora di fine della manutenzione è **solo informativa**: non spegne nulla da solo.

## Dati

**Migrazione `backend/db/migrations/013_notices.sql`**, due tabelle da una riga sola (`id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1)`, riga inserita dalla migrazione, come `game_settings`):

| Tabella | Colonne |
|---|---|
| `announcement` | `version INTEGER NOT NULL DEFAULT 0` (sale a ogni pubblicazione), `active BOOLEAN NOT NULL DEFAULT false`, `message TEXT NOT NULL DEFAULT ''`, `severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','importante'))`, `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `updated_by TEXT`, `CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)` |
| `maintenance` | `active BOOLEAN NOT NULL DEFAULT false`, `message TEXT NOT NULL DEFAULT ''`, `ends_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `updated_by TEXT` |

**Costanti** in `backend/src/config/notices.js`: lunghezza del messaggio (1–280 caratteri), gravità ammesse (`info`, `importante`).

**Stato in memoria:** `gameState.announcement` e `gameState.maintenance`, caricati all'avvio accanto alle impostazioni e cambiati **solo dopo** che lo store ha scritto (se la scrittura fallisce la cache non cambia).

## Store

Metodi nuovi sia nello store in memoria sia in quello PostgreSQL; ognuno scrive la riga di audit nella stessa transazione e blocca la riga con `FOR UPDATE`:
- `getAnnouncement()` / `getMaintenance()`: la riga con `updatedAt` e `updatedBy`.
- `publishAnnouncement({ message, severity, startsAt, endsAt }, { actor })`: `version = version + 1`, `active = true`; audit `announcement_published` (target nullo; dettagli: `version`, `message`, `severity`, `startsAt`, `endsAt`). Restituisce il nuovo stato.
- `withdrawAnnouncement({ actor })`: `active = false`, la versione resta; audit `announcement_withdrawn` (dettagli: `version`). Se non c'è un avviso attivo non scrive nulla.
- `setMaintenance({ active, message, endsAt }, { actor })`: audit `maintenance_enabled` (con `message` e `endsAt`) o `maintenance_disabled`. Se lo stato non cambia (già acceso con gli stessi valori, già spento) non scrive nulla.

## Servizio `backend/src/services/notices.service.js`

- `loadNotices(store, gameState)`: all'avvio.
- `visibleAnnouncement(gameState, now = new Date())`: l'avviso se `active` e `now` è dentro la finestra (`starts_at` ≤ ora < `ends_at`, con i limiti assenti ignorati), altrimenti `null`. Restituisce `{ version, message, severity, startsAt, endsAt }`.
- `publishAnnouncement`, `withdrawAnnouncement`, `setMaintenance(store, gameState, io, …)`: scrivono con lo store, poi aggiornano la cache e **emettono l'evento**.
- `isMaintenance(gameState)` e `assertNotInMaintenance(req)`: lancia `AppError("The game is in maintenance", 503)` con `code: "MAINTENANCE"` e, se c'è, `retryAfter` in secondi fino a `ends_at`; **non fa nulla per un admin** (`req.auth.role === "admin"`).
- `armNoticeTimers(io, gameState)`: un timer (non tiene vivo il processo, `unref`) al prossimo bordo della finestra dell'avviso attivo (inizio o fine futuri) che emette lo stato visibile e ne arma un altro; riarmato all'avvio. Il ritardo si limita a 12 ore e si ricalcola (un `setTimeout` non supera i circa 24 giorni).

## Route

- **Pubblica:** `GET /api/status` → `{ maintenance: { active, message, endsAt } | null, announcement: visibleAnnouncement | null }`. `/api/health` aggiunge `maintenance: boolean`. Nessun dato di giocatori.
- **Admin** (router con `requireAuth` e `requireRole("admin")`, limite di richieste `settingsLimiter` sulle scritture):
  - `GET /api/admin/notices`: stato completo (anche avviso non visibile, versione, `updatedAt`, `updatedBy`).
  - `PUT /api/admin/announcement`: `{ message, severity, startsAt?, endsAt? }`.
  - `DELETE /api/admin/announcement`.
  - `PUT /api/admin/maintenance`: `{ active, message?, endsAt? }`; con `active: true` il messaggio è obbligatorio.
- Schemi Joi in `schemas.js`: `message` testo, tagliato, 1–280 caratteri; `severity` tra le ammesse; date ISO; `endsAt` dopo `startsAt` (altrimenti `400`). Il testo è sempre testo: React lo mostra senza interpretarlo e il server non lo trasforma. L'attore è `req.auth`, mai il corpo. `reason` non serve: il messaggio è già la spiegazione.

## Tempo reale

- Eventi a tutti i client connessi (`io.emit` con `broadcastToAll`): `avviso` con `{ announcement: visibleAnnouncement | null }` e `manutenzione` con `{ maintenance }`. Emessi a ogni pubblicazione, ritiro, cambio di manutenzione e bordo di finestra.
- All'ingresso e alla riconnessione del socket il client rilegge `GET /api/status`.

## Cosa blocca la manutenzione

Per chi non è admin, con `503` e `code: "MAINTENANCE"` (messaggio del server, tradotto sullo schermo): `POST /api/auth/register`, `POST /api/games`, `POST /api/games/:id/join` (solo per chi non è già nella partita, nello stesso punto del blocco dei termini), `POST /api/games/:id/start` e l'avvio automatico di una partita piena in attesa (resta in attesa finché la manutenzione non finisce). **Restano aperti:** accesso (login), partite avviate, estrazioni, Jolly, uscita da una partita, acquisto di crediti, eliminazione dell'account, storico. L'admin passa sempre.

## Frontend

- **Stato:** `noticeSlice` (`announcement`, `maintenance`, `loaded`) con il thunk `fetchStatus`; `useSocket` ascolta `avviso` e `manutenzione` e alla riconnessione richiama `fetchStatus`. `fetchStatus` parte all'avvio, anche senza accesso.
- **`AvvisoBanner`** in cima a ogni schermata (in `AppContent`, anche per le schermate di testo): gravità `importante` con più rilievo, pulsante «Chiudi» da 44 px; la chiusura ricorda in `localStorage` la `version` (con `try/catch`: senza archiviazione il banner torna a ogni ricarica). Mai HTML. Ha `role="status"`, e `role="alert"` per `importante`.
- **`ManutenzioneScreen`:** al posto della pagina di accesso per chi non ha una sessione, e al posto di hall e storico per un giocatore che non è admin e non è in una partita. Mostra il messaggio e, se c'è, l'ora di fine («Dovrebbe finire verso le 22:30»); per chi ha una sessione c'è «Esci»; per chi non ce l'ha c'è un collegamento «Sono un amministratore» che apre il modulo di accesso (un utente normale che accede viene riportato alla schermata di manutenzione). Chi è in una partita (in attesa o in corso) vede la partita e un banner con il messaggio della manutenzione. Un admin vede un banner «Manutenzione accesa» in alto e lavora normalmente.
- **Scheda «Avvisi» in `AdminScreen`** (`AvvisiPanel`): modulo dell'avviso (testo con contatore, gravità, inizio e fine facoltativi, «Pubblica» e «Ritira», mostra lo stato e la versione) e modulo della manutenzione (interruttore, messaggio, ora di fine). Gli errori del server si leggono nel modulo; `403` riporta alla hall come le altre schede.
- **Registro (`AuditPanel`):** frasi per le quattro nuove azioni.
- Testi dell'interfaccia in italiano; tradotto «The game is in maintenance» in `errors.utils.js`.

## Errori

Corpo non valido `400`; database non scrivibile `503` «Storage temporarily unavailable» e la cache non cambia; due `PUT` simultanee: la riga si blocca e la seconda parte dal valore già cambiato; un utente non admin che chiama una route admin riceve `403` (un test controlla ogni route, come per le altre). Nessuna route restituisce dati di altri giocatori.

## Prove

- **Backend:** schemi; store in memoria e PostgreSQL (migrazione, pubblicazione che alza la versione, ritiro, audit nella stessa transazione, nessuna scrittura se nulla cambia); servizio (finestra dell'avviso con limiti assenti, cache invariata se la scrittura fallisce, `retryAfter`, admin esente, timer ai bordi con tempo finto); controller e route (blocchi su registrazione, creazione, ingresso, avvio manuale e automatico; non interrompe chi è già in partita; `GET /api/status` pubblico e senza dati dei giocatori; ogni route admin negata a un utente normale); eventi emessi.
- **Frontend:** slice, banner (chiusura per versione, `localStorage` che manca, gravità), schermata di manutenzione e collegamento per l'admin, banner in partita, scheda «Avvisi», registro.
- **E2E (API e UI):** un admin pubblica un avviso e un giocatore connesso lo vede senza ricaricare, lo chiude e non lo rivede; con la manutenzione accesa un utente non si registra né crea né entra, vede la schermata, l'admin lavora; spegnendola tutto torna. Le prove che accendono la manutenzione girano in **un solo progetto** (come quelle dei parametri), per non bloccare le altre in parallelo.

## Documenti da aggiornare

`docs/AUTH.md` (route, blocco), `docs/DATABASE.md` (tabelle e azioni di audit), `docs/DEPLOYMENT.md` (come usare la manutenzione; `/api/health`), `README.md` (route ed eventi `avviso` e `manutenzione`), `docs/GAME_DESIGN.md` (avvisi e manutenzione nel flusso), `TEST_SUITE.md` se cambia la struttura.

## Da decidere durante il piano

- Il testo esatto delle frasi del registro e dei messaggi.
- Dove si mette il collegamento «Sono un amministratore» nella schermata di accesso.
