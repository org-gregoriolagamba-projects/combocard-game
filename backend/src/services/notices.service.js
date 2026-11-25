/**
 * Notices Service
 *
 * The announcement for all the players and the maintenance mode. The server keeps them in
 * `gameState.announcement` and `gameState.maintenance`, loaded at startup from the store and changed
 * only after the store has written the change (a failed write leaves the old state and tells nobody).
 * Every change is told to everybody with an event: `avviso` with the announcement that is visible now
 * (or null) and `manutenzione` with the maintenance mode (or null when it is off).
 *
 * An announcement can have a start and an end. Nothing reads the clock on a timer: the server arms a
 * timer at the next edge of the window, which tells everybody again when the announcement appears or
 * goes away, and arms the next one. The timers are not saved: at startup `armNoticeTimers` arms them
 * again.
 */

import { AppError } from "../utils/AppError.js";
import { broadcastToAll } from "../sockets/index.js";

const STORAGE_UNAVAILABLE = "Storage temporarily unavailable, please try again";

// A setTimeout does not go beyond about 24 days: a farther edge is reached in steps
const MAX_TIMER_DELAY_MS = 12 * 60 * 60 * 1000;

let timer = null;

/**
 * Read the announcement and the maintenance mode from the store into the game state: at startup
 * @param {Object} store - Persistence store
 * @param {Object} gameState - Global game state
 */
export async function loadNotices(store, gameState) {
  gameState.announcement = await store.getAnnouncement();
  gameState.maintenance = await store.getMaintenance();
}

/**
 * The announcement the players see now
 * @param {Object} gameState - Global game state
 * @param {Date} [now] - The moment to look at
 * @returns {Object|null} { version, message, severity, startsAt, endsAt }, or null when there is none
 */
export function visibleAnnouncement(gameState, now = new Date()) {
  const a = gameState.announcement;
  if (!a?.active) {
    return null;
  }
  if (a.startsAt && now < new Date(a.startsAt)) {
    return null;
  }
  if (a.endsAt && now >= new Date(a.endsAt)) {
    return null;
  }
  return { version: a.version, message: a.message, severity: a.severity, startsAt: a.startsAt, endsAt: a.endsAt };
}

/**
 * The maintenance mode, when it is on
 * @param {Object} gameState - Global game state
 * @returns {Object|null} { active: true, message, endsAt }, or null when it is off
 */
export function visibleMaintenance(gameState) {
  const m = gameState.maintenance;
  return m?.active ? { active: true, message: m.message, endsAt: m.endsAt } : null;
}

/**
 * What anybody can read, with no account
 * @param {Object} gameState - Global game state
 * @param {Date} [now] - The moment to look at
 * @returns {Object} { maintenance, announcement }
 */
export function statusView(gameState, now = new Date()) {
  return { maintenance: visibleMaintenance(gameState), announcement: visibleAnnouncement(gameState, now) };
}

/**
 * Whether the game is in maintenance
 * @param {Object} gameState - Global game state
 * @returns {boolean} True when the maintenance mode is on
 */
export const isMaintenance = (gameState) => Boolean(gameState.maintenance?.active);

/**
 * Refuse what is new while the game is in maintenance. An admin is never refused.
 * @param {Object} gameState - Global game state
 * @param {string|null} [role] - The role of whoever asks, null for a visitor without a session
 * @throws {AppError} 503 with the code MAINTENANCE and, if the end is known, retryAfter (seconds)
 */
export function assertNotInMaintenance(gameState, role = null) {
  if (!isMaintenance(gameState) || role === "admin") {
    return;
  }
  const error = Object.assign(new AppError("The game is in maintenance", 503), { code: "MAINTENANCE" });
  const { endsAt } = gameState.maintenance;
  if (endsAt) {
    const seconds = Math.ceil((new Date(endsAt) - Date.now()) / 1000);
    if (seconds >= 1) {
      error.retryAfter = seconds;
    }
  }
  throw error;
}

