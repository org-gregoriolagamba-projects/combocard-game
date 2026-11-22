/**
 * The terms of use on screen
 *
 * The registration does not go on without the box; the privacy notice and the terms open without
 * an account, from the footer, and "Indietro" goes back.
 * @tags @mobile @terms
 */

import { test, expect } from '@playwright/test';
import { PASSWORD, TERMS_LABEL, uniqueUsername } from '../helpers/auth.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.describe('Terms of use on screen @terms', () => {
  test('the registration does not go on without the box, and then it does', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /crea un account/i }).click();
    await page.getByLabel(/nome utente/i).fill(uniqueUsername('Termini'));
    await page.getByLabel(/password/i).fill(PASSWORD);

    await page.getByRole('button', { name: /registrati/i }).click();

    await expect(page.getByRole('alert')).toContainText("Per registrarti devi accettare l'informativa e i termini d'uso");
    await expect(page.getByLabel(TERMS_LABEL)).toBeFocused();

    await page.getByLabel(TERMS_LABEL).check();
    await page.getByRole('button', { name: /registrati/i }).click();

    await expect(page.getByRole('heading', { name: 'Prima di giocare: le regole' })).toBeVisible({ timeout: 10000 });
  });

  test('the texts open from the footer without an account, and Indietro goes back to the login', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('contentinfo').getByRole('button', { name: 'Informativa' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Informativa sulla privacy' })).toBeVisible();

    await page.getByRole('button', { name: "Termini d'uso" }).click();
    await expect(page.getByRole('heading', { level: 1, name: "Termini d'uso" })).toBeVisible();
    await expect(page.getByText(/almeno 14 anni/)).toBeVisible();

    await page.getByRole('button', { name: /indietro/i }).click();
    await expect(page.getByRole('heading', { name: /combocard/i })).toBeVisible();
  });

  test('the texts fit the phone: no sideways scroll', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('button', { name: 'Informativa' }).click();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    expect(overflow).toBe(false);
  });
});
