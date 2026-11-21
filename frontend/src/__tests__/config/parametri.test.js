import { PARAMETRI, etichettaParametro, fraseCambio } from '../../config/parametri';

describe('the labels of the game settings', () => {
  test('are the six keys of the server, in this order', () => {
    expect(PARAMETRI.map((p) => p.chiave)).toEqual([
      'minPlayers',
      'maxPlayers',
      'requiredCredits',
      'jollyHoldSeconds',
      'jollyMaxDeclarations',
      'drawCooldownSeconds',
    ]);
  });

  test('every one has a label, a unit and a sentence that explains it', () => {
    for (const p of PARAMETRI) {
      expect(p.etichetta).toEqual(expect.any(String));
      expect(p.etichetta).not.toBe('');
      expect(p.unita).not.toBe('');
      expect(p.spiegazione).not.toBe('');
    }
  });

  test('the labels and the units are the ones the admin reads', () => {
    expect(PARAMETRI.map((p) => [p.etichetta, p.unita])).toEqual([
      ['Giocatori minimi per avviare', 'giocatori'],
      ['Giocatori massimi', 'giocatori'],
      ["Quota d'ingresso predefinita", 'crediti'],
      ['Pausa del Jolly', 'secondi'],
      ['Dichiarazioni del Jolly per partita', 'dichiarazioni'],
      ['Attesa tra le estrazioni', 'secondi'],
    ]);
  });

  test('etichettaParametro gives the label, or the key itself if it is not known', () => {
    expect(etichettaParametro('drawCooldownSeconds')).toBe('Attesa tra le estrazioni');
    expect(etichettaParametro('cheat')).toBe('cheat');
  });

  test('fraseCambio says what changed, with the unit', () => {
    expect(fraseCambio('drawCooldownSeconds', 8, 12)).toBe('Attesa tra le estrazioni da 8 a 12 secondi');
    expect(fraseCambio('maxPlayers', 10, 8)).toBe('Giocatori massimi da 10 a 8 giocatori');
  });

  test('fraseCambio for an unknown key uses the key and no unit', () => {
    expect(fraseCambio('cheat', 1, 2)).toBe('cheat da 1 a 2');
  });
});
