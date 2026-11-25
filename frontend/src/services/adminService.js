/**
 * Admin Service
 *
 * API calls of the admin area: the users, their name, role and credits, the games, the statistics
 * and the audit log.
 * Every one of them is refused by the server (403) to whoever is not an admin.
 */

import api from "./api";

// A query string with only what has a value
const query = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

/**
 * One page of the registered users
 * @param {Object} filters - { q, role, page, limit }
 * @returns {Promise<Object>} { items, total, page, limit }
 */
export const listUsers = async ({ q, role, page, limit } = {}) => {
  const response = await api.get(`/admin/users${query({ q, role, page, limit })}`);
  return response.data;
};

/**
 * One user
 * @param {string} playerId - Player ID
 * @returns {Promise<Object>} { playerId, username, role, credits, createdAt, inGame }
 */
export const getUser = async (playerId) => {
  const response = await api.get(`/admin/users/${encodeURIComponent(playerId)}`);
  return response.data;
};

/**
 * Rename a user, or change their role (one of the two at a time)
 * @param {string} playerId - Player ID
 * @param {Object} change - { username } or { role }
 * @returns {Promise<Object>} The user as it is now
 */
export const updateUser = async (playerId, change) => {
  const response = await api.patch(`/admin/users/${encodeURIComponent(playerId)}`, change);
  return response.data;
};

/**
 * Add or take away credits, with the reason
 * @param {string} playerId - Player ID
 * @param {Object} adjustment - { amount (negative to take away), reason }
 * @returns {Promise<Object>} { playerId, credits }
 */
export const adjustCredits = async (playerId, { amount, reason }) => {
  const response = await api.post(`/admin/users/${encodeURIComponent(playerId)}/credits`, { amount, reason });
  return response.data;
};

/**
 * Suspend a user: they lose the access at once and their sessions are closed
 * @param {string} playerId - Player ID
 * @param {Object} action - { reason }
 * @returns {Promise<Object>} The user as it is now
 */
export const suspendUser = async (playerId, { reason }) => {
  const response = await api.post(`/admin/users/${encodeURIComponent(playerId)}/suspend`, { reason });
  return response.data;
};

/**
 * Reinstate a suspended user
 * @param {string} playerId - Player ID
 * @param {Object} action - { reason }
 * @returns {Promise<Object>} The user as it is now
 */
export const unsuspendUser = async (playerId, { reason }) => {
  const response = await api.post(`/admin/users/${encodeURIComponent(playerId)}/unsuspend`, { reason });
  return response.data;
};

/**
 * Close every session of a user, without suspending them
 * @param {string} playerId - Player ID
 * @param {Object} action - { reason }
 * @returns {Promise<Object>} The user as it is now
 */
export const revokeSessions = async (playerId, { reason }) => {
  const response = await api.post(`/admin/users/${encodeURIComponent(playerId)}/sessions/revoke`, { reason });
  return response.data;
};

/**
 * Reset the password of a user: the server makes a temporary one, shown to the admin once
 * @param {string} playerId - Player ID
 * @param {Object} action - { reason }
 * @returns {Promise<Object>} { user, temporaryPassword }
 */
export const resetPassword = async (playerId, { reason }) => {
  const response = await api.post(`/admin/users/${encodeURIComponent(playerId)}/password/reset`, { reason });
  return response.data;
};

/**
 * Delete the account of a user, for good: the balance is closed, the name is free, the personal data go
 * @param {string} playerId - Player ID
 * @param {Object} action - { reason }
 * @returns {Promise<Object>} { playerId, credits }
 */
export const deleteUser = async (playerId, { reason }) => {
  const response = await api.delete(`/admin/users/${encodeURIComponent(playerId)}`, { reason });
  return response.data;
};

/**
 * One page of the audit log, the latest first
 * @param {Object} filters - { targetId, page, limit }
 * @returns {Promise<Object>} { items, total, page, limit }
 */
export const listAudit = async ({ targetId, page, limit } = {}) => {
  const response = await api.get(`/admin/audit${query({ targetId, page, limit })}`);
  return response.data;
};

/**
 * One page of the games waiting or in progress, the oldest first: metadata only
 * @param {Object} filters - { status ('waiting' or 'playing'), page, limit }
 * @returns {Promise<Object>} { items, total, page, limit }
 */
export const listGames = async ({ status, page, limit } = {}) => {
  const response = await api.get(`/admin/games${query({ status, page, limit })}`);
  return response.data;
};

/**
 * Cancel a game that is stuck: the players still in it get the entry fee back
 * @param {string} gameId - Game ID
 * @param {Object} cancellation - { reason }
 * @returns {Promise<Object>} { gameId, previousStatus, players: [{ playerId, credits, refund }] }
 */
export const cancelGame = async (gameId, { reason }) => {
  const response = await api.post(`/admin/games/${encodeURIComponent(gameId)}/cancel`, { reason });
  return response.data;
};

/**
 * The numbers of the platform
 * @returns {Promise<Object>} { users, games, credits, prizesDistributed }
 */
export const getStats = async () => {
  const response = await api.get("/admin/stats");
  return response.data;
};

/**
 * The game settings: the values in force, the interval of each one, the defaults, and when and by whom
 * they were last changed
 * @returns {Promise<Object>} { values, limits, defaults, updatedAt, updatedBy }
 */
export const getSettings = async () => {
  const response = await api.get("/admin/settings");
  return response.data;
};

/**
 * Change some of the game settings, with the reason that goes in the audit log. Only what is sent changes;
 * the server refuses a value outside its interval and a maximum of players below the minimum.
 * @param {Object} change - { values: { key: number }, reason }
 * @returns {Promise<Object>} The settings after the change: { values, limits, defaults, updatedAt, updatedBy }
 */
export const updateSettings = async ({ values, reason }) => {
  const response = await api.patch("/admin/settings", { values, reason });
  return response.data;
};

/**
 * The announcement and the maintenance mode, complete, with who changed them last
 * @returns {Promise<Object>} { announcement, maintenance }
 */
export const getNotices = async () => {
  const response = await api.get("/admin/notices");
  return response.data;
};

/**
 * Publish an announcement for all the players: it replaces the previous one
 * @param {Object} notice - { message, severity: "info"|"importante", startsAt?, endsAt? }
 * @returns {Promise<Object>} { announcement, maintenance }
 */
export const publishAnnouncement = async ({ message, severity, startsAt, endsAt }) => {
  const response = await api.put("/admin/announcement", { message, severity, startsAt, endsAt });
  return response.data;
};

/**
 * Withdraw the announcement
 * @returns {Promise<Object>} { announcement, maintenance }
 */
export const withdrawAnnouncement = async () => {
  const response = await api.delete("/admin/announcement");
  return response.data;
};

/**
 * Turn the maintenance mode on (with the message the players read) or off
 * @param {Object} change - { active, message?, endsAt? }
 * @returns {Promise<Object>} { announcement, maintenance, changed }
 */
export const setMaintenance = async ({ active, message, endsAt }) => {
  const response = await api.put("/admin/maintenance", { active, message, endsAt });
  return response.data;
};
