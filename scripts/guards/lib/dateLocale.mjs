// Date LOCALE du jour, lue par la porte du commit (`scripts/git-hooks/commit-msg.mjs`).

/** Date LOCALE `AAAA-MM-JJ` (pas UTC) : un solde écrit après minuit heure locale porte la date locale.
 *  @param {Date} d @returns {string} */
export const dateLocale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
