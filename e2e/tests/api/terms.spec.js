/**
 * Acceptance of the terms of use, over HTTP
 *
 * A registration carries the acceptance with the version of the texts; a player can accept again
 * through a route of their own, and an old version is refused. A player who has not accepted cannot
 * be made from outside (the server keeps the players in memory), so the refusal of the game
 * routes is covered by the backend tests.
 * @tags @critical @terms
 */

import { test, expect } from '@playwright/test';
import { PASSWORD, TERMS, registerPlayer, uniqueUsername } from '../helpers/auth.js';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

test.describe('Acceptance of the terms @terms', () => {
  test('a registration without the acceptance is refused', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: { username: uniqueUsername('NoTerms'), password: PASSWORD },
    });

    expect(response.status()).toBe(400);
  });

  test('a registration with acceptTerms false is refused', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: { username: uniqueUsername('NoTerms'), password: PASSWORD, ...TERMS, acceptTerms: false },
    });

    expect(response.status()).toBe(400);
  });

  test('a registration with the version of an old text is refused', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/register`, {
      data: { username: uniqueUsername('OldTerms'), password: PASSWORD, ...TERMS, termsVersion: '2025-1' },
    });

    expect(response.status()).toBe(400);
  });

  test('a registered player has nothing left to accept', async ({ request }) => {
    const player = await registerPlayer(request, API_URL, 'Terms');

    const me = await request.get(`${API_URL}/api/players/${player.id}`, { headers: player.headers });

    expect((await me.json()).data).toMatchObject({ terminiDaAccettare: false, terminiVersione: TERMS.termsVersion });
  });

  test('accepting again answers 200 twice, and an old version is a 409 with its code', async ({ request }) => {
    const player = await registerPlayer(request, API_URL, 'Terms');
    const url = `${API_URL}/api/players/${player.id}/accept-terms`;

    const first = await request.post(url, { headers: player.headers, data: { version: TERMS.termsVersion } });
    const second = await request.post(url, { headers: player.headers, data: { version: TERMS.termsVersion } });
    const old = await request.post(url, { headers: player.headers, data: { version: '2025-1' } });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect((await second.json()).data.terminiAccettatiIl).toBe((await first.json()).data.terminiAccettatiIl);
    expect(old.status()).toBe(409);
    expect((await old.json()).code).toBe('TERMS_VERSION_OUTDATED');
  });

  test('nobody accepts for another player', async ({ request }) => {
    const anna = await registerPlayer(request, API_URL, 'Anna');
    const bruno = await registerPlayer(request, API_URL, 'Bruno');

    const response = await request.post(`${API_URL}/api/players/${anna.id}/accept-terms`, {
      headers: bruno.headers,
      data: { version: TERMS.termsVersion },
    });

    expect(response.status()).toBe(403);
  });

  test('the route needs a session', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/players/someone/accept-terms`, { data: { version: TERMS.termsVersion } });

    expect(response.status()).toBe(401);
  });
});
