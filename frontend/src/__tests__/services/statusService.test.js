import api from '../../services/api';
import * as statusService from '../../services/statusService';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

describe('statusService', () => {
  test('getStatus asks the public status and gives back what the server answers', async () => {
    const answer = { maintenance: null, announcement: { version: 2, message: 'Ciao', severity: 'info' } };
    api.get.mockResolvedValue({ data: answer });

    await expect(statusService.getStatus()).resolves.toEqual(answer);

    // A read in the background: a page that is reloaded cancels it, and that is not an error to write in the console
    expect(api.get).toHaveBeenCalledWith('/status', { quiet: true });
  });
});