// What goes wrong in the store is a failure to tell, not a mistake of the caller; a TypeError (no
// actor) is a mistake in the code and must not be hidden
function storageError(err, what) {
  if (err instanceof TypeError) {
    return err;
  }
  console.error(`❌ Could not ${what}: ${err.message}`);
  return new AppError(STORAGE_UNAVAILABLE, 503);
}

const tellAnnouncement = (gameState, io) => broadcastToAll(io, "avviso", { announcement: visibleAnnouncement(gameState) });

/**
 * Publish an announcement: it replaces the previous one
 * @param {Object} store - Persistence store
 * @param {Object} gameState - Global game state
 * @param {Object} io - Socket.IO server
 * @param {Object} input - { message, severity, startsAt, endsAt }
 * @param {Object} actor - Who publishes: { type, id }
 * @returns {Promise<Object>} The announcement, as the store has it
 * @throws {AppError} 503 if the store cannot write
 */
export async function publishAnnouncement(store, gameState, io, input, actor) {
  let announcement;
  try {
    announcement = await store.publishAnnouncement(input, { actor });
  } catch (err) {
    throw storageError(err, "publish the announcement");
  }
  gameState.announcement = announcement;
  tellAnnouncement(gameState, io);
  armNoticeTimers(gameState, io);
  return announcement;
}

/**
 * Withdraw the announcement
 * @param {Object} store - Persistence store
 * @param {Object} gameState - Global game state
 * @param {Object} io - Socket.IO server
 * @param {Object} actor - Who withdraws: { type, id }
 * @returns {Promise<Object>} The announcement, as the store has it
 * @throws {AppError} 503 if the store cannot write
 */
export async function withdrawAnnouncement(store, gameState, io, actor) {
  let announcement;
  try {
    announcement = await store.withdrawAnnouncement({ actor });
  } catch (err) {
    throw storageError(err, "withdraw the announcement");
  }
  gameState.announcement = announcement;
  tellAnnouncement(gameState, io);
  armNoticeTimers(gameState, io);
  return announcement;
}

/**
 * Turn the maintenance mode on or off. Nobody is told when nothing changes.
 * @param {Object} store - Persistence store
 * @param {Object} gameState - Global game state
 * @param {Object} io - Socket.IO server
 * @param {Object} input - { active, message, endsAt }
 * @param {Object} actor - Who changes it: { type, id }
 * @returns {Promise<Object>} { maintenance, changed }
 * @throws {AppError} 503 if the store cannot write
 */
export async function setMaintenance(store, gameState, io, input, actor) {
  let result;
  try {
    result = await store.setMaintenance(input, { actor });
  } catch (err) {
    throw storageError(err, "change the maintenance mode");
  }
  if (result.changed) {
    gameState.maintenance = result.maintenance;
    broadcastToAll(io, "manutenzione", { maintenance: visibleMaintenance(gameState) });
  }
  return result;
}

/**
 * Stop the timer of the announcement (tests, and the replacement of a timer by another)
 */
export function stopNoticeTimers() {
  clearTimeout(timer);
  timer = null;
}

/**
 * Arm the timer at the next edge of the window of the active announcement: when it fires and the edge
 * has been reached it tells everybody again, then the next edge is armed. One timer at a time; it does
 * not keep the process alive.
 * @param {Object} gameState - Global game state
 * @param {Object} io - Socket.IO server
 */
export function armNoticeTimers(gameState, io) {
  stopNoticeTimers();
  const a = gameState.announcement;
  if (!a?.active) {
    return;
  }
  const now = Date.now();
  const edges = [a.startsAt, a.endsAt].filter(Boolean).map((iso) => new Date(iso).getTime()).filter((t) => t > now);
  if (edges.length === 0) {
    return;
  }
  const next = Math.min(...edges);
  timer = setTimeout(() => {
    timer = null;
    if (Date.now() >= next) {
      tellAnnouncement(gameState, io);
    }
    armNoticeTimers(gameState, io);
  }, Math.min(next - now, MAX_TIMER_DELAY_MS));
  timer.unref?.();
}
