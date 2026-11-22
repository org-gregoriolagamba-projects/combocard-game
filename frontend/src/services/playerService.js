/**
 * Player Service
 * 
 * API calls related to player management.
 */

import api from "./api";
import { LEGALE } from "../config/legale";

/**
 * Get player by ID
 * @param {string} playerId - Player ID
 * @returns {Promise} Player data
 */
export const getPlayer = async (playerId) => {
  const response = await api.get(`/players/${playerId}`);
  return response.data;
};

/**
 * Confirm that the player read and understood the rules
 * @param {string} playerId - Player ID
 * @returns {Promise} { success, regoleAccettateIl }
 */
export const acceptRules = async (playerId) => {
  const response = await api.post(`/players/${playerId}/accept-rules`);
  return response.data;
};

/**
 * Accept the terms of use, with the version of the texts the app shows
 * @param {string} playerId - Player ID
 * @returns {Promise} { success, terminiAccettatiIl, terminiVersione }
 */
export const acceptTerms = async (playerId) => {
  const response = await api.post(`/players/${playerId}/accept-terms`, { version: LEGALE.versione });
  return response.data;
};

/**
 * Buy credits for a player
 * @param {string} playerId - Player ID
 * @param {number} amount - Amount to buy
 * @returns {Promise} Updated credits
 */
export const buyCredits = async (playerId, amount) => {
  const response = await api.post(`/players/${playerId}/buy-credits`, { amount });
  return response.data;
};
