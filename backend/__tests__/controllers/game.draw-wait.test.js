/**
 * The wait between draws, in the classic mode (the creator draws)
 *
 * The server keeps the wait: a draw that comes too soon is refused with 429 and the seconds that are
 * left. The wait does not run while a player chooses the card for the jolly: the pause does not make
 * it shorter nor longer. (With the turns the same rule is in game.turns.test.js.)
 */

import { jest } from '@jest/globals';
import {
  cancelJollyChoice,
  createGame,
  drawCard,
  joinGame,
  startGame,
  startJollyChoice,
} from '../../src/controllers/game.controller.js';
import { registerPlayer, buyCredits, acceptRules } from '../../src/services/player.service.js';
import { legacySettings } from '../../src/services/settings.service.js';
import { createMemoryStore } from '../../src/db/store.js';

const COOLDOWN = 8000;
const HOLD = 30000;

describe('the wait between draws, drawn by the creator', () => {
  let gameState;
  let anna;
  let carlo;
  let io;
  const store = createMemoryStore();

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

  const startedGame = async () => {
    const { gameId } = await call(createGame, anna.id, { body: { requiredCredits: 100 } });
    await call(joinGame, anna.id, { params: { gameId } });
    await call(joinGame, carlo.id, { params: { gameId } });
    await call(startGame, anna.id, { params: { gameId } });
    return gameId;
  };
  const draw = (gameId) => call(drawCard, anna.id, { params: { gameId } });
  const avanza = (ms) => jest.advanceTimersByTime(ms);

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-01-01T10:00:00Z') });
    gameState = { games: {}, players: {} };
    anna = registerPlayer(gameState, 'Anna');
    carlo = registerPlayer(gameState, 'Carlo');
    for (const p of [anna, carlo]) {
      acceptRules(gameState, p.id);
      buyCredits(gameState, p.id, 500);
    }
    const room = { emit: () => {}, socketsJoin: () => {}, socketsLeave: () => {} };
    io = { to: () => room, in: () => room };
  });

  afterEach(() => jest.useRealTimers());

  test('the first draw is not made to wait; the next one too soon is a 429 with the seconds left', async () => {
    const gameId = await startedGame();

    await expect(draw(gameId)).resolves.toBeDefined();
    await expect(draw(gameId)).rejects.toMatchObject({ statusCode: 429, retryAfter: 8 });
    avanza(COOLDOWN - 1);
    await expect(draw(gameId)).rejects.toMatchObject({ statusCode: 429, retryAfter: 1 });
    avanza(1);
    await expect(draw(gameId)).resolves.toBeDefined();
  });

  test('the wait is the one of the game: a change of the admin does not reach it', async () => {
    gameState.settings = { ...legacySettings(), drawCooldownSeconds: 5 };
    const gameId = await startedGame();
    gameState.settings = { ...gameState.settings, drawCooldownSeconds: 20 };

    await draw(gameId);
    avanza(5000);

    await expect(draw(gameId)).resolves.toBeDefined();
  });

  test('two draws at the same time (a double click): one passes, the other gets a 429', async () => {
    const gameId = await startedGame();

    const results = await Promise.allSettled([draw(gameId), draw(gameId)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({ statusCode: 429 });
  });

  test('a game without settings waits as before', async () => {
    const gameId = await startedGame();
    delete gameState.games[gameId].settings;
    delete gameState.settings;

    await draw(gameId);

    await expect(draw(gameId)).rejects.toMatchObject({ statusCode: 429, retryAfter: 8 });
  });

  describe('while a player chooses the jolly', () => {
    test('nobody draws (409), and the wait that was left is the same when the choice is given up', async () => {
      const gameId = await startedGame();
      await draw(gameId);
      avanza(2000); // 6 seconds of wait are left
      await call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } });

      avanza(3000);
      await expect(draw(gameId)).rejects.toMatchObject({ statusCode: 409 });
      await call(cancelJollyChoice, carlo.id, { params: { gameId } });

      avanza(5999);
      await expect(draw(gameId)).rejects.toMatchObject({ statusCode: 429, retryAfter: 1 });
      avanza(1);
      await expect(draw(gameId)).resolves.toBeDefined();
    });

    test('when the time to choose runs out nobody ended it: the pause is counted up to that moment, not up to the next request', async () => {
      const gameId = await startedGame();
      await draw(gameId);
      avanza(2000); // 6 seconds of wait are left
      await call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } });

      // the choice ends at 30 s; a request comes one second later: 5 seconds of the wait are still left
      avanza(HOLD + 1000);

      await expect(draw(gameId)).rejects.toMatchObject({ statusCode: 429, retryAfter: 5 });
      avanza(5000);
      await expect(draw(gameId)).resolves.toBeDefined();
    });

    test('a request that comes long after the end of the choice is not made to wait for the time in between', async () => {
      const gameId = await startedGame();
      await draw(gameId);
      await call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } });

      avanza(10 * 60 * 1000);

      await expect(draw(gameId)).resolves.toBeDefined();
    });
  });
});
