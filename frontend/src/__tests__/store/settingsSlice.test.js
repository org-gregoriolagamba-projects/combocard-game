/**
 * Settings Slice Tests
 *
 * The game settings of the server: read when the player is known, kept while the app runs.
 * Only the last request counts; a failure never replaces values that were already read.
 */

import settingsReducer, { clearSettings, fetchSettings } from '../../store/slices/settingsSlice';
import { clearPlayer, logout } from '../../store/slices/playerSlice';

const initial = { values: null, limits: null, status: 'idle', error: null, requestId: null };
const VALUES = { minPlayers: 2, maxPlayers: 10, requiredCredits: 100, jollyHoldSeconds: 30, jollyMaxDeclarations: 3, drawCooldownSeconds: 8 };
const LIMITS = { requiredCredits: { min: 1, max: 10000 } };
const answer = (values = VALUES) => ({ values, limits: LIMITS, defaults: VALUES });
// A state with the values already read, as the app has it after the first answer
const readyState = () => {
  const loading = settingsReducer(initial, fetchSettings.pending('r0'));
  return settingsReducer(loading, fetchSettings.fulfilled(answer(), 'r0'));
};

describe('settingsSlice', () => {
  test('starts idle, with no values', () => {
    expect(settingsReducer(undefined, { type: 'unknown' })).toEqual(initial);
  });

  test('a request in progress is loading', () => {
    expect(settingsReducer(initial, fetchSettings.pending('r1'))).toMatchObject({ status: 'loading', requestId: 'r1' });
  });

  test('the answer gives the values and the limits, and the state is ready', () => {
    let state = settingsReducer(initial, fetchSettings.pending('r1'));
    state = settingsReducer(state, fetchSettings.fulfilled(answer(), 'r1'));

    expect(state).toMatchObject({ values: VALUES, limits: LIMITS, status: 'ready', error: null });
  });

  test('a failure with no values read before is an error, with the message', () => {
    let state = settingsReducer(initial, fetchSettings.pending('r1'));
    state = settingsReducer(state, fetchSettings.rejected(null, 'r1', undefined, 'Impossibile contattare il server'));

    expect(state).toMatchObject({ values: null, status: 'error', error: 'Impossibile contattare il server' });
  });

  test('a failure after the values were read leaves them, and the state stays ready', () => {
    let state = readyState();
    state = settingsReducer(state, fetchSettings.pending('r1'));
    expect(state.status).toBe('ready');
    state = settingsReducer(state, fetchSettings.rejected(null, 'r1', undefined, 'Impossibile contattare il server'));

    expect(state).toMatchObject({ values: VALUES, status: 'ready', error: null });
  });

  test('two requests in flight: the last one wins, even if the old one answers after it', () => {
    const older = { ...VALUES, maxPlayers: 6 };
    const newer = { ...VALUES, maxPlayers: 8 };
    let state = settingsReducer(initial, fetchSettings.pending('old'));
    state = settingsReducer(state, fetchSettings.pending('new'));
    state = settingsReducer(state, fetchSettings.fulfilled(answer(newer), 'new'));
    state = settingsReducer(state, fetchSettings.fulfilled(answer(older), 'old'));

    expect(state.values.maxPlayers).toBe(8);
  });

  test('an old failure does not spoil the answer of the last request', () => {
    let state = settingsReducer(initial, fetchSettings.pending('old'));
    state = settingsReducer(state, fetchSettings.pending('new'));
    state = settingsReducer(state, fetchSettings.fulfilled(answer(), 'new'));
    state = settingsReducer(state, fetchSettings.rejected(null, 'old', undefined, 'Impossibile contattare il server'));

    expect(state).toMatchObject({ values: VALUES, status: 'ready', error: null });
  });

  test.each([
    ['clearSettings', clearSettings()],
    ['clearPlayer', clearPlayer()],
    ['logout.fulfilled', logout.fulfilled(undefined, 'r')],
    ['logout.rejected', logout.rejected(null, 'r')],
  ])('%s empties the settings', (_name, action) => {
    expect(settingsReducer(readyState(), action)).toEqual(initial);
  });
});
