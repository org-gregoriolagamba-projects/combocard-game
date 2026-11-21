/**
 * Game settings in the in-memory store
 *
 * The same behavior as the PostgreSQL store (the CHECK constraints and the locks are tested in
 * postgres.integration.test.js): the defaults, a change with its audit row, and what is refused.
 */

import { createMemoryStore, INVALID_SETTINGS } from '../../src/db/store.js';

const DEFAULTS = { minPlayers: 2, maxPlayers: 10, requiredCredits: 100, jollyHoldSeconds: 30, jollyMaxDeclarations: 3, drawCooldownSeconds: 8 };
const actor = { type: 'player', id: 'p9' };

describe('game settings of the memory store', () => {
  let store;

  beforeEach(() => {
    store = createMemoryStore();
  });

  test('start from the defaults, changed by nobody', async () => {
    await expect(store.getGameSettings()).resolves.toEqual({ settings: DEFAULTS, updatedAt: null, updatedBy: null });
  });

  test('a change is kept and audited, with the values before and after and the reason', async () => {
    const result = await store.updateGameSettings({ drawCooldownSeconds: 12 }, { actor, reason: ' più tempo ' });

    expect(result).toEqual({ before: DEFAULTS, after: { ...DEFAULTS, drawCooldownSeconds: 12 }, changed: ['drawCooldownSeconds'] });
    await expect(store.getGameSettings()).resolves.toMatchObject({ settings: { drawCooldownSeconds: 12 }, updatedBy: 'p9' });
    const [event, ...others] = await store.listAuditEvents();
    expect(others).toHaveLength(0);
    expect(event).toMatchObject({ action: 'settings_changed', actorType: 'player', actorId: 'p9', targetId: null });
    expect(event.details).toEqual({ changes: { drawCooldownSeconds: { from: 8, to: 12 } }, reason: 'più tempo' });
  });

  test('a change that changes nothing writes nothing', async () => {
    const result = await store.updateGameSettings({ drawCooldownSeconds: 8 }, { actor, reason: 'x' });

    expect(result.changed).toEqual([]);
    await expect(store.listAuditEvents()).resolves.toEqual([]);
    await expect(store.getGameSettings()).resolves.toMatchObject({ updatedAt: null, updatedBy: null });
  });

  test.each([
    ['a value below the interval', { jollyHoldSeconds: 9 }],
    ['a value above the interval', { requiredCredits: 10001 }],
    ['a maximum of players below the minimum', { minPlayers: 8, maxPlayers: 6 }],
    ['a value that is not whole', { jollyMaxDeclarations: 2.5 }],
    ['an unknown key', { cheat: 1 }],
  ])('%s is refused with INVALID_SETTINGS, and nothing changes', async (_name, patch) => {
    await expect(store.updateGameSettings(patch, { actor, reason: 'x' })).rejects.toMatchObject({ code: INVALID_SETTINGS });

    await expect(store.getGameSettings()).resolves.toMatchObject({ settings: DEFAULTS });
    await expect(store.listAuditEvents()).resolves.toEqual([]);
  });

  test('a reason and an actor are needed', async () => {
    await expect(store.updateGameSettings({ requiredCredits: 150 }, { actor })).rejects.toThrow(TypeError);
    await expect(store.updateGameSettings({ requiredCredits: 150 }, { actor, reason: '  ' })).rejects.toThrow(TypeError);
    await expect(store.updateGameSettings({ requiredCredits: 150 }, { reason: 'x' })).rejects.toThrow(TypeError);
  });

  test('what the caller gets back is a copy: changing it does not change the store', async () => {
    const { settings } = await store.getGameSettings();
    settings.minPlayers = 9;
    const { after } = await store.updateGameSettings({ requiredCredits: 150 }, { actor, reason: 'x' });
    after.maxPlayers = 3;

    await expect(store.getGameSettings()).resolves.toMatchObject({ settings: { ...DEFAULTS, requiredCredits: 150 } });
  });

  test('the first value of the cooldown can come from the environment, if it is inside the interval', async () => {
    await expect(createMemoryStore({ drawCooldownSeconds: 12 }).getGameSettings()).resolves.toMatchObject({ settings: { drawCooldownSeconds: 12 } });
    for (const outside of [2, 31, 'x', 4.5, undefined]) {
      await expect(createMemoryStore({ drawCooldownSeconds: outside }).getGameSettings()).resolves.toMatchObject({ settings: { drawCooldownSeconds: 8 } });
    }
  });
});
