/**
 * Settings Service
 *
 * The game settings the admin can change. The server keeps them in `gameState.settings`, loaded at
 * startup from the store and changed only after the store has written the change (so a failed write
 * leaves the old values). Every game takes a copy when it is created: a change reaches the games
 * created afterwards, never the ones already waiting or in progress. A game without settings (saved
 * before they existed) keeps the values of today, whatever the admin sets afterwards, and so does a
 * state without settings (built by hand in a test).
 */

import { AppError } from "../utils/AppError.js";
import { GAME_DEFAULTS } from "../config/constants.js";
import { GAME_SETTING_KEYS, GAME_SETTING_LIMITS, defaultGameSettings } from "../config/gameSettings.js";
import config from "../config/index.js";
import { INVALID_SETTINGS } from "../db/store.js";

const STORAGE_UNAVAILABLE = "Storage temporarily unavailable, please try again";

/**
 * The values the game had before the settings existed
 * @returns {Object} One value for each key
 */
export function legacySettings() {
  return {
    minPlayers: GAME_DEFAULTS.MIN_PLAYERS,
    maxPlayers: GAME_DEFAULTS.MAX_PLAYERS,
    requiredCredits: GAME_DEFAULTS.REQUIRED_CREDITS,
    jollyHoldSeconds: GAME_DEFAULTS.JOLLY_HOLD_MS / 1000,
    jollyMaxDeclarations: GAME_DEFAULTS.JOLLY_MAX_DECLARATIONS,
    drawCooldownSeconds: config.drawCooldownSeconds,
  };
}

/**
 * The settings in force now
 * @param {Object} gameState - Global game state
 * @returns {Object} One value for each key
 */
export const currentSettings = (gameState) => gameState.settings ?? legacySettings();

/**
 * The settings a game plays by: its own copy, or the values of today if it has none (a game saved
 * before the settings existed must not follow the changes of the admin: it began with other rules)
 * @param {Object} game - The game
 * @returns {Object} One value for each key
 */
export const settingsOfGame = (game) => game.settings ?? legacySettings();

/**
 * Read the settings from the store into the game state: at startup
 * @param {Object} store - Persistence store
 * @param {Object} gameState - Global game state
 */
export async function loadSettings(store, gameState) {
  gameState.settings = (await store.getGameSettings()).settings;
}

/**
 * What the routes answer: the values, the interval of each one and the defaults
 * @param {Object} store - Persistence store
 * @param {Object} gameState - Global game state
 * @param {Object} options - { admin }: the admin also gets when and by whom they were last changed
 * @returns {Promise<Object>} { values, limits, defaults, updatedAt?, updatedBy? }
 */
export async function getSettingsView(store, gameState, { admin = false } = {}) {
  const limits = Object.fromEntries(
    GAME_SETTING_KEYS.map((key) => [key, { min: GAME_SETTING_LIMITS[key].min, max: GAME_SETTING_LIMITS[key].max }]),
  );
  const view = { values: { ...currentSettings(gameState) }, limits, defaults: defaultGameSettings() };
  if (admin) {
    const { updatedAt, updatedBy } = await store.getGameSettings();
    return { ...view, updatedAt, updatedBy };
  }
  return view;
}

/**
 * Change some of the settings, with the reason that goes in the audit log
 * @param {Object} store - Persistence store
 * @param {Object} gameState - Global game state
 * @param {Object} change - { values, reason, actor }
 * @returns {Promise<Object>} { before, after, changed }
 * @throws {AppError} 400 for a value outside its interval (or a maximum of players below the minimum), 503 if the store cannot write
 */
export async function updateSettings(store, gameState, { values, reason, actor }) {
  let result;
  try {
    result = await store.updateGameSettings(values, { actor, reason });
  } catch (err) {
    if (err.code === INVALID_SETTINGS) {
      throw new AppError(err.message, 400);
    }
    console.error(`❌ Could not change the game settings: ${err.message}`);
    throw new AppError(STORAGE_UNAVAILABLE, 503);
  }
  if (result.changed.length > 0) {
    gameState.settings = result.after;
  }
  return result;
}
