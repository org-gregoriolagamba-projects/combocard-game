# Parametri di gioco, parte 2: il frontend legge i valori dal server

Issue #118 (parte della #73, dipende dalla #117, già unita). Branch `feature/parametri-di-gioco-frontend`.

## Obiettivo

Nessun valore di gioco resta scritto a mano nel frontend. Il modulo «Crea partita», l'attesa tra le estrazioni, il conto alla rovescia del Jolly e il testo delle regole prendono i numeri dal server. L'attesa e il tempo del Jolly seguono la **copia dei parametri della partita** (`game.settings`), perché una partita creata prima di una modifica dell'admin continua con i suoi valori. Il `429` del server si gestisce col tempo che resta. Se la lettura dei parametri fallisce, un messaggio chiaro e «Riprova»: mai valori inventati.

**Fuori da questa parte:** la schermata di amministrazione (#119), un `attesaIn` per la modalità classica, la frase leggibile della riga di audit `settings_changed`.

## Decisioni già prese

- **Backend, piccola modifica nella stessa PR:** `gameViewFor` aggiunge `settings` alla vista della partita (sei interi non segreti; la regola di visibilità non cambia). Una partita salvata senza copia riceve i valori di oggi (`settingsOfGame`). Scartate: usare solo i valori globali (una partita in corso mostrerebbe l'attesa sbagliata dopo un cambio) e un `attesaIn` anche in modalità classica (cambio più grande, da fare a parte).
- **Stato (approccio A):** uno stato Redux dedicato, caricato quando il giocatore è noto, nello stile del resto dell'app. Scartate: una lettura per schermata (duplica richieste ed errori) e valori solo dentro la partita (il modulo e le Regole servono prima che esista una partita).
- **Il minimo di 10 crediti del modulo** non esiste nel server (la quota va da 1 a 10.000): sparisce, vale il limite del server.

## Dati e caricamento

- **Backend:** in `backend/src/services/game.service.js`, `gameViewFor` aggiunge `settings: settingsOfGame(game)`. Un test nel `game.visibility.test.js` e uno su `gameViewFor` controllano che ci sia e che non compaiano `mazzo` né la cartella di un altro giocatore.
- **Servizio** `frontend/src/services/settingsService.js`: `getSettings()` chiama `GET /api/settings` e restituisce `{ values, limits, defaults }`.
- **Slice** `frontend/src/store/slices/settingsSlice.js`: stato `{ values, limits, status, error }`, con `status` fra `idle`, `loading`, `ready` ed `error`; thunk `fetchSettings`. Conta solo l'ultima richiesta (le risposte vecchie non sovrascrivono le nuove). Si svuota all'uscita dell'account.
- **Quando si carica:**
  - dopo il login, la registrazione o il ripristino della sessione, in `enterGameOrHall` (`store/sessionThunks.js`), senza bloccare l'ingresso;
  - quando si apre la Hall e quando si apre il modulo «Crea partita», così un valore cambiato dall'admin si vede senza ricaricare la pagina;
  - `RegoleScreen` li carica se mancano.
- **Client dell'API** (`services/api.js`): l'errore del server porta anche `retryAfter` quando c'è.

## Schermate

**Modulo «Crea partita» (`HallScreen.jsx`)**
- Massimo di giocatori: `min` e `max` da `values.minPlayers` e `values.maxPlayers`, suggerimento «Da {min} a {max} giocatori», valore iniziale `values.maxPlayers` (non più 6).
- Quota: `min` e `max` da `limits.requiredCredits`, suggerimento «Da {min} a {max} crediti», valore iniziale il più basso fra `values.requiredCredits` e i crediti del giocatore (mai sotto il minimo). Il minimo di 10 crediti sparisce.
- Gli errori di validazione usano gli stessi numeri. «Crea partita» è disattivato finché i parametri non sono pronti; se la lettura è fallita compare il messaggio con «Riprova».

**Sala d'attesa (`LobbyScreen.jsx`):** «Servono almeno {minPlayers} giocatori» da `game.settings`; il contatore usa il `maxPlayers` della partita, senza il ripiego `|| 10`.

**Partita, barra d'azione e attesa (`GameScreen.jsx`, `BarraAzione.jsx`, `gameSlice.js`)**
- Dopo un'estrazione il conto parte da `game.settings.drawCooldownSeconds` (non più 8). La barra di avanzamento usa lo stesso numero come totale, passato come prop; `COOLDOWN_SECONDS` sparisce.
- Il `429` fa ripartire il conto da `retryAfter` e il messaggio dice «Attendi N secondi prima di estrarre un'altra carta». Il client si riallinea al server da solo, anche se il pulsante si riattiva troppo presto dopo una pausa del Jolly.
- In modalità a turno non cambia nulla: l'attesa arriva dal server (`turno.attesaIn`).

**Jolly (`ConteggioJolly.jsx`):** riceve la durata da `game.settings.jollyHoldSeconds` come prop per limitare il conto; l'export `SECONDI_PAUSA_JOLLY` sparisce.

**Regole (`RegoleGioco.jsx`, `RegoleScreen.jsx`, `CollezioniPanel.jsx`):** «Si gioca da {min} a {max}» e «almeno {n} secondi tra una e l'altra» vengono dai parametri: in partita quelli della partita, nella schermata iniziale quelli del server. Se non sono disponibili, le frasi si leggono senza numeri («il numero di giocatori lo decide chi gestisce il gioco»).

**Traduzioni degli errori (`utils/errors.utils.js`):** «Wait N seconds before drawing» → «Attendi N secondi prima di estrarre un'altra carta»; «maxPlayers must be from N to M» → «Da N a M giocatori».

## Errori e casi limite

- Lettura non riuscita: lo slice va in `error` col messaggio già tradotto; il modulo e le Regole mostrano il messaggio con «Riprova». Se ci sono valori letti prima, restano quelli e l'errore non appare.
- Una partita senza `game.settings` (non dovrebbe succedere): nessun conto alla rovescia del client, senza inventare un numero; il pulsante resta attivo e il `429` riallinea il conto.
- Un `429` senza `retryAfter`: si mostra il messaggio e non si inventa il tempo.
- Modulo aperto mentre l'admin cambia un valore: quello che l'utente ha scritto resta, la validazione all'invio usa i limiti nuovi, e un `400` del server è tradotto in italiano.

## Test

- **Backend:** la vista della partita contiene `settings` (anche per una partita salvata senza copia) e non contiene `mazzo` né la cartella altrui.
- **Frontend (Vitest):** `settingsService`; slice (stati, ultima richiesta che vince, svuotamento all'uscita); `enterGameOrHall` che lancia la lettura; modulo «Crea partita» (limiti e suggerimento dal server, valori iniziali, pulsante disattivato in caricamento o errore, «Riprova», messaggi di validazione, valori che cambiano dopo la rilettura); sala d'attesa (minimo da `game.settings`, niente ripiego a 10); `drawCard` (conto da `game.settings.drawCooldownSeconds`, `429` che lo riparte da `retryAfter`); `BarraAzione` (totale dalla prop); `ConteggioJolly` (durata dalla prop); `RegoleGioco` (frasi con e senza numeri); traduzioni degli errori; `api.js` porta `retryAfter`.
- **End-to-end:** a 320 e 180 px il modulo mostra i valori del server, senza scorrimento orizzontale e con i controlli da 44 px. Un test con admin (serve PostgreSQL, `E2E_DATABASE_URL`: senza, salta) cambia `maxPlayers` e vede «Da 2 a N giocatori», poi ripristina il valore. Gli e2e esistenti che contano sui vecchi valori della Hall (6 giocatori, minimo 10 crediti) si aggiornano.
- **Verifica «niente a mano»:** una ricerca nel codice del frontend, esclusi i test, di `COOLDOWN_SECONDS`, `SECONDI_PAUSA_JOLLY`, «Da 2 a 10» e del 6 iniziale non trova più nulla. È una verifica, non un test.
- **Prima di chiudere:** suite del frontend e del backend, lint, e gli e2e dell'interfaccia in locale.

## Documentazione

`README.md` (le funzioni), `docs/GAME_DESIGN.md` («Game settings»: il frontend le legge e il `429`), `frontend/README.md` (servizio e slice), `TEST_SUITE.md` (cosa copre). Poi `node .claude/skills/controllo-documentazione-release/scripts/check-docs.mjs` deve dare 0 errori.

## Criteri di accettazione (dalla #118)

- Nessun valore (2–10, 8 s, 30 s, 100) resta scritto a mano nel frontend (ricerca nel codice).
- Cambiando i parametri dal server, il modulo e le regole mostrano i nuovi valori.
- Test del frontend ed end-to-end, anche a 320 e 180 px.
- Se la lettura dei parametri fallisce: messaggio chiaro e «Riprova», mai valori inventati.
