/**
 * AvvisiPanel Component
 *
 * The announcement for all the players and the maintenance mode. The announcement is text only (never HTML),
 * one at a time: publishing a new one replaces the previous one; it can have a start and an end. The maintenance
 * stops what is new (registration, new games) and lets the games in progress finish; the time of its end is only
 * an information for the players. The server decides what is allowed.
 */

import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import { Button, Input } from "../common";
import { adminService } from "../../services";
import { addToast } from "../../store/slices/uiSlice";

const MESSAGE_MAX = 280;

// The fields of the form hold "2026-12-01T10:00" (local time): the server wants a date
const dataISO = (testo) => (testo === "" ? undefined : new Date(testo).toISOString());

const campo =
  "w-full rounded-xl border border-linea-forte bg-notte-950 px-4 py-3 text-testo placeholder:text-testo-3 focus:outline-none focus:ring-2 focus:ring-oro";

function AvvisiPanel({ onForbidden }) {
  const dispatch = useDispatch();
  const [reloads, setReloads] = useState(0);
  const [notices, setNotices] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [testo, setTesto] = useState("");
  const [gravita, setGravita] = useState("info");
  const [inizio, setInizio] = useState("");
  const [fine, setFine] = useState("");
  const [erroriAvviso, setErroriAvviso] = useState({});
  const [erroreAvviso, setErroreAvviso] = useState(null);

  const [messaggio, setMessaggio] = useState("");
  const [fineManutenzione, setFineManutenzione] = useState("");
  const [erroreMessaggio, setErroreMessaggio] = useState(null);
  const [erroreManutenzione, setErroreManutenzione] = useState(null);

  const [sending, setSending] = useState(false);
  // A double tap must not send it twice: the ref answers at once, the state would not
  const inFlight = useRef(false);

  useEffect(() => {
    let current = true;
    adminService
      .getNotices()
      .then((result) => {
        if (current) {
          setNotices(result);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!current) {
          return;
        }
        if (err.status === 403) {
          onForbidden();
        } else {
          setLoadError(err.message);
        }
      });
    return () => {
      current = false;
    };
  }, [reloads, onForbidden]);

  if (loadError && !notices) {
    return (
      <div className="space-y-3">
        <p role="alert" className="font-bold text-coppe [overflow-wrap:anywhere]">{loadError}</p>
        <Button type="button" variant="secondary" onClick={() => setReloads((n) => n + 1)}>Riprova</Button>
      </div>
    );
  }

  if (!notices) {
    return <p role="status" className="text-testo-2">Caricamento degli avvisi…</p>;
  }

  const { announcement, maintenance } = notices;

  // Runs a change on the server once at a time; the answer of the server is the new state
  const esegui = async (azione, onError, messaggioOk) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSending(true);
    onError(null);
    try {
      const result = await azione();
      setNotices({ announcement: result.announcement, maintenance: result.maintenance });
      dispatch(addToast({ message: messaggioOk, type: "success" }));
      return result;
    } catch (err) {
      if (err.status === 403) {
        onForbidden();
      } else {
        onError(err.message);
      }
      return undefined;
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const pubblica = async (event) => {
    event?.preventDefault();
    const problemi = {};
    if (testo.trim() === "") {
      problemi.testo = "Scrivi il testo dell'avviso";
    }
    if (inizio !== "" && fine !== "" && new Date(fine) <= new Date(inizio)) {
      problemi.fine = "La fine deve essere dopo l'inizio";
    }
    setErroriAvviso(problemi);
    if (Object.keys(problemi).length > 0) {
      return;
    }
    const result = await esegui(
      () => adminService.publishAnnouncement({ message: testo.trim(), severity: gravita, startsAt: dataISO(inizio), endsAt: dataISO(fine) }),
      setErroreAvviso,
      "Avviso pubblicato",
    );
    if (result) {
      setTesto("");
      setInizio("");
      setFine("");
    }
  };

  const ritira = () => esegui(() => adminService.withdrawAnnouncement(), setErroreAvviso, "Avviso ritirato");

  const accendi = async (event) => {
    event?.preventDefault();
    if (messaggio.trim() === "") {
      setErroreMessaggio("Scrivi il messaggio per i giocatori");
      return;
    }
    setErroreMessaggio(null);
    const result = await esegui(
      () => adminService.setMaintenance({ active: true, message: messaggio.trim(), endsAt: dataISO(fineManutenzione) }),
      setErroreManutenzione,
      "Manutenzione accesa",
    );
    if (result) {
      setMessaggio("");
      setFineManutenzione("");
    }
  };

  const spegni = () => esegui(() => adminService.setMaintenance({ active: false }), setErroreManutenzione, "Manutenzione spenta");

  return (
    <div className="space-y-8">
      <form noValidate onSubmit={pubblica} className="space-y-4" aria-labelledby="avviso-titolo">
        <h2 id="avviso-titolo" className="titolo text-xl text-testo">Avviso a tutti i giocatori</h2>
        <p className="text-sm text-testo-2 [overflow-wrap:anywhere]">
          {announcement.active
            ? `Avviso attivo (versione ${announcement.version}): «${announcement.message}»`
            : "Nessun avviso attivo"}
        </p>
        <p className="text-sm text-testo-2">
          Un solo avviso alla volta: pubblicarne uno sostituisce il precedente. È solo testo. Chi lo chiude non lo
          rivede finché non ne pubblichi un altro.
        </p>

        <div>
          <label htmlFor="avviso-testo" className="mb-2 block text-sm font-bold text-testo">Testo dell&apos;avviso</label>
          <textarea
            id="avviso-testo"
            rows={3}
            maxLength={MESSAGE_MAX}
            value={testo}
            onChange={(e) => {
              setTesto(e.target.value);
              setErroriAvviso((c) => ({ ...c, testo: undefined }));
            }}
            aria-invalid={erroriAvviso.testo ? true : undefined}
            className={campo}
            disabled={sending}
          />
          <p className="mt-1 text-right text-xs text-testo-2" aria-live="polite">{`${testo.length}/${MESSAGE_MAX}`}</p>
          {erroriAvviso.testo && <p role="alert" className="mt-1 text-sm font-bold text-coppe">{erroriAvviso.testo}</p>}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-bold text-testo">Gravità</legend>
          {[["info", "Informativo"], ["importante", "Importante"]].map(([valore, etichetta]) => (
            <label key={valore} className="flex min-h-[44px] items-center gap-3 text-testo">
              <input type="radio" name="gravita" value={valore} checked={gravita === valore} onChange={() => setGravita(valore)} className="h-5 w-5" />
              {etichetta}
            </label>
          ))}
        </fieldset>

        <Input label="Inizio (facoltativo)" type="datetime-local" value={inizio} onChange={(e) => setInizio(e.target.value)} disabled={sending} />
        <Input
          label="Fine (facoltativa)"
          type="datetime-local"
          value={fine}
          onChange={(e) => {
            setFine(e.target.value);
            setErroriAvviso((c) => ({ ...c, fine: undefined }));
          }}
          error={erroriAvviso.fine}
          disabled={sending}
        />

        {erroreAvviso && <p role="alert" className="text-sm font-bold text-coppe [overflow-wrap:anywhere]">{erroreAvviso}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={sending}>Pubblica</Button>
          <Button type="button" variant="secondary" disabled={sending || !announcement.active} onClick={ritira}>Ritira</Button>
        </div>
      </form>

      <form noValidate onSubmit={accendi} className="space-y-4 border-t border-linea pt-6" aria-labelledby="manutenzione-titolo">
        <h2 id="manutenzione-titolo" className="titolo text-xl text-testo">Manutenzione</h2>
        <p className="text-sm text-testo-2 [overflow-wrap:anywhere]">
          {maintenance.active ? `Manutenzione accesa: «${maintenance.message}»` : "Manutenzione spenta"}
        </p>
        <p className="text-sm text-testo-2">
          Con la manutenzione accesa nessuno si registra e nessuno crea o entra in una partita; le partite già iniziate
          continuano e tu lavori come sempre. L&apos;ora di fine è solo un&apos;informazione: la spegni tu.
        </p>

        {maintenance.active ? (
          <Button type="button" variant="secondary" disabled={sending} onClick={spegni}>Spegni la manutenzione</Button>
        ) : (
          <>
            <Input
              label="Messaggio per i giocatori"
              type="text"
              maxLength={MESSAGE_MAX}
              value={messaggio}
              onChange={(e) => {
                setMessaggio(e.target.value);
                setErroreMessaggio(null);
              }}
              error={erroreMessaggio ?? undefined}
              disabled={sending}
            />
            <Input label="Fine prevista (facoltativa)" type="datetime-local" value={fineManutenzione} onChange={(e) => setFineManutenzione(e.target.value)} disabled={sending} />
            <Button type="submit" disabled={sending}>Accendi la manutenzione</Button>
          </>
        )}
        {erroreManutenzione && <p role="alert" className="text-sm font-bold text-coppe [overflow-wrap:anywhere]">{erroreManutenzione}</p>}
      </form>
    </div>
  );
}

AvvisiPanel.propTypes = {
  onForbidden: PropTypes.func.isRequired,
};

export default AvvisiPanel;
