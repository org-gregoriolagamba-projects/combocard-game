/**
 * What is new waits while the game is in maintenance
 *
 * Registering, creating a game, joining one and starting one (by hand or by itself) are refused with
 * 503 and the code MAINTENANCE; an admin is never refused; who is already in a game is not interrupted
 * and a game that has started goes on. When the maintenance ends, a full game that was waiting starts.
 */

import { jest } from '@jest/globals';
import { createGame, drawCard, joinGame, startGame } from '../../src/controllers/game.controller.js';
import { setMaintenance as setMaintenanceHandler } from '../../src/controllers/admin.controller.js';
import { registerPlayer, buyCredits, acceptRules } from '../../src/services/player.service.js';
import { createMemoryStore } from '../../src/db/store.js';
import { loadNotices, stopNoticeTimers } from '../../src/services/notices.service.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('maintenance gate', () => {
  let gameState;
  let anna;
  let bruno;
  let store;
  let io;

  const call = (handler, playerId, { params = {}, body = {}, role = 'player' } = {}) =>
    new Promise((resolve, reject) => {
      const res = {
        status: () => res,
        json: (payload) => {
          resolve(JSON.parse(JSON.stringify(payload.data)));
          return res;
        },
      };
      handler({ params, body, query: {}, gameState, io, store, auth: { playerId, role } }, res, reject);
    });

  const refusal = { statusCode: 503, code: 'MAINTENANCE' };
  const maintenanceOn = (endsAt = null) => {
    gameState.maintenance = { active: true, message: 'Torno alle 22', endsAt };
  };
  const maintenanceOff = () => {
    gameState.maintenance = { active: false, message: '', endsAt: null };
  };
  const waitingGame = async (maxPlayers = 3) => (await call(createGame, anna.id, { body: { requiredCredits: 100, maxPlayers } })).gameId;

  beforeEach(async () => {
    store = createMemoryStore();
    gameState = { games: {}, players: {} };
    await loadNotices(store, gameState);
    anna = registerPlayer(gameState, 'Anna');
    bruno = registerPlayer(gameState, 'Bruno');
    [anna, bruno].forEach((p) => {
      acceptRules(gameState, p.id);
      buyCredits(gameState, p.id, 500);
    });
    const room = () => ({ emit: () => {}, socketsJoin: () => {}, socketsLeave: () => {} });
    io = { to: room, in: room, emit: () => {} };
  });

  afterEach(() => stopNoticeTimers());

  test('a player cannot create a game, and the answer says when to retry if the end is known', async () => {
    maintenanceOn(new Date(Date.now() + 600 * 1000).toISOString());

    await expect(call(createGame, anna.id, { body: { requiredCredits: 100 } })).rejects.toMatchObject({ ...refusal, retryAfter: expect.any(Number) });
    expect(Object.keys(gameState.games)).toHaveLength(0);
  });

  test('an admin creates a game and joins one', async () => {
    maintenanceOn();

    const { gameId } = await call(createGame, anna.id, { role: 'admin', body: { requiredCredits: 100, maxPlayers: 3 } });
    await expect(call(joinGame, bruno.id, { params: { gameId }, role: 'admin' })).resolves.toBeDefined();
  });

  test('a new player cannot join a game that was waiting, and does not get in', async () => {
    const gameId = await waitingGame();
    maintenanceOn();

    await expect(call(joinGame, bruno.id, { params: { gameId } })).rejects.toMatchObject(refusal);
    expect(gameState.games[gameId].players.map((p) => p.id)).not.toContain(bruno.id);
  });

  test('who is already in the game is not interrupted: a repeated join gets the answer it always had', async () => {
    const gameId = await waitingGame();
    await call(joinGame, bruno.id, { params: { gameId } });
    maintenanceOn();

    await expect(call(joinGame, bruno.id, { params: { gameId } })).rejects.toMatchObject({ statusCode: 400, message: 'Already in game' });

    gameState.games[gameId].status = 'playing';
    await expect(call(joinGame, bruno.id, { params: { gameId } })).resolves.toMatchObject({ success: true, autoStarted: true });
  });

  test('the creator cannot start a waiting game by hand, an admin can', async () => {
    const gameId = await waitingGame(3);
    await call(joinGame, anna.id, { params: { gameId } });
    await call(joinGame, bruno.id, { params: { gameId } });
    maintenanceOn();

    await expect(call(startGame, anna.id, { params: { gameId } })).rejects.toMatchObject(refusal);
    expect(gameState.games[gameId].status).toBe('waiting');

    await expect(call(startGame, anna.id, { params: { gameId }, role: 'admin' })).resolves.toBeDefined();
    expect(gameState.games[gameId].status).toBe('playing');
  });

  test('a game that has started goes on: the creator still draws', async () => {
    const gameId = await waitingGame(3);
    await call(joinGame, anna.id, { params: { gameId } });
    await call(joinGame, bruno.id, { params: { gameId } });
    await call(startGame, anna.id, { params: { gameId } });
    maintenanceOn();

    const drawn = await call(drawCard, anna.id, { params: { gameId } });

    expect(drawn).toBeDefined();
    expect(gameState.games[gameId].status).toBe('playing');
  });

  const admin = (active) => call(setMaintenanceHandler, anna.id, { role: 'admin', body: active ? { active: true, message: 'Torno alle 22' } : { active: false } });

  test('a full game waiting does not start by itself during the maintenance, and starts when it ends', async () => {
    const gameId = await waitingGame(2);
    await call(joinGame, anna.id, { params: { gameId } });
    await call(joinGame, bruno.id, { params: { gameId } }); // full: the automatic start is on its way
    await admin(true);
    await wait(250);

    expect(gameState.games[gameId].status).toBe('waiting');
    expect(gameState.players[anna.id].credits).toBe(500);

    await admin(false);
    await wait(250);

    expect(gameState.games[gameId].status).toBe('playing');
    expect(gameState.players[anna.id].credits).toBe(400);
  });

  test('turning the maintenance off starts only the games that are full', async () => {
    const carla = registerPlayer(gameState, 'Carla');
    acceptRules(gameState, carla.id);
    buyCredits(gameState, carla.id, 500);
    const full = await waitingGame(2);
    await call(joinGame, anna.id, { params: { gameId: full } });
    await call(joinGame, bruno.id, { params: { gameId: full } });
    const notFull = (await call(createGame, carla.id, { body: { requiredCredits: 100, maxPlayers: 3 } })).gameId;
    await call(joinGame, carla.id, { params: { gameId: notFull } });
    await admin(true);
    await wait(250);

    await admin(false);
    await wait(250);

    expect(gameState.games[full].status).toBe('playing');
    expect(gameState.games[notFull].status).toBe('waiting');
    expect(gameState.players[carla.id].credits).toBe(500);
  });

  test('with the maintenance off nothing changes', async () => {
    maintenanceOff();

    const { gameId } = await call(createGame, anna.id, { body: { requiredCredits: 100, maxPlayers: 3 } });
    await expect(call(joinGame, bruno.id, { params: { gameId } })).resolves.toBeDefined();
  });
});
