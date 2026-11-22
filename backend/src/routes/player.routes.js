/**
 * Player Routes
 * 
 * Routes for player management.
 */

import { Router } from "express";
import * as playerController from "../controllers/player.controller.js";
import { validate } from "../middleware/validation.middleware.js";
import { requireAuth, requireSelf } from "../middleware/auth.middleware.js";
import { acceptTermsSchema, buyCreditsSchema } from "../validation/schemas.js";

const router = Router();

/**
 * @route   GET /api/players/:playerId
 * @desc    Get your own player
 * @access  Authenticated, self only
 */
router.get("/:playerId", requireAuth, requireSelf, playerController.getPlayer);

/**
 * @route   POST /api/players/:playerId/accept-rules
 * @desc    Confirm that the player read and understood the rules
 * @access  Authenticated, self only
 */
router.post("/:playerId/accept-rules", requireAuth, requireSelf, playerController.acceptRules);

/**
 * @route   POST /api/players/:playerId/accept-terms
 * @desc    Accept the terms of use, with the version of the texts the player saw
 * @access  Authenticated, self only
 */
router.post(
  "/:playerId/accept-terms",
  requireAuth,
  requireSelf,
  validate(acceptTermsSchema),
  playerController.acceptTerms,
);

/**
 * @route   POST /api/players/:playerId/buy-credits
 * @desc    Buy credits for a player
 * @access  Authenticated, self only
 */
router.post(
  "/:playerId/buy-credits",
  requireAuth,
  requireSelf,
  validate(buyCreditsSchema),
  playerController.buyCredits,
);

export default router;
