import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TerminiGate from '../../components/legal/TerminiGate';
import { renderWithProviders } from '../test-utils';
import * as playerService from '../../services/playerService';

vi.mock('../../services/playerService');
vi.mock('../../services/authService');

const state = () => ({
  player: { id: 'p1', name: 'Anna', credits: 0, currentGameId: null, terminiDaAccettare: true, isLoading: false, error: null, sessionChecked: true },
  ui: { toasts: [], currentScreen: 'hall', legalReturn: null, modals: {}, isLoading: false, vittoriaRecente: null },
});

const box = () => screen.getByLabelText("Ho letto l'informativa sulla privacy e accetto i termini d'uso");

describe('TerminiGate: "Prima di continuare"', () => {
  test('says why it is there and has the links to the two texts', () => {
    renderWithProviders(<TerminiGate />, { preloadedState: state() });

    expect(screen.getByRole('heading', { name: 'Prima di continuare' })).toBeInTheDocument();
    expect(screen.getByText(/Ciao Anna/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Informativa sulla privacy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Termini d'uso" })).toBeInTheDocument();
  });

  test('the button is off until the box is ticked', () => {
    renderWithProviders(<TerminiGate />, { preloadedState: state() });
    const button = screen.getByRole('button', { name: 'Accetto e continuo' });

    expect(button).toBeDisabled();
    fireEvent.click(box());
    expect(button).toBeEnabled();
  });

  test('accepting sends one request, also with a double tap, and clears what was left to accept', async () => {
    let finish;
    playerService.acceptTerms.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { store } = renderWithProviders(<TerminiGate />, { preloadedState: state() });
    fireEvent.click(box());
    const button = screen.getByRole('button', { name: 'Accetto e continuo' });

    fireEvent.click(button);
    fireEvent.click(button);
    finish({ success: true, terminiVersione: '2026-1' });

    await waitFor(() => expect(store.getState().player.terminiDaAccettare).toBe(false));
    expect(playerService.acceptTerms).toHaveBeenCalledTimes(1);
    expect(playerService.acceptTerms).toHaveBeenCalledWith('p1');
  });

  test('a refusal for an old text says to reload the page, and the player has still to accept', async () => {
    playerService.acceptTerms.mockRejectedValue(Object.assign(new Error('I testi sono cambiati: ricarica la pagina'), { status: 409 }));
    const { store } = renderWithProviders(<TerminiGate />, { preloadedState: state() });
    fireEvent.click(box());

    fireEvent.click(screen.getByRole('button', { name: 'Accetto e continuo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('I testi sono cambiati: ricarica la pagina');
    expect(store.getState().player.terminiDaAccettare).toBe(true);
  });

  test('the links open the two texts', () => {
    const { store } = renderWithProviders(<TerminiGate />, { preloadedState: state() });

    fireEvent.click(screen.getByRole('button', { name: "Termini d'uso" }));

    expect(store.getState().ui.currentScreen).toBe('termini');
  });

  test('who does not accept can delete the account from here, as the notice says', () => {
    renderWithProviders(<TerminiGate />, { preloadedState: state() });

    fireEvent.click(screen.getByRole('button', { name: 'Non accetto: elimina il mio account' }));

    expect(screen.getByRole('dialog', { name: 'Elimina il mio account' })).toBeInTheDocument();
  });

  test('"Esci" logs out', async () => {
    const authService = await import('../../services/authService');
    authService.logout.mockResolvedValue(undefined);
    const { store } = renderWithProviders(<TerminiGate />, { preloadedState: state() });

    fireEvent.click(screen.getByRole('button', { name: /esci/i }));

    await waitFor(() => expect(store.getState().player.id).toBeNull());
  });
});
