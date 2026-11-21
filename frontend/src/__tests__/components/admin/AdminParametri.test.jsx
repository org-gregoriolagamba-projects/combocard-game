import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminScreen } from '../../../components/admin';
import { renderWithProviders } from '../../test-utils';
import * as adminService from '../../../services/adminService';
import { adminState, anna, failure, pageOf } from './fixtures';

vi.mock('../../../services/adminService');

// Values that are not the defaults, so a number that comes from the defaults cannot pass for the right one
const SETTINGS = {
  values: { minPlayers: 3, maxPlayers: 8, requiredCredits: 150, jollyHoldSeconds: 45, jollyMaxDeclarations: 2, drawCooldownSeconds: 12 },
  limits: {
    minPlayers: { min: 2, max: 10 },
    maxPlayers: { min: 2, max: 20 },
    requiredCredits: { min: 1, max: 10000 },
    jollyHoldSeconds: { min: 10, max: 120 },
    jollyMaxDeclarations: { min: 1, max: 10 },
    drawCooldownSeconds: { min: 3, max: 30 },
  },
  defaults: { minPlayers: 2, maxPlayers: 10, requiredCredits: 100, jollyHoldSeconds: 30, jollyMaxDeclarations: 3, drawCooldownSeconds: 8 },
  updatedAt: '2026-11-20T10:30:00.000Z',
  updatedBy: 'p3',
};

const LABELS = [
  'Giocatori minimi per avviare',
  'Giocatori massimi',
  "Quota d'ingresso predefinita",
  'Pausa del Jolly',
  'Dichiarazioni del Jolly per partita',
  'Attesa tra le estrazioni',
];

