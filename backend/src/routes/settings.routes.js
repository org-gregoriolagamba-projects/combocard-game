/**
 * Settings Routes
 *
 * The game settings, for every logged-in user. They are changed from the admin routes.
 */

import { Router } from "express";
import * as settingsController from "../controllers/settings.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @route   GET /api/settings
 * @desc    The game settings, with their limits and defaults
 * @access  Private
 */
router.get("/", requireAuth, settingsController.getSettings);

export default router;
