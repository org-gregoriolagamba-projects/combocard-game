/**
 * AvvisoBanner
 *
 * At the top of every screen: the announcement of the admin (text only, never HTML) and, for an admin or
 * for a player who is in a game, the notice that the maintenance is on. The player can close the
 * announcement: it does not come back until the admin publishes another one (a higher version).
 */

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { chiudiAvviso, versioneChiusa } from "../../utils/avvisoChiuso";

const BASE = "flex items-start gap-3 border-b-2 px-4 py-2 text-sm";
const STILI = {
  info: "border-linea-forte bg-notte-700 text-testo",
  importante: "border-oro-dark bg-oro font-bold text-inchiostro-900",
};

function AvvisoBanner() {
  const announcement = useSelector((state) => state.notices.announcement);
  const maintenance = useSelector((state) => state.notices.maintenance);
  const playerId = useSelector((state) => state.player.id);
  const role = useSelector((state) => state.player.role);
  // Where the player is playing: joining and creating a game put it in the game slice (the player slice
  // only has what the server said at the login, which nothing updates)
  const currentGameId = useSelector((state) => state.game.currentGameId);
  const [chiusa, setChiusa] = useState(versioneChiusa);

  const showAnnouncement = announcement && announcement.version > chiusa;
  // Who is not in a game sees the maintenance screen instead; somebody without an account sees it too
  const showMaintenance = maintenance?.active && playerId && (role === "admin" || currentGameId);

  if (!showAnnouncement && !showMaintenance) {
    return null;
  }

  const chiudi = () => {
    chiudiAvviso(announcement.version);
    setChiusa(announcement.version);
  };

  return (
    // Not sticky: the header of the game sticks to the top and must not go under the banner
    <div>
      {showMaintenance && (
        <p role="status" className={`${BASE} ${STILI.importante} [overflow-wrap:anywhere]`}>
          Manutenzione accesa: {maintenance.message}
        </p>
      )}
      {showAnnouncement && (
        <div role={announcement.severity === "importante" ? "alert" : "status"} className={`${BASE} ${STILI[announcement.severity] ?? STILI.info}`}>
          <p className="min-w-0 flex-1 self-center [overflow-wrap:anywhere]">{announcement.message}</p>
          <button
            type="button"
            onClick={chiudi}
            aria-label="Chiudi l'avviso"
            className="min-h-[44px] shrink-0 rounded-lg border-2 border-current px-3 font-bold"
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  );
}

export default AvvisoBanner;
