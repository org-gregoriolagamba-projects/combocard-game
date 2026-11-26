/**
 * ManutenzioneScreen
 *
 * The game is in maintenance: who is not in a game (and is not an admin) sees this instead of the hall,
 * with the message of the admin and, if the admin said so, the time the maintenance should end (only an
 * information: the admin turns it off). Without a session there is the way in for the admin.
 */

import React from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../store/slices/playerSlice";

const ora = (iso) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

function ManutenzioneScreen({ onAdminLogin }) {
  const dispatch = useDispatch();
  const maintenance = useSelector((state) => state.notices.maintenance);
  const playerId = useSelector((state) => state.player.id);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center tavolo p-4 max-[359px]:p-2">
      <main className="superficie w-full max-w-md p-5 text-center max-[359px]:p-3 sm:p-8">
        <h1 className="titolo text-3xl text-testo sm:text-4xl">Manutenzione</h1>
        <p className="mt-3 [overflow-wrap:anywhere] text-testo-2 [text-wrap:pretty]">{maintenance?.message}</p>
        {maintenance?.endsAt && (
          <p className="mt-2 text-sm font-bold text-testo">Dovrebbe finire verso le {ora(maintenance.endsAt)}</p>
        )}
        <p className="mt-3 text-sm text-testo-2">Le partite già iniziate continuano. Torna tra poco.</p>

        {playerId ? (
          <button
            type="button"
            onClick={() => dispatch(logout())}
            className="mt-5 min-h-[44px] w-full rounded-xl border-2 border-linea-forte bg-notte-700 px-4 font-bold text-testo transition hover:bg-notte-600"
          >
            Esci
          </button>
        ) : (
          onAdminLogin && (
            <button
              type="button"
              onClick={onAdminLogin}
              className="mt-5 min-h-[44px] w-full text-sm font-bold text-testo-2 underline decoration-2 underline-offset-4 hover:text-testo"
            >
              Sono un amministratore
            </button>
          )
        )}
      </main>
    </div>
  );
}

ManutenzioneScreen.propTypes = {
  onAdminLogin: PropTypes.func,
};

export default ManutenzioneScreen;
