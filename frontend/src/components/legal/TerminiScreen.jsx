/**
 * TerminiScreen
 *
 * The terms of use. The player accepts them at the registration (or, if the account is older, on
 * the first access after they were published). When they change in an important way, change the
 * version in `config/legale.js` (and `backend/src/config/legale.js`): everybody accepts again.
 */

import React from "react";
import { LEGALE } from "../../config/legale";
import { CONTATTI, CREDITI_MAZZO } from "../../config/contatti";
import LegalLayout, { Sezione, LinkTesto } from "./LegalLayout";

function TerminiScreen() {
  return (
    <LegalLayout titolo="Termini d'uso">
      <p>
        Questi termini regolano l&apos;uso di ComboCard, il gioco di carte napoletane da giocare con gli amici. Registrandoti
        dichiari di averli letti e li accetti.
      </p>

      <Sezione titolo="Chi può giocare">
        <p>
          ComboCard è per persone che hanno almeno {LEGALE.etaMinima} anni. Registrandoti dichiari di averli. L&apos;account è
          personale: non condividere la password con altri.
        </p>
      </Sezione>

      <Sezione titolo="I crediti">
        <p>
          I crediti sono <strong>di gioco</strong>, senza valore reale: non si comprano con denaro, non si possono convertire
          in denaro e sono <strong>non rimborsabili</strong>. Servono solo a pagare l&apos;ingresso nelle partite e a ricevere i
          premi. Se elimini l&apos;account il saldo si azzera, senza rimborso.
        </p>
      </Sezione>

      <Sezione titolo="Sospensione ed eliminazione">
        <p>
          L&apos;amministrazione può sospendere o eliminare un account e annullare una partita (con la restituzione delle quote
          d&apos;ingresso) quando ci sono comportamenti non ammessi: imbrogliare o cercare di aggirare le regole, usare più
          account, disturbare o attaccare il servizio o gli altri giocatori, scegliere un nome utente offensivo. Puoi eliminare
          il tuo account dalla hall, tranne mentre sei in una partita in attesa o in corso: prima la lasci o aspetti che finisca.
        </p>
      </Sezione>

      <Sezione titolo="Licenza e responsabilità">
        <p>
          ComboCard è un software con una licenza per uso personale ed educativo, senza scopi commerciali (il testo è nel file
          LICENSE del{" "}
          <a href={CONTATTI.repository} className="font-bold text-testo underline decoration-2 underline-offset-4">
            repository
          </a>
          ). Il gioco è offerto «così com&apos;è», senza garanzie: nei limiti consentiti dalla legge, il titolare non risponde di
          interruzioni del servizio né della perdita di crediti di gioco o di dati.
        </p>
        <p>
          Se i termini cambiano in modo importante ti chiederemo di accettarli di nuovo. Come trattiamo i tuoi dati è spiegato
          nell&apos;<LinkTesto a="informativa">informativa sulla privacy</LinkTesto>.
        </p>
      </Sezione>

      <Sezione titolo="Crediti delle illustrazioni">
        <p>
          Le carte e i semi derivano da un {CREDITI_MAZZO.descrizione} ({CREDITI_MAZZO.fonte}), di pubblico dominio. I
          dettagli sono nel file{" "}
          <a href={CREDITI_MAZZO.url} className="font-bold text-testo underline decoration-2 underline-offset-4">
            della fonte
          </a>{" "}
          e in <code>frontend/public/carte/CREDITI.md</code>.
        </p>
      </Sezione>
    </LegalLayout>
  );
}

export default TerminiScreen;
