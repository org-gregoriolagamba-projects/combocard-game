/**
 * Legal texts: the version and the values that go into the privacy notice and the terms of use
 *
 * The only place to change them. The version is the one of the terms the player accepts: the
 * server has the same value (`backend/src/config/legale.js`) and refuses an acceptance of another
 * version; the script that checks the documentation fails if the two differ. When the texts change
 * in an important way, the version changes and everybody accepts again.
 *
 * A value that is `null` is shown as "[da indicare]" in the texts. The values that depend on the
 * publication (what Cloudflare and Neon keep, the date) and the contact e-mail (`contatti.js`) must be
 * set before the site is published: `check-docs.mjs --release` stops a release that still has them.
 */

export const LEGALE = {
  versione: "2026-1",
  titolare: "Gregorio La Gamba",
  etaMinima: 14,
  // Where the player writes about the data (the general contact of the app is in contatti.js)
  emailPrivacy: "privacy@combocard.it",
  // Who treats the data for us. `fuoriSee`: the company is outside the European Economic Area, so the
  // notice says what the transfer rests on and links the document of the provider (`documento`).
  // Resend (the e-mails of the password recovery) is added when the app starts to use it (#44).
  fornitori: [
    {
      nome: "Render",
      societa: "Render Services, Inc.",
      paese: "Stati Uniti",
      ruolo: "hosting dell'applicazione e dei log del server",
      dove: "server a Francoforte (Germania)",
      fuoriSee: true,
      documento: "https://render.com/dpa",
    },
    {
      nome: "Neon",
      societa: "Neon, parte di Databricks, Inc.",
      paese: "Stati Uniti",
      ruolo: "database",
      dove: "server AWS a Francoforte (Germania)",
      fuoriSee: true,
      documento: "https://neon.com/platform-terms",
    },
    {
      nome: "Cloudflare",
      societa: "Cloudflare, Inc.",
      paese: "Stati Uniti",
      ruolo: "DNS, HTTPS e cache",
      dove: "rete globale",
      fuoriSee: true,
      documento: "https://www.cloudflare.com/cloudflare-customer-dpa/",
    },
    {
      nome: "OVHcloud",
      societa: "OVHcloud",
      paese: "Francia",
      ruolo: "dominio e casella di posta",
      // Empty, not null: `null` means "still to be decided" for the release check
      dove: "",
      fuoriSee: false,
      documento: "",
    },
  ],
  // How long each provider keeps what we cannot delete ourselves
  conservazioneLog: "7 giorni",
  // What Cloudflare keeps about the traffic: depends on what is switched on in our account
  conservazioneCloudflare: null,
  // How long Neon keeps the history of the database for the restore: depends on the plan
  conservazioneBackup: null,
  // The day the texts came into force, for example "1 dicembre 2026": set when the site is published
  vigenteDal: null,
};
