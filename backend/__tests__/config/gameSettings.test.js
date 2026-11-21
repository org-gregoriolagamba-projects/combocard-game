/**
 * Game settings: keys, defaults and limits
 */

import {
  GAME_SETTING_KEYS,
  GAME_SETTING_LIMITS,
  checkGameSettings,
  defaultGameSettings,
} from '../../src/config/gameSettings.js';

const DEFAULTS = {
  minPlayers: 2,
  maxPlayers: 10,
  requiredCredits: 100,
  jollyHoldSeconds: 30,
  jollyMaxDeclarations: 3,
  drawCooldownSeconds: 8,
};

describe('defaultGameSettings', () => {
  test('gives the six defaults, in the order of the keys', () => {
    expect(defaultGameSettings()).toEqual(DEFAULTS);
    expect(GAME_SETTING_KEYS).toEqual(Object.keys(DEFAULTS));
  });

  test('gives a copy: changing it does not change the next one', () => {
    const first = defaultGameSettings();
    first.minPlayers = 9;

    expect(defaultGameSettings().minPlayers).toBe(2);
  });
});

describe('checkGameSettings', () => {
  test('accepts the defaults', () => {
    expect(checkGameSettings(DEFAULTS)).toBeNull();
  });

  test.each(GAME_SETTING_KEYS)('%s: accepts both ends of the interval', (key) => {
    const { min, max } = GAME_SETTING_LIMITS[key];
    // minPlayers up to its maximum must not be above maxPlayers, and the other way round
    const base = { ...DEFAULTS, minPlayers: 2, maxPlayers: 20 };

    expect(checkGameSettings({ ...base, [key]: min })).toBeNull();
    expect(checkGameSettings({ ...base, [key]: max })).toBeNull();
  });

  test.each(GAME_SETTING_KEYS)('%s: refuses a value outside the interval, saying the key and the interval', (key) => {
    const { min, max } = GAME_SETTING_LIMITS[key];

    for (const value of [min - 1, max + 1]) {
      const message = checkGameSettings({ ...DEFAULTS, [key]: value });
      expect(message).toContain(key);
      expect(message).toContain(String(min));
      expect(message).toContain(String(max));
    }
  });

  test.each([['a decimal', 2.5], ['a string', '5'], ['null', null]])('refuses %s', (_name, value) => {
    expect(checkGameSettings({ ...DEFAULTS, drawCooldownSeconds: value })).toContain('drawCooldownSeconds');
  });

  test('refuses a maximum of players below the minimum, naming both', () => {
    const message = checkGameSettings({ ...DEFAULTS, minPlayers: 8, maxPlayers: 6 });

    expect(message).toContain('maxPlayers');
    expect(message).toContain('minPlayers');
  });

  test('refuses an unknown key', () => {
    expect(checkGameSettings({ ...DEFAULTS, cheat: 1 })).toContain('cheat');
  });
});
