/**
 * Announcement and maintenance mode in the memory store
 *
 * One announcement at a time: publishing raises the version, withdrawing keeps it. The maintenance
 * mode is on or off. Every real change leaves a row in the audit log, and nothing is written when
 * nothing changes.
 */

import { createMemoryStore } from '../../src/db/store.js';
import { NOTICE_MESSAGE_MAX, NOTICE_SEVERITIES } from '../../src/config/notices.js';

const admin = { type: 'player', id: 'p9' };

describe('the constants of the notices', () => {
  test('the message goes from 1 to 280 characters; the severities are info and importante', () => {
    expect(NOTICE_MESSAGE_MAX).toBe(280);
    expect(NOTICE_SEVERITIES).toEqual(['info', 'importante']);
  });
});

describe('memory store: announcement', () => {
  let store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  test('starts with no announcement, at version 0', async () => {
    await expect(store.getAnnouncement()).resolves.toMatchObject({
      version: 0, active: false, message: '', severity: 'info', startsAt: null, endsAt: null, updatedAt: null, updatedBy: null,
    });
  });

  test('publishing raises the version and activates; a second one replaces the first', async () => {
    const first = await store.publishAnnouncement({ message: 'Alle 22 manutenzione', severity: 'importante' }, { actor: admin });
    expect(first).toMatchObject({ version: 1, active: true, message: 'Alle 22 manutenzione', severity: 'importante', updatedBy: 'p9' });
    expect(first.updatedAt).toEqual(expect.any(String));

    const second = await store.publishAnnouncement(
      { message: 'Nuovo', severity: 'info', startsAt: '2026-12-01T10:00:00.000Z', endsAt: '2026-12-01T12:00:00.000Z' },
      { actor: admin },
    );

    expect(second).toMatchObject({ version: 2, message: 'Nuovo', startsAt: '2026-12-01T10:00:00.000Z', endsAt: '2026-12-01T12:00:00.000Z' });
    await expect(store.getAnnouncement()).resolves.toMatchObject({ version: 2, message: 'Nuovo' });
  });

  test('withdrawing deactivates and keeps the version; withdrawing again writes nothing', async () => {
    await store.publishAnnouncement({ message: 'a', severity: 'info' }, { actor: admin });

    const withdrawn = await store.withdrawAnnouncement({ actor: admin });
    const again = await store.withdrawAnnouncement({ actor: admin });

    expect(withdrawn).toMatchObject({ version: 1, active: false });
    expect(again).toMatchObject({ version: 1, active: false });
    const actions = (await store.listAuditEvents()).map((e) => e.action);
    expect(actions.filter((a) => a === 'announcement_withdrawn')).toHaveLength(1);
  });

  test('withdrawing when there is nothing active writes nothing', async () => {
    await store.withdrawAnnouncement({ actor: admin });

    expect(await store.listAuditEvents()).toEqual([]);
  });
});

describe('memory store: maintenance', () => {
  let store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  test('starts off', async () => {
    await expect(store.getMaintenance()).resolves.toMatchObject({ active: false, message: '', endsAt: null });
  });

  test('turning it on, then the same again, then off, then off again: changed true, false, true, false', async () => {
    const on = { active: true, message: 'Torno alle 22', endsAt: '2026-12-01T22:00:00.000Z' };

    const first = await store.setMaintenance(on, { actor: admin });
    const second = await store.setMaintenance(on, { actor: admin });
    const off = await store.setMaintenance({ active: false }, { actor: admin });
    const offAgain = await store.setMaintenance({ active: false }, { actor: admin });

    expect(first).toMatchObject({ changed: true, maintenance: { active: true, message: 'Torno alle 22', endsAt: '2026-12-01T22:00:00.000Z', updatedBy: 'p9' } });
    expect(second.changed).toBe(false);
    expect(off).toMatchObject({ changed: true, maintenance: { active: false } });
    expect(offAgain.changed).toBe(false);
  });
});

describe('memory store: the audit of the notices', () => {
  test('every real change leaves its row, with the details and the actor', async () => {
    const store = createMemoryStore();

    await store.publishAnnouncement({ message: 'Ciao', severity: 'info', startsAt: null, endsAt: null }, { actor: admin });
    await store.withdrawAnnouncement({ actor: admin });
    await store.setMaintenance({ active: true, message: 'Dopo cena', endsAt: null }, { actor: admin });
    await store.setMaintenance({ active: false }, { actor: admin });

    const events = (await store.listAuditEvents()).reverse();
    expect(events.map((e) => e.action)).toEqual([
      'announcement_published', 'announcement_withdrawn', 'maintenance_enabled', 'maintenance_disabled',
    ]);
    expect(events[0]).toMatchObject({ actorType: 'player', actorId: 'p9', targetId: null, details: { version: 1, message: 'Ciao', severity: 'info', startsAt: null, endsAt: null } });
    expect(events[1].details).toEqual({ version: 1 });
    expect(events[2].details).toEqual({ message: 'Dopo cena', endsAt: null });
    expect(events[3].details).toEqual({});
  });

  test('without an actor nothing is written', async () => {
    const store = createMemoryStore();

    await expect(store.publishAnnouncement({ message: 'x', severity: 'info' })).rejects.toThrow(TypeError);
    await expect(store.withdrawAnnouncement({})).rejects.toThrow(TypeError);
    await expect(store.setMaintenance({ active: true, message: 'x' }, {})).rejects.toThrow(TypeError);

    expect(await store.listAuditEvents()).toEqual([]);
    await expect(store.getAnnouncement()).resolves.toMatchObject({ version: 0, active: false });
  });
});
