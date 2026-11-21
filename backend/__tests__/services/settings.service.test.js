/**
 * Settings service
 *
 * The settings in the game state (loaded at startup, changed through the store), the values of a game
 * and what the routes answer. A game without settings (saved before they existed) uses the values of today.
 */

import { createMemoryStore } from '../../src/db/store.js';
import config from '../../src/config/index.js';
import {
  currentSettings,
  getSettingsView,
  legacySettings,
  loadSettings,
  settingsOfGame,
  updateSettings,
} from '../../src/services/settings.service.js';

const actor = { type: 'player', id: 'p9' };
const DEFAULTS = { minPlayers: 2, maxPlayers: 10, requiredCredits: 100, jollyHoldSeconds: 30, jollyMaxDeclarations: 3, drawCooldownSeconds: config.drawCooldownSeconds };

describe('settings service', () => {
  let store;
  let gameState;

  beforeEach(() => {
    store = createMemoryStore({ drawCooldownSeconds: config.drawCooldownSeconds });
    gameState = { games: {}, players: {} };
  });

  describe('what a game uses', () => {
    test('the values of today for a state or a game without settings', () => {
      expect(legacySettings()).toEqual(DEFAULTS);
      expect(currentSettings(gameState)).toEqual(DEFAULTS);
      expect(settingsOfGame({ id: 'g1' })).toEqual(DEFAULTS);
    });

    test('the state follows the settings once loaded; a game keeps its own copy, or the values of today if it has none', async () => {
      await store.updateGameSettings({ requiredCredits: 150 }, { actor, reason: 'x' });
      await loadSettings(store, gameState);

      expect(currentSettings(gameState).requiredCredits).toBe(150);
      expect(settingsOfGame({ id: 'g1' }).requiredCredits).toBe(100);
      expect(settingsOfGame({ id: 'g2', settings: { ...DEFAULTS, requiredCredits: 120 } }).requiredCredits).toBe(120);
    });

    test('after a restart the values come back from the store', async () => {
      await updateSettings(store, gameState, { values: { jollyHoldSeconds: 45 }, reason: 'x', actor });
      const restarted = { games: {}, players: {} };

      await loadSettings(store, restarted);

      expect(currentSettings(restarted).jollyHoldSeconds).toBe(45);
    });
  });

  describe('updateSettings', () => {
    beforeEach(() => loadSettings(store, gameState));

    test('writes through the store, then changes the settings of the state', async () => {
      const result = await updateSettings(store, gameState, { values: { drawCooldownSeconds: 12 }, reason: 'più tempo', actor });

      expect(result.changed).toEqual(['drawCooldownSeconds']);
      expect(gameState.settings.drawCooldownSeconds).toBe(12);
      expect((await store.getGameSettings()).settings.drawCooldownSeconds).toBe(12);
    });

    test('a maximum of players below the current minimum is refused with 400 naming both, and nothing changes', async () => {
      await updateSettings(store, gameState, { values: { minPlayers: 6 }, reason: 'x', actor });

      await expect(updateSettings(store, gameState, { values: { maxPlayers: 4 }, reason: 'x', actor }))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/maxPlayers.*minPlayers/) });
      await expect(updateSettings(store, gameState, { values: { minPlayers: 10, maxPlayers: 10 }, reason: 'x', actor })).resolves.toBeDefined();
      await expect(updateSettings(store, gameState, { values: { minPlayers: 3 }, reason: 'x', actor })).resolves.toBeDefined();
      expect(gameState.settings).toMatchObject({ minPlayers: 3, maxPlayers: 10 });
    });

    test('a value outside its interval is refused with 400 and the state keeps the old values', async () => {
      await expect(updateSettings(store, gameState, { values: { requiredCredits: 0 }, reason: 'x', actor }))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('requiredCredits') });

      expect(gameState.settings.requiredCredits).toBe(100);
    });

    test('when the store cannot write: 503, and the state keeps the old values', async () => {
      store.updateGameSettings = async () => {
        throw new Error('connection lost');
      };

      await expect(updateSettings(store, gameState, { values: { requiredCredits: 150 }, reason: 'x', actor }))
        .rejects.toMatchObject({ statusCode: 503 });

      expect(gameState.settings.requiredCredits).toBe(100);
    });

    test('a change that changes nothing does not touch the state', async () => {
      const before = gameState.settings;

      const result = await updateSettings(store, gameState, { values: { requiredCredits: 100 }, reason: 'x', actor });

      expect(result.changed).toEqual([]);
      expect(gameState.settings).toBe(before);
    });
  });

  describe('getSettingsView', () => {
    beforeEach(() => loadSettings(store, gameState));

    test('every user gets the values, the limits and the defaults, and nothing about who changed them', async () => {
      const view = await getSettingsView(store, gameState, { admin: false });

      expect(view.values).toEqual(gameState.settings);
      expect(view.limits.drawCooldownSeconds).toEqual({ min: 3, max: 30 });
      expect(view.defaults).toEqual({ minPlayers: 2, maxPlayers: 10, requiredCredits: 100, jollyHoldSeconds: 30, jollyMaxDeclarations: 3, drawCooldownSeconds: 8 });
      expect(view).not.toHaveProperty('updatedBy');
      expect(view).not.toHaveProperty('updatedAt');
    });

    test('the admin also gets when and by whom they were changed', async () => {
      await updateSettings(store, gameState, { values: { requiredCredits: 150 }, reason: 'x', actor });

      const view = await getSettingsView(store, gameState, { admin: true });

      expect(view.updatedBy).toBe('p9');
      expect(view.updatedAt).toBeInstanceOf(Date);
    });
  });
});
