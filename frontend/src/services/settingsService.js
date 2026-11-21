/**
 * Settings Service
 *
 * What the server says about the parameters of the game: the values in force, the interval each
 * one accepts and the defaults. They are not written here: an admin changes them on the server.
 */

import api from "./api";

/**
 * The game settings
 * @returns {Promise<Object>} { values, limits, defaults }
 */
export const getSettings = async () => {
  const response = await api.get("/settings");
  return response.data;
};
