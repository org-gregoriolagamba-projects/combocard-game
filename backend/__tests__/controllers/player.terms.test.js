/**
 * Acceptance of the terms of use
 *
 * A player accepts once, with the version of the texts they saw. The date and the version are saved
 * with the player; an old version is refused, a repetition changes nothing.
 */

import { jest } from '@jest/globals';
import { acceptTerms, getPlayer } from '../../src/controllers/player.controller.js';
import { registerPlayer } from '../../src/services/player.service.js';
import { createMemoryStore } from '../../src/db/store.js';

describe('accept-terms', () => {
  let gameState;
  let store;
  let anna;
  let errorSpy;

  const call = (handler, playerId, { body = {} } = {}) =>
    new Promise((resolve, reject) => {
      const res = {
        status: () => res,
        json: (payload) => {
          resolve(JSON.parse(JSON.stringify(payload.data)));
          return res;
        },
      };
      handler({ params: { playerId }, body, gameState, store, auth: { playerId, role: 'player' } }, res, reject);
    });

  beforeEach(() => {
    gameState = { games: {}, players: {} };
    anna = registerPlayer(gameState, 'Anna', { termsVersion: null });
    store = { ...createMemoryStore(), recordTermsAccepted: jest.fn().mockResolvedValue(undefined) };
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => errorSpy.mockRestore());

  test('the first acceptance is saved with the date and the version', async () => {
    const res = await call(acceptTerms, anna.id, { body: { version: '2026-1' } });

    expect(res).toMatchObject({ success: true, terminiVersione: '2026-1' });
    expect(res.terminiAccettatiIl).toEqual(expect.any(String));
    expect(store.recordTermsAccepted).toHaveBeenCalledTimes(1);
    expect(store.recordTermsAccepted).toHaveBeenCalledWith(anna.id, res.terminiAccettatiIl, '2026-1');
    expect((await call(getPlayer, anna.id)).terminiDaAccettare).toBe(false);
  });

  test('a repetition answers the same and saves nothing again', async () => {
    const first = await call(acceptTerms, anna.id, { body: { version: '2026-1' } });
    const again = await call(acceptTerms, anna.id, { body: { version: '2026-1' } });

    expect(again.terminiAccettatiIl).toBe(first.terminiAccettatiIl);
    expect(store.recordTermsAccepted).toHaveBeenCalledTimes(1);
  });

  test('an old version is refused with 409 and TERMS_VERSION_OUTDATED, and nothing changes', async () => {
    await expect(call(acceptTerms, anna.id, { body: { version: '2025-1' } })).rejects.toMatchObject({
      statusCode: 409,
      code: 'TERMS_VERSION_OUTDATED',
    });

    expect(store.recordTermsAccepted).not.toHaveBeenCalled();
    expect(anna.terminiVersione).toBeNull();
  });

  test('when the saving fails the answer is 503 and the player goes back to not accepted', async () => {
    store.recordTermsAccepted.mockRejectedValue(new Error('down'));

    await expect(call(acceptTerms, anna.id, { body: { version: '2026-1' } })).rejects.toMatchObject({ statusCode: 503 });

    expect(anna.terminiVersione).toBeNull();
    expect(anna.terminiAccettatiIl).toBeNull();
  });

  test('getPlayer tells whether there is something left to accept', async () => {
    expect((await call(getPlayer, anna.id)).terminiDaAccettare).toBe(true);
  });
});
