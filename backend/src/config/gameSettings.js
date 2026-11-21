/**
 * Game settings
 *
 * The parameters of a game that the admin can change: their defaults and the interval each one
 * accepts. The database repeats the same intervals in CHECK constraints (migration 011), and the
 * tests compare the two.
 */

export const GAME_SETTING_LIMITS = {
  minPlayers: { default: 2, min: 2, max: 10 },
  maxPlayers: { default: 10, min: 2, max: 20 },
  requiredCredits: { default: 100, min: 1, max: 10000 },
  jollyHoldSeconds: { default: 30, min: 10, max: 120 },
  jollyMaxDeclarations: { default: 3, min: 1, max: 10 },
  drawCooldownSeconds: { default: 8, min: 3, max: 30 },
};

export const GAME_SETTING_KEYS = Object.keys(GAME_SETTING_LIMITS);

/**
 * The defaults, as a new object each time
 * @returns {Object} One value for each key
 */
export function defaultGameSettings() {
  return Object.fromEntries(GAME_SETTING_KEYS.map((key) => [key, GAME_SETTING_LIMITS[key].default]));
}

/**
 * Check a whole set of settings: every key a whole number inside its interval, and the maximum
 * of players not below the minimum. A value is never corrected: it is refused.
 * @param {Object} values - One value for each key
 * @returns {string|null} What is wrong, or null
 */
export function checkGameSettings(values) {
  const unknown = Object.keys(values).find((key) => !GAME_SETTING_KEYS.includes(key));
  if (unknown) {
    return `Unknown setting: ${unknown}`;
  }
  for (const key of GAME_SETTING_KEYS) {
    const { min, max } = GAME_SETTING_LIMITS[key];
    const value = values[key];
    if (!Number.isInteger(value) || value < min || value > max) {
      return `${key} must be a whole number from ${min} to ${max}`;
    }
  }
  if (values.maxPlayers < values.minPlayers) {
    return "maxPlayers cannot be below minPlayers";
  }
  return null;
}
