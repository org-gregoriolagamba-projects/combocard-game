/**
 * App Content Component
 *
 * Restores the session at page load and handles screen navigation based on Redux state.
 */

import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSocket } from "./hooks";
import { setSessionExpiredHandler } from "./services/api";
import { enterGameOrHall } from "./store/sessionThunks";
import { clearGame } from "./store/slices/gameSlice";
import { clearPlayer, restoreSession } from "./store/slices/playerSlice";
import { addToast, setScreen } from "./store/slices/uiSlice";

// Pages
import { HomePage } from "./pages";

// Game screens
import { HallScreen, LobbyScreen, GameScreen, RegoleScreen, ChangePasswordScreen, StoricoScreen } from "./components/game";
import { AdminScreen } from "./components/admin";
import { LoadingSpinner } from "./components/common";
import { InformativaScreen, TerminiScreen, TerminiGate } from "./components/legal";
import { AvvisoBanner, ManutenzioneScreen } from "./components/notices";
import { fetchStatus } from "./store/slices/noticeSlice";

function AppContent() {
  const dispatch = useDispatch();
  const currentScreen = useSelector((state) => state.ui.currentScreen);
  const sessionChecked = useSelector((state) => state.player.sessionChecked);
  const playerId = useSelector((state) => state.player.id);
  const regoleAccettateIl = useSelector((state) => state.player.regoleAccettateIl);
  const terminiDaAccettare = useSelector((state) => state.player.terminiDaAccettare);
  const role = useSelector((state) => state.player.role);
  const mustChangePassword = useSelector((state) => state.player.mustChangePassword);
  const currentGameId = useSelector((state) => state.player.currentGameId);
  const maintenance = useSelector((state) => state.notices.maintenance);
  // During the maintenance a visitor sees its screen; the admin opens the login from there
  const [mostraAccesso, setMostraAccesso] = useState(false);

  // Initialize socket connection
  useSocket();

  // The maintenance and the announcement are public: they are read before anybody has logged in
  useEffect(() => {
    dispatch(fetchStatus());
  }, [dispatch]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      dispatch(clearPlayer());
      dispatch(clearGame());
      dispatch(setScreen("home"));
      dispatch(addToast({ message: "Sessione scaduta, accedi di nuovo", type: "warning" }));
    });

    const restore = async () => {
      const player = await dispatch(restoreSession()).unwrap().catch(() => null);
      // With a temporary password the server refuses the game: the player chooses a password first
      if (player && !player.mustChangePassword) {
        await dispatch(enterGameOrHall(player));
      }
    };
    restore();

    return () => setSessionExpiredHandler(null);
  }, [dispatch]);

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center tavolo">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  const renderMain = () => {
    // The privacy notice and the terms of use are public: they open with or without an account, and
    // from the screen that asks to accept them
    if (currentScreen === "informativa") {
      return <InformativaScreen />;
    }
    if (currentScreen === "termini") {
      return <TerminiScreen />;
    }

    // The game is in maintenance: somebody who is not an admin sees its screen, unless they are in a
    // game (it goes on). A visitor can open the login from there: the admin comes in.
    if (maintenance?.active && role !== "admin") {
      if (!playerId) {
        return mostraAccesso ? <HomePage /> : <ManutenzioneScreen onAdminLogin={() => setMostraAccesso(true)} />;
      }
      if (!currentGameId) {
        return <ManutenzioneScreen />;
      }
    }

    // A temporary password comes before everything, the rules included
    if (playerId && mustChangePassword) {
      return <ChangePasswordScreen />;
    }

    // A player who has not accepted the current terms of use accepts them before the rules
    if (playerId && terminiDaAccettare === true) {
      return <TerminiGate />;
    }

    // A player who never confirmed the rules reads them before anything else
    if (playerId && regoleAccettateIl === null) {
      return <RegoleScreen />;
    }

    return renderScreen();
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return <HomePage />;
      case "hall":
        return <HallScreen />;
      case "storico":
        return <StoricoScreen />;
      case "lobby":
        return <LobbyScreen />;
      case "game":
        return <GameScreen />;
      case "admin":
        // The way in is only offered to an admin, and the server refuses everybody else: anybody
        // else who ends up here is shown the hall
        return role === "admin" ? <AdminScreen /> : <HallScreen />;
      default:
        return <HomePage />;
    }
  };

  return (
    <>
      <AvvisoBanner />
      {renderMain()}
    </>
  );
}

export default AppContent;
