/**
 * Session Thunks Tests
 *
 * What happens when the player is known: the screen to show, and the reading of the game settings,
 * which never holds the entrance back and never makes it fail.
 */

import { enterGameOrHall } from '../../store/sessionThunks';
import { createTestStore } from '../test-utils';
import * as gameService from '../../services/gameService';
import * as settingsService from '../../services/settingsService';

vi.mock('../../services/gameService');
vi.mock('../../services/settingsService');

const ANSWER = {
  values: { minPlayers: 2, maxPlayers: 10, requiredCredits: 100, jollyHoldSeconds: 30, jollyMaxDeclarations: 3, drawCooldownSeconds: 8 },
  limits: { requiredCredits: { min: 1, max: 10000 } },
  defaults: {},
};

describe('enterGameOrHall', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    settingsService.getSettings.mockResolvedValue(ANSWER);
  });

  test('without a game in progress the hall opens, and the settings are read', async () => {
    await store.dispatch(enterGameOrHall({ id: 'p1', currentGameId: null }));

    expect(store.getState().ui.currentScreen).toBe('hall');
    expect(settingsService.getSettings).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(store.getState().settings.status).toBe('ready'));
    expect(store.getState().settings.values.drawCooldownSeconds).toBe(8);
  });

  test('if the settings cannot be read the hall opens anyway, and the state says so', async () => {
    settingsService.getSettings.mockRejectedValue(new Error('Impossibile contattare il server'));

    await store.dispatch(enterGameOrHall({ id: 'p1', currentGameId: null }));

    expect(store.getState().ui.currentScreen).toBe('hall');
    await vi.waitFor(() => expect(store.getState().settings.status).toBe('error'));
    expect(store.getState().settings.error).toBe('Impossibile contattare il server');
  });

  test('with a game in progress the game opens, and the settings are read as well', async () => {
    gameService.getGame.mockResolvedValue({
      id: 'g1',
      status: 'playing',
      carteEstratte: [],
      players: [{ id: 'p1', name: 'Anna' }],
    });

    await store.dispatch(enterGameOrHall({ id: 'p1', currentGameId: 'g1' }));

    expect(store.getState().ui.currentScreen).toBe('game');
    expect(settingsService.getSettings).toHaveBeenCalledTimes(1);
  });
});
