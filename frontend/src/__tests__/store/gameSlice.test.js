import gameReducer, {
  clearJollyInCorso,
  declareJolly,
  drawCard,
  playJolly,
  setGame,
  setJollyInCorso,
  setTurno,
} from '../../store/slices/gameSlice';
import * as gameService from '../../services/gameService';
import { createTestStore, mockGameState } from '../test-utils';

vi.mock('../../services/gameService');

const hold = (overrides = {}) => ({ playerId: 'anna', name: 'Anna', tipo: 'tris', scadenza: 1_000_000, ...overrides });
const withGame = (jollyInCorso = null) => ({
  ...mockGameState,
  game: { ...mockGameState.game, jollyInCorso },
});

describe('the pause for the jolly choice in the game state', () => {
  test('setJollyInCorso keeps who is choosing with the game', () => {
    const state = gameReducer(withGame(), setJollyInCorso(hold()));

    expect(state.game.jollyInCorso).toEqual(hold());
  });

  test('without a game there is nothing to change and nothing breaks', () => {
    const state = gameReducer({ ...mockGameState, game: null }, setJollyInCorso(hold()));

    expect(state.game).toBeNull();
  });

  test('clearJollyInCorso without a player ends any pause', () => {
    const state = gameReducer(withGame(hold()), clearJollyInCorso());

    expect(state.game.jollyInCorso).toBeNull();
  });

  test('with a player it ends only that player\'s pause: an old message cannot end another one', () => {
    const state = gameReducer(withGame(hold({ playerId: 'carlo' })), clearJollyInCorso('anna'));

    expect(state.game.jollyInCorso).toEqual(hold({ playerId: 'carlo' }));
  });

  test('declaring the jolly stores the pause the server answers with', async () => {
    gameService.startJollyChoice.mockResolvedValue({ success: true, jollyInCorso: hold() });
    const store = createTestStore({ game: withGame() });

    await store.dispatch(declareJolly({ gameId: 'game-456', tipo: 'tris' }));

    expect(gameService.startJollyChoice).toHaveBeenCalledWith('game-456', 'tris');
    expect(store.getState().game.game.jollyInCorso).toEqual(hold());
  });

  test('a refused declaration changes nothing and carries the reason', async () => {
    gameService.startJollyChoice.mockRejectedValue(new Error('Un altro giocatore sta scegliendo il Jolly'));
    const store = createTestStore({ game: withGame() });

    const result = await store.dispatch(declareJolly({ gameId: 'game-456', tipo: 'tris' }));

    expect(result.payload).toBe('Un altro giocatore sta scegliendo il Jolly');
    expect(store.getState().game.game.jollyInCorso).toBeNull();
  });

  test('using the jolly ends the pause', async () => {
    gameService.useJolly.mockResolvedValue({ convertedTo: { valore: 'Sei', seme: 'Denari' } });
    const store = createTestStore({ game: withGame(hold()) });

    await store.dispatch(playJolly({ gameId: 'game-456', row: 0, col: 0, tipo: 'tris' }));

    expect(store.getState().game.game.jollyInCorso).toBeNull();
  });
});

describe('the turn of the draws in the game state', () => {
  const turno = { playerId: 'anna', attesaIn: 8_000, scadenzaIn: 60_000, sospeso: false };

  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-01-01T10:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  test('a game that arrives with a turn remembers when it arrived, to count the time left', () => {
    const state = gameReducer(withGame(), setGame({ ...mockGameState.game, turno }));

    expect(state.game.turno).toMatchObject({ ...turno, ricevutoA: Date.now() });
  });

  test('a game with no turn (the classic mode) keeps none', () => {
    const state = gameReducer(withGame(), setGame({ ...mockGameState.game, turno: null }));

    expect(state.game.turno).toBeNull();
  });

  test('setTurno puts the new turn in the game, with the moment it arrived', () => {
    const state = gameReducer(withGame(), setTurno(turno));

    expect(state.game.turno).toMatchObject({ ...turno, ricevutoA: Date.now() });
  });

  test('without a game there is nothing to change and nothing breaks', () => {
    const state = gameReducer({ ...mockGameState, game: null }, setTurno(turno));

    expect(state.game).toBeNull();
  });
});

describe('the wait after a draw, from the settings of the game', () => {
  const carta = { valore: 'Re', seme: 'Coppe' };
  const withSettings = (settings, extra = {}) => ({
    ...mockGameState,
    game: { ...mockGameState.game, settings },
    ...extra,
  });

  test.each([12, 5])('after a draw the wait starts from the %i seconds of the game, not from a fixed number', async (seconds) => {
    gameService.drawCard.mockResolvedValue({ carta });
    const store = createTestStore({ game: withSettings({ drawCooldownSeconds: seconds }) });

    await store.dispatch(drawCard({ gameId: 'game-456' }));

    expect(store.getState().game.drawCooldown).toBe(seconds);
    expect(store.getState().game.ultimaCartaEstratta).toEqual(carta);
  });

  test('a game without settings gives no wait of its own: no number is invented', async () => {
    gameService.drawCard.mockResolvedValue({ carta });
    const store = createTestStore({ game: withSettings(undefined) });

    await store.dispatch(drawCard({ gameId: 'game-456' }));

    expect(store.getState().game.drawCooldown).toBe(0);
  });

  test('a 429 with the seconds left starts the wait from them, and the message is the one of the error', async () => {
    const tooSoon = Object.assign(new Error("Attendi 4 secondi prima di estrarre un'altra carta"), { status: 429, retryAfter: 4 });
    gameService.drawCard.mockRejectedValue(tooSoon);
    const store = createTestStore({ game: withSettings({ drawCooldownSeconds: 8 }, { drawCooldown: 0 }) });

    const result = await store.dispatch(drawCard({ gameId: 'game-456' }));

    expect(result.payload).toBe("Attendi 4 secondi prima di estrarre un'altra carta");
    expect(store.getState().game.drawCooldown).toBe(4);
  });

  test('a refusal without the seconds leaves the wait as it was: the time is not invented', async () => {
    gameService.drawCard.mockRejectedValue(Object.assign(new Error('Le carte sono finite'), { status: 400 }));
    const store = createTestStore({ game: withSettings({ drawCooldownSeconds: 8 }, { drawCooldown: 2 }) });

    await store.dispatch(drawCard({ gameId: 'game-456' }));

    expect(store.getState().game.drawCooldown).toBe(2);
  });
});
