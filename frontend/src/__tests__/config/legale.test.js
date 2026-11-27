import { LEGALE } from '../../config/legale';

describe('LEGALE', () => {
  test('the version of the texts and the minimum age', () => {
    expect(LEGALE.versione).toBe('2026-1');
    expect(LEGALE.etaMinima).toBe(14);
  });

  test('the owner of the processing is a person', () => {
    expect(LEGALE.titolare).toBe('Gregorio La Gamba');
  });

  test('the contact for the privacy is a dedicated address of the domain', () => {
    expect(LEGALE.emailPrivacy).toBe('privacy@combocard.it');
  });

  test('the providers: who they are, where, what they do, where the data is', () => {
    expect(LEGALE.fornitori.map((f) => f.nome)).toEqual(['Render', 'Neon', 'Cloudflare', 'OVHcloud']);
    const byName = Object.fromEntries(LEGALE.fornitori.map((f) => [f.nome, f]));
    expect(byName.Render).toMatchObject({ societa: 'Render Services, Inc.', paese: 'Stati Uniti', fuoriSee: true });
    expect(byName.Render.dove).toMatch(/Francoforte/);
    expect(byName.Neon).toMatchObject({ societa: 'Neon, parte di Databricks, Inc.', paese: 'Stati Uniti', fuoriSee: true });
    expect(byName.Neon.dove).toMatch(/AWS.*Francoforte/);
    expect(byName.Cloudflare).toMatchObject({ paese: 'Stati Uniti', fuoriSee: true });
    expect(byName.OVHcloud).toMatchObject({ paese: 'Francia', fuoriSee: false });
  });

  test('every provider outside the Area has the link to the document that describes the transfers', () => {
    for (const f of LEGALE.fornitori.filter((p) => p.fuoriSee)) {
      expect(f.documento).toMatch(/^https:\/\//);
    }
  });

  test('the server logs are kept 7 days (Render)', () => {
    expect(LEGALE.conservazioneLog).toBe('7 giorni');
  });

  test('what is still to be decided is not set: the logs of Cloudflare, the backups of Neon and the date', () => {
    expect(LEGALE.conservazioneCloudflare).toBeNull();
    expect(LEGALE.conservazioneBackup).toBeNull();
    expect(LEGALE.vigenteDal).toBeNull();
  });
});
