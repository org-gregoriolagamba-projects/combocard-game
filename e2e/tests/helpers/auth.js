/**
 * Authentication helpers for the API tests
 */

import { readFileSync } from 'node:fs';

// The version of the terms the frontend shows, read from its file as text: the frontend package is
// not an ES module (importing the file fails on some Node versions), and a regular expression is enough
const FRONTEND_TERMS_VERSION = readFileSync(new URL('../../../frontend/src/config/legale.js', import.meta.url), 'utf8')
  .match(/versione:\s*["']([^"']+)["']/)?.[1];
if (!FRONTEND_TERMS_VERSION) {
  throw new Error('Cannot read the version of the terms from frontend/src/config/legale.js');
}

export const PASSWORD = 'test-password-123';

/**
 * What a registration carries: the acceptance of the terms of use, with the version the frontend
 * shows. The test passes only if that version is the one of the server (that is the check that the
 * two constants are aligned).
 */
export const TERMS = { acceptTerms: true, termsVersion: FRONTEND_TERMS_VERSION };

export const TERMS_LABEL = "Ho letto l'informativa sulla privacy e accetto i termini d'uso";

/**
 * Tick the box of the terms in the registration form
 * @param {Page} page - Playwright page, on the registration form
 */
export const acceptTermsOnForm = (page) => page.getByLabel(TERMS_LABEL).check();

let counter = 0;

/**
 * Build a username no other test is using: usernames are unique
 * @param {string} base - Readable prefix
 * @returns {string} Unique username, within the length limit
 */
export function uniqueUsername(base = 'Player') {
  counter += 1;
  const suffix = `${Date.now().toString(36)}${process.pid.toString(36)}${counter}`;
  return `${base.slice(0, 29 - suffix.length)}_${suffix}`;
}

/**
 * Create an account
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} apiUrl - Backend URL
 * @param {string} base - Readable prefix of the username
 * @param {Object} [options]
 * @param {boolean} [options.acceptRules=true] - Confirm the rules too: a game does not start for a
 *   player who has not. Pass false to test what happens to a new player.
 * @returns {Promise<Object>} Player, with `token` and ready-to-use `headers`
 */
export async function registerPlayer(request, apiUrl, base, { acceptRules = true } = {}) {
  const response = await request.post(`${apiUrl}/api/auth/register`, {
    data: { username: uniqueUsername(base), password: PASSWORD, ...TERMS },
  });
  if (!response.ok()) {
    throw new Error(`Registration failed: ${response.status()} ${await response.text()}`);
  }

  const { accessToken, player } = (await response.json()).data;
  const headers = { Authorization: `Bearer ${accessToken}` };

  if (acceptRules) {
    const accepted = await request.post(`${apiUrl}/api/players/${player.id}/accept-rules`, { headers });
    if (!accepted.ok()) {
      throw new Error(`Rules confirmation failed: ${accepted.status()} ${await accepted.text()}`);
    }
  }

  return { ...player, token: accessToken, headers };
}
