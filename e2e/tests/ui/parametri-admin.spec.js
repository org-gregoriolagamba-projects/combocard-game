/**
 * Admin screen: the game settings
 *
 * The admin changes a game parameter from the Parametri tab, with a reason, and finds it in the log; a
 * value outside its interval is explained and not saved. The tab fits a 320 px phone and a 360 px phone
 * zoomed to 200% (180 px wide). A player never sees the way to the admin area (admin-screen.spec.js).
 * Needs a server on PostgreSQL (E2E_DATABASE_URL): with the in-memory server nobody can be made admin.
 * @tags @mobile @admin @settings
 */

import { test, expect } from '@playwright/test';
import { PASSWORD } from '../helpers/auth.js';
import { E2E_DATABASE_URL, registerAdmin } from '../helpers/admin.js';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

test.skip(!E2E_DATABASE_URL, 'needs a server on PostgreSQL: set E2E_DATABASE_URL');

const LABELS = [
  'Giocatori minimi per avviare',
  'Giocatori massimi',
  "Quota d'ingresso predefinita",
  'Pausa del Jolly',
  'Dichiarazioni del Jolly per partita',
  'Attesa tra le estrazioni',
];

const settingsOf = async (request, player) =>
  (await (await request.get(`${API_URL}/api/settings`, { headers: player.headers })).json()).data;

async function openParametri(page, admin) {
  await page.addInitScript(() => window.localStorage.setItem('combocard.guida-letta', '1'));
  await page.goto('/');
  await page.getByLabel(/nome utente/i).fill(admin.name);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /accedi/i }).click();
  await page.getByRole('button', { name: 'Amministrazione' }).click();
  await page.getByRole('tab', { name: 'Parametri' }).click();
  await expect(campo(page, LABELS[0])).toBeVisible();
}

// The label is a part of the name of its "Ripristina" button: the field is found by the exact label
const campo = (page, label) => page.getByLabel(label, { exact: true });

const sidewaysBy = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('Admin screen: the game settings on a narrow phone @admin @narrow', () => {
  for (const [width, height] of [[320, 640], [180, 740]]) {
    test(`at ${width}px the six fields fit, with an error and a long reason too, and every control is 44px`, async ({ page, request }) => {
      const admin = await registerAdmin(request, API_URL);
      await page.setViewportSize({ width, height });
      await openParametri(page, admin);

      for (const label of LABELS) {
        await expect(campo(page, label)).toBeVisible();
      }
      // An error on a field and the longest reason: the hardest case for the width
      await campo(page, 'Attesa tra le estrazioni').fill('99');
      await campo(page, 'Motivo').fill('x'.repeat(200));
      await page.getByRole('button', { name: 'Salva' }).click();
      await expect(campo(page, 'Attesa tra le estrazioni')).toHaveAccessibleDescription('Da 3 a 30 secondi');

      expect(await sidewaysBy(page)).toBeLessThanOrEqual(0);
      const controls = [
        ...(await page.getByRole('spinbutton').all()),
        ...(await page.getByRole('button', { name: /^Ripristina / }).all()),
        ...(await page.getByRole('tab').all()),
        campo(page, 'Motivo'),
        page.getByRole('button', { name: 'Salva' }),
      ];
      for (const control of controls) {
        expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe('Admin screen: a change of the game settings @admin @settings', () => {
  // The settings are shared by every test that runs against the same server: this one runs in one project
  // only (two projects in parallel would change and put back the same value on top of each other)
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'it changes the settings of the server: one project only');
  });

  test('the admin changes a parameter with a reason and finds it in the log; a value out of the interval is not saved', async ({ page, request }) => {
    const admin = await registerAdmin(request, API_URL);
    const { values, defaults } = await settingsOf(request, admin);
    // Nothing else in the tests depends on the limit of the declarations of the jolly, and a larger one breaks nothing
    const target = values.jollyMaxDeclarations === 4 ? 5 : 4;
    const field = () => campo(page, 'Dichiarazioni del Jolly per partita');

    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await openParametri(page, admin);

      await field().fill(String(target));
      await campo(page, 'Motivo').fill('e2e: prova dei parametri');
      await page.getByRole('button', { name: 'Salva' }).click();

      await expect(page.getByText('Parametri di gioco aggiornati')).toBeVisible();
      await expect(field()).toHaveValue(String(target));
      await expect(field()).toHaveAccessibleDescription(new RegExp(`^Attuale ${target} `));
      await expect(campo(page, 'Motivo')).toHaveValue('');
      expect((await settingsOf(request, admin)).values.jollyMaxDeclarations).toBe(target);

      await page.getByRole('tab', { name: 'Registro' }).click();
      const log = page.getByRole('list', { name: 'Azioni registrate' });
      await expect(log).toContainText(
        `ha cambiato i parametri di gioco: Dichiarazioni del Jolly per partita da ${values.jollyMaxDeclarations} a ${target} dichiarazioni`,
      );
      await expect(log).toContainText('«e2e: prova dei parametri»');

      // A value out of the interval is explained and not saved
      await page.getByRole('tab', { name: 'Parametri' }).click();
      await field().fill('99');
      await campo(page, 'Motivo').fill('e2e: valore fuori intervallo');
      await page.getByRole('button', { name: 'Salva' }).click();
      await expect(field()).toHaveAccessibleDescription('Da 1 a 10 dichiarazioni');
      expect((await settingsOf(request, admin)).values.jollyMaxDeclarations).toBe(target);
    } finally {
      // Put back a value that is always the same, not the one read at the start
      await request.patch(`${API_URL}/api/admin/settings`, {
        headers: admin.headers,
        data: { values: { jollyMaxDeclarations: defaults.jollyMaxDeclarations }, reason: 'e2e: ripristino' },
      });
    }
    expect((await settingsOf(request, admin)).values.jollyMaxDeclarations).toBe(defaults.jollyMaxDeclarations);
  });
});
