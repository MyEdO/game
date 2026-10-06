// Mécanique de scan du garde-fou « réf de source `{book,page}` réinventée » (#281, F20/V10 du
// programme structurel #276). `z.strictObject({ book: z.string(), page: z.number() })` réinvente
// `sourceRefSchema` (`src/data/schemas/grammaire/valeurs.ts`). Module ESM pur, exécutable par `node`
// nu — consommé par `src/data/source-ref-inline-guard.test.ts`.
// Même patron que `labelLogic.mjs` (fenêtre stripée de commentaires, motif bloquant tolérance ZÉRO).
// Le motif exige la paire `book:`/`page:` DANS CET ORDRE, comme `sourceRefSchema`.

/** Retire les commentaires de bloc et de ligne (pas les chaînes).
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Réinvention inline de `sourceRefSchema` : `book:` suivi (dans la même déclaration) de `page:
 *  z.number()`. Multiline-safe (`s`) — la déclaration de `sourceRefSchema` elle-même s'écrit sur
 *  plusieurs lignes dans `grammaire/valeurs.ts`. @type {RegExp} */
export const SOURCE_REF_INLINE_RX = /book\s*:\s*z\.string\(\)\s*,\s*page\s*:\s*z\.number\(\)/s;

/**
 * Scan complet d'un fichier source : présence du motif (hors commentaires).
 * @param {string} relPath @param {string} contenu
 * @returns {boolean}
 */
export function hasInlineSourceRef(relPath, contenu) {
  return SOURCE_REF_INLINE_RX.test(stripComments(contenu));
}
