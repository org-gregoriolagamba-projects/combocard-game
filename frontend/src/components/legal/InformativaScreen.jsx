/**
 * InformativaScreen
 *
 * The privacy notice (art. 13 GDPR), in plain words. Every sentence is about what the app really
 * does: the data are the ones of the database (`players`, `credit_transactions`, `user_accounts`,
 * `audit_log`) and of the server logs; what remains after the deletion of an account is what
 * `deleteAccount` of the store leaves. When the app changes what it keeps, change this text and
 * the version in `config/legale.js` (and `backend/src/config/legale.js`).
 */

import React from "react";
import { LEGALE } from "../../config/legale";
import Dato from "./Dato";
import LegalLayout, { Sezione, LinkTesto } from "./LegalLayout";

function InformativaScreen() {
  return (
    <LegalLayout titolo="Informativa sulla privacy">
      <p>
        Questa informativa spiega quali dati personali tratta ComboCard, perché e per quanto tempo, e
        come puoi far valere i tuoi diritti. È scritta in modo semplice: se qualcosa non è chiaro,
        scrivici.
      </p>

      <Sezione titolo="Chi è il titolare">
        <p>
          Il titolare del trattamento è {LEGALE.titolare}, persona fisica, che ha creato e gestisce ComboCard.
          Per qualsiasi domanda sui tuoi dati scrivi a <Dato valore={LEGALE.emailPrivacy} />.
        </p>
      </Sezione>

      <Sezione titolo="Quali dati trattiamo">
        <ul>
          <li>
            Il <strong>nome utente</strong> che scegli: lo vedono gli altri giocatori delle partite a cui partecipi e, per chi
            apre una partita in attesa, chiunque sia nella hall.
          </li>
          <li>
            La <strong>password</strong>: la conserviamo solo come impronta cifrata (hash), mai in chiaro. Nessuno,
            nemmeno chi gestisce il gioco, può leggerla.
          </li>
          <li>
            Il <strong>ruolo</strong> (giocatore o amministratore), lo stato dell&apos;account (attivo o sospeso) e la data di
            creazione dell&apos;account.
          </li>
          <li>
            I <strong>crediti</strong> di gioco e i loro movimenti: il saldo, i crediti presi, le quote d&apos;ingresso, i premi e i
            rimborsi.
          </li>
          <li>Le <strong>partite</strong> e le <strong>statistiche</strong>: le partite giocate, le collezioni vinte, gli importi.</li>
          <li>
            Il <strong>registro delle operazioni</strong>: se un amministratore interviene sul tuo account (per esempio una
            sospensione o una rettifica dei crediti), o se tu cambi la password o elimini l&apos;account, resta una riga con
            chi, che cosa, quando e, per l&apos;amministrazione, il perché. Non contiene mai la tua password.
          </li>
          <li>La <strong>data e la versione</strong> dei termini d&apos;uso che hai accettato, e la data in cui hai confermato di aver letto le regole.</li>
          <li>
            I <strong>messaggi che ci scrivi</strong> (a {LEGALE.emailPrivacy ?? "…"} o all&apos;indirizzo generale del servizio), con l&apos;indirizzo
            da cui li mandi: restano nella casella di posta, ospitata da un fornitore (vedi «A chi li comunichiamo»), per il tempo
            che serve a risponderti.
          </li>
          <li>
            Le <strong>sessioni aperte</strong> sui tuoi dispositivi, che teniamo come identificativi cifrati, e un
            <strong> cookie di sessione</strong>, tecnico, che serve a tenerti collegato (vedi «Cookie»).
          </li>
          <li>
            I <strong>dati tecnici dei log del server</strong>: per ogni richiesta, l&apos;indirizzo IP, la data e l&apos;ora, l&apos;indirizzo
            richiesto, l&apos;esito, il programma di navigazione e la pagina di provenienza. Il server usa l&apos;indirizzo IP anche per
            limitare le richieste troppo frequenti: questo conteggio resta in memoria e non viene salvato.
          </li>
        </ul>
        <p>Non raccogliamo altri dati: niente telefono, posizione, contatti o dati di pagamento.</p>
      </Sezione>

      <Sezione titolo="Perché e su quale base">
        <ul>
          <li>
            <strong>Per darti il servizio</strong> (creare l&apos;account, farti giocare, tenere i crediti): è necessario per
            eseguire i termini d&apos;uso che accetti (art. 6.1.b GDPR). Senza questi dati non possiamo offrirti il gioco.
          </li>
          <li>
            <strong>Per la sicurezza</strong> (registro dell&apos;amministrazione, log, limite delle richieste): è un interesse
            legittimo del titolare (art. 6.1.f GDPR), quello di proteggere il servizio e gli altri giocatori dagli abusi.
          </li>
        </ul>
        <p>Non usiamo i dati per pubblicità né per profilarti, e non prendiamo decisioni con processi automatici su di te.</p>
      </Sezione>

      <Sezione titolo="Per quanto tempo li conserviamo">
        <ul>
          <li>L&apos;<strong>account</strong>, finché non lo elimini tu (dall&apos;app) o lo elimina l&apos;amministrazione.</li>
          <li>
            Quando un account viene eliminato cancelliamo il nome utente, la password e le sessioni, e il tuo nome diventa
            «Utente eliminato». Il saldo si azzera, senza rimborso. Restano, <strong>senza il tuo nome</strong>, i movimenti
            dei crediti, le partite concluse, il registro delle operazioni, la data di creazione dell&apos;account e le date e la versione
            delle accettazioni: servono a tenere corretti i conti e le partite degli altri giocatori e alla sicurezza, e li
            teniamo finché servono alla gestione del servizio (non c&apos;è una scadenza prestabilita). I motivi scritti a mano
            dall&apos;amministrazione nel registro restano com&apos;erano.
          </li>
          <li>
            I <strong>log del server</strong> (indirizzo IP, data e ora, indirizzo richiesto e esito di ogni richiesta), sul fornitore di
            hosting: <Dato valore={LEGALE.conservazioneLog} />.
          </li>
          <li>
            Il <strong>traffico che passa dalla rete</strong> (DNS, HTTPS, cache): <Dato valore={LEGALE.conservazioneCloudflare} />.
          </li>
          <li>
            Le <strong>copie e la cronologia del database</strong>, per ripristinarlo in caso di errore: <Dato valore={LEGALE.conservazioneBackup} />.
          </li>
          <li>
            Il <strong>registro delle operazioni</strong>, che teniamo finché serve alla gestione del servizio: non contiene mai né password né nomi
            utente degli account eliminati.
          </li>
          <li>
            Il <strong>cookie di sessione</strong>: dura 7 giorni dall&apos;ultimo utilizzo (a ogni uso si rinnova) o fino a quando
            esci.
          </li>
        </ul>
      </Sezione>

      <Sezione titolo="A chi li comunichiamo">
        <p>Per far funzionare il servizio ci appoggiamo a fornitori che trattano i dati per nostro conto:</p>
        <ul>
          {LEGALE.fornitori.map((f) => (
            <li key={f.nome}>
              <strong>{f.nome}</strong> ({f.societa}, {f.paese}): {f.ruolo}
              {f.dove ? `; ${f.dove}` : ""}.
            </li>
          ))}
        </ul>
        <p>
          <strong>Fuori dallo Spazio economico europeo.</strong> Alcuni di questi fornitori sono società degli Stati Uniti: anche
          quando i dati stanno su server in Germania, la società che li gestisce è statunitense, e il suo personale può accedervi per
          far funzionare il servizio e dare assistenza (Render scrive nel suo contratto che la sua attività principale di trattamento
          si svolge negli Stati Uniti). Per questi trasferimenti i loro contratti prevedono come garanzia la certificazione
          all&apos;EU-U.S. Data Privacy Framework (che la Commissione europea riconosce come adeguato) e, se non si applica, le clausole
          contrattuali standard della Commissione europea. Cloudflare tratta il traffico, compreso l&apos;indirizzo IP, nella sua rete in
          tutto il mondo.
          Come ciascuno li descrive:{" "}
          {LEGALE.fornitori
            .filter((f) => f.fuoriSee && f.documento)
            .map((f, i, tutti) => (
              <React.Fragment key={f.nome}>
                <a href={f.documento} className="font-bold text-testo underline decoration-2 underline-offset-4">
                  {f.nome}
                </a>
                {i < tutti.length - 1 ? ", " : "."}
              </React.Fragment>
            ))}
        </p>
        <p>
          Non vendiamo i dati e non li diamo ad altri, salvo obblighi di legge. Il tuo nome utente è visibile agli altri giocatori
          delle tue partite.
        </p>
      </Sezione>

      <Sezione titolo="I tuoi diritti">
        <p>
          Puoi chiederci di accedere ai tuoi dati, correggerli, cancellarli, limitarne l&apos;uso, riceverli in un formato
          leggibile (portabilità) e opporti al trattamento (artt. 15-22 GDPR). Scrivi a <Dato valore={LEGALE.emailPrivacy} />: ti
          rispondiamo entro un mese. Puoi anche eliminare l&apos;account da solo, dalla hall, con «Elimina il mio account» (o
          dalla schermata «Prima di continuare»). Non è possibile mentre sei in una partita in attesa o in corso: prima la
          lasci o aspetti che finisca.
        </p>
        <p>
          Se ritieni che i tuoi dati non siano trattati correttamente puoi fare reclamo al Garante per la protezione dei dati
          personali (www.garanteprivacy.it).
        </p>
      </Sezione>

      <Sezione titolo="Cookie">
        <p>
          ComboCard usa <strong>un solo cookie</strong>, tecnico e necessario: tiene aperta la tua sessione, ti permette di
          riprendere dopo aver ricaricato la pagina e non può essere letto dagli script della pagina. Il browser conserva anche
          <strong> due preferenze tecniche</strong> sul tuo dispositivo (se hai già letto la guida della prima partita e se hai
          disattivato i suoni), che non vengono mai inviate a noi. Non usiamo cookie di profilazione né di statistica, quindi
          non serve alcun avviso da accettare.
        </p>
      </Sezione>

      <p>
        Leggi anche i <LinkTesto a="termini">Termini d&apos;uso</LinkTesto>.
      </p>
    </LegalLayout>
  );
}

export default InformativaScreen;
