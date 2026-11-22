/**
 * Legal texts: the version and the values that go into the privacy notice and the terms of use
 *
 * The only place to change them. The version is the one of the terms the player accepts: the
 * server has the same value (`backend/src/config/legale.js`) and refuses an acceptance of another
 * version; the script that checks the documentation fails if the two differ. When the texts change
 * in an important way, the version changes and everybody accepts again.
 *
 * A value that is `null` is shown as "[da indicare]" in the texts. The values that depend on the
 * publication (hosting, retention of the logs, date) and the contact e-mail (`contatti.js`) must be
 * set before the site is published: `check-docs.mjs --release` stops a release that still has them.
 */

export const LEGALE = {
  versione: "2026-1",
  titolare: "Gregorio La Gamba",
  etaMinima: 14,
  hosting: { nome: null, paese: null },
  // How long the server logs are kept, for example "30 giorni"
  conservazioneLog: null,
  // The day the texts came into force, for example "1 dicembre 2026"
  vigenteDal: null,
};
