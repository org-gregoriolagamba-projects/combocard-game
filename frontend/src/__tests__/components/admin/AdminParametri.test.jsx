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

  test('"Ripristina" puts the default in the field, and is off when the field already has it', async () => {
    await open();
    const field = await screen.findByLabelText('Attesa tra le estrazioni');
    const restore = screen.getByRole('button', { name: 'Ripristina Attesa tra le estrazioni' });
    expect(restore).toBeEnabled();

    fireEvent.click(restore);

    expect(field).toHaveValue(8);
    expect(restore).toBeDisabled();
    fireEvent.change(field, { target: { value: '9' } });
    expect(restore).toBeEnabled();
  });
});
