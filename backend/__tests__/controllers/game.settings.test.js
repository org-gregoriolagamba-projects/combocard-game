/**
 * A game plays by the settings it was created with
 *
 * The game takes a copy of the settings when it is created: a change of the admin reaches the games
 * created afterwards, never the ones already waiting or in progress. A game without settings (saved
 * before they existed) uses the values of today.
 */

import { jest } from '@jest/globals';
import {
  cancelJollyChoice,
  createGame,
  getLobby,
  joinGame,
  startGame,
  startJollyChoice,
} from '../../src/controllers/game.controller.js';
import { registerPlayer, buyCredits, acceptRules } from '../../src/services/player.service.js';
import { loadSettings, updateSettings } from '../../src/services/settings.service.js';
import { createMemoryStore } from '../../src/db/store.js';
import config from '../../src/config/index.js';

describe('the settings of a game', () => {
  let gameState;
  let store;
  let anna;
  let carlo;
  let io;
  let now;
  const actor = { type: 'player', id: 'p9' };

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

  const change = (values) => updateSettings(store, gameState, { values, reason: 'test', actor });

  const newGame = async (body = {}) => {
    const { gameId } = await call(createGame, anna.id, { body });
    await call(joinGame, anna.id, { params: { gameId } });
    return { gameId, game: gameState.games[gameId] };
  };

  beforeEach(async () => {
    store = createMemoryStore({ drawCooldownSeconds: config.drawCooldownSeconds });
    gameState = { games: {}, players: {} };
    await loadSettings(store, gameState);
    anna = registerPlayer(gameState, 'Anna');
    carlo = registerPlayer(gameState, 'Carlo');
    for (const p of [anna, carlo]) {
      acceptRules(gameState, p.id);
      buyCredits(gameState, p.id, 500);
    }
    const room = { emit: () => {}, socketsJoin: () => {}, socketsLeave: () => {} };
    io = { to: () => room, in: () => room };
    now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('at the creation', () => {
    test('the game takes a copy of the current settings, and a later change does not reach it', async () => {
      const { game: before } = await newGame();
      expect(before.settings).toEqual(gameState.settings);
      const copy = { ...before.settings };

      await change({ requiredCredits: 150, jollyHoldSeconds: 60 });

      expect(gameState.games[before.id].settings).toEqual(copy);
      expect(gameState.games[before.id].requiredCredits).toBe(100);
      const second = await call(createGame, carlo.id, { body: {} }).then(({ gameId }) => gameState.games[gameId]);
      expect(second.settings).toMatchObject({ requiredCredits: 150, jollyHoldSeconds: 60 });
    });

    test('without the fee or the maximum in the body, the game uses the current ones', async () => {
      await change({ requiredCredits: 150, maxPlayers: 6 });

      const { game } = await newGame();

      expect(game).toMatchObject({ requiredCredits: 150, maxPlayers: 6 });
    });

    test('a maximum of players outside the current interval is a 400 that says the interval', async () => {
      await change({ minPlayers: 4, maxPlayers: 8 });

      await expect(call(createGame, anna.id, { body: { maxPlayers: 3 } }))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/4.*8/) });
      await expect(call(createGame, anna.id, { body: { maxPlayers: 9 } })).rejects.toMatchObject({ statusCode: 400 });
      await expect(call(createGame, anna.id, { body: { maxPlayers: 8 } })).resolves.toBeDefined();
    });

    test('the lobby shows the maximum of each game, and the current one for a game without it', async () => {
      const { game } = await newGame({ maxPlayers: 5 });
      delete game.maxPlayers;
      delete game.settings;
      await change({ maxPlayers: 7 });

      const [lobby] = await call(getLobby, anna.id);

      expect(lobby.maxPlayers).toBe(7);
    });
  });

  const startedGame = async (body = {}) => {
    const { gameId, game } = await newGame(body);
    await call(joinGame, carlo.id, { params: { gameId } });
    await call(startGame, anna.id, { params: { gameId } });
    return { gameId, game };
  };

  describe('at the start', () => {
    test('a game created before the change starts with its own minimum', async () => {
      const { gameId } = await newGame();
      await call(joinGame, carlo.id, { params: { gameId } });

      await change({ minPlayers: 3 });

      await expect(call(startGame, anna.id, { params: { gameId } })).resolves.toBeDefined();
    });

    test('a game created after the change needs the new minimum', async () => {
      await change({ minPlayers: 3 });
      const { gameId } = await newGame();
      await call(joinGame, carlo.id, { params: { gameId } });

      await expect(call(startGame, anna.id, { params: { gameId } }))
        .rejects.toMatchObject({ statusCode: 400, message: 'At least 3 players required' });
    });
  });

  describe('the jolly', () => {
    test('the time to choose is the one of the game', async () => {
      await change({ jollyHoldSeconds: 10 });
      const { gameId, game } = await startedGame();

      await call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } });

      expect(game.jollyInCorso.scadenza).toBe(now + 10_000);
    });

    test('the declarations allowed are the ones of the game', async () => {
      await change({ jollyMaxDeclarations: 1 });
      const { gameId } = await startedGame();
      await call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } });
      await call(cancelJollyChoice, carlo.id, { params: { gameId } });

      await expect(call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } }))
        .rejects.toMatchObject({ statusCode: 429 });
    });
  });

  describe('a game without settings, saved before they existed', () => {
    test('uses the values of today: the minimum, the time to choose and the declarations', async () => {
      const { gameId, game } = await newGame();
      await call(joinGame, carlo.id, { params: { gameId } });
      delete game.settings;
      delete gameState.settings;

      await call(startGame, anna.id, { params: { gameId } });
      await call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } });

      expect(game.jollyInCorso.scadenza).toBe(now + 30_000);
      for (let i = 0; i < 2; i++) {
        await call(cancelJollyChoice, carlo.id, { params: { gameId } });
        await call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } });
      }
      await call(cancelJollyChoice, carlo.id, { params: { gameId } });
      await expect(call(startJollyChoice, carlo.id, { params: { gameId }, body: { tipo: 'tris' } }))
        .rejects.toMatchObject({ statusCode: 429 });
    });
  });
});
