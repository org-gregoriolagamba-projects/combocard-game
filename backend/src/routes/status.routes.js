/**
 * Status Routes
 *
 * Public: the app asks it before anybody has logged in, to know whether the game is in maintenance and
 * whether there is an announcement to show.
 */

import { Router } from "express";
import { publicStatus } from "../controllers/health.controller.js";

const router = Router();

/**
 * @route   GET /api/status
 * @desc    The maintenance mode and the announcement that is visible now
 * @access  Public
 */
router.get("/", publicStatus);

export default router;
