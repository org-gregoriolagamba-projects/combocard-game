/**
 * Notices controllers (admin): publish and withdraw the announcement, turn the maintenance on and off
 *
 * The handlers run on the memory store. What they answer, what they save and what they tell the players.
 */

import { jest } from '@jest/globals';
import {
  getNotices,
  publishAnnouncement,
  withdrawAnnouncement,
  setMaintenance,
} from '../../src/controllers/admin.controller.js';
import { createMemoryStore } from '../../src/db/store.js';
import { loadNotices, stopNoticeTimers } from '../../src/services/notices.service.js';

describe('notices controllers', () => {
  let store;
  let gameState;
  let emitted;
  let io;
  let errorSpy;

  const call = (handler, { body = {}, playerId = 'p9' } = {}) =>
    new Promise((resolve, reject) => {
      const res = {
        status: (code) => {
          res.code = code;
          return res;
        },
        json: (payload) => {
          resolve({ code: res.code, ...payload });
          return res;
        },
      };
      handler({ params: {}, body, query: {}, store, gameState, io, auth: { playerId, role: 'admin' } }, res, reject);
    });

  beforeEach(async () => {
    store = createMemoryStore();
    gameState = { games: {}, players: {} };
    await loadNotices(store, gameState);
    emitted = [];
    io = { emit: (event, data) => emitted.push({ event, data: JSON.parse(JSON.stringify(data)) }), to: () => ({ emit: () => {} }) };
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    stopNoticeTimers();
    errorSpy.mockRestore();
  });

  test('getNotices answers the full state of both, with who changed them last', async () => {
    await call(publishAnnouncement, { body: { message: 'Ciao', severity: 'info' } });

    const res = await call(getNotices);

    expect(res.data.announcement).toMatchObject({ version: 1, active: true, message: 'Ciao', updatedBy: 'p9' });
    expect(res.data.maintenance).toMatchObject({ active: false, message: '' });
  });

  test('publishing answers with the announcement, saves it with the caller as the actor and tells the players', async () => {
    const res = await call(publishAnnouncement, {
      body: { message: 'Alle 22 manutenzione', severity: 'importante', startsAt: new Date('2026-12-01T10:00:00Z'), endsAt: new Date('2026-12-01T12:00:00Z') },
    });

    expect(res.data.announcement).toMatchObject({
      version: 1, severity: 'importante', startsAt: '2026-12-01T10:00:00.000Z', endsAt: '2026-12-01T12:00:00.000Z',
    });
    const [audit] = await store.listAuditEvents();
    expect(audit).toMatchObject({ action: 'announcement_published', actorId: 'p9' });
    expect(emitted.some((e) => e.event === 'avviso')).toBe(true);
  });

  test('a message with a script tag is saved and answered exactly as written', async () => {
    const res = await call(publishAnnouncement, { body: { message: '<script>alert(1)</script>', severity: 'info' } });

    expect(res.data.announcement.message).toBe('<script>alert(1)</script>');
    expect((await store.getAnnouncement()).message).toBe('<script>alert(1)</script>');
  });

  test('the actor is the caller, never the body', async () => {
    await call(publishAnnouncement, { playerId: 'p9', body: { message: 'x', severity: 'info', actor: { type: 'player', id: 'p1' }, updatedBy: 'p1' } });

    expect((await store.getAnnouncement()).updatedBy).toBe('p9');
  });

  test('withdrawing answers with the announcement switched off, and tells the players there is none', async () => {
    await call(publishAnnouncement, { body: { message: 'x', severity: 'info' } });

    const res = await call(withdrawAnnouncement);

    expect(res.data.announcement).toMatchObject({ version: 1, active: false });
    expect(emitted.at(-1)).toEqual({ event: 'avviso', data: { announcement: null } });
  });

  test('turning the maintenance on and off says whether it changed', async () => {
    const on = await call(setMaintenance, { body: { active: true, message: 'Torno alle 22', endsAt: new Date('2026-12-01T22:00:00Z') } });
    const again = await call(setMaintenance, { body: { active: true, message: 'Torno alle 22', endsAt: new Date('2026-12-01T22:00:00Z') } });
    const off = await call(setMaintenance, { body: { active: false } });

    expect(on.data).toMatchObject({ changed: true, maintenance: { active: true, message: 'Torno alle 22', endsAt: '2026-12-01T22:00:00.000Z' } });
    expect(again.data.changed).toBe(false);
    expect(off.data).toMatchObject({ changed: true, maintenance: { active: false } });
    expect(emitted.filter((e) => e.event === 'manutenzione').map((e) => e.data.maintenance?.active ?? null)).toEqual([true, null]);
  });

  test('when the store cannot write the answer is 503', async () => {
    store.publishAnnouncement = async () => { throw new Error('down'); };

    await expect(call(publishAnnouncement, { body: { message: 'x', severity: 'info' } })).rejects.toMatchObject({ statusCode: 503 });
  });
});
