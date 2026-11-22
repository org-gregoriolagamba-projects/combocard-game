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
import { CONTATTI } from "../../config/contatti";
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
          Per qualsiasi domanda sui tuoi dati scrivi a <Dato valore={CONTATTI.email} />.
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
            teniamo senza una scadenza prestabilita. I motivi scritti a mano dall&apos;amministrazione nel registro restano
            com&apos;erano.
          </li>
          <li>
            I <strong>log del server</strong>: <Dato valore={LEGALE.conservazioneLog} />.
          </li>
          <li>
            Il <strong>cookie di sessione</strong>: dura 7 giorni dall&apos;ultimo utilizzo (a ogni uso si rinnova) o fino a quando
            esci.
          </li>
        </ul>
      </Sezione>

      <Sezione titolo="A chi li comunichiamo">
        <p>
          I dati sono ospitati da <Dato valore={LEGALE.hosting.nome} /> (<Dato valore={LEGALE.hosting.paese} />), che li tratta
          per nostro conto come fornitore del servizio di hosting. Non vendiamo i dati e non li diamo ad altri, salvo
          obblighi di legge. Il tuo nome utente è visibile agli altri giocatori delle tue partite.
        </p>
      </Sezione>

      <Sezione titolo="I tuoi diritti">
        <p>
          Puoi chiederci di accedere ai tuoi dati, correggerli, cancellarli, limitarne l&apos;uso, riceverli in un formato
          leggibile (portabilità) e opporti al trattamento (artt. 15-22 GDPR). Scrivi a <Dato valore={CONTATTI.email} />: ti
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
