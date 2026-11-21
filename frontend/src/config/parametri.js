/**
 * The game settings, as the admin reads them
 *
 * The six parameters the admin can change (the server keeps their values and their limits): the label
 * of each one, its unit and a sentence that says what it does. The admin screen, the audit log and the
 * translation of the errors of the server use the same words.
 */

export const PARAMETRI = [
  {
    chiave: "minPlayers",
    etichetta: "Giocatori minimi per avviare",
    unita: "giocatori",
    spiegazione: "Con meno giocatori di così il creatore non può avviare la partita.",
  },
  {
    chiave: "maxPlayers",
    etichetta: "Giocatori massimi",
    unita: "giocatori",
    spiegazione: "Quanti giocatori può avere al massimo una partita.",
  },
  {
    chiave: "requiredCredits",
    etichetta: "Quota d'ingresso predefinita",
    unita: "crediti",
    spiegazione: "La quota di una partita quando chi la crea non ne sceglie una.",
  },
  {
    chiave: "jollyHoldSeconds",
    etichetta: "Pausa del Jolly",
    unita: "secondi",
    spiegazione: "Il tempo che ha un giocatore per scegliere la carta del Jolly mentre le estrazioni sono ferme.",
  },
  {
    chiave: "jollyMaxDeclarations",
    etichetta: "Dichiarazioni del Jolly per partita",
    unita: "dichiarazioni",
    spiegazione: "Quante volte un giocatore può dichiarare il Jolly in una partita.",
  },
  {
    chiave: "drawCooldownSeconds",
    etichetta: "Attesa tra le estrazioni",
    unita: "secondi",
    spiegazione: "Quanti secondi devono passare tra una carta estratta e la successiva.",
  },
];

/**
 * The label of a setting
 * @param {string} chiave - Key of the setting
 * @returns {string} The label, or the key itself when it is not known
 */
export const etichettaParametro = (chiave) => PARAMETRI.find((p) => p.chiave === chiave)?.etichetta ?? chiave;

/**
 * A change of a setting, as a phrase
 * @param {string} chiave - Key of the setting
 * @param {number} da - The value before
 * @param {number} a - The value after
 * @returns {string} For example "Attesa tra le estrazioni da 8 a 12 secondi"
 */
export function fraseCambio(chiave, da, a) {
  const parametro = PARAMETRI.find((p) => p.chiave === chiave);
  return parametro
    ? `${parametro.etichetta} da ${da} a ${a} ${parametro.unita}`
    : `${chiave} da ${da} a ${a}`;
}
