/**
 * Status Service
 *
 * What anybody can read without an account: whether the game is in maintenance and the
 * announcement that is visible now.
 */

import api from "./api";

/**
 * The public status
 * @returns {Promise<Object>} { maintenance, announcement }, each one null when there is none
 */
export const getStatus = async () => {
  // In the background: if the page is reloaded the request is cancelled, and that is not an error to show
  const response = await api.get("/status", { quiet: true });
  return response.data;
};
