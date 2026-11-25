import noticeReducer, { fetchStatus, setAnnouncement, setMaintenance } from '../../store/slices/noticeSlice';
import * as statusService from '../../services/statusService';
import { createTestStore } from '../test-utils';

vi.mock('../../services/statusService');

const initial = { announcement: null, maintenance: null, status: 'idle', seq: 0 };
const announcement = { version: 2, message: 'Ciao', severity: 'info', startsAt: null, endsAt: null };
const maintenance = { active: true, message: 'Torno alle 22', endsAt: null };

describe('noticeSlice', () => {
  test('starts with nothing', () => {
    expect(noticeReducer(undefined, { type: 'unknown' })).toEqual(initial);
  });

  test('a status that arrives puts both in the state', () => {
    const state = noticeReducer(initial, { type: fetchStatus.fulfilled.type, payload: { announcement, maintenance, startSeq: 0 } });

    expect(state).toEqual({ announcement, maintenance, status: 'ready', seq: 0 });
  });

  test('a status with nothing in it empties them', () => {
    const before = { announcement, maintenance, status: 'ready', seq: 0 };

    const state = noticeReducer(before, { type: fetchStatus.fulfilled.type, payload: { announcement: null, maintenance: null, startSeq: 0 } });

    expect(state).toMatchObject({ announcement: null, maintenance: null });
  });

  test('a failure keeps what was already read', () => {
    const before = { announcement, maintenance, status: 'ready', seq: 0 };

    const state = noticeReducer(before, { type: fetchStatus.rejected.type, payload: 'down' });

    expect(state).toEqual({ announcement, maintenance, status: 'error', seq: 0 });
  });

  test('the events set and clear each one on its own', () => {
    let state = noticeReducer(initial, setAnnouncement(announcement));
    state = noticeReducer(state, setMaintenance(maintenance));
    expect(state).toMatchObject({ announcement, maintenance });

    state = noticeReducer(state, setAnnouncement(null));
    expect(state).toMatchObject({ announcement: null, maintenance });
    state = noticeReducer(state, setMaintenance(null));
    expect(state).toMatchObject({ announcement: null, maintenance: null });
  });

  test('an event that arrives while a read is in flight is not overwritten by the older answer', async () => {
    let answer;
    statusService.getStatus.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const store = createTestStore();
    const reading = store.dispatch(fetchStatus());

    // The server told everybody about a new announcement while the read was on its way
    store.dispatch(setAnnouncement(announcement));
    answer({ announcement: null, maintenance: null }); // what the server knew before
    await reading;

    expect(store.getState().notices.announcement).toEqual(announcement);
    expect(store.getState().notices.status).toBe('ready');
  });

  test('a read that began after the event is used', async () => {
    const store = createTestStore();
    store.dispatch(setAnnouncement(announcement));
    statusService.getStatus.mockResolvedValue({ announcement: null, maintenance });

    await store.dispatch(fetchStatus());

    expect(store.getState().notices).toMatchObject({ announcement: null, maintenance });
  });

  test('fetchStatus reads the public status of the server', async () => {
    statusService.getStatus.mockResolvedValue({ announcement, maintenance: null });
    const store = createTestStore();

    await store.dispatch(fetchStatus());

    expect(store.getState().notices).toEqual({ announcement, maintenance: null, status: 'ready', seq: 0 });
  });

  test('fetchStatus that fails leaves what was there', async () => {
    statusService.getStatus.mockResolvedValue({ announcement, maintenance: null });
    const store = createTestStore();
    await store.dispatch(fetchStatus());
    statusService.getStatus.mockRejectedValue(new Error('down'));

    await store.dispatch(fetchStatus());

    expect(store.getState().notices).toMatchObject({ announcement, status: 'error' });
  });
});
