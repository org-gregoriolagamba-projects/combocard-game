import { versioneChiusa, chiudiAvviso } from '../../utils/avvisoChiuso';

describe('the announcement the player closed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  test('nothing closed yet: version 0', () => {
    expect(versioneChiusa()).toBe(0);
  });

  test('closing remembers the version', () => {
    chiudiAvviso(3);

    expect(versioneChiusa()).toBe(3);
  });

  test('what is stored and is not a number counts as nothing closed', () => {
    window.localStorage.setItem('combocard.avviso-chiuso', 'abc');

    expect(versioneChiusa()).toBe(0);
  });

  test('without the storage nothing breaks: reading gives 0 and closing does not throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(versioneChiusa()).toBe(0);
    expect(() => chiudiAvviso(3)).not.toThrow();
  });
});
