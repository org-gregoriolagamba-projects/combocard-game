import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminScreen } from '../../../components/admin';
import { renderWithProviders } from '../../test-utils';
import * as adminService from '../../../services/adminService';
import { adminState, anna, failure, pageOf } from './fixtures';

vi.mock('../../../services/adminService');

const OFF = {
  announcement: { version: 0, active: false, message: '', severity: 'info', startsAt: null, endsAt: null, updatedAt: null, updatedBy: null },
  maintenance: { active: false, message: '', endsAt: null, updatedAt: null, updatedBy: null },
};
const ACTIVE = {
  announcement: { version: 2, active: true, message: 'Alle 22 manutenzione', severity: 'importante', startsAt: null, endsAt: null, updatedAt: '2026-11-20T10:30:00.000Z', updatedBy: 'p3' },
  maintenance: { active: true, message: 'Torno alle 22', endsAt: null, updatedAt: '2026-11-20T10:30:00.000Z', updatedBy: 'p3' },
};

describe('AdminScreen: the Avvisi tab', () => {
  beforeEach(() => {
    adminService.listUsers.mockResolvedValue(pageOf([anna]));
    adminService.listAudit.mockResolvedValue(pageOf([]));
    adminService.listGames.mockResolvedValue(pageOf([]));
    adminService.getNotices.mockResolvedValue(OFF);
  });

  const open = async (notices = OFF) => {
    adminService.getNotices.mockResolvedValue(notices);
    const view = renderWithProviders(<AdminScreen />, { preloadedState: adminState() });
    fireEvent.click(await screen.findByRole('tab', { name: 'Avvisi' }));
    await screen.findByLabelText("Testo dell'avviso");
    return view;
  };
  const write = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  test('is the sixth tab, and it is not read until it is opened', async () => {
    renderWithProviders(<AdminScreen />, { preloadedState: adminState() });

    const tabs = await screen.findAllByRole('tab');

    expect(tabs.map((t) => t.textContent)).toEqual(['Utenti', 'Partite', 'Statistiche', 'Registro', 'Parametri', 'Avvisi']);
    expect(adminService.getNotices).not.toHaveBeenCalled();
  });

  test('shows the state of both: none active, then an active announcement and the maintenance on', async () => {
    const view = await open(OFF);
    expect(screen.getByText('Nessun avviso attivo')).toBeInTheDocument();
    expect(screen.getByText('Manutenzione spenta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ritira' })).toBeDisabled();
    view.unmount();

    await open(ACTIVE);
    expect(screen.getByText(/Avviso attivo \(versione 2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Alle 22 manutenzione/)).toBeInTheDocument();
    expect(screen.getByText(/Manutenzione accesa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ritira' })).toBeEnabled();
  });

  test('the counter follows what is written and the field stops at 280 characters', async () => {
    await open();

    expect(screen.getByText('0/280')).toBeInTheDocument();
    write("Testo dell'avviso", 'ciao');

    expect(screen.getByText('4/280')).toBeInTheDocument();
    expect(screen.getByLabelText("Testo dell'avviso")).toHaveAttribute('maxLength', '280');
  });

  test('publishing sends the text and the severity, and shows what the server answers', async () => {
    await open();
    adminService.publishAnnouncement.mockResolvedValue({ ...ACTIVE, maintenance: OFF.maintenance });
    write("Testo dell'avviso", 'Alle 22 manutenzione');
    fireEvent.click(screen.getByLabelText('Importante'));

    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }));

    await waitFor(() => expect(adminService.publishAnnouncement).toHaveBeenCalledTimes(1));
    expect(adminService.publishAnnouncement).toHaveBeenCalledWith({ message: 'Alle 22 manutenzione', severity: 'importante', startsAt: undefined, endsAt: undefined });
    expect(await screen.findByText(/Avviso attivo \(versione 2\)/)).toBeInTheDocument();
  });

  test('the start and the end are sent as dates', async () => {
    await open();
    adminService.publishAnnouncement.mockResolvedValue(ACTIVE);
    write("Testo dell'avviso", 'Domani');
    write('Inizio (facoltativo)', '2026-12-01T10:00');
    write('Fine (facoltativa)', '2026-12-01T12:00');

    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }));

    await waitFor(() => expect(adminService.publishAnnouncement).toHaveBeenCalled());
    expect(adminService.publishAnnouncement).toHaveBeenCalledWith({
      message: 'Domani',
      severity: 'info',
      startsAt: new Date('2026-12-01T10:00').toISOString(),
      endsAt: new Date('2026-12-01T12:00').toISOString(),
    });
  });

  test('without a text nothing is sent, and the problem is in the form', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }));

    expect(adminService.publishAnnouncement).not.toHaveBeenCalled();
    expect(screen.getByText("Scrivi il testo dell'avviso")).toBeInTheDocument();
  });

  test('an end that is not after the start is explained and not sent', async () => {
    await open();
    write("Testo dell'avviso", 'x');
    write('Inizio (facoltativo)', '2026-12-01T12:00');
    write('Fine (facoltativa)', '2026-12-01T10:00');

    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }));

    expect(adminService.publishAnnouncement).not.toHaveBeenCalled();
    expect(screen.getByText("La fine deve essere dopo l'inizio")).toBeInTheDocument();
  });

  test('withdrawing asks the server and shows that there is none', async () => {
    await open(ACTIVE);
    adminService.withdrawAnnouncement.mockResolvedValue({ announcement: { ...ACTIVE.announcement, active: false }, maintenance: ACTIVE.maintenance });

    fireEvent.click(screen.getByRole('button', { name: 'Ritira' }));

    await waitFor(() => expect(adminService.withdrawAnnouncement).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Nessun avviso attivo')).toBeInTheDocument();
  });

  test('a message of the server is read in the form', async () => {
    await open();
    adminService.publishAnnouncement.mockRejectedValue(failure('Qualcosa non ha funzionato: riprova tra poco', 503));
    write("Testo dell'avviso", 'x');

    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Qualcosa non ha funzionato: riprova tra poco');
  });

  test('a 403 sends the player back to the hall', async () => {
    const { store } = await open();
    adminService.publishAnnouncement.mockRejectedValue(failure('Non hai i permessi per farlo', 403));
    write("Testo dell'avviso", 'x');

    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }));

    await waitFor(() => expect(store.getState().ui.currentScreen).toBe('hall'));
  });

  test('turning the maintenance on needs the message', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Accendi la manutenzione' }));

    expect(adminService.setMaintenance).not.toHaveBeenCalled();
    expect(screen.getByText('Scrivi il messaggio per i giocatori')).toBeInTheDocument();
  });

  test('turning the maintenance on sends the message and the expected end, and then it can be turned off', async () => {
    await open();
    adminService.setMaintenance.mockResolvedValueOnce({ ...OFF, maintenance: ACTIVE.maintenance, changed: true });
    write('Messaggio per i giocatori', 'Torno alle 22');
    write('Fine prevista (facoltativa)', '2026-12-01T22:00');

    fireEvent.click(screen.getByRole('button', { name: 'Accendi la manutenzione' }));

    await waitFor(() => expect(adminService.setMaintenance).toHaveBeenCalledTimes(1));
    expect(adminService.setMaintenance).toHaveBeenCalledWith({ active: true, message: 'Torno alle 22', endsAt: new Date('2026-12-01T22:00').toISOString() });
    expect(await screen.findByText(/Manutenzione accesa/)).toBeInTheDocument();

    adminService.setMaintenance.mockResolvedValueOnce({ ...OFF, changed: true });
    fireEvent.click(screen.getByRole('button', { name: 'Spegni la manutenzione' }));

    await waitFor(() => expect(adminService.setMaintenance).toHaveBeenCalledTimes(2));
    expect(adminService.setMaintenance).toHaveBeenLastCalledWith({ active: false });
    expect(await screen.findByText('Manutenzione spenta')).toBeInTheDocument();
  });
});
