import { LEGALE } from '../../config/legale';

describe('LEGALE', () => {
  test('the version of the texts and the minimum age', () => {
    expect(LEGALE.versione).toBe('2026-1');
    expect(LEGALE.etaMinima).toBe(14);
  });

  test('the owner of the processing is a person', () => {
    expect(LEGALE.titolare).toBe('Gregorio La Gamba');
  });

  test('the values that depend on the publication are not set yet', () => {
    expect(LEGALE.hosting).toEqual({ nome: null, paese: null });
    expect(LEGALE.conservazioneLog).toBeNull();
    expect(LEGALE.vigenteDal).toBeNull();
  });
});
