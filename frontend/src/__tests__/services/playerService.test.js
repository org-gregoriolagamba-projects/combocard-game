import api from '../../services/api';
import * as playerService from '../../services/playerService';

vi.mock('../../services/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

describe('playerService.acceptTerms', () => {
  test('sends the version of the texts the app shows', async () => {
    api.post.mockResolvedValue({ data: { success: true, terminiAccettatiIl: '2026-11-22T10:00:00.000Z', terminiVersione: '2026-1' } });

    const result = await playerService.acceptTerms('p1');

    expect(api.post).toHaveBeenCalledWith('/players/p1/accept-terms', { version: '2026-1' });
    expect(result).toEqual({ success: true, terminiAccettatiIl: '2026-11-22T10:00:00.000Z', terminiVersione: '2026-1' });
  });
});
