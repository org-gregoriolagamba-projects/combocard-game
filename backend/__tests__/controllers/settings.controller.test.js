/**
 * Settings controller and settings of the admin area
 *
 * GET /api/settings (every user), GET and PATCH /api/admin/settings (admin). The admin routes are
 * behind requireAuth and requireRole (admin.routes.test.js): here, what the handlers answer.
 */

import { getSettings } from '../../src/controllers/settings.controller.js';
import { getSettings as getAdminSettings, updateSettings } from '../../src/controllers/admin.controller.js';
import { createMemoryStore } from '../../src/db/store.js';
import { loadSettings } from '../../src/services/settings.service.js';

describe('settings handlers', () => {
  let store;
  let gameState;

  const call = (handler, { body = {}, playerId = 'p9', role = 'admin' } = {}) =>
    new Promise((resolve, reject) => {
      const res = {
        status: (code) => {
          res.code = code;
          return res;
        },
        json: (payload) => {
          resolve({ code: res.code, ...payload });
          return res;
        },
      };
      handler({ params: {}, query: {}, body, store, gameState, auth: { playerId, role } }, res, reject);
    });

  beforeEach(async () => {
    store = createMemoryStore();
    gameState = { games: {}, players: {} };
    await loadSettings(store, gameState);
  });

  test('GET /api/settings: values, limits and defaults, and nothing about who changed them', async () => {
    const { code, data } = await call(getSettings, { role: 'player' });

    expect(code).toBe(200);
    expect(data.values).toMatchObject({ minPlayers: 2, maxPlayers: 10, requiredCredits: 100 });
    expect(data.limits.requiredCredits).toEqual({ min: 1, max: 10000 });
    expect(data.defaults.drawCooldownSeconds).toBe(8);
    expect(data).not.toHaveProperty('updatedBy');
  });

  test('GET /api/admin/settings: the same, and who changed them last', async () => {
    await call(updateSettings, { body: { values: { requiredCredits: 150 }, reason: 'x' } });

    const { data } = await call(getAdminSettings);

    expect(data.values.requiredCredits).toBe(150);
    expect(data.updatedBy).toBe('p9');
  });

  test('PATCH: changes the settings, and the actor is the token, never the body', async () => {
    const { code, data } = await call(updateSettings, {
      body: { values: { drawCooldownSeconds: 12 }, reason: 'più tempo', actor: { type: 'system' }, actorId: 'p1' },
      playerId: 'p9',
    });

    expect(code).toBe(200);
    expect(data.values.drawCooldownSeconds).toBe(12);
    expect(gameState.settings.drawCooldownSeconds).toBe(12);
    const [event] = await store.listAuditEvents();
    expect(event).toMatchObject({ action: 'settings_changed', actorType: 'player', actorId: 'p9' });
    expect(event.details.reason).toBe('più tempo');
  });

  test('PATCH: a maximum of players below the minimum is a 400, and nothing is written', async () => {
    await expect(call(updateSettings, { body: { values: { minPlayers: 10 }, reason: 'x' } })).resolves.toBeDefined();

    await expect(call(updateSettings, { body: { values: { maxPlayers: 5 }, reason: 'x' } })).rejects.toMatchObject({ statusCode: 400 });

    expect(gameState.settings).toMatchObject({ minPlayers: 10, maxPlayers: 10 });
    expect(await store.listAuditEvents()).toHaveLength(1);
  });
});
