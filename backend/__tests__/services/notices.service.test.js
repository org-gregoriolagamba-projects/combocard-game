/**
 * Notices service: the announcement, the maintenance mode, the events and the timers
 *
 * The state lives in the game state and changes only after the store has written; every change is
 * told to everybody with an event; the edges of the window of an announcement are armed with a timer.
 */

import { jest } from '@jest/globals';
import { createMemoryStore } from '../../src/db/store.js';
import {
  loadNotices,
  visibleAnnouncement,
  visibleMaintenance,
  statusView,
  publishAnnouncement,
  withdrawAnnouncement,
  setMaintenance,
  isMaintenance,
  assertNotInMaintenance,
  armNoticeTimers,
  stopNoticeTimers,
} from '../../src/services/notices.service.js';

const admin = { type: 'player', id: 'p9' };
const HOUR = 60 * 60 * 1000;

describe('notices service', () => {
  let store;
  let gameState;
  let emitted;
  let io;
  let errorSpy;

  const events = (name) => emitted.filter((e) => e.event === name).map((e) => e.data);

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date('2026-12-01T10:00:00.000Z') });
    store = createMemoryStore();
    gameState = { games: {}, players: {} };
    await loadNotices(store, gameState);
    emitted = [];
    io = { emit: (event, data) => emitted.push({ event, data: JSON.parse(JSON.stringify(data)) }) };
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    stopNoticeTimers();
    jest.useRealTimers();
    errorSpy.mockRestore();
  });

  describe('what is visible', () => {
    const state = (extra) => ({ announcement: { version: 3, active: true, message: 'm', severity: 'info', startsAt: null, endsAt: null, ...extra } });

    test('an announcement without a window is visible; the view has the fields the players need', () => {
      expect(visibleAnnouncement(state())).toEqual({ version: 3, message: 'm', severity: 'info', startsAt: null, endsAt: null });
    });

    test('not before its start, not from its end, not when it is not active', () => {
      const now = new Date('2026-12-01T10:00:00.000Z');

      expect(visibleAnnouncement(state({ startsAt: '2026-12-01T11:00:00.000Z' }), now)).toBeNull();
      expect(visibleAnnouncement(state({ startsAt: '2026-12-01T09:00:00.000Z' }), now)).not.toBeNull();
      expect(visibleAnnouncement(state({ endsAt: '2026-12-01T10:00:00.000Z' }), now)).toBeNull();
      expect(visibleAnnouncement(state({ endsAt: '2026-12-01T10:00:01.000Z' }), now)).not.toBeNull();
      expect(visibleAnnouncement(state({ active: false }), now)).toBeNull();
    });

    test('a state that was never loaded has nothing visible', () => {
      expect(visibleAnnouncement({})).toBeNull();
      expect(visibleMaintenance({})).toBeNull();
      expect(isMaintenance({})).toBe(false);
    });

    test('statusView: no maintenance when it is off', () => {
      expect(statusView(gameState)).toEqual({ maintenance: null, announcement: null });
    });
  });

  describe('announcement', () => {
    test('publishing updates the state, tells everybody with the visible announcement and leaves the audit', async () => {
      const published = await publishAnnouncement(store, gameState, io, { message: 'Alle 22 manutenzione', severity: 'importante' }, admin);

      expect(published).toMatchObject({ version: 1, active: true });
      expect(gameState.announcement.version).toBe(1);
      expect(events('avviso')).toEqual([
        { announcement: { version: 1, message: 'Alle 22 manutenzione', severity: 'importante', startsAt: null, endsAt: null } },
      ]);
      expect((await store.listAuditEvents()).map((e) => e.action)).toEqual(['announcement_published']);
    });

    test('a message with markup is kept exactly as written: it is text, never interpreted', async () => {
      await publishAnnouncement(store, gameState, io, { message: '<script>alert(1)</script>', severity: 'info' }, admin);

      expect(gameState.announcement.message).toBe('<script>alert(1)</script>');
      expect(events('avviso')[0].announcement.message).toBe('<script>alert(1)</script>');
    });

    test('withdrawing tells everybody there is none', async () => {
      await publishAnnouncement(store, gameState, io, { message: 'a', severity: 'info' }, admin);

      await withdrawAnnouncement(store, gameState, io, admin);

      expect(gameState.announcement.active).toBe(false);
      expect(events('avviso').at(-1)).toEqual({ announcement: null });
    });

    test('when the store cannot write: 503, the state does not change and nothing is told', async () => {
      store.publishAnnouncement = async () => { throw new Error('down'); };

      await expect(publishAnnouncement(store, gameState, io, { message: 'a', severity: 'info' }, admin))
        .rejects.toMatchObject({ statusCode: 503 });

      expect(gameState.announcement.version).toBe(0);
      expect(emitted).toEqual([]);
    });

    test('the same for the withdrawal', async () => {
      await publishAnnouncement(store, gameState, io, { message: 'a', severity: 'info' }, admin);
      emitted.length = 0;
      store.withdrawAnnouncement = async () => { throw new Error('down'); };

      await expect(withdrawAnnouncement(store, gameState, io, admin)).rejects.toMatchObject({ statusCode: 503 });

      expect(gameState.announcement.active).toBe(true);
      expect(emitted).toEqual([]);
    });
  });

  describe('maintenance', () => {
    test('turning it on tells everybody, turning it off tells them it is over', async () => {
      const on = await setMaintenance(store, gameState, io, { active: true, message: 'Torno alle 22', endsAt: '2026-12-01T22:00:00.000Z' }, admin);
      const off = await setMaintenance(store, gameState, io, { active: false }, admin);

      expect(on.changed).toBe(true);
      expect(off.changed).toBe(true);
      expect(events('manutenzione')).toEqual([
        { maintenance: { active: true, message: 'Torno alle 22', endsAt: '2026-12-01T22:00:00.000Z' } },
        { maintenance: null },
      ]);
      expect(isMaintenance(gameState)).toBe(false);
    });

    test('a change that changes nothing tells nobody', async () => {
      await setMaintenance(store, gameState, io, { active: false }, admin);

      expect(emitted).toEqual([]);
    });

    test('when the store cannot write: 503, the state and the events do not change', async () => {
      store.setMaintenance = async () => { throw new Error('down'); };

      await expect(setMaintenance(store, gameState, io, { active: true, message: 'x' }, admin)).rejects.toMatchObject({ statusCode: 503 });

      expect(isMaintenance(gameState)).toBe(false);
      expect(emitted).toEqual([]);
    });
  });

  describe('assertNotInMaintenance', () => {
    test('does nothing while the maintenance is off', () => {
      expect(() => assertNotInMaintenance(gameState, 'player')).not.toThrow();
    });

    test('refuses a player and a visitor with 503 and the code MAINTENANCE; never an admin', async () => {
      await setMaintenance(store, gameState, io, { active: true, message: 'Torno presto' }, admin);

      expect(() => assertNotInMaintenance(gameState, 'player')).toThrow(expect.objectContaining({ statusCode: 503, code: 'MAINTENANCE' }));
      expect(() => assertNotInMaintenance(gameState)).toThrow(expect.objectContaining({ code: 'MAINTENANCE' }));
      expect(() => assertNotInMaintenance(gameState, 'admin')).not.toThrow();
    });

    test('retryAfter is the number of seconds to the expected end, at least 1, and absent without an end', async () => {
      await setMaintenance(store, gameState, io, { active: true, message: 'x', endsAt: '2026-12-01T10:30:00.000Z' }, admin);
      let error;
      try { assertNotInMaintenance(gameState, 'player'); } catch (err) { error = err; }
      expect(error.retryAfter).toBe(1800);

      jest.setSystemTime(new Date('2026-12-01T11:00:00.000Z'));
      try { assertNotInMaintenance(gameState, 'player'); } catch (err) { error = err; }
      expect(error).not.toHaveProperty('retryAfter', expect.any(Number));

      await setMaintenance(store, gameState, io, { active: false }, admin);
      await setMaintenance(store, gameState, io, { active: true, message: 'y' }, admin);
      try { assertNotInMaintenance(gameState, 'player'); } catch (err) { error = err; }
      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('the timers at the edges of the window', () => {
    test('an announcement that starts in an hour is not told now and is told when it starts', async () => {
      await publishAnnouncement(store, gameState, io, { message: 'a', severity: 'info', startsAt: '2026-12-01T11:00:00.000Z' }, admin);
      expect(events('avviso')).toEqual([{ announcement: null }]);

      jest.advanceTimersByTime(HOUR);

      expect(events('avviso').at(-1)).toMatchObject({ announcement: { version: 1, message: 'a' } });
    });

    test('an announcement that ends in an hour is told when it ends: there is none any more', async () => {
      await publishAnnouncement(store, gameState, io, { message: 'a', severity: 'info', endsAt: '2026-12-01T11:00:00.000Z' }, admin);
      expect(events('avviso').at(-1)).toMatchObject({ announcement: { version: 1 } });

      jest.advanceTimersByTime(HOUR);

      expect(events('avviso').at(-1)).toEqual({ announcement: null });
    });

    test('a start that is 40 days away does not fire at once: the timer waits at most 12 hours and arms again', async () => {
      const startsAt = new Date(Date.now() + 40 * 24 * HOUR).toISOString();
      await publishAnnouncement(store, gameState, io, { message: 'a', severity: 'info', startsAt }, admin);
      const before = events('avviso').length;

      jest.advanceTimersByTime(12 * HOUR);
      expect(events('avviso')).toHaveLength(before);
      expect(jest.getTimerCount()).toBe(1);

      jest.advanceTimersByTime(40 * 24 * HOUR);
      expect(events('avviso').at(-1)).toMatchObject({ announcement: { version: 1 } });
    });

    test('nothing is armed without a future edge, and a new call replaces the old timer', async () => {
      await publishAnnouncement(store, gameState, io, { message: 'a', severity: 'info' }, admin);
      expect(jest.getTimerCount()).toBe(0);

      await publishAnnouncement(store, gameState, io, { message: 'b', severity: 'info', endsAt: '2026-12-01T12:00:00.000Z' }, admin);
      armNoticeTimers(gameState, io);
      armNoticeTimers(gameState, io);
      expect(jest.getTimerCount()).toBe(1);

      await withdrawAnnouncement(store, gameState, io, admin);
      expect(jest.getTimerCount()).toBe(0);
    });

    test('at startup the timers come back for the announcement that was saved', async () => {
      await store.publishAnnouncement({ message: 'a', severity: 'info', endsAt: '2026-12-01T11:00:00.000Z' }, { actor: admin });
      const fresh = { games: {}, players: {} };
      await loadNotices(store, fresh);
      emitted.length = 0;

      armNoticeTimers(fresh, io);
      jest.advanceTimersByTime(HOUR);

      expect(events('avviso')).toEqual([{ announcement: null }]);
    });
  });
});
