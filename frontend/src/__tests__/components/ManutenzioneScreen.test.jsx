import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ManutenzioneScreen } from '../../components/notices';
import { renderWithProviders } from '../test-utils';
import * as authService from '../../services/authService';

vi.mock('../../services/authService');

const state = ({ maintenance, player = {} } = {}) => ({
  notices: { announcement: null, maintenance: maintenance ?? { active: true, message: 'Torno presto', endsAt: null }, status: 'ready' },
  player: { id: 'p1', name: 'Anna', role: 'player', currentGameId: null, ...player },
});

describe('ManutenzioneScreen', () => {
  test('says that the game is in maintenance, with the message of the admin', () => {
    renderWithProviders(<ManutenzioneScreen />, { preloadedState: state() });

    expect(screen.getByRole('heading', { level: 1, name: 'Manutenzione' })).toBeInTheDocument();
    expect(screen.getByText('Torno presto')).toBeInTheDocument();
  });

  test('says when it should end, if the admin said so', () => {
    renderWithProviders(<ManutenzioneScreen />, { preloadedState: state({ maintenance: { active: true, message: 'x', endsAt: '2026-12-01T21:30:00.000Z' } }) });

    expect(screen.getByText(/Dovrebbe finire verso le \d{2}:\d{2}/)).toBeInTheDocument();
  });

  test('without an end it does not guess one', () => {
    renderWithProviders(<ManutenzioneScreen />, { preloadedState: state() });

    expect(screen.queryByText(/Dovrebbe finire/)).not.toBeInTheDocument();
  });

  test('markup in the message is text', () => {
    renderWithProviders(<ManutenzioneScreen />, { preloadedState: state({ maintenance: { active: true, message: '<i>x</i>', endsAt: null } }) });

    expect(screen.getByText('<i>x</i>')).toBeInTheDocument();
    expect(document.querySelector('i')).toBeNull();
  });

  test('with a session there is "Esci", and it logs out', async () => {
    authService.logout.mockResolvedValue(undefined);
    const { store } = renderWithProviders(<ManutenzioneScreen />, { preloadedState: state() });

    fireEvent.click(screen.getByRole('button', { name: /esci/i }));

    await waitFor(() => expect(store.getState().player.id).toBeNull());
    expect(screen.queryByRole('button', { name: /sono un amministratore/i })).not.toBeInTheDocument();
  });

  test('without a session there is the way in for the admin, only when the screen is given what to do', () => {
    const onAdminLogin = vi.fn();
    const { unmount } = renderWithProviders(<ManutenzioneScreen />, { preloadedState: state({ player: { id: null } }) });
    expect(screen.queryByRole('button', { name: /sono un amministratore/i })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<ManutenzioneScreen onAdminLogin={onAdminLogin} />, { preloadedState: state({ player: { id: null } }) });
    fireEvent.click(screen.getByRole('button', { name: /sono un amministratore/i }));

    expect(onAdminLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /esci/i })).not.toBeInTheDocument();
  });
});
