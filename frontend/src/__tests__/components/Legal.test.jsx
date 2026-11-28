import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InformativaScreen, TerminiScreen } from '../../components/legal';
import { renderWithProviders } from '../test-utils';

const FORNITORI = [
  { nome: 'Render', societa: 'Render Services, Inc.', paese: 'Stati Uniti', ruolo: "hosting dell'applicazione e dei log del server", dove: 'server a Francoforte (Germania)', fuoriSee: true, documento: 'https://render.example/dpa' },
  { nome: 'Neon', societa: 'Neon, parte di Databricks, Inc.', paese: 'Stati Uniti', ruolo: 'database', dove: 'server AWS a Francoforte (Germania)', fuoriSee: true, documento: 'https://neon.example/terms' },
  { nome: 'OVHcloud', societa: 'OVHcloud', paese: 'Francia', ruolo: 'dominio e casella di posta', dove: '', fuoriSee: false, documento: '' },
];

const config = vi.hoisted(() => ({
  legale: {
    versione: '2026-1',
    titolare: 'Gregorio La Gamba',
    etaMinima: 14,
    emailPrivacy: null,
    fornitori: [],
    conservazioneLog: null,
    conservazioneCloudflare: null,
    conservazioneBackup: null,
    vigenteDal: null,
  },
  contatti: { autore: 'Gregorio La Gamba', email: 'info@esempio.it' },
}));
vi.mock('../../config/legale', () => ({
  get LEGALE() {
    return config.legale;
  },
}));
vi.mock('../../config/contatti', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    get CONTATTI() {
      return { ...original.CONTATTI, ...config.contatti };
    },
  };
});

const ui = (currentScreen, legalReturn = 'hall') => ({
  ui: { toasts: [], currentScreen, legalReturn, modals: {}, isLoading: false, vittoriaRecente: null },
});

const setAll = () => {
  config.legale.emailPrivacy = 'privacy@esempio.it';
  config.legale.fornitori = FORNITORI;
  config.legale.conservazioneLog = '7 giorni';
  config.legale.conservazioneCloudflare = 'nessun log conservato';
  config.legale.conservazioneBackup = '1 giorno';
  config.legale.vigenteDal = '1 dicembre 2026';
};

beforeEach(() => {
  config.legale.emailPrivacy = null;
  config.legale.fornitori = FORNITORI;
  config.legale.conservazioneLog = null;
  config.legale.conservazioneCloudflare = null;
  config.legale.conservazioneBackup = null;
  config.legale.vigenteDal = null;
});

