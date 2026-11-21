/**
 * ParametriPanel Component
 *
 * The game settings: the six parameters with their value in force, the interval each one accepts and the
 * default, in one form. A change is for the games created after it; the games already waiting or in progress
 * keep the parameters they had. The server decides what is allowed.
 */

import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, Input } from "../common";
import { adminService } from "../../services";
import { PARAMETRI } from "../../config/parametri";

const quando = (iso) => new Date(iso).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });

// The fields keep the text as typed: a field can be emptied to write a new number
const comeTesto = (values) => Object.fromEntries(PARAMETRI.map(({ chiave }) => [chiave, String(values[chiave])]));

function ParametriPanel({ onForbidden }) {
  const [reloads, setReloads] = useState(0);
  const [data, setData] = useState(null);
  const [campi, setCampi] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [outcome, setOutcome] = useState(null);

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

  return (
    <form noValidate onSubmit={(event) => event.preventDefault()} className="space-y-5">
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
            onChange={(e) => setCampi((current) => ({ ...current, [chiave]: e.target.value }))}
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
            onClick={() => setCampi((current) => ({ ...current, [chiave]: String(defaults[chiave]) }))}
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
        onChange={(e) => setMotivo(e.target.value)}
        hint="Resta nel registro delle azioni."
      />

      <Button type="submit" fullWidth disabled>
        Salva
      </Button>
    </form>
  );
}

ParametriPanel.propTypes = {
  onForbidden: PropTypes.func.isRequired,
};

export default ParametriPanel;
