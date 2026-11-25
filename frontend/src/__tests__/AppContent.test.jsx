import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppContent from '../AppContent';
import { renderWithProviders } from './test-utils';
import * as authService from '../services/authService';
import * as gameService from '../services/gameService';
import * as adminService from '../services/adminService';
import * as statusService from '../services/statusService';
import { clearDraft } from '../utils/formDraft';

vi.mock('../services/authService');
vi.mock('../services/gameService');
vi.mock('../services/adminService');
vi.mock('../services/statusService');

const preloaded = (regoleAccettateIl, screen = 'hall') => ({
  player: { id: 'p1', name: 'Anna', credits: 100, currentGameId: null, regoleAccettateIl, isLoading: false, error: null, sessionChecked: true },
  ui: { toasts: [], currentScreen: screen, modals: {}, isLoading: false, vittoriaRecente: null },
  game: { lobbies: [], currentGameId: null, game: null, currentPlayer: null },
});

describe('AppContent: the rules come first', () => {
  beforeEach(() => {
    authService.restoreSession.mockResolvedValue(null);
    gameService.getLobby.mockResolvedValue([]);
  });

  test('a player who never confirmed sees the rules, not the hall', async () => {
    renderWithProviders(<AppContent />, { preloadedState: preloaded(null) });

    expect(await screen.findByRole('heading', { name: 'Prima di giocare: le regole' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hall' })).not.toBeInTheDocument();
  });

  test('also a player who is already in a lobby reads them first', async () => {
    renderWithProviders(<AppContent />, { preloadedState: preloaded(null, 'lobby') });

    expect(await screen.findByRole('heading', { name: 'Prima di giocare: le regole' })).toBeInTheDocument();
  });

  test('a player who confirmed goes on to the hall', async () => {
    renderWithProviders(<AppContent />, { preloadedState: preloaded('2026-11-03T10:00:00.000Z') });

    expect(await screen.findByRole('heading', { name: 'Hall' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Prima di giocare: le regole' })).not.toBeInTheDocument());
  });

  test('somebody who is not logged in sees the login page', async () => {
    const state = preloaded(null, 'home');
    state.player.id = null;
    renderWithProviders(<AppContent />, { preloadedState: state });

    expect(await screen.findByRole('heading', { name: /combocard/i })).toBeInTheDocument();
  });
});

describe('AppContent: a temporary password', () => {
  beforeEach(() => {
    authService.restoreSession.mockResolvedValue(null);
    gameService.getLobby.mockResolvedValue([]);
  });

  test('an account that must change the password sees only that, even with the rules not read', async () => {
    const state = preloaded(null);
    state.player.mustChangePassword = true;
    renderWithProviders(<AppContent />, { preloadedState: state });

    expect(await screen.findByRole('heading', { name: 'Scegli una nuova password' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hall' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Prima di giocare: le regole' })).not.toBeInTheDocument();
  });

  test('a restored session that must change the password does not go to the hall', async () => {
    authService.restoreSession.mockResolvedValue({ id: 'p1', name: 'Anna', credits: 0, currentGameId: 'g1', role: 'player', mustChangePassword: true });
    const state = preloaded(null, 'home');
    state.player = { ...state.player, id: null, sessionChecked: false };

    renderWithProviders(<AppContent />, { preloadedState: state });

    expect(await screen.findByRole('heading', { name: 'Scegli una nuova password' })).toBeInTheDocument();
    expect(gameService.getGame).not.toHaveBeenCalled();
  });
});

describe('AppContent: the admin screen', () => {
  beforeEach(() => {
    authService.restoreSession.mockResolvedValue(null);
    gameService.getLobby.mockResolvedValue([]);
    adminService.listUsers.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  });

  test('an admin on the admin screen sees it', async () => {
    const state = preloaded('2026-11-03T10:00:00.000Z', 'admin');
    state.player.role = 'admin';
    renderWithProviders(<AppContent />, { preloadedState: state });

    expect(await screen.findByRole('heading', { name: 'Amministrazione' })).toBeInTheDocument();
  });

  test('anybody else is shown the hall, whatever the screen says', async () => {
    renderWithProviders(<AppContent />, { preloadedState: preloaded('2026-11-03T10:00:00.000Z', 'admin') });

    expect(await screen.findByRole('heading', { name: 'Hall' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Amministrazione' })).not.toBeInTheDocument();
    expect(adminService.listUsers).not.toHaveBeenCalled();
  });
});

describe('AppContent: the terms of use come before the rules', () => {
  beforeEach(() => {
    authService.restoreSession.mockResolvedValue(null);
    gameService.getLobby.mockResolvedValue([]);
  });

  const withTerms = (terminiDaAccettare, extra = {}) => {
    const state = preloaded(null);
    state.player = { ...state.player, terminiDaAccettare, ...extra };
    return state;
  };

  test('a player who has not accepted sees "Prima di continuare", before the rules', async () => {
    renderWithProviders(<AppContent />, { preloadedState: withTerms(true) });

    expect(await screen.findByRole('heading', { name: 'Prima di continuare' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Prima di giocare: le regole' })).not.toBeInTheDocument();
  });

  test('a temporary password still comes first', async () => {
    renderWithProviders(<AppContent />, { preloadedState: withTerms(true, { mustChangePassword: true }) });

    expect(await screen.findByRole('heading', { name: /nuova password/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Prima di continuare' })).not.toBeInTheDocument();
  });

  test('a state without the field (the older tests) has nothing to accept', async () => {
    renderWithProviders(<AppContent />, { preloadedState: preloaded(null) });

    expect(await screen.findByRole('heading', { name: 'Prima di giocare: le regole' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Prima di continuare' })).not.toBeInTheDocument();
  });

  test('the texts open without an account', async () => {
    const state = preloaded(null, 'informativa');
    state.player.id = null;
    renderWithProviders(<AppContent />, { preloadedState: state });

    expect(await screen.findByRole('heading', { level: 1, name: 'Informativa sulla privacy' })).toBeInTheDocument();
  });

  test('the texts open also from the gate, and going back shows the gate again', async () => {
    const { store } = renderWithProviders(<AppContent />, { preloadedState: withTerms(true) });
    fireEvent.click(await screen.findByRole('button', { name: /informativa sulla privacy/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Informativa sulla privacy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /indietro/i }));

    expect(await screen.findByRole('heading', { name: 'Prima di continuare' })).toBeInTheDocument();
    expect(store.getState().ui.currentScreen).toBe('hall');
  });
});

describe('AppContent: reading a text from the registration form', () => {
  beforeEach(() => {
    clearDraft();
    authService.restoreSession.mockResolvedValue(null);
    gameService.getLobby.mockResolvedValue([]);
  });

  test('"Indietro" brings the registration back as it was, not an empty login', async () => {
    const state = preloaded(null, 'home');
    state.player.id = null;
    renderWithProviders(<AppContent />, { preloadedState: state });

    fireEvent.click(await screen.findByRole('button', { name: /crea un account/i }));
    fireEvent.change(screen.getByLabelText(/nome utente/i), { target: { value: 'Anna' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'long enough' } });
    fireEvent.click(screen.getByLabelText("Ho letto l'informativa sulla privacy e accetto i termini d'uso"));
    fireEvent.click(screen.getByRole('button', { name: 'Informativa sulla privacy' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Informativa sulla privacy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /indietro/i }));

    expect(await screen.findByRole('button', { name: /registrati/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nome utente/i)).toHaveValue('Anna');
    expect(screen.getByLabelText(/password/i)).toHaveValue('long enough');
    expect(screen.getByLabelText("Ho letto l'informativa sulla privacy e accetto i termini d'uso")).toBeChecked();
  });
});

describe('AppContent: the maintenance', () => {
  const maintenance = { active: true, message: 'Torno alle 22', endsAt: null };

  beforeEach(() => {
    authService.restoreSession.mockResolvedValue(null);
    gameService.getLobby.mockResolvedValue([]);
    adminService.getStats?.mockResolvedValue?.({});
    statusService.getStatus.mockResolvedValue({ announcement: null, maintenance });
  });

  // The game the player is in is in the game slice (it is where joining and creating put it); the
  // currentGameId of the player slice is only what the server said at the login
  const withMaintenance = ({ role = 'player', currentGameId = null, id = 'p1', playerGameId = null } = {}) => {
    const state = preloaded('2026-11-03T10:00:00.000Z');
    state.player = { ...state.player, id, role, currentGameId: playerGameId };
    state.game = { ...state.game, currentGameId };
    state.notices = { announcement: null, maintenance, status: 'ready' };
    return state;
  };

  test('asks for the status when it opens, with or without an account', async () => {
    const state = withMaintenance({ id: null });
    state.notices.maintenance = null;
    renderWithProviders(<AppContent />, { preloadedState: state });

    await waitFor(() => expect(statusService.getStatus).toHaveBeenCalled());
  });

  test('somebody without an account sees the maintenance screen, and "Sono un amministratore" opens the login', async () => {
    renderWithProviders(<AppContent />, { preloadedState: withMaintenance({ id: null }) });

    expect(await screen.findByRole('heading', { name: 'Manutenzione' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/nome utente/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sono un amministratore/i }));

    expect(await screen.findByLabelText(/nome utente/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Manutenzione' })).not.toBeInTheDocument();
  });

  test('a player who is not in a game sees the maintenance screen, not the hall', async () => {
    renderWithProviders(<AppContent />, { preloadedState: withMaintenance() });

    expect(await screen.findByRole('heading', { name: 'Manutenzione' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hall' })).not.toBeInTheDocument();
  });

  test('a player who is in a game goes on, with the banner of the maintenance', async () => {
    renderWithProviders(<AppContent />, { preloadedState: withMaintenance({ currentGameId: 'g1' }) });

    expect(await screen.findByRole('heading', { name: 'Hall' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Manutenzione accesa: Torno alle 22');
    expect(screen.queryByRole('heading', { name: 'Manutenzione' })).not.toBeInTheDocument();
  });

  test('a player who joined a game in this session goes on (the game slice, not the login, says it)', async () => {
    // The server says: no maintenance, for now (the beforeEach of this block says the opposite)
    statusService.getStatus.mockResolvedValue({ announcement: null, maintenance: null });
    const state = withMaintenance();
    state.notices.maintenance = null;
    const { store } = renderWithProviders(<AppContent />, { preloadedState: state });
    expect(await screen.findByRole('heading', { name: 'Hall' })).toBeInTheDocument();

    store.dispatch({ type: 'game/join/fulfilled', payload: { gameId: 'g1', player: { id: 'p1' } } });
    store.dispatch({ type: 'notices/setMaintenance', payload: maintenance });

    expect(screen.queryByRole('heading', { name: 'Manutenzione' })).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Manutenzione accesa: Torno alle 22');
  });

  test('a game id left at the login does not count once the player is out of the game', async () => {
    renderWithProviders(<AppContent />, { preloadedState: withMaintenance({ playerGameId: 'vecchia', currentGameId: null }) });

    expect(await screen.findByRole('heading', { name: 'Manutenzione' })).toBeInTheDocument();
  });

  test('an admin works as always, with the banner', async () => {
    renderWithProviders(<AppContent />, { preloadedState: withMaintenance({ role: 'admin' }) });

    expect(await screen.findByRole('heading', { name: 'Hall' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Manutenzione accesa');
  });

  test('when the maintenance ends the screen goes away by itself', async () => {
    const { store } = renderWithProviders(<AppContent />, { preloadedState: withMaintenance() });
    expect(await screen.findByRole('heading', { name: 'Manutenzione' })).toBeInTheDocument();

    store.dispatch({ type: 'notices/setMaintenance', payload: null });

    expect(await screen.findByRole('heading', { name: 'Hall' })).toBeInTheDocument();
  });

  test('an announcement shows over any screen', async () => {
    const state = withMaintenance({ id: null });
    state.notices = { announcement: { version: 1, message: 'Benvenuti', severity: 'info', startsAt: null, endsAt: null }, maintenance: null, status: 'ready' };
    state.ui.currentScreen = 'home';
    renderWithProviders(<AppContent />, { preloadedState: state });

    expect(await screen.findByRole('status')).toHaveTextContent('Benvenuti');
  });
});

describe('AppContent: a visitor on the maintenance screen learns when it ends', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    authService.restoreSession.mockResolvedValue(null);
    gameService.getLobby.mockResolvedValue([]);
    statusService.getStatus.mockResolvedValue({ announcement: null, maintenance: { active: true, message: 'Torno alle 22', endsAt: null } });
  });
  afterEach(() => vi.useRealTimers());

  const visitor = () => {
    const state = preloaded('2026-11-03T10:00:00.000Z', 'home');
    state.player = { ...state.player, id: null };
    state.notices = { announcement: null, maintenance: { active: true, message: 'Torno alle 22', endsAt: null }, status: 'ready' };
    return state;
  };

  test('without a session the status is read again every half a minute', async () => {
    renderWithProviders(<AppContent />, { preloadedState: visitor() });
    await waitFor(() => expect(statusService.getStatus).toHaveBeenCalledTimes(1));

    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(statusService.getStatus).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(statusService.getStatus).toHaveBeenCalledTimes(3);
  });

  test('and when the maintenance is over the screen goes away', async () => {
    renderWithProviders(<AppContent />, { preloadedState: visitor() });
    expect(await screen.findByRole('heading', { name: 'Manutenzione' })).toBeInTheDocument();
    statusService.getStatus.mockResolvedValue({ announcement: null, maintenance: null });

    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });

    expect(screen.queryByRole('heading', { name: 'Manutenzione' })).not.toBeInTheDocument();
  });

  test('the status is read when the page becomes visible again', async () => {
    renderWithProviders(<AppContent />, { preloadedState: visitor() });
    await waitFor(() => expect(statusService.getStatus).toHaveBeenCalledTimes(1));

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });

    expect(statusService.getStatus).toHaveBeenCalledTimes(2);
  });

  test('with a session there is no polling: the socket tells', async () => {
    const state = preloaded('2026-11-03T10:00:00.000Z');
    state.notices = { announcement: null, maintenance: null, status: 'ready' };
    renderWithProviders(<AppContent />, { preloadedState: state });
    await waitFor(() => expect(statusService.getStatus).toHaveBeenCalledTimes(1));

    await act(async () => { await vi.advanceTimersByTimeAsync(90000); });

    expect(statusService.getStatus).toHaveBeenCalledTimes(1);
  });
});
