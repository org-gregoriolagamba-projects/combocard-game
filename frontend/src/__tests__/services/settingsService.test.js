import api from '../../services/api';
import { getSettings } from '../../services/settingsService';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

describe('settingsService', () => {
  // Braces: a function returned by beforeEach is run as a clean-up after the test
  beforeEach(() => {
    api.get.mockReset();
  });

  test('getSettings reads the values, the limits and the defaults of the game', async () => {
    const data = {
      values: { minPlayers: 2, maxPlayers: 10 },
      limits: { minPlayers: { min: 2, max: 10 } },
      defaults: { minPlayers: 2, maxPlayers: 10 },
    };
    api.get.mockResolvedValue({ data });

    await expect(getSettings()).resolves.toEqual(data);
    expect(api.get).toHaveBeenCalledWith('/settings');
  });

  test('a failure of the server reaches the caller', async () => {
    api.get.mockRejectedValue(new Error('Qualcosa non ha funzionato: riprova tra poco'));

    await expect(getSettings()).rejects.toThrow('riprova tra poco');
  });
});
