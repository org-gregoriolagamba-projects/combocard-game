import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RegoleGioco } from '../../components/game';

const game = {
  montepremi: 200,
  collezioniDistribuzione: { tris: 20, sequenza: 30, scopa: 40, napola: 50, combocard_reale: 60 },
};

describe('RegoleGioco', () => {
  test('explains the game in sections: aim, how a game goes, the sheet, collections, the jolly, the end', () => {
    render(<RegoleGioco game={game} />);

    for (const titolo of ['Lo scopo', 'Come funziona una partita', 'La cartella', 'Le collezioni', 'Il Jolly', 'Come finisce']) {
      expect(screen.getByRole('heading', { name: titolo })).toBeInTheDocument();
    }
  });

  test('says how a game goes: who draws, how often, and that the sheet covers by itself', () => {
    render(<RegoleGioco game={game} parametri={{ minPlayers: 2, maxPlayers: 10, drawCooldownSeconds: 8 }} />);

    expect(screen.getByText(/Estrae una carta alla volta/)).toHaveTextContent('almeno 8 secondi');
    expect(screen.getByText(/si copre da sola con un sigillo/)).toBeInTheDocument();
    expect(screen.getByText(/formano il montepremi/)).toBeInTheDocument();
  });

  test('gives the rule of each collection, with the share of the pot this game really uses', () => {
    render(<RegoleGioco game={game} />);

    expect(screen.getByText(/Tris/, { selector: 'strong' }).closest('li')).toHaveTextContent('(10% del montepremi)');
    expect(screen.getByText(/Combocard Reale/, { selector: 'strong' }).closest('li')).toHaveTextContent('(30% del montepremi)');
    expect(screen.getByText(/Dopo il Re non si riparte dall'Asso/)).toBeInTheDocument();
  });

  test('without the game it still gives the rules, only without percentages', () => {
    render(<RegoleGioco />);

    expect(screen.getByText(/tre carte coperte con lo stesso valore \(una riga/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('% del montepremi');
  });

  test('says that a collection is won once, and shared when it is completed together', () => {
    render(<RegoleGioco game={game} />);

    expect(screen.getByText(/una volta sola per partita/)).toHaveTextContent('si dividono il premio');
  });

  test('says how the game ends and what happens to the credits', () => {
    render(<RegoleGioco game={game} />);

    const fine = screen.getByText(/La partita finisce quando qualcuno completa la Combocard Reale/);
    expect(fine).toHaveTextContent('si dividono in parti uguali tra tutti i giocatori');
    expect(fine).toHaveTextContent('perdi i crediti d');
  });

  test('explains the turns, the time limit and the cards of discipline', () => {
    render(<RegoleGioco game={game} />);

    expect(screen.getByText(/a turno tutti i giocatori/)).toBeInTheDocument();
    expect(screen.getByText(/cartellino giallo/)).toBeInTheDocument();
    expect(screen.getByText(/cartellino rosso/)).toBeInTheDocument();
  });

  describe('the numbers come from the settings, never from the text', () => {
    const settings = { minPlayers: 3, maxPlayers: 8, drawCooldownSeconds: 12 };
    const players = () => screen.getByText(/Si gioca|Il numero di giocatori/);
    const wait = () => screen.getByText(/Estrae una carta alla volta/);

    test('with the settings given, the players and the wait are the ones of the server', () => {
      render(<RegoleGioco game={game} parametri={settings} />);

      expect(players()).toHaveTextContent('Si gioca da 3 a 8.');
      expect(wait()).toHaveTextContent('almeno 12 secondi tra una e l\'altra');
      expect(document.body).not.toHaveTextContent('da 2 a 10');
      expect(document.body).not.toHaveTextContent('almeno 8 secondi');
    });

    test('in a game the settings of the game are used', () => {
      render(<RegoleGioco game={{ ...game, settings: { ...settings, maxPlayers: 6 } }} />);

      expect(players()).toHaveTextContent('Si gioca da 3 a 6.');
      expect(wait()).toHaveTextContent('almeno 12 secondi');
    });

    test('the settings given win over the ones of the game', () => {
      render(<RegoleGioco game={{ ...game, settings: { ...settings, maxPlayers: 6 } }} parametri={{ ...settings, maxPlayers: 9 }} />);

      expect(players()).toHaveTextContent('Si gioca da 3 a 9.');
    });

    test('without the settings the sentences are read with no number', () => {
      render(<RegoleGioco game={game} />);

      expect(players()).toHaveTextContent('Il numero di giocatori lo decide chi gestisce il gioco.');
      expect(wait()).toHaveTextContent("con una breve attesa tra una e l'altra");
      expect(players().textContent).not.toMatch(/\d/);
      expect(wait().textContent).not.toMatch(/\d+ secondi/);
    });

    test('each number is used only if it is there', () => {
      render(<RegoleGioco game={game} parametri={{ drawCooldownSeconds: 12 }} />);

      expect(players()).toHaveTextContent('Il numero di giocatori lo decide chi gestisce il gioco.');
      expect(wait()).toHaveTextContent('almeno 12 secondi');
    });
  });
});
