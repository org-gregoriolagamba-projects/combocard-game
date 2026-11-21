/**
 * Game settings in the new game form
 *
 * The form takes the limits of a game from the server: the interval of the players, the limits of
 * the fee and the hints. They are read on a 320 px phone and on a 360 px phone zoomed to 200% (180 px
 * wide) with no sideways scroll and controls of at least 44 px. With an admin (needs PostgreSQL,
 * E2E_DATABASE_URL), a change of the settings is seen in the form after the reload.
 * @tags @mobile @narrow @settings
 */

import { test, expect } from '@playwright/test';
import { PASSWORD, registerPlayer } from '../helpers/auth.js';
import { E2E_DATABASE_URL, registerAdmin } from '../helpers/admin.js';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const GUIDA_LETTA = () => window.localStorage.setItem('combocard.guida-letta', '1');

const CREDITS = 'Crediti richiesti per partecipare';
const PLAYERS = 'Numero massimo giocatori';

const settingsOf = async (request, player) =>
  (await (await request.get(`${API_URL}/api/settings`, { headers: player.headers })).json()).data;

async function signInHall(page, player) {
  await page.addInitScript(GUIDA_LETTA);
  await page.goto('/');
  await page.getByLabel(/nome utente/i).fill(player.name);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /accedi/i }).click();
  await expect(page.getByRole('button', { name: 'Prendi crediti' })).toBeVisible();
}

const openForm = async (page) => {
  await page.getByRole('button', { name: /Crea Nuova Partita/ }).click();
  await expect(page.getByLabel(PLAYERS)).toBeVisible();
};

const sidewaysBy = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('Game settings in the new game form @settings', () => {
  for (const [width, height] of [[320, 640], [180, 740]]) {
    test(`at ${width}px the form shows the limits of the server, with no sideways scroll and controls of 44px`, async ({ page, request }) => {
      const player = await registerPlayer(request, API_URL, 'Giocatore');
      const { values, limits } = await settingsOf(request, player);
      await page.setViewportSize({ width, height });
      await signInHall(page, player);

      await openForm(page);

      // What the form shows is coherent with itself: the hint, the limits of the field and the first value
      // say the same interval (the values may be changed by an admin test that runs at the same time, so
      // they are compared with the server only in that test)
      const players = page.getByLabel(PLAYERS);
      await expect(players).toHaveAccessibleDescription(/Da \d+ a \d+ giocatori/);
      const [, min, max] = (await players.getAttribute('aria-describedby').then((id) => page.locator(`[id="${id}"]`).textContent()))
        .match(/Da (\d+) a (\d+) giocatori/);
      await expect(players).toHaveAttribute('min', min);
      await expect(players).toHaveAttribute('max', max);
      await expect(players).toHaveValue(max);
      expect(Number(min)).toBe(values.minPlayers);
      const credits = page.getByLabel(CREDITS);
      await expect(credits).toHaveAttribute('min', String(limits.requiredCredits.min));
      await expect(credits).toHaveAttribute('max', String(limits.requiredCredits.max));
      await expect(credits).toHaveAccessibleDescription(new RegExp(`Da ${limits.requiredCredits.min} a ${limits.requiredCredits.max} crediti`));

      expect(await sidewaysBy(page)).toBeLessThanOrEqual(0);
      for (const control of [players, credits, page.getByRole('button', { name: /^Crea Partita$/ })]) {
        expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe('A change of the settings is seen in the form @settings @admin', () => {
  test.skip(!E2E_DATABASE_URL, 'needs a server on PostgreSQL: set E2E_DATABASE_URL');
  // The settings are shared by every test that runs against the same server, so this test runs in one project
  // only (two projects in parallel would change and put back the same value on top of each other)
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'it changes the settings of the server: one project only');
  });

  test('the new maximum of players is in the hint, the limit of the field and the first value', async ({ page, request }) => {
    const admin = await registerAdmin(request, API_URL);
    const player = await registerPlayer(request, API_URL, 'Giocatore');
    const { values, defaults } = await settingsOf(request, player);
    const patch = (maxPlayers, reason) =>
      request.patch(`${API_URL}/api/admin/settings`, { headers: admin.headers, data: { values: { maxPlayers }, reason } });
    const changed = defaults.maxPlayers === 8 ? 7 : 8;

    try {
      expect((await patch(changed, 'e2e: il modulo legge i parametri')).status()).toBe(200);
      await signInHall(page, player);

      await openForm(page);

      const players = page.getByLabel(PLAYERS);
      await expect(players).toHaveAttribute('max', String(changed));
      await expect(players).toHaveAccessibleDescription(new RegExp(`Da ${values.minPlayers} a ${changed} giocatori`));
      await expect(players).toHaveValue(String(changed));
    } finally {
      // Put back a value that is always the same, not the one read at the start (another run may have changed it)
      await patch(defaults.maxPlayers, 'e2e: ripristino');
    }
    expect((await settingsOf(request, player)).values.maxPlayers).toBe(defaults.maxPlayers);
  });
});
