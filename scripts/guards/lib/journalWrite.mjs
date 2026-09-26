// Mécanique de scan du garde-fou « composition du journal » (#319). Le motif
// `….journal.slice(-40)` (n'importe quel receveur : `state.journal`, `get().journal`, `s.journal`…)
// réinvente l'action canonique `log` (`src/state/store.ts`, ~L2146 : `set((s) => ({ journal:
// [...s.journal.slice(-40), ...] }))`). Module ESM pur, exécutable par `node` nu — consommé par
// `src/state/journal-write-guard.test.ts` ET par un futur hook pre-commit. Même patron que
// `inBattleFind.mjs` (mécanique de détection ici, BASELINES en policy dans le test).

/** Retire commentaires ET imports nommés — mêmes règles que `hardcode.mjs`.
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]*['"];?/g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/**
 * Motif d'écriture RAW du journal : `.journal.slice(-40)` — cette forme n'existe QUE pour composer
 * une nouvelle valeur de `journal` (plafond 40 lignes) ; une simple LECTURE de `journal` (`get().journal`
 * seul, sans `.slice(-40)`) reste légitime et n'est pas ce motif. Distinct de `journal: [...]` littéral
 * (canal `CascadeApplier`, cliquet `cascade-consequence-guard.test.ts`).
 * @type {RegExp}
 */
export const JOURNAL_WRITE_RX = /\.journal\.slice\(-40\)/;

/**
 * Scan complet d'un fichier source : chaque ligne portant le motif (hors commentaires/imports).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanJournalWrite(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (JOURNAL_WRITE_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanJournalWrite(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countJournalWrite(relPath, contenu) {
  return scanJournalWrite(relPath, contenu).length;
}
