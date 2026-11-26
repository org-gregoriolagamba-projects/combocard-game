/**
 * Announcement and maintenance mode, over HTTP
 *
 * Only an admin publishes and turns the maintenance on; the public status tells everybody; with the
 * maintenance on nobody new registers and a player creates and joins nothing, while an admin works
 * and a registered player still logs in. Needs a server on PostgreSQL (E2E_DATABASE_URL): with the
 * in-memory server nobody can be made admin.
 *
 * The announcement and the maintenance are shared by everybody who uses the same server, and the
 * maintenance refuses what is new to every other test: these tests run alone (`--workers=1`, as CI
 * does) and in one project (chromium); with more workers they are skipped.
 * @tags @api @admin @notices
 */

import { test, expect } from '@playwright/test';
import { PASSWORD, TERMS, registerPlayer, uniqueUsername } from '../helpers/auth.js';
import { E2E_DATABASE_URL, registerAdmin } from '../helpers/admin.js';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

test.skip(!E2E_DATABASE_URL, 'needs a server on PostgreSQL: set E2E_DATABASE_URL');
test.describe.configure({ mode: 'serial' });

const status = async (request) => (await (await request.get(`${API_URL}/api/status`)).json()).data;
const publish = (request, admin, data) => request.put(`${API_URL}/api/admin/announcement`, { headers: admin.headers, data });
const maintenance = (request, admin, data) => request.put(`${API_URL}/api/admin/maintenance`, { headers: admin.headers, data });
const newGame = (request, player) =>
  request.post(`${API_URL}/api/games`, { headers: player.headers, data: { requiredCredits: 100, maxPlayers: 4 } });

