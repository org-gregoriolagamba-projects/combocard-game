/**
 * Settings Controller
 *
 * What every logged-in user can read about the game settings.
 */

import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.utils.js";
import { getSettingsView } from "../services/settings.service.js";

/**
 * The game settings with their limits and defaults, and nothing about who changed them
 * GET /api/settings
 */
export const getSettings = asyncHandler(async (req, res) => {
  sendSuccess(res, await getSettingsView(req.store, req.gameState, { admin: false }));
});
