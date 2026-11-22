/**
 * Player Controller
 * 
 * Handles HTTP requests related to players.
 */

import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.utils.js";
import { AppError } from "../utils/AppError.js";
import * as playerService from "../services/player.service.js";
import { applyRulesConfirmation } from "./game.controller.js";
import { TERMS_VERSION } from "../config/legale.js";

const STORAGE_UNAVAILABLE = "Storage temporarily unavailable, please try again";

/**
 * Get player by ID
 * GET /api/players/:playerId
 */
export const getPlayer = asyncHandler(async (req, res) => {
  const player = playerService.getPlayer(req.gameState, req.params.playerId);
  sendSuccess(res, playerService.toPlayerView(player));
});

/**
 * Accept the terms of use, with the version of the texts the player saw
 * POST /api/players/:playerId/accept-terms
 */
export const acceptTerms = asyncHandler(async (req, res) => {
  const player = playerService.getPlayer(req.gameState, req.params.playerId);

  // Who saw an old text does not accept the new one: the screen asks to reload
  if (req.body.version !== TERMS_VERSION) {
    throw Object.assign(new AppError("The terms of use have changed, reload the page", 409), {
      code: "TERMS_VERSION_OUTDATED",
    });
  }

  if (player.terminiVersione !== TERMS_VERSION) {
    const before = { at: player.terminiAccettatiIl, version: player.terminiVersione };
    playerService.acceptTerms(req.gameState, player.id, TERMS_VERSION);

    try {
      await req.store.recordTermsAccepted(player.id, player.terminiAccettatiIl, player.terminiVersione);
    } catch (err) {
      console.error(`❌ Could not save the acceptance of the terms of player ${player.id}: ${err.message}`);
      player.terminiAccettatiIl = before.at;
      player.terminiVersione = before.version;
      throw new AppError(STORAGE_UNAVAILABLE, 503);
    }
  }

  sendSuccess(res, { success: true, terminiAccettatiIl: player.terminiAccettatiIl, terminiVersione: player.terminiVersione });
});

/**
 * Confirm that the player read and understood the rules
 * POST /api/players/:playerId/accept-rules
 */
export const acceptRules = asyncHandler(async (req, res) => {
  const player = playerService.getPlayer(req.gameState, req.params.playerId);

  if (!player.regoleAccettateIl) {
    playerService.acceptRules(req.gameState, player.id);

    try {
      await req.store.recordRulesAccepted(player.id, player.regoleAccettateIl);
    } catch (err) {
      console.error(`❌ Could not save the rules confirmation of player ${player.id}: ${err.message}`);
      player.regoleAccettateIl = null;
      throw new AppError(STORAGE_UNAVAILABLE, 503);
    }

    applyRulesConfirmation(req.gameState, req.io, req.store, player);
  }

  sendSuccess(res, { success: true, regoleAccettateIl: player.regoleAccettateIl });
});

/**
 * Buy credits for a player
 * POST /api/players/:playerId/buy-credits
 */
export const buyCredits = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  playerService.assertTermsAccepted(playerService.getPlayer(req.gameState, req.params.playerId));
  const player = playerService.buyCredits(req.gameState, req.params.playerId, amount);

  try {
    await req.store.recordPurchase(player.id, amount);
  } catch (err) {
    console.error(`❌ Could not save purchase for player ${player.id}: ${err.message}`);
    player.credits -= amount;
    throw new AppError(STORAGE_UNAVAILABLE, 503);
  }

  sendSuccess(res, {
    success: true,
    credits: player.credits,
  }, "Credits purchased successfully");
});
