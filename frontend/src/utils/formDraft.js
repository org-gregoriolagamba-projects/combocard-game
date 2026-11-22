/**
 * Draft of the login and registration form
 *
 * Reading the privacy notice or the terms from the registration form leaves the page, and the form
 * with it: without this, "Indietro" would bring the player back to an empty login. The form puts
 * what was typed here just before it opens a text, and takes it back when it comes back.
 * It lives only in memory (a reload forgets it) and is cleared by a login or a registration that
 * went through.
 */

const EMPTY = { isRegistering: false, username: "", password: "", accepted: false };

let draft = { ...EMPTY };

/** What was typed before a text was opened, or the empty form */
export const readDraft = () => ({ ...draft });

/** Keep what was typed (mode, username, password, box) */
export const saveDraft = (values) => {
  draft = { ...EMPTY, ...values };
};

/** Forget it */
export const clearDraft = () => {
  draft = { ...EMPTY };
};
