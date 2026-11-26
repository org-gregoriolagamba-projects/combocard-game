/**
 * Health Controller
 * 
 * Handles health check endpoints.
 */

import { sendSuccess } from "../utils/response.utils.js";
import { isMaintenance, statusView } from "../services/notices.service.js";

/**
 * Health check endpoint
 * GET /api/health
 */
export const healthCheck = (req, res) => {
  sendSuccess(res, {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    maintenance: isMaintenance(req.gameState ?? {}),
  });
};

/**
 * What anybody can read, with no account: the maintenance mode and the announcement that is visible
 * GET /api/status
 */
export const publicStatus = (req, res) => {
  sendSuccess(res, statusView(req.gameState ?? {}));
};

/**
 * Detailed health check
 * GET /api/health/detailed
 */
export const detailedHealthCheck = (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  sendSuccess(res, {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + " MB",
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + " MB",
    },
    database: req.store?.status() ?? null,
    gameState: {
      activeGames: Object.keys(req.gameState?.games || {}).length,
      registeredPlayers: Object.keys(req.gameState?.players || {}).length,
    },
  });
};
