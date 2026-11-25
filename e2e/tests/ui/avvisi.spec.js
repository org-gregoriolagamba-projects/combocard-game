/**
 * Announcement and maintenance mode on screen
 *
 * A player who is connected sees the announcement the admin publishes without reloading, closes it and
 * does not see it again until there is a new one; with the maintenance on a visitor sees its screen and
 * the admin comes in from there, a player in the hall is sent to the screen and back when it ends;
 * the admin publishes from the Avvisi tab. Needs a server on PostgreSQL (E2E_DATABASE_URL).
 *
 * The announcement and the maintenance are shared by everybody who uses the same server: these tests
 * run alone (`--workers=1`, as CI does) and in one project (chromium); with more workers they are skipped.
 * @tags @mobile @admin @notices
 */

import { test, expect } from '@playwright/test';
import { PASSWORD, registerPlayer } from '../helpers/auth.js';
import { E2E_DATABASE_URL, registerAdmin } from '../helpers/admin.js';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

test.skip(!E2E_DATABASE_URL, 'needs a server on PostgreSQL: set E2E_DATABASE_URL');
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.describe.configure({ mode: 'serial' });

const publish = (request, admin, data) => request.put(`${API_URL}/api/admin/announcement`, { headers: admin.headers, data });
const maintenance = (request, admin, data) => request.put(`${API_URL}/api/admin/maintenance`, { headers: admin.headers, data });

async function signIn(page, user) {
  await page.addInitScript(() => window.localStorage.setItem('combocard.guida-letta', '1'));
  await page.goto('/');
  await page.getByLabel(/nome utente/i).fill(user.name);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /accedi/i }).click();
}

const hall = (page) => page.getByRole('heading', { name: 'Hall' });

test.describe('Notices on screen @notices', () => {
  let admin;

  test.beforeEach(async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'it changes what every user of the server sees: one project only');
    test.skip(testInfo.config.workers > 1, 'it turns the maintenance on for every other test: run it with --workers=1');
    admin = await registerAdmin(request, API_URL, 'AvvisiUi');
  });

  test.afterEach(async ({ request }) => {
    if (admin) {
      await maintenance(request, admin, { active: false });
      await request.delete(`${API_URL}/api/admin/announcement`, { headers: admin.headers });
    }
  });

  test('a connected player sees the announcement at once, closes it, and sees the next one', async ({ page, request }) => {
    const player = await registerPlayer(request, API_URL, 'Lettore');
    await signIn(page, player);
    await expect(hall(page)).toBeVisible({ timeout: 10000 });

    await publish(request, admin, { message: 'Alle 22 manutenzione', severity: 'importante' });

    const banner = page.getByRole('alert').filter({ hasText: 'Alle 22 manutenzione' });
    await expect(banner).toBeVisible({ timeout: 10000 });
    await banner.getByRole('button', { name: /chiudi/i }).click();
    await expect(banner).toHaveCount(0);

    await page.reload();
    await expect(hall(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Alle 22 manutenzione')).toHaveCount(0);

    await publish(request, admin, { message: 'Un nuovo avviso', severity: 'info' });
    await expect(page.getByRole('status').filter({ hasText: 'Un nuovo avviso' })).toBeVisible({ timeout: 10000 });
  });

  test('a message with markup is shown as text', async ({ page, request }) => {
    const player = await registerPlayer(request, API_URL, 'Testo');
    await signIn(page, player);
    await expect(hall(page)).toBeVisible({ timeout: 10000 });

    await publish(request, admin, { message: '<b>grassetto</b>', severity: 'info' });

    await expect(page.getByText('<b>grassetto</b>')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('b')).toHaveCount(0);
  });

  test('with the maintenance on a visitor sees its screen and the admin comes in from there', async ({ page, request }) => {
    await maintenance(request, admin, { active: true, message: 'Torno alle 22' });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Manutenzione' })).toBeVisible();
    await expect(page.getByText('Torno alle 22')).toBeVisible();
    await page.getByRole('button', { name: /sono un amministratore/i }).click();
    await page.getByLabel(/nome utente/i).fill(admin.name);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /accedi/i }).click();

    await expect(hall(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('status').filter({ hasText: 'Manutenzione accesa' })).toBeVisible();
  });

  test('a player in the hall is sent to the maintenance screen without reloading, and back when it ends', async ({ page, request }) => {
    const player = await registerPlayer(request, API_URL, 'InHall');
    await signIn(page, player);
    await expect(hall(page)).toBeVisible({ timeout: 10000 });

    await maintenance(request, admin, { active: true, message: 'Un attimo' });
    await expect(page.getByRole('heading', { name: 'Manutenzione' })).toBeVisible({ timeout: 10000 });
    await expect(hall(page)).toHaveCount(0);

    await maintenance(request, admin, { active: false });
    await expect(hall(page)).toBeVisible({ timeout: 10000 });
  });

  test('the admin publishes and withdraws from the Avvisi tab', async ({ page }) => {
    await signIn(page, admin);
    await page.getByRole('button', { name: 'Amministrazione' }).click();
    await page.getByRole('tab', { name: 'Avvisi' }).click();

    await page.getByLabel("Testo dell'avviso").fill('Prova dalla scheda');
    await page.getByRole('button', { name: 'Pubblica' }).click();

    await expect(page.getByText(/Avviso attivo \(versione \d+\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Ritira' }).click();
    await expect(page.getByText('Nessun avviso attivo')).toBeVisible();
  });
});
