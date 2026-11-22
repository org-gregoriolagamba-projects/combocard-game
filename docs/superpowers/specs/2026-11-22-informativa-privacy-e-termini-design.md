# Informativa privacy e termini d'uso

Issue #116. Branch `feature/informativa-privacy-e-termini`.

## Obiettivo

L'app tratta dati personali (nome utente, password, crediti, partite) e non ha né un'informativa né dei termini d'uso. Questa attività scrive i due testi, li rende raggiungibili da chiunque (anche senza accesso) e registra l'accettazione dei termini, con data e versione, alla registrazione e per chi è già registrato.

**Fuori da questa attività:**
- la revisione legale del testo (il testo è scritto per essere corretto rispetto a ciò che l'app fa, ma non sostituisce un parere professionale);
- le e-mail e il fornitore di invio (#44: la #44 aggiornerà l'informativa e cambierà la versione);
- un avviso sui cookie (il cookie è solo tecnico: sessione);
- la pubblicazione, che aspetta il dominio (vedi «Prima di pubblicare»).

## Decisioni già prese

- **Titolare del trattamento:** Gregorio La Gamba, come persona.
- **E-mail di contatto:** una e-mail del dominio su cui verrà pubblicato il sito, non un indirizzo provvisorio (commento sulla #116). Finché il dominio non c'è, il valore non è impostato.
- **Dove vive il testo:** due schermate dell'app, pubbliche, con il contenuto in componenti (come `RegoleGioco`), non in un documento in `docs/` che l'app mostri.
- **Accettazione:** casella obbligatoria alla registrazione; per chi è già registrato, schermata «Prima di continuare» al prossimo accesso. L'accettazione ha una **versione**: se i testi cambiano in modo importante si cambia versione e tutti riaccettano.
- **Dati dell'accettazione di un account eliminato:** si tengono come traccia. Il nome è già anonimizzato (#93) e le due colonne restano sulla riga del giocatore.

## Natura dell'accettazione

L'informativa **informa**: non richiede consenso, perché la base giuridica è l'esecuzione del servizio. I termini si **accettano**. La casella dice quindi «Ho letto l'informativa sulla privacy e accetto i termini d'uso», con i due collegamenti, e il server registra una sola accettazione.

## Dati

**Migrazione `backend/db/migrations/012_terms_acceptance.sql`**
- `ALTER TABLE players ADD COLUMN terms_accepted_at TIMESTAMPTZ` e `terms_version TEXT`.
- `NULL` significa «mai accettato»: gli account esistenti partono da `NULL` e accettano al prossimo accesso, come per `rules_accepted_at` (migrazione 003).

**Giocatore in memoria:** `terminiAccettatiIl` (ISO o `null`) e `terminiVersione` (stringa o `null`), caricati da `loadState` come `regoleAccettateIl`.

**Versione corrente:** una costante per lato, con lo stesso valore.
- Backend: `backend/src/config/legale.js` (`TERMS_VERSION`).
- Frontend: `frontend/src/config/legale.js` (`versione`, accanto ai valori dei testi).
- Il controllo di allineamento sta nello script di controllo della documentazione (errore se i due valori sono diversi) e nel test e2e di registrazione, che passa solo se coincidono.

**Cosa deve restare impostato prima di pubblicare** (tutti in `frontend/src/config/legale.js`, tranne l'e-mail, che resta in `contatti.js`):

| Valore | Da dove viene | Oggi |
|---|---|---|
| `CONTATTI.email` | dominio | `null` |
| `hosting` (nome e paese) | scelta dell'hosting | `null` |
| `conservazioneLog` | scelta | `null` |
| `vigenteDal` (data) | giorno della pubblicazione | `null` |

Con un valore non impostato la schermata mostra un segnaposto ben visibile, «[da indicare]», così non passa inosservato.

## Server

- **`POST /api/players/:playerId/accept-terms`**, dietro `requireAuth` e `requireSelf`, con corpo `{ version }` convalidato da uno schema. Se `version` non è `TERMS_VERSION` risponde `409` (chi ha visto un testo vecchio non lo accetta). Se è già accettata quella versione, risponde allo stesso modo senza riscrivere (una ripetizione è innocua, come per le regole).
- **Registrazione:** lo schema `registerSchema` richiede `acceptTerms: true` e `termsVersion` uguale a quella corrente. Senza, `400`. Il giocatore nasce già con le due colonne scritte, nella stessa operazione che crea l'account (`createAccount`).
- **Persistenza (CLAUDE.md):** ogni scrittura passa da `req.store`, con un metodo nuovo `recordTermsAccepted(playerId, isoDate, version)` nello store in memoria (no-op, come `recordRulesAccepted`) e in quello PostgreSQL. Se il salvataggio fallisce, il valore in memoria torna com'era e la risposta è `503`, come in `acceptRules`.
- **Vista del giocatore:** `terminiDaAccettare` (booleano calcolato dal server: `terminiVersione !== TERMS_VERSION`), accanto a `regoleAccettateIl`. Nessun dato di altri giocatori cambia visibilità.
- **Applicazione lato server:** finché `terminiDaAccettare` è vero, `POST /api/games`, `POST /api/games/:id/join` e `POST /api/players/:id/buy-credits` rispondono `403` con codice `TERMS_REQUIRED`. Chi è già dentro una partita non viene interrotto. Senza questo blocco un client potrebbe saltare la schermata.
- **Eliminazione dell'account:** non tocca le due colonne (da provare con un test).

## Frontend

- **Schermate** `InformativaScreen` e `TerminiScreen`, in `components/legal/`, con il testo in componenti e il valore dei campi da `config/legale.js`. Pagina intera sul telefono, pulsante «Indietro» che torna alla schermata di provenienza (`uiSlice`: schermata e ritorno). Funzionano senza accesso (`AppContent` le mostra prima del controllo di `playerId`).
- **Footer:** «Informativa» e «Termini», accanto a «Info e contatti», sulla schermata di accesso e nella hall.
- **Registrazione (`HomePage`):** casella obbligatoria con i due collegamenti; senza spunta il pulsante resta com'è ma l'invio mostra l'errore sotto la casella e sposta il fuoco lì. `authService.register` invia `acceptTerms` e `termsVersion`.
- **Accettazione per gli esistenti:** `TerminiGate`, schermata «Prima di continuare», con i due collegamenti, la casella e il pulsante, e «Esci» come in `RegoleScreen`. Ordine in `AppContent`: password provvisoria, **accettazione**, regole. Gli stati sono in `playerSlice` (`terminiDaAccettare`, thunk `acceptTerms`).
- Un giocatore dentro una partita che ricarica la pagina dopo la pubblicazione vede la schermata e poi ritrova la partita: la partita non si ferma.

## Contenuto dei testi

**Informativa (art. 13 GDPR), in italiano semplice**
- Titolare e contatto.
- Dati trattati: nome utente, password (solo come hash), ruolo, crediti e movimenti, partite e statistiche, registro delle azioni degli amministratori, cookie di sessione (tecnico), log del server.
- Finalità e base giuridica: esecuzione del servizio (art. 6.1.b) per account e gioco; interesse legittimo alla sicurezza (art. 6.1.f) per registro e log.
- Conservazione: l'account finché esiste; dopo l'eliminazione restano, **senza il nome** («Utente eliminato»), i movimenti dei crediti, le partite concluse e il registro, e le due date di accettazione; log secondo `conservazioneLog`.
- Destinatari: il fornitore di hosting (`hosting`). Nessuna vendita né pubblicità.
- Diritti degli artt. 15–22, come esercitarli (scrivere al contatto, o eliminare l'account dall'app) e reclamo al Garante.
- Nessun avviso sui cookie: è solo tecnico.

**Termini**
- I crediti sono di gioco, senza valore reale, non rimborsabili; l'eliminazione chiude il saldo senza rimborso.
- Sospensione ed eliminazione da parte dell'amministrazione, comportamenti non ammessi.
- Licenza d'uso personale ed educativo (`LICENSE`) ed esclusione di responsabilità.
- Crediti delle illustrazioni (`frontend/public/carte/CREDITI.md`).
- Età minima: **da confermare** (proposta: 14 anni, la soglia italiana per il consenso digitale). Il valore si decide prima di scrivere i testi e va in `legale.js`.

Ogni affermazione dei testi va controllata contro il codice (per esempio la conservazione dopo l'eliminazione contro `deleteAccount`), non scritta a memoria.

## Prima di pubblicare

- Lo script `check-docs.mjs` ha un'opzione `--release`: senza, i valori non impostati di `legale.js` e `contatti.js` sono avvisi; con `--release` sono **errori**. La release (`CONTRIBUTING.md`, skill di controllo, modello della release) la lancia con `--release`: non si pubblica con un segnaposto.
- Nelle note di rilascio della versione che la include, dire che gli utenti esistenti vedono una schermata di accettazione al prossimo accesso.
- Revisione legale del testo, a carico di chi pubblica.

## Prove

- **Backend:** schema di registrazione (con e senza `acceptTerms`, versione sbagliata), `accept-terms` (prima volta, ripetizione, versione vecchia `409`), blocco `403 TERMS_REQUIRED` su creazione, ingresso e acquisto, fallimento del salvataggio (`503`, il valore in memoria non cambia), visibilità del giocatore, store in memoria e PostgreSQL (migrazione, `loadState`, eliminazione dell'account che lascia le colonne).
- **Frontend:** casella e errore alla registrazione, `TerminiGate` e ordine in `AppContent`, schermate pubbliche e «Indietro», collegamenti del footer, segnaposto con valori non impostati.
- **E2E:** la registrazione non passa senza casella; un account esistente (senza accettazione) vede la schermata una volta sola; le due schermate si aprono senza accesso. Il test di registrazione verifica anche che le due versioni coincidano.
- **Script di controllo:** prove di `--release` e dell'allineamento delle versioni.

## Documenti da aggiornare

`docs/AUTH.md` (registrazione e `accept-terms`), `docs/DATABASE.md` (le due colonne), `docs/GAME_DESIGN.md` (flusso di registrazione e accettazione), `README.md` (rotta), `docs/DEPLOYMENT.md` (valori da impostare prima di pubblicare), `CONTRIBUTING.md` e la skill di controllo (opzione `--release`), modello della release.

## Da decidere durante il piano

- Età minima (proposta: 14 anni).
- Dove stanno i due testi nei file, se in un solo modulo o in due.
