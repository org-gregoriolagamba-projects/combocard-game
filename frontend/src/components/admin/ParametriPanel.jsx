/**
 * ParametriPanel Component
 *
 * The game settings: the six parameters with their value in force, the interval each one accepts and the
 * default, in one form. A change is for the games created after it; the games already waiting or in progress
 * keep the parameters they had. The server decides what is allowed.
 */

import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import { Button, Input } from "../common";
import { adminService } from "../../services";
import { addToast } from "../../store/slices/uiSlice";
import { PARAMETRI } from "../../config/parametri";

const quando = (iso) => new Date(iso).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });

// The fields keep the text as typed: a field can be emptied to write a new number
const comeTesto = (values) => Object.fromEntries(PARAMETRI.map(({ chiave }) => [chiave, String(values[chiave])]));

// The number typed in a field, NaN when it is empty or is not a whole number
const numero = (testo) => (/^\d+$/.test(testo) ? parseInt(testo, 10) : NaN);

function ParametriPanel({ onForbidden }) {
  const dispatch = useDispatch();
  const [reloads, setReloads] = useState(0);
  const [data, setData] = useState(null);
  const [campi, setCampi] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [outcome, setOutcome] = useState(null);
  const [errori, setErrori] = useState({});
  const [serverError, setServerError] = useState(null);
  const [sending, setSending] = useState(false);
  // A double tap must not send it twice: the ref answers at once, the state would not
  const inFlight = useRef(false);

  const loading = outcome?.key !== reloads;
  const error = loading ? null : outcome.error;

  useEffect(() => {
    let current = true;
    adminService
      .getSettings()
      .then((result) => {
        if (current) {
          setData(result);
          setCampi(comeTesto(result.values));
          setOutcome({ key: reloads, error: null });
        }
      })
      .catch((err) => {
        if (!current) {
          return;
        }
        if (err.status === 403) {
          onForbidden();
        } else {
          setOutcome({ key: reloads, error: err.message });
        }
      });
    return () => {
      current = false;
    };
  }, [reloads, onForbidden]);

  if (error && !data) {
    return (
      <div className="space-y-3">
        <p role="alert" className="font-bold text-coppe [overflow-wrap:anywhere]">{error}</p>
        <Button type="button" variant="secondary" onClick={() => setReloads((n) => n + 1)}>Riprova</Button>
      </div>
    );
  }

  if (!data) {
    return <p role="status" className="text-testo-2">Caricamento dei parametri…</p>;
  }

  const { limits, defaults, values } = data;

  // What is different from the value in force (a text that is not a number counts: it is explained on saving)
  const cambiati = PARAMETRI.filter(({ chiave }) => {
    const n = numero(campi[chiave]);
    return Number.isNaN(n) || n !== values[chiave];
  });

  const scrivi = (chiave, testo) => {
    setCampi((current) => ({ ...current, [chiave]: testo }));
    setErrori((current) => ({ ...current, [chiave]: undefined }));
  };

  // Each problem is shown in its field, once. The server decides in the end, but nothing is sent until the form is right
  const verifica = () => {
    const problemi = {};
    for (const { chiave, unita } of PARAMETRI) {
      const n = numero(campi[chiave]);
      const { min, max } = limits[chiave];
      if (Number.isNaN(n)) {
        problemi[chiave] = "Scrivi un numero";
      } else if (n < min || n > max) {
        problemi[chiave] = `Da ${min} a ${max} ${unita}`;
      }
    }
    // The minimum is the one written in the form: both can be changed together
    if (!problemi.minPlayers && !problemi.maxPlayers && numero(campi.maxPlayers) < numero(campi.minPlayers)) {
      problemi.maxPlayers = `Non può essere meno dei giocatori minimi (${numero(campi.minPlayers)})`;
    }
    if (motivo.trim() === "") {
      problemi.motivo = "Scrivi il motivo";
    }
    return problemi;
  };

  const salva = async (event) => {
    event?.preventDefault();
    if (inFlight.current || cambiati.length === 0) {
      return;
    }
    const problemi = verifica();
    setErrori(problemi);
    if (Object.keys(problemi).length > 0) {
      return;
    }

    inFlight.current = true;
    setSending(true);
    setServerError(null);
    try {
      const result = await adminService.updateSettings({
        values: Object.fromEntries(cambiati.map(({ chiave }) => [chiave, numero(campi[chiave])])),
        reason: motivo.trim(),
      });
      // The answer of the server is the new state: what is shown is what is saved, not what was written
      setData(result);
      setCampi(comeTesto(result.values));
      setMotivo("");
      dispatch(addToast({ message: "Parametri di gioco aggiornati", type: "success" }));
    } catch (err) {
      if (err.status === 403) {
        onForbidden();
      } else {
        setServerError(err.message);
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <form noValidate onSubmit={salva} className="space-y-5">
      <p className="rounded-xl border-2 border-oro/60 bg-oro/10 p-3 text-sm text-testo [overflow-wrap:anywhere]">
        Le modifiche valgono solo per le partite create dopo: quelle in attesa o in corso continuano con i
        parametri che avevano.
      </p>
      {data.updatedAt && <p className="text-sm text-testo-2">{`Ultima modifica: ${quando(data.updatedAt)}`}</p>}

      {PARAMETRI.map(({ chiave, etichetta, spiegazione }) => (
        <div key={chiave} className="min-w-0 space-y-2">
          <p className="text-sm text-testo-2 [overflow-wrap:anywhere]">{spiegazione}</p>
          <Input
            label={etichetta}
            type="number"
            inputMode="numeric"
            min={limits[chiave].min}
            max={limits[chiave].max}
            value={campi[chiave]}
            onChange={(e) => scrivi(chiave, e.target.value)}
            error={errori[chiave]}
            hint={`Attuale ${values[chiave]} · Da ${limits[chiave].min} a ${limits[chiave].max} · Predefinito ${defaults[chiave]}${
              chiave === "maxPlayers" ? " · mai meno dei giocatori minimi" : ""
            }`}
          />
          <Button
            type="button"
            variant="secondary"
            fullWidth
            aria-label={`Ripristina ${etichetta}`}
            disabled={campi[chiave] === String(defaults[chiave])}
            onClick={() => scrivi(chiave, String(defaults[chiave]))}
          >
            Ripristina predefinito
          </Button>
        </div>
      ))}

      <Input
        label="Motivo"
        type="text"
        maxLength={200}
        value={motivo}
        onChange={(e) => {
          setMotivo(e.target.value);
          setErrori((current) => ({ ...current, motivo: undefined }));
        }}
        error={errori.motivo}
        hint="Resta nel registro delle azioni."
      />

      {serverError && (
        <p role="alert" className="text-sm font-bold text-coppe [overflow-wrap:anywhere]">
          {serverError}
        </p>
      )}

      <Button type="submit" fullWidth disabled={cambiati.length === 0 || sending}>
        Salva
      </Button>
    </form>
  );
}

ParametriPanel.propTypes = {
  onForbidden: PropTypes.func.isRequired,
};

export default ParametriPanel;
