/**
 * Announcements and maintenance mode: the limits of the message and the severities
 *
 * The schemas of the admin routes and the tests use these values, and the CHECK of the table
 * `announcement` repeats the severities.
 */

/** The longest message of an announcement or of the maintenance mode */
export const NOTICE_MESSAGE_MAX = 280;

/** How much an announcement stands out */
export const NOTICE_SEVERITIES = ["info", "importante"];
