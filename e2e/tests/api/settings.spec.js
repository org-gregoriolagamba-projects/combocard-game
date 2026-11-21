/**
 * Game settings: read by every user, changed by the admin
 *
 * The admin changes a parameter with a reason, a game created afterwards plays by it, a player cannot
 * change anything, and the audit log remembers. Needs a server on PostgreSQL (E2E_DATABASE_URL): with
 * the in-memory server nobody can be made admin. Every change is undone in the same test, because the
 * settings are shared by all the tests that run against the same server.
 * @tags @api @admin
 */

import { test, expect } from '@playwright/test';
import { registerPlayer } from '../helpers/auth.js';
import { E2E_DATABASE_URL, registerAdmin } from '../helpers/admin.js';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

test.skip(!E2E_DATABASE_URL, 'needs a server on PostgreSQL: set E2E_DATABASE_URL');

// The tests below change the same row: one after the other
test.describe.configure({ mode: 'serial' });

const patch = (request, admin, values, reason = 'e2e') =>
  request.patch(`${API_URL}/api/admin/settings`, { headers: admin.headers, data: { values, reason } });

test.describe('Game settings @admin', () => {
  test('a player reads the settings, with the limits, and cannot change them (403 on every admin route)', async ({ request }) => {
    const player = await registerPlayer(request, API_URL, 'Giocatore');

    const read = await request.get(`${API_URL}/api/settings`, { headers: player.headers });
    expect(read.status()).toBe(200);
    const { values, limits, defaults } = (await read.json()).data;
    expect(Object.keys(values)).toHaveLength(6);
    expect(limits.requiredCredits).toEqual({ min: 1, max: 10000 });
    expect(defaults.minPlayers).toBe(2);
    expect(JSON.stringify(await read.json())).not.toContain('updatedBy');

    const adminRead = await request.get(`${API_URL}/api/admin/settings`, { headers: player.headers });
    expect(adminRead.status()).toBe(403);
    const change = await patch(request, player, { requiredCredits: 150 });
    expect(change.status()).toBe(403);
    const after = await request.get(`${API_URL}/api/settings`, { headers: player.headers });
    expect((await after.json()).data.values.requiredCredits).toBe(values.requiredCredits);
  });

  test('without a login the settings are not given', async ({ request }) => {
    expect((await request.get(`${API_URL}/api/settings`)).status()).toBe(401);
    expect((await request.patch(`${API_URL}/api/admin/settings`, { data: {} })).status()).toBe(401);
  });

  test('the admin changes the fee, a game created afterwards uses it, the audit log remembers, and the change is undone', async ({ request }) => {
    const admin = await registerAdmin(request, API_URL);
    const player = await registerPlayer(request, API_URL, 'Creatore');
    await request.post(`${API_URL}/api/players/${player.id}/buy-credits`, { headers: player.headers, data: { amount: 1000 } });
    const before = (await (await request.get(`${API_URL}/api/admin/settings`, { headers: admin.headers })).json()).data.values.requiredCredits;

    try {
      const changed = await patch(request, admin, { requiredCredits: 150 }, 'prova e2e');
      expect(changed.status()).toBe(200);
      expect((await changed.json()).data).toMatchObject({ values: { requiredCredits: 150 }, updatedBy: admin.id });

      const created = await request.post(`${API_URL}/api/games`, { headers: player.headers, data: {} });
      expect(created.status()).toBe(201);
      expect((await created.json()).data.game.requiredCredits).toBe(150);

      const audit = await request.get(`${API_URL}/api/admin/audit?limit=50`, { headers: admin.headers });
      const event = (await audit.json()).data.items.find((e) => e.action === 'settings_changed' && e.actorId === admin.id);
      expect(event.details).toMatchObject({ reason: 'prova e2e', changes: { requiredCredits: { to: 150 } } });
    } finally {
      await patch(request, admin, { requiredCredits: before }, 'e2e: ripristino');
    }
    const restored = await request.get(`${API_URL}/api/settings`, { headers: player.headers });
    expect((await restored.json()).data.values.requiredCredits).toBe(before);
  });

  test('a value outside its interval, a string, an unknown key and a missing reason are refused with 400', async ({ request }) => {
    const admin = await registerAdmin(request, API_URL);

    for (const data of [
      { values: { drawCooldownSeconds: 2 }, reason: 'x' },
      { values: { requiredCredits: '150' }, reason: 'x' },
      { values: { cheat: 1 }, reason: 'x' },
      // a typo next to a valid key must not be dropped in silence while the rest changes
      { values: { drawCooldownSecond: 12, requiredCredits: 150 }, reason: 'x' },
      { values: { requiredCredits: 150 } },
      { values: {}, reason: 'x' },
    ]) {
      const response = await request.patch(`${API_URL}/api/admin/settings`, { headers: admin.headers, data });
      expect(response.status(), JSON.stringify(data)).toBe(400);
    }
  });

  test('a maximum of players below the current minimum is refused with 400, and nothing changes', async ({ request }) => {
    const admin = await registerAdmin(request, API_URL);
    const { values } = (await (await request.get(`${API_URL}/api/admin/settings`, { headers: admin.headers })).json()).data;

    const response = await patch(request, admin, { minPlayers: 10, maxPlayers: 9 });

    expect(response.status()).toBe(400);
    const after = (await (await request.get(`${API_URL}/api/admin/settings`, { headers: admin.headers })).json()).data.values;
    expect(after).toEqual(values);
  });
});
