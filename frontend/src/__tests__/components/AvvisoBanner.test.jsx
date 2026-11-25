import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AvvisoBanner } from '../../components/notices';
import { renderWithProviders } from '../test-utils';

const announcement = (extra = {}) => ({ version: 3, message: 'Alle 22 manutenzione', severity: 'info', startsAt: null, endsAt: null, ...extra });
const maintenance = { active: true, message: 'Torno alle 22', endsAt: null };

const state = ({ notices = {}, player = {} } = {}) => ({
  notices: { announcement: null, maintenance: null, status: 'ready', ...notices },
  player: { id: 'p1', name: 'Anna', role: 'player', currentGameId: null, ...player },
});

describe('AvvisoBanner: the announcement', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  test('shows an info announcement as a status, with its text', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { announcement: announcement() } }) });

    expect(screen.getByRole('status')).toHaveTextContent('Alle 22 manutenzione');
  });

  test('an important one is an alert', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { announcement: announcement({ severity: 'importante' }) } }) });

    expect(screen.getByRole('alert')).toHaveTextContent('Alle 22 manutenzione');
  });

  test('markup in the message is text, never interpreted', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { announcement: announcement({ message: '<b>grassetto</b>' }) } }) });

    expect(screen.getByText('<b>grassetto</b>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });

  test('nothing without an announcement', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state() });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('"Chiudi" hides it and remembers the version', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { announcement: announcement() } }) });

    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('combocard.avviso-chiuso')).toBe('3');
  });

  test('an announcement of a version already closed does not show again', () => {
    window.localStorage.setItem('combocard.avviso-chiuso', '3');

    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { announcement: announcement() } }) });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('a new version comes back after one was closed', () => {
    window.localStorage.setItem('combocard.avviso-chiuso', '3');

    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { announcement: announcement({ version: 4, message: 'Nuovo' }) } }) });

    expect(screen.getByRole('status')).toHaveTextContent('Nuovo');
  });

  test('the close button is at least 44px high', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { announcement: announcement() } }) });

    expect(screen.getByRole('button', { name: /chiudi/i }).className).toMatch(/min-h-\[44px\]/);
  });

  test('without the storage the banner works: it closes and does not break', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { announcement: announcement() } }) });
    expect(screen.getByRole('status')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('AvvisoBanner: the maintenance', () => {
  test('an admin sees that the maintenance is on', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { maintenance }, player: { role: 'admin' } }) });

    expect(screen.getByRole('status')).toHaveTextContent('Manutenzione accesa: Torno alle 22');
  });

  test('a player who is in a game sees it too', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { maintenance }, player: { currentGameId: 'g1' } }) });

    expect(screen.getByRole('status')).toHaveTextContent('Manutenzione accesa: Torno alle 22');
  });

  test('a player who is not in a game does not: the maintenance screen says it', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { maintenance } }) });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('somebody without an account does not see it either', () => {
    renderWithProviders(<AvvisoBanner />, { preloadedState: state({ notices: { maintenance }, player: { id: null } }) });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