describe('InformativaScreen', () => {
  test('has its title, the version, and the sections of the notice', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    expect(screen.getByRole('heading', { level: 1, name: 'Informativa sulla privacy' })).toBeInTheDocument();
    expect(screen.getByText(/Versione 2026-1/)).toBeInTheDocument();
    for (const titolo of [
      'Chi è il titolare',
      'Quali dati trattiamo',
      'Perché e su quale base',
      'Per quanto tempo li conserviamo',
      'A chi li comunichiamo',
      'I tuoi diritti',
      'Cookie',
    ]) {
      expect(screen.getByRole('heading', { name: titolo })).toBeInTheDocument();
    }
  });

  test('names the owner, a person', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    expect(screen.getAllByText(/Gregorio La Gamba/).length).toBeGreaterThan(0);
  });

  test('says what is kept after the deletion of an account', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    const section = screen.getByRole('heading', { name: 'Per quanto tempo li conserviamo' }).closest('section');
    expect(within(section).getByText(/Utente eliminato/)).toBeInTheDocument();
  });

  test('says that the server logs carry the IP address', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    const section = screen.getByRole('heading', { name: 'Quali dati trattiamo' }).closest('section');
    expect(within(section).getByText(/indirizzo IP/)).toBeInTheDocument();
  });

  test('says who can see the username: the players of the games, and everybody in the hall for the first player of a waiting game', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    const section = screen.getByRole('heading', { name: 'Quali dati trattiamo' }).closest('section');
    expect(within(section).getByText(/chiunque sia nella hall/)).toBeInTheDocument();
  });

  test('the register covers also what the player does on the account, and says that the reasons written by hand stay', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    expect(screen.getByText(/cambi la password/)).toBeInTheDocument();
    const section = screen.getByRole('heading', { name: 'Per quanto tempo li conserviamo' }).closest('section');
    expect(within(section).getByText(/motivi scritti a mano/)).toBeInTheDocument();
  });

  test('lists the dates and the sessions that are kept, and says there is no fixed expiry', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    const dati = screen.getByRole('heading', { name: 'Quali dati trattiamo' }).closest('section');
    expect(within(dati).getByText(/data di creazione dell'account/)).toBeInTheDocument();
    expect(within(dati).getByText(/sessioni aperte/)).toBeInTheDocument();
    const tempi = screen.getByRole('heading', { name: 'Per quanto tempo li conserviamo' }).closest('section');
    expect(within(tempi).getByText(/finché servono alla gestione del servizio/)).toBeInTheDocument();
  });

  test('the cookie lasts 7 days from the last use, and the two preferences of the browser are named', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    expect(screen.getByText(/dall'ultimo utilizzo/)).toBeInTheDocument();
    const cookie = screen.getByRole('heading', { name: 'Cookie' }).closest('section');
    expect(within(cookie).getByText(/due preferenze tecniche/)).toBeInTheDocument();
  });

  test('the deletion of the account is not possible while the player is in a game, in both texts', () => {
    const { unmount } = renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });
    expect(screen.getByText(/mentre sei in una partita/)).toBeInTheDocument();
    unmount();

    renderWithProviders(<TerminiScreen />, { preloadedState: ui('termini') });
    expect(screen.getByText(/mentre sei in una partita/)).toBeInTheDocument();
  });

  test('a value that is not set shows [da indicare], and none when everything is set', () => {
    const { unmount } = renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });
    expect(screen.getAllByTestId('da-indicare').length).toBeGreaterThanOrEqual(3);
    unmount();

    setAll();
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });
    expect(screen.queryByTestId('da-indicare')).not.toBeInTheDocument();
    expect(screen.getAllByText(/privacy@esempio.it/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Render Services, Inc./).length).toBeGreaterThan(0);
  });

  test('the contact of the notice is the privacy address, not the general one of the app', () => {
    setAll();
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    expect(screen.getAllByText(/privacy@esempio.it/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/info@esempio.it/)).not.toBeInTheDocument();
  });

  describe('the providers', () => {
    test('are listed with who they are, where they are, what they do and where the data is', () => {
      renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

      const section = screen.getByRole('heading', { name: 'A chi li comunichiamo' }).closest('section');
      // The name is in the list and in the link to the document
      expect(within(section).getAllByText('Render').length).toBeGreaterThanOrEqual(1);
      expect(within(section).getByText(/Render Services, Inc\./)).toBeInTheDocument();
      expect(within(section).getByText(/server a Francoforte \(Germania\)/)).toBeInTheDocument();
      expect(within(section).getByText(/server AWS a Francoforte/)).toBeInTheDocument();
      expect(within(section).getByText(/hosting dell'applicazione e dei log del server/)).toBeInTheDocument();
      expect(within(section).getByText('OVHcloud')).toBeInTheDocument();
      expect(within(section).getByText(/Francia/)).toBeInTheDocument();
    });

    test('say, for the ones outside the European Economic Area, what the transfer rests on, with the link to their document', () => {
      renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

      const section = screen.getByRole('heading', { name: 'A chi li comunichiamo' }).closest('section');
      expect(within(section).getByText(/Fuori dallo Spazio economico europeo/)).toBeInTheDocument();
      expect(within(section).getByText(/clausole contrattuali standard/)).toBeInTheDocument();
      expect(within(section).getByText(/Data Privacy Framework/)).toBeInTheDocument();
      // The framework first, the clauses when it does not apply: as the contracts of the providers say
      expect(within(section).getByText(/se non si applica, le clausole contrattuali standard/)).toBeInTheDocument();
      expect(within(section).getByText(/attività principale di trattamento si svolge negli Stati Uniti/)).toBeInTheDocument();
      expect(within(section).getByRole('link', { name: /Render/ })).toHaveAttribute('href', 'https://render.example/dpa');
      expect(within(section).getByRole('link', { name: /Neon/ })).toHaveAttribute('href', 'https://neon.example/terms');
      // The one in France is inside the Area: no document, no link
      expect(within(section).queryByRole('link', { name: /OVHcloud/ })).not.toBeInTheDocument();
    });

    test('nothing is sold and nothing goes to anybody else, apart from what the law requires', () => {
      renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

      const section = screen.getByRole('heading', { name: 'A chi li comunichiamo' }).closest('section');
      expect(within(section).getByText(/Non vendiamo i dati/)).toBeInTheDocument();
    });
  });

  describe('how long it all is kept', () => {
    const tempi = () => screen.getByRole('heading', { name: 'Per quanto tempo li conserviamo' }).closest('section');

    test('the server logs, the traffic of the network, the backups of the database, each with its own value', () => {
      setAll();
      renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

      expect(within(tempi()).getByText(/sul fornitore di\s+hosting: 7 giorni/)).toBeInTheDocument();
      expect(within(tempi()).getByText(/nessun log conservato/)).toBeInTheDocument();
      expect(within(tempi()).getByText(/1 giorno/)).toBeInTheDocument();
    });

    test('what is not decided yet shows [da indicare], one for each value', () => {
      renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

      expect(within(tempi()).getAllByTestId('da-indicare').length).toBeGreaterThanOrEqual(3);
    });

    test('the register of the operations is kept as long as the management of the service needs it, and holds no password nor name of a deleted account', () => {
      renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

      // The text of the list item without the bold words in it
      expect(within(tempi()).getByText(/che teniamo finché serve alla gestione del servizio/)).toBeInTheDocument();
      expect(within(tempi()).getByText(/né password né nomi utente degli account eliminati/)).toBeInTheDocument();
    });
  });

  test('says that what the player writes to the addresses of the service is kept in the mailbox', () => {
    renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa') });

    const dati = screen.getByRole('heading', { name: 'Quali dati trattiamo' }).closest('section');
    expect(within(dati).getByText(/messaggi che ci scrivi/)).toBeInTheDocument();
  });

  test('"Indietro" goes back to the screen the player came from', () => {
    const { store } = renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa', 'hall') });

    fireEvent.click(screen.getByRole('button', { name: /indietro/i }));

    expect(store.getState().ui.currentScreen).toBe('hall');
  });

  test('a link takes to the terms', () => {
    const { store } = renderWithProviders(<InformativaScreen />, { preloadedState: ui('informativa', 'hall') });

    fireEvent.click(screen.getByRole('button', { name: /termini d'uso/i }));

    expect(store.getState().ui.currentScreen).toBe('termini');
    expect(store.getState().ui.legalReturn).toBe('hall');
  });
});

describe('TerminiScreen', () => {
  test('has its title and the sections of the terms', () => {
    renderWithProviders(<TerminiScreen />, { preloadedState: ui('termini') });

    expect(screen.getByRole('heading', { level: 1, name: "Termini d'uso" })).toBeInTheDocument();
    for (const titolo of ['Chi può giocare', 'I crediti', 'Sospensione ed eliminazione', 'Licenza e responsabilità', 'Crediti delle illustrazioni']) {
      expect(screen.getByRole('heading', { name: titolo })).toBeInTheDocument();
    }
  });

  test('states the minimum age, 14 years', () => {
    renderWithProviders(<TerminiScreen />, { preloadedState: ui('termini') });

    expect(screen.getByText(/almeno 14 anni/)).toBeInTheDocument();
  });

  test('says that the credits are play money, without real value and not refunded', () => {
    renderWithProviders(<TerminiScreen />, { preloadedState: ui('termini') });

    const section = screen.getByRole('heading', { name: 'I crediti' }).closest('section');
    expect(within(section).getByText(/senza valore reale/)).toBeInTheDocument();
    expect(within(section).getByText(/non rimborsabili/)).toBeInTheDocument();
  });

  test('credits the deck of 1875', () => {
    renderWithProviders(<TerminiScreen />, { preloadedState: ui('termini') });

    expect(screen.getByText(/1875/)).toBeInTheDocument();
    expect(screen.getByText(/British Museum/)).toBeInTheDocument();
  });

  test('"Indietro" goes back and a link takes to the privacy notice', () => {
    const { store } = renderWithProviders(<TerminiScreen />, { preloadedState: ui('termini', 'home') });

    fireEvent.click(screen.getByRole('button', { name: /informativa sulla privacy/i }));
    expect(store.getState().ui.currentScreen).toBe('informativa');
    expect(store.getState().ui.legalReturn).toBe('home');
  });
});
