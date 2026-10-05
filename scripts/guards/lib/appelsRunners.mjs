// Reconnaître un APPEL de runner dans un segment exécuté — motifs de `scripts/hooks/codeur-gates-guard.mjs`
// (« ce segment lance-t-il un runner, ou ne fait-il que le MENTIONNER ? »), qui refuse à un `codeur` les gates
// du train sur les segments profonds du socle (`pipelinesDeJetons`).
// Le contrat que chaque motif porte : le segment doit COMMENCER par l'exécutable (éventuellement
// `npx `/`node ` et son chemin), et les lecteurs de texte (grep, cat…) sont écartés d'emblée — une
// recherche de texte n'est pas un appel.

/** Lecteurs de texte : un segment qui commence par l'un d'eux MENTIONNE, il n'appelle pas. */
export const LECTEURS = /^(?:grep|egrep|fgrep|rg|cat|echo|type|findstr|Select-String|sls|Select-Object|sed|awk|head|tail|ls|wc|cut|sort|uniq)(?=\s|$)/i
/** Appel d'un exécutable local `outil`, sous ses graphies (`npx`, `node`, chemin, `.cmd`, `.js`, `.mjs`). */
export const appelDe = (outil) =>
  new RegExp(`^(?:npx\\s+|node\\s+)?(?:\\S*[\\\\/])?${outil}(?:\\.cmd|\\.js|\\.mjs)?(?=\\s|$)`)
const APPEL_TSC = appelDe('tsc')
export const APPEL_VITEST = appelDe('vitest')
/** Modes où la capture en fichier n'a pas de sens : run interactif, sortie non composée d'un bilan. */
const DRAPEAUX_HORS_CAPTURE = /(?:^|\s)(?:--watch|-w|--ui|--version)(?=\s|$)/
/** Sous-commandes de vitest qui ne lancent pas la suite. */
const SOUS_COMMANDES_HORS_CAPTURE = new Set(['list', 'bench'])

// Portes du dépôt : un segment qui les emprunte DÉJÀ n'est pas un appel nu.
const PORTE_TYPECHECK = /typecheck:fast|typecheck-fast\.mjs/
const PORTE_VITEST = /\bnpm\s+(?:run\s+)?test\b|scripts[\\/]test[\\/]run\.mjs/

/**
 * `true` si le segment lance un `tsc --noEmit` NU (hors porte incrémentale).
 * @param {string} segment
 * @returns {boolean}
 */
export function appelleTscNu(segment) {
  return !LECTEURS.test(segment) && !PORTE_TYPECHECK.test(segment) && APPEL_TSC.test(segment) && /--noEmit\b/.test(segment)
}

/**
 * `true` si le segment lance `vitest` en direct (hors porte `npm test`, hors modes sans capture).
 * @param {string} segment
 * @returns {boolean}
 */
export function appelleVitestNu(segment) {
  if (LECTEURS.test(segment) || PORTE_VITEST.test(segment)) return false
  if (!APPEL_VITEST.test(segment) || DRAPEAUX_HORS_CAPTURE.test(segment)) return false
  const premier = segment.replace(APPEL_VITEST, '').trim().split(/\s+/)[0] ?? ''
  return !SOUS_COMMANDES_HORS_CAPTURE.has(premier)
}