test.describe('Notices @notices', () => {
  let admin;

  test.beforeEach(async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'it changes what every user of the server sees: one project only');
    test.skip(testInfo.config.workers > 1, 'it turns the maintenance on for every other test: run it with --workers=1');
    admin = await registerAdmin(request, API_URL, 'Avvisi');
  });

  // Whatever happens, the server is left open and without an announcement
  test.afterEach(async ({ request }) => {
    if (admin) {
      await maintenance(request, admin, { active: false });
      await request.delete(`${API_URL}/api/admin/announcement`, { headers: admin.headers });
    }
  });

  test('a player cannot use any of the routes of the admin; without a session it is 401', async ({ request }) => {
    const player = await registerPlayer(request, API_URL, 'Giocatore');
    const h = { headers: player.headers };

    expect((await request.get(`${API_URL}/api/admin/notices`, h)).status()).toBe(403);
    expect((await publish(request, player, { message: 'x', severity: 'info' })).status()).toBe(403);
    expect((await request.delete(`${API_URL}/api/admin/announcement`, h)).status()).toBe(403);
    expect((await maintenance(request, player, { active: true, message: 'x' })).status()).toBe(403);

    expect((await request.get(`${API_URL}/api/admin/notices`)).status()).toBe(401);
    expect((await request.put(`${API_URL}/api/admin/maintenance`, { data: { active: false } })).status()).toBe(401);
    expect((await status(request)).maintenance).toBeNull();
  });

  test('the admin publishes an announcement and everybody reads it, without a session; a new one raises the version; withdrawn, it is gone', async ({ request }) => {
    const first = await publish(request, admin, { message: 'Alle 22 manutenzione', severity: 'importante' });
    expect(first.status()).toBe(200);
    const version = (await first.json()).data.announcement.version;

    expect((await status(request)).announcement).toMatchObject({ version, message: 'Alle 22 manutenzione', severity: 'importante' });

    await publish(request, admin, { message: 'Un altro', severity: 'info' });
    expect((await status(request)).announcement).toMatchObject({ version: version + 1, message: 'Un altro' });

    const withdrawn = await request.delete(`${API_URL}/api/admin/announcement`, { headers: admin.headers });
    expect(withdrawn.status()).toBe(200);
    expect((await status(request)).announcement).toBeNull();
  });

  test('a message with markup comes back exactly as written; an empty or too long one is refused', async ({ request }) => {
    const odd = '<script>alert(1)</script>';
    expect((await publish(request, admin, { message: odd, severity: 'info' })).status()).toBe(200);
    expect((await status(request)).announcement.message).toBe(odd);

    expect((await publish(request, admin, { message: '   ', severity: 'info' })).status()).toBe(400);
    expect((await publish(request, admin, { message: 'x'.repeat(281), severity: 'info' })).status()).toBe(400);
    expect((await publish(request, admin, { message: 'x', severity: 'urgente' })).status()).toBe(400);
  });

  test('an announcement that has not started is not told yet', async ({ request }) => {
    const later = new Date(Date.now() + 3600 * 1000).toISOString();

    await publish(request, admin, { message: 'Più tardi', severity: 'info', startsAt: later });

    expect((await status(request)).announcement).toBeNull();
    const full = (await (await request.get(`${API_URL}/api/admin/notices`, { headers: admin.headers })).json()).data;
    expect(full.announcement).toMatchObject({ active: true, message: 'Più tardi' });
  });

  test('turning the maintenance on needs the message', async ({ request }) => {
    expect((await maintenance(request, admin, { active: true })).status()).toBe(400);
    expect((await status(request)).maintenance).toBeNull();
  });

  test('with the maintenance on nobody new registers, a player creates nothing, an admin works and a registered player still logs in', async ({ request }) => {
    const player = await registerPlayer(request, API_URL, 'Prima');
    await request.post(`${API_URL}/api/players/${player.id}/buy-credits`, { headers: player.headers, data: { amount: 500 } });
    await request.post(`${API_URL}/api/players/${admin.id}/buy-credits`, { headers: admin.headers, data: { amount: 500 } });

    const on = await maintenance(request, admin, { active: true, message: 'Torno alle 22' });
    expect(on.status()).toBe(200);
    expect((await status(request)).maintenance).toMatchObject({ active: true, message: 'Torno alle 22' });
    expect((await (await request.get(`${API_URL}/api/health`)).json()).data.maintenance).toBe(true);

    const registration = await request.post(`${API_URL}/api/auth/register`, { data: { username: uniqueUsername('Nuovo'), password: PASSWORD, ...TERMS } });
    expect(registration.status()).toBe(503);
    expect((await registration.json()).code).toBe('MAINTENANCE');

    expect((await newGame(request, player)).status()).toBe(503);
    expect((await newGame(request, admin)).status()).toBe(201);

    const login = await request.post(`${API_URL}/api/auth/login`, { data: { username: player.name, password: PASSWORD } });
    expect(login.status()).toBe(200);
  });

  test('turned off, everything works again; a game that was created before is joined only after', async ({ request }) => {
    const player = await registerPlayer(request, API_URL, 'Dopo');
    await request.post(`${API_URL}/api/players/${player.id}/buy-credits`, { headers: player.headers, data: { amount: 500 } });
    const guest = await registerPlayer(request, API_URL, 'Ospite');
    await request.post(`${API_URL}/api/players/${guest.id}/buy-credits`, { headers: guest.headers, data: { amount: 500 } });
    const created = await newGame(request, player);
    const gameId = (await created.json()).data.gameId;

    await maintenance(request, admin, { active: true, message: 'Torno presto' });
    const refused = await request.post(`${API_URL}/api/games/${gameId}/join`, { headers: guest.headers });
    expect(refused.status()).toBe(503);

    const off = await maintenance(request, admin, { active: false });
    expect((await off.json()).data.changed).toBe(true);
    expect((await status(request)).maintenance).toBeNull();
    const joined = await request.post(`${API_URL}/api/games/${gameId}/join`, { headers: guest.headers });
    expect(joined.status()).toBe(200);
  });
});
