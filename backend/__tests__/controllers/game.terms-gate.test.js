/**
 * Creating a game, joining one and buying credits wait for the acceptance of the terms of use.
 *
 * The screen asks for the acceptance, but a client could skip the screen: the server refuses with
 * 403 and the code TERMS_REQUIRED. Who is already in a game is not interrupted.
 */

import { createGame, getGame, joinGame } from '../../src/controllers/game.controller.js';
import { buyCredits as buyCreditsHandler } from '../../src/controllers/player.controller.js';
import { registerPlayer, buyCredits, acceptRules, acceptTerms } from '../../src/services/player.service.js';
import { createMemoryStore } from '../../src/db/store.js';

describe('terms gate', () => {
  let gameState;
  let anna;
  let bruno;
  let store;
  let io;

  const call = (handler, playerId, { params = {}, body = {} } = {}) =>
    new Promise((resolve, reject) => {
      const res = {
        status: () => res,
        json: (payload) => {
          resolve(JSON.parse(JSON.stringify(payload.data)));
          return res;
        },
      };
      handler({ params, body, gameState, io, store, auth: { playerId, role: 'player' } }, res, reject);
    });

  const refusal = { statusCode: 403, code: 'TERMS_REQUIRED' };

  beforeEach(() => {
    gameState = { games: {}, players: {} };
    anna = registerPlayer(gameState, 'Anna');
    bruno = registerPlayer(gameState, 'Bruno', { termsVersion: null });
    [anna, bruno].forEach((p) => {
      acceptRules(gameState, p.id);
      buyCredits(gameState, p.id, 500);
    });
    store = createMemoryStore();
    const room = () => ({ emit: () => {}, socketsJoin: () => {}, socketsLeave: () => {} });
    io = { to: room, in: room };
  });

  const annaGame = async () => (await call(createGame, anna.id, { body: { requiredCredits: 100, maxPlayers: 3 } })).gameId;

  test('a player who has not accepted cannot create a game', async () => {
    await expect(call(createGame, bruno.id, { body: { requiredCredits: 100, maxPlayers: 3 } })).rejects.toMatchObject(refusal);
  });

  test('a player who has not accepted cannot join a game', async () => {
    const gameId = await annaGame();

    await expect(call(joinGame, bruno.id, { params: { gameId } })).rejects.toMatchObject(refusal);
    expect(gameState.games[gameId].players.map((p) => p.id)).not.toContain(bruno.id);
  });

  test('a player who has not accepted cannot buy credits', async () => {
    await expect(call(buyCreditsHandler, bruno.id, { params: { playerId: bruno.id }, body: { amount: 100 } })).rejects.toMatchObject(refusal);
  });

  test('after the acceptance the same player can join and buy', async () => {
    acceptTerms(gameState, bruno.id, '2026-1');

    const gameId = await annaGame();

    await expect(call(joinGame, bruno.id, { params: { gameId } })).resolves.toBeDefined();
    await expect(call(buyCreditsHandler, bruno.id, { params: { playerId: bruno.id }, body: { amount: 100 } })).resolves.toBeDefined();
  });

  test('after the acceptance the same player can create a game', async () => {
    acceptTerms(gameState, bruno.id, '2026-1');

    await expect(call(createGame, bruno.id, { body: { requiredCredits: 100 } })).resolves.toBeDefined();
  });

  test('who is already in a game is not interrupted: a repeated join gets the answer it always had', async () => {
    acceptTerms(gameState, bruno.id, '2026-1');
    const gameId = await annaGame();
    await call(joinGame, bruno.id, { params: { gameId } });
    bruno.terminiVersione = null;
    bruno.terminiAccettatiIl = null;

    await expect(call(joinGame, bruno.id, { params: { gameId } })).rejects.toMatchObject({ statusCode: 400, message: 'Already in game' });

    gameState.games[gameId].status = 'playing';
    await expect(call(joinGame, bruno.id, { params: { gameId } })).resolves.toMatchObject({ success: true, autoStarted: true });
  });

  test('what a client receives about a game never carries the acceptance of anybody', async () => {
    acceptTerms(gameState, bruno.id, '2026-1');
    const gameId = await annaGame();
    await call(joinGame, bruno.id, { params: { gameId } });

    const view = await call(getGame, anna.id, { params: { gameId } });

    expect(JSON.stringify(view)).not.toMatch(/termini/i);
  });
});
