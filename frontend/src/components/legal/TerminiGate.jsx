/**
 * TerminiGate
 *
 * "Prima di continuare": a player who has not accepted the current terms of use (an account that
 * is older than the texts, or one that was made with an older version) accepts them before
 * anything else. The server refuses to create a game, join one or take credits until then.
 */

import React, { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { acceptTerms, logout } from "../../store/slices/playerSlice";
import DeleteAccountDialog from "../game/DeleteAccountDialog";
import { LinkTesto } from "./LegalLayout";

function TerminiGate() {
  const dispatch = useDispatch();
  const { id: playerId, name: playerName, error } = useSelector((state) => state.player);
  const inFlight = useRef(false);
  const [dichiarato, setDichiarato] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // A double tap must not send two acceptances: the ref answers at once, the state would not
  const conferma = async () => {
    if (!dichiarato || inFlight.current) return;
    inFlight.current = true;
    try {
      await dispatch(acceptTerms(playerId)).unwrap();
    } catch {
      // The reason is in the state of the player and is shown under the button
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <div className="min-h-[100dvh] tavolo p-4 max-[359px]:p-2">
      <div className="mx-auto max-w-2xl">
        <main className="superficie p-5 max-[359px]:p-3 sm:p-8">
          <h1 className="titolo text-2xl text-testo sm:text-3xl">Prima di continuare</h1>
          <p className="mt-2 [overflow-wrap:anywhere] text-testo-2 [text-wrap:pretty]">
            Ciao {playerName}! ComboCard ha ora un&apos;informativa sulla privacy, che spiega quali dati trattiamo e perché, e i
            termini d&apos;uso. Leggili e accettali per continuare a giocare.
          </p>

          <p className="mt-3 flex flex-wrap items-center gap-x-4 text-sm text-testo-2">
            <LinkTesto a="informativa">Informativa sulla privacy</LinkTesto>
            <LinkTesto a="termini">Termini d&apos;uso</LinkTesto>
          </p>

          <div className="mt-4 border-t border-linea pt-5">
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-testo">
              <input
                type="checkbox"
                checked={dichiarato}
                onChange={(e) => setDichiarato(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0"
              />
              <span className="min-w-0 [overflow-wrap:anywhere] font-bold">
                Ho letto l&apos;informativa sulla privacy e accetto i termini d&apos;uso
              </span>
            </label>

            {error && (
              <p role="alert" className="mt-3 text-sm font-bold text-coppe">{error}</p>
            )}

            <button
              type="button"
              onClick={conferma}
              disabled={!dichiarato}
              className="mt-4 min-h-[52px] w-full rounded-xl bg-oro px-6 py-3 font-bold text-inchiostro-900 shadow-md transition hover:bg-oro-dark disabled:cursor-not-allowed disabled:bg-notte-600 disabled:text-testo-3"
            >
              Accetto e continuo
            </button>

            <button
              type="button"
              onClick={() => dispatch(logout())}
              className="mt-2 min-h-[44px] w-full [overflow-wrap:anywhere] text-sm font-bold text-testo-2 underline decoration-2 underline-offset-4 hover:text-testo"
            >
              Non sei {playerName}? Esci dall&apos;account
            </button>

            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="min-h-[44px] w-full [overflow-wrap:anywhere] text-sm font-bold text-testo-3 underline decoration-2 underline-offset-4 hover:text-coppe"
            >
              Non accetto: elimina il mio account
            </button>
          </div>
        </main>
      </div>

      {showDelete && <DeleteAccountDialog onClose={() => setShowDelete(false)} />}
    </div>
  );
}

export default TerminiGate;
