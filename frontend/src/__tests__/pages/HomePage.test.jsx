import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HomePage } from '../../pages';
import { renderWithProviders } from '../test-utils';
import { setAccessToken } from '../../services/api';
import { clearDraft } from '../../utils/formDraft';

vi.mock('../../services/socketService', () => ({
  __esModule: true,
  default: { connect: vi.fn(), disconnect: vi.fn(), getSocket: vi.fn() },
}));

const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body });
const session = {
  data: {
    accessToken: 't1',
    player: { id: 'p1', name: 'Anna', credits: 0, currentGameId: null },
  },
};

const fill = (username, password) => {
  fireEvent.change(screen.getByLabelText(/nome utente/i), { target: { value: username } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
};

const termsBox = () => screen.getByLabelText("Ho letto l'informativa sulla privacy e accetto i termini d'uso");

describe('HomePage', () => {
  let errorSpy;

  beforeEach(() => {
    clearDraft();
    setAccessToken(null);
    global.fetch = vi.fn();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test('a login with a temporary password does not go to the hall: the password comes first', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, { data: { ...session.data, role: 'player', mustChangePassword: true } }));
    const { store } = renderWithProviders(<HomePage />);

    fill('Anna', 'K7QM-X2PD-9WJT');
    fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

    await waitFor(() => expect(store.getState().player.mustChangePassword).toBe(true));
    expect(store.getState().ui.currentScreen).not.toBe('hall');
  });

  test('logs in by default, with a password field that hides the text', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, session));
    const { store } = renderWithProviders(<HomePage />);

    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
    fill('Anna', 'x');
    fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

    await waitFor(() => expect(store.getState().ui.currentScreen).toBe('hall'));
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(options.body)).toEqual({ username: 'Anna', password: 'x' });
    expect(store.getState().player.id).toBe('p1');
  });

  test('switches to the registration', async () => {
    global.fetch.mockResolvedValue(jsonResponse(201, session));
    const { store } = renderWithProviders(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
    fill('Anna', 'long enough');
    fireEvent.click(termsBox());
    fireEvent.click(screen.getByRole('button', { name: /registrati/i }));

    await waitFor(() => expect(store.getState().ui.currentScreen).toBe('hall'));
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/auth\/register$/);
  });

  describe('the acceptance of the terms at the registration', () => {
    test('the box is only in the registration, not in the login', () => {
      renderWithProviders(<HomePage />);
      expect(screen.queryByLabelText(/Ho letto l'informativa/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
      expect(termsBox()).not.toBeChecked();
    });

    test('without the tick nothing is sent: the error is under the box and the focus goes there', () => {
      renderWithProviders(<HomePage />);
      fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
      fill('Anna', 'long enough');

      fireEvent.click(screen.getByRole('button', { name: /registrati/i }));

      expect(global.fetch).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent("Per registrarti devi accettare l'informativa e i termini d'uso");
      expect(termsBox()).toHaveFocus();
      expect(termsBox()).toHaveAttribute('aria-invalid', 'true');
    });

    test('ticking the box takes the error away, and the registration carries the acceptance', async () => {
      global.fetch.mockResolvedValue(jsonResponse(201, session));
      renderWithProviders(<HomePage />);
      fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
      fill('Anna', 'long enough');
      fireEvent.click(screen.getByRole('button', { name: /registrati/i }));

      fireEvent.click(termsBox());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /registrati/i }));

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
        username: 'Anna',
        password: 'long enough',
        acceptTerms: true,
        termsVersion: '2026-1',
      });
    });

    test('opening a text from the form keeps what was typed for when the player comes back', () => {
      const first = renderWithProviders(<HomePage />);
      fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
      fill('Anna', 'long enough');
      fireEvent.click(termsBox());

      fireEvent.click(screen.getByRole('button', { name: "Termini d'uso" }));
      first.unmount();
      renderWithProviders(<HomePage />);

      expect(screen.getByLabelText(/nome utente/i)).toHaveValue('Anna');
      expect(screen.getByLabelText(/password/i)).toHaveValue('long enough');
      expect(termsBox()).toBeChecked();
      expect(screen.getByRole('button', { name: /registrati/i })).toBeInTheDocument();
    });

    test('a registration that went through leaves nothing to restore', async () => {
      global.fetch.mockResolvedValue(jsonResponse(201, session));
      const first = renderWithProviders(<HomePage />);
      fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
      fill('Anna', 'long enough');
      fireEvent.click(termsBox());
      fireEvent.click(screen.getByRole('button', { name: "Termini d'uso" }));
      fireEvent.click(screen.getByRole('button', { name: /registrati/i }));
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(first.store.getState().ui.currentScreen).toBe('hall'));
      first.unmount();

      renderWithProviders(<HomePage />);

      expect(screen.getByLabelText(/nome utente/i)).toHaveValue('');
      expect(screen.queryByLabelText(/Ho letto l'informativa/)).not.toBeInTheDocument();
    });

    test('the links of the box open the two texts and do not tick it', () => {
      const { store } = renderWithProviders(<HomePage />);
      fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));

      fireEvent.click(screen.getByRole('button', { name: 'Informativa sulla privacy' }));

      expect(store.getState().ui.currentScreen).toBe('informativa');
      expect(termsBox()).not.toBeChecked();
    });
  });

  test('does not send a registration with a short password', () => {
    renderWithProviders(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
    fill('Anna', 'short');
    fireEvent.click(screen.getByRole('button', { name: /registrati/i }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('shows a clear message for a taken username, in Italian', async () => {
    global.fetch.mockResolvedValue(jsonResponse(409, { message: 'Username already taken' }));
    const { store } = renderWithProviders(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
    fill('Anna', 'long enough');
    fireEvent.click(termsBox());
    fireEvent.click(screen.getByRole('button', { name: /registrati/i }));

    expect(await screen.findByText('Questo nome utente è già in uso')).toBeInTheDocument();
    expect(store.getState().ui.currentScreen).toBe('home');
  });

  describe('errors appear in one place only', () => {
    test('a wrong password is an inline alert and not also a notice', async () => {
      global.fetch.mockResolvedValue(jsonResponse(401, { message: 'Invalid username or password' }));
      const { store } = renderWithProviders(<HomePage />);

      fill('Anna', 'wrong password');
      fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Nome utente o password non corretti');
      expect(store.getState().ui.toasts).toHaveLength(0);
    });

    test('empty fields are explained in the form, without sending anything', () => {
      const { store } = renderWithProviders(<HomePage />);

      fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

      expect(screen.getByRole('alert')).toHaveTextContent('Inserisci nome utente e password');
      expect(store.getState().ui.toasts).toHaveLength(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('a short password says what is needed, in the form', () => {
      renderWithProviders(<HomePage />);

      fireEvent.click(screen.getByRole('button', { name: /crea un account/i }));
      fill('Anna', 'short');
      fireEvent.click(screen.getByRole('button', { name: /registrati/i }));

      expect(screen.getByRole('alert')).toHaveTextContent('La password deve avere almeno 8 caratteri');
    });

    test('the message goes away when the player changes the field', () => {
      renderWithProviders(<HomePage />);
      fireEvent.click(screen.getByRole('button', { name: /accedi/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/nome utente/i), { target: { value: 'A' } });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('the fields point to the message', () => {
      renderWithProviders(<HomePage />);

      fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

      expect(screen.getByLabelText(/nome utente/i)).toHaveAccessibleDescription('Inserisci nome utente e password');
    });
  });

  test('goes back to the game in progress after the login', async () => {
    const game = {
      id: 'g1',
      status: 'playing',
      carteEstratte: [{ valore: 'Re' }],
      players: [{ id: 'p1', name: 'Anna' }],
    };
    // The answer depends on what is asked, not on the order: the settings are read at the same time
    global.fetch.mockImplementation(async (url) => {
      if (url.endsWith('/settings')) {
        return jsonResponse(200, { data: { values: {}, limits: {}, defaults: {} } });
      }
      if (url.endsWith('/games/g1')) {
        return jsonResponse(200, { data: game });
      }
      return jsonResponse(200, {
        data: { accessToken: 't1', player: { id: 'p1', name: 'Anna', credits: 0, currentGameId: 'g1' } },
      });
    });
    const { store } = renderWithProviders(<HomePage />);

    fill('Anna', 'x');
    fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

    await waitFor(() => expect(store.getState().ui.currentScreen).toBe('game'));
    expect(store.getState().game.currentGameId).toBe('g1');
    expect(store.getState().game.ultimaCartaEstratta).toEqual({ valore: 'Re' });
  });
});
