/**
 * The announcement a player closed
 *
 * The version of the last announcement the player closed is kept in the browser: the banner does not
 * come back until the version goes up (a new announcement). The storage can be blocked or missing
 * (a private window, blocked site data): then nothing is remembered and the banner comes back at
 * every reload, but nothing breaks.
 */

const CHIAVE = "combocard.avviso-chiuso";

/**
 * The version of the last announcement the player closed
 * @returns {number} The version, 0 if none (or if the storage cannot be read)
 */
export const versioneChiusa = () => {
  try {
    const version = Number.parseInt(window.localStorage.getItem(CHIAVE) ?? "", 10);
    return Number.isInteger(version) && version > 0 ? version : 0;
  } catch {
    return 0;
  }
};

/**
 * Remember that the player closed this announcement
 * @param {number} version - The version that was closed
 */
export const chiudiAvviso = (version) => {
  try {
    window.localStorage.setItem(CHIAVE, String(version));
  } catch {
    // Without the storage the banner comes back at the next reload: nothing to do
  }
};