describe('AdminScreen: the game settings', () => {
  beforeEach(() => {
    adminService.listUsers.mockResolvedValue(pageOf([anna]));
    adminService.listAudit.mockResolvedValue(pageOf([]));
    adminService.listGames.mockResolvedValue(pageOf([]));
    adminService.getSettings.mockResolvedValue(SETTINGS);
  });

  const open = async () => {
    const view = renderWithProviders(<AdminScreen />, { preloadedState: adminState() });
    fireEvent.click(await screen.findByRole('tab', { name: 'Parametri' }));
    return view;
  };

  test('is the fifth tab, after the log, and it is not read until it is opened', async () => {
    renderWithProviders(<AdminScreen />, { preloadedState: adminState() });

    const tabs = await screen.findAllByRole('tab');

    expect(tabs.map((t) => t.textContent)).toEqual(['Utenti', 'Partite', 'Statistiche', 'Registro', 'Parametri']);
    expect(adminService.getSettings).not.toHaveBeenCalled();
  });

  test('says it is loading, then reads the settings once', async () => {
    adminService.getSettings.mockReturnValue(new Promise(() => {}));

    await open();

    expect(await screen.findByText('Caricamento dei parametri…')).toBeInTheDocument();
    expect(adminService.getSettings).toHaveBeenCalledTimes(1);
  });

  test('has one field for each setting, with the limits of the server and the current value', async () => {
    await open();
    await screen.findByLabelText(LABELS[0]);

    const expected = [
      ['Giocatori minimi per avviare', 3, 2, 10],
      ['Giocatori massimi', 8, 2, 20],
      ["Quota d'ingresso predefinita", 150, 1, 10000],
      ['Pausa del Jolly', 45, 10, 120],
      ['Dichiarazioni del Jolly per partita', 2, 1, 10],
      ['Attesa tra le estrazioni', 12, 3, 30],
    ];
    for (const [label, value, min, max] of expected) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveValue(value);
      expect(field).toHaveAttribute('min', String(min));
      expect(field).toHaveAttribute('max', String(max));
    }
    expect(screen.getAllByRole('spinbutton')).toHaveLength(6);
  });

  test('each field says the current value, the interval and the default', async () => {
    await open();

    expect(await screen.findByLabelText('Attesa tra le estrazioni')).toHaveAccessibleDescription(
      'Attuale 12 · Da 3 a 30 · Predefinito 8',
    );
    expect(screen.getByLabelText("Quota d'ingresso predefinita")).toHaveAccessibleDescription(
      'Attuale 150 · Da 1 a 10000 · Predefinito 100',
    );
    expect(screen.getByLabelText('Giocatori massimi')).toHaveAccessibleDescription(/mai meno dei giocatori minimi/);
  });

  test('says that a change is for the games created after, and that the reason stays in the log', async () => {
    await open();

    expect(await screen.findByText(/valgono solo per le partite create dopo/)).toHaveTextContent(
      'quelle in attesa o in corso continuano con i parametri che avevano',
    );
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('maxlength', '200');
    expect(screen.getByLabelText('Motivo')).toHaveAccessibleDescription('Resta nel registro delle azioni.');
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();
  });

  test('says when they were last changed, if they ever were', async () => {
    const { unmount } = await open();
    expect(await screen.findByText(/Ultima modifica:/)).toHaveTextContent('2026');
    unmount();

    adminService.getSettings.mockResolvedValue({ ...SETTINGS, updatedAt: null, updatedBy: null });
    await open();
    await screen.findByLabelText(LABELS[0]);

    expect(screen.queryByText(/Ultima modifica:/)).not.toBeInTheDocument();
  });

  test('an error can be asked again', async () => {
    adminService.getSettings.mockRejectedValueOnce(failure('Impossibile contattare il server'));
    await open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile contattare il server');

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByLabelText(LABELS[0])).toBeInTheDocument();
    expect(adminService.getSettings).toHaveBeenCalledTimes(2);
  });

  test('a 403 sends the player back to the hall, with a notice', async () => {
    adminService.getSettings.mockRejectedValue(failure('Non hai i permessi per farlo', 403));
    const { store } = renderWithProviders(<AdminScreen />, { preloadedState: adminState() });

    fireEvent.click(await screen.findByRole('tab', { name: 'Parametri' }));

    await waitFor(() => expect(store.getState().ui.currentScreen).toBe('hall'));
    expect(store.getState().ui.toasts.at(-1).message).toBe("Non hai più i permessi dell'amministrazione");
  });

  test('the name of "Ripristina" starts with the text that is seen on it, so that it can be said aloud', async () => {
    await open();

    const restores = await screen.findAllByRole('button', { name: /^Ripristina predefinito: / });

    expect(restores).toHaveLength(6);
    restores.forEach((restore) => expect(restore).toHaveTextContent('Ripristina predefinito'));
  });

  test('"Ripristina" puts the default in the field, and is off when the field already has it', async () => {
    await open();
    const field = await screen.findByLabelText('Attesa tra le estrazioni');
    const restore = screen.getByRole('button', { name: 'Ripristina predefinito: Attesa tra le estrazioni' });
    expect(restore).toBeEnabled();

    fireEvent.click(restore);

    expect(field).toHaveValue(8);
    expect(restore).toBeDisabled();
    fireEvent.change(field, { target: { value: '9' } });
    expect(restore).toBeEnabled();
  });

  describe('the form', () => {
    const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    const openForm = async () => {
      const view = await open();
      await screen.findByLabelText(LABELS[0]);
      return view;
    };
    const ANSWER = (values, extra = {}) => ({ ...SETTINGS, values: { ...SETTINGS.values, ...values }, ...extra });

    test('"Salva" is off until something is different from the current value, and off again if it is put back', async () => {
      await openForm();
      expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();

      type('Attesa tra le estrazioni', '15');
      expect(screen.getByRole('button', { name: 'Salva' })).toBeEnabled();

      type('Attesa tra le estrazioni', '12');
      expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    });

    test('sends only the values that changed, as numbers, with the reason without the spaces at the edges', async () => {
      adminService.updateSettings.mockResolvedValue(ANSWER({ drawCooldownSeconds: 15, requiredCredits: 160 }));
      await openForm();

      type('Attesa tra le estrazioni', '15');
      type("Quota d'ingresso predefinita", '160');
      type('Motivo', '  più tempo  ');
      save();

      await waitFor(() => expect(adminService.updateSettings).toHaveBeenCalledTimes(1));
      expect(adminService.updateSettings).toHaveBeenCalledWith({
        values: { drawCooldownSeconds: 15, requiredCredits: 160 },
        reason: 'più tempo',
      });
    });

    test('the minimum and the maximum of the players can be changed together, even above the current maximum', async () => {
      adminService.updateSettings.mockResolvedValue(ANSWER({ minPlayers: 10, maxPlayers: 12 }));
      await openForm();

      type('Giocatori minimi per avviare', '10');
      type('Giocatori massimi', '12');
      type('Motivo', 'tavoli grandi');
      save();

      await waitFor(() => expect(adminService.updateSettings).toHaveBeenCalledTimes(1));
      expect(adminService.updateSettings).toHaveBeenCalledWith({ values: { minPlayers: 10, maxPlayers: 12 }, reason: 'tavoli grandi' });
    });

    test('a maximum below the minimum written in the form is explained in its field, and nothing is sent', async () => {
      await openForm();

      type('Giocatori minimi per avviare', '6');
      type('Giocatori massimi', '4');
      type('Motivo', 'x');
      save();

      expect(screen.getByLabelText('Giocatori massimi')).toHaveAccessibleDescription('Non può essere meno dei giocatori minimi (6)');
      expect(adminService.updateSettings).not.toHaveBeenCalled();
    });

    test.each([
      ['Attesa tra le estrazioni', '31', 'Da 3 a 30 secondi'],
      ['Attesa tra le estrazioni', '2', 'Da 3 a 30 secondi'],
      ["Quota d'ingresso predefinita", '0', 'Da 1 a 10000 crediti'],
      ['Giocatori minimi per avviare', '11', 'Da 2 a 10 giocatori'],
      ['Pausa del Jolly', '', 'Scrivi un numero'],
      ['Pausa del Jolly', '2.5', 'Scrivi un numero'],
    ])('%s with "%s" is explained in the field, and nothing is sent', async (label, value, message) => {
      await openForm();

      type(label, value);
      type('Motivo', 'x');
      save();

      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message);
      expect(adminService.updateSettings).not.toHaveBeenCalled();
    });

    test('a reason that is empty or only spaces is asked for, and nothing is sent; writing in the field takes the message away', async () => {
      await openForm();
      type('Attesa tra le estrazioni', '15');

      type('Motivo', '   ');
      save();
      expect(screen.getByLabelText('Motivo')).toHaveAccessibleDescription('Scrivi il motivo');
      expect(adminService.updateSettings).not.toHaveBeenCalled();

      type('Motivo', 'x');
      expect(screen.getByLabelText('Motivo')).toHaveAccessibleDescription('Resta nel registro delle azioni.');
    });

    test('after the save the fields are the ones of the answer of the server, not the ones written, and the reason is empty', async () => {
      // another admin has saved in the meantime: the answer has other values than the ones written
      adminService.updateSettings.mockResolvedValue(
        ANSWER({ drawCooldownSeconds: 14, jollyHoldSeconds: 50 }, { updatedAt: '2026-11-21T09:00:00.000Z' }),
      );
      const { store } = await openForm();

      type('Attesa tra le estrazioni', '15');
      type('Motivo', 'più tempo');
      save();

      await waitFor(() => expect(screen.getByLabelText('Attesa tra le estrazioni')).toHaveValue(14));
      expect(screen.getByLabelText('Pausa del Jolly')).toHaveValue(50);
      expect(screen.getByLabelText('Attesa tra le estrazioni')).toHaveAccessibleDescription(/^Attuale 14 /);
      expect(screen.getByLabelText('Motivo')).toHaveValue('');
      expect(screen.getByText(/Ultima modifica:/)).toHaveTextContent('21');
      expect(store.getState().ui.toasts.at(-1)).toMatchObject({ message: 'Parametri di gioco aggiornati', type: 'success' });
    });

    test('if the server refuses, the fields and the reason stay as written, the current value does not change, and the error is above "Salva"', async () => {
      adminService.updateSettings.mockRejectedValue(failure('Non sono riuscito a salvare: riprova tra poco', 503));
      const { store } = await openForm();

      type('Attesa tra le estrazioni', '15');
      type('Motivo', 'più tempo');
      save();

      expect(await screen.findByRole('alert')).toHaveTextContent('Non sono riuscito a salvare: riprova tra poco');
      expect(screen.getByLabelText('Attesa tra le estrazioni')).toHaveValue(15);
      expect(screen.getByLabelText('Attesa tra le estrazioni')).toHaveAccessibleDescription(/^Attuale 12 /);
      expect(screen.getByLabelText('Motivo')).toHaveValue('più tempo');
      expect(store.getState().ui.toasts.some((toast) => toast.type === 'success')).toBe(false);
      expect(screen.getByRole('button', { name: 'Salva' })).toBeEnabled();
    });

    test('a refusal of the values by the server is told with its message, and the next try starts clean', async () => {
      adminService.updateSettings.mockRejectedValueOnce(failure('Attesa tra le estrazioni: da 3 a 30', 400));
      adminService.updateSettings.mockResolvedValueOnce(ANSWER({ drawCooldownSeconds: 15 }));
      await openForm();
      type('Attesa tra le estrazioni', '15');
      type('Motivo', 'x');

      save();
      expect(await screen.findByRole('alert')).toHaveTextContent('Attesa tra le estrazioni: da 3 a 30');

      save();
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });

    test('a 403 on the save sends the player back to the hall', async () => {
      adminService.updateSettings.mockRejectedValue(failure('Non hai i permessi per farlo', 403));
      const { store } = await openForm();
      type('Attesa tra le estrazioni', '15');
      type('Motivo', 'x');

      save();

      await waitFor(() => expect(store.getState().ui.currentScreen).toBe('hall'));
    });

    test('a failed save moves the focus to the first field with a problem, in the order of the form', async () => {
      await openForm();

      type('Pausa del Jolly', '5');
      type('Attesa tra le estrazioni', '99');
      save();

      expect(screen.getByLabelText('Pausa del Jolly')).toHaveFocus();
    });

    test('if the only problem is the reason, the focus goes to the reason', async () => {
      await openForm();

      type('Attesa tra le estrazioni', '15');
      save();

      expect(screen.getByLabelText('Motivo')).toHaveFocus();
    });

    test('a save that is right does not move the focus away', async () => {
      adminService.updateSettings.mockResolvedValue(ANSWER({ drawCooldownSeconds: 15 }));
      await openForm();
      type('Attesa tra le estrazioni', '15');
      type('Motivo', 'x');
      screen.getByLabelText('Motivo').focus();

      save();

      await waitFor(() => expect(adminService.updateSettings).toHaveBeenCalled());
      expect(screen.getByLabelText('Attesa tra le estrazioni')).not.toHaveFocus();
    });

    test('two submissions in a row send one request', async () => {
      adminService.updateSettings.mockReturnValue(new Promise(() => {}));
      await openForm();
      type('Attesa tra le estrazioni', '15');
      type('Motivo', 'x');
      const form = screen.getByRole('button', { name: 'Salva' }).closest('form');

      fireEvent.submit(form);
      fireEvent.submit(form);

      expect(adminService.updateSettings).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled());
    });
  });
});
