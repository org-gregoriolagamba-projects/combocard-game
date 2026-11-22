/**
 * Player Service
 * 
 * Handles player-related business logic.
 */

import { generateId } from "../utils/card.utils.js";
import { AppError } from "../utils/AppError.js";
import config from "../config/index.js";
import { TERMS_VERSION } from "../config/legale.js";

/**
 * Register a new player
 * @param {Object} gameState - Global game state
 * @param {string} playerName - Player name
 * @param {Object} [options]
 * @param {string|null} [options.termsVersion] - Version of the terms the player accepted: a
 *   registration carries the acceptance, so the current version is the default. null creates a
 *   player who has accepted nothing.
 * @returns {Object} Created player
 */
export function registerPlayer(gameState, playerName, { termsVersion = TERMS_VERSION } = {}) {
  if (!playerName || playerName.trim().length === 0) {
    throw new AppError("Player name is required", 400);
  }

  const playerId = generateId();

  gameState.players[playerId] = {
    id: playerId,
    name: playerName.trim(),
    credits: config.defaultCredits,
    currentGameId: null,
    // When the player confirmed that they read the rules; null until then
    regoleAccettateIl: null,
    // When the player accepted the terms of use, and which version of the texts; null until then
    terminiAccettatiIl: termsVersion ? new Date().toISOString() : null,
    terminiVersione: termsVersion ?? null,
    createdAt: new Date().toISOString(),
  };

  return gameState.players[playerId];
}

/**
 * Get player by ID
 * @param {Object} gameState - Global game state
 * @param {string} playerId - Player ID
 * @returns {Object} Player object
 */
export function getPlayer(gameState, playerId) {
  const player = gameState.players[playerId];
  if (!player) {
    throw new AppError("Player not found", 404);
  }
  return player;
}

/**
 * Buy credits for a player
 * @param {Object} gameState - Global game state
 * @param {string} playerId - Player ID
 * @param {number} amount - Amount to add
 * @returns {Object} Updated player
 */
export function buyCredits(gameState, playerId, amount) {
  const player = getPlayer(gameState, playerId);

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError("Invalid amount", 400);
  }

  if (amount > config.maxCreditsPerPurchase) {
    throw new AppError(`Maximum purchasable amount is ${config.maxCreditsPerPurchase} credits`, 400);
  }

  player.credits += amount;
  return player;
}

/**
 * Mark that the player read and understood the rules. Only the first confirmation counts.
 * @param {Object} gameState - Global game state
 * @param {string} playerId - Player ID
 * @returns {Object} Updated player
 */
export function acceptRules(gameState, playerId) {
  const player = getPlayer(gameState, playerId);
  if (!player.regoleAccettateIl) {
    player.regoleAccettateIl = new Date().toISOString();
  }
  return player;
}

/**
 * Mark that the player accepted the terms of use, with the version of the texts
 * @param {Object} gameState - Global game state
 * @param {string} playerId - Player ID
 * @param {string} version - Version that was accepted
 * @returns {Object} Updated player
 */
export function acceptTerms(gameState, playerId, version) {
  const player = getPlayer(gameState, playerId);
  if (player.terminiVersione !== version) {
    player.terminiAccettatiIl = new Date().toISOString();
    player.terminiVersione = version;
  }
  return player;
}

/**
 * The player as the owner of the account sees it: with what is left to accept
 * @param {Object} player - Player
 * @returns {Object} Copy of the player with `terminiDaAccettare`
 */
export function toPlayerView(player) {
  return { ...player, terminiDaAccettare: player.terminiVersione !== TERMS_VERSION };
}

/**
 * Get all players
 * @param {Object} gameState - Global game state
 * @returns {Array} Array of players
 */
export function getAllPlayers(gameState) {
  return Object.values(gameState.players);
}
