// Reconnaître un APPEL de runner dans une commande shell — segmentation et motifs de
// `scripts/hooks/codeur-gates-guard.mjs` (« ce segment lance-t-il un runner, ou ne fait-il que le
// MENTIONNER ? »), qui refuse à un `codeur` les gates du train.
// Le contrat que chaque motif porte : le segment doit COMMENCER par l'exécutable (éventuellement
// `npx `/`node ` et son chemin), et les lecteurs de texte (grep, cat…) sont écartés d'emblée — une
// recherche de texte n'est pas un appel.

/** Lecteurs de texte : un segment qui commence par l'un d'eux MENTIONNE, il n'appelle pas. */
export const LECTEURS = /^(?:grep|rg|cat|echo|type|findstr|Select-String|sed|awk|head|tail)\b/i
/** Appel d'un exécutable local `outil`, sous ses graphies (`npx`, `node`, chemin, `.cmd`, `.js`, `.mjs`). */
export const appelDe = (outil) =>
  new RegExp(`^(?:npx\\s+|node\\s+)?(?:\\S*[\\\\/])?${outil}(?:\\.cmd|\\.js|\\.mjs)?(?=\\s|$)`)
const APPEL_TSC = appelDe('tsc')
export const APPEL_VITEST = appelDe('vitest')
/** Modes où la capture en fichier n'a pas de sens : run interactif, sortie non composée d'un bilan. */
const DRAPEAUX_HORS_CAPTURE = /(?:^|\s)(?:--watch|-w|--ui|--version)(?=\s|$)/
/** Sous-commandes de vitest qui ne lancent pas la suite. */
const SOUS_COMMANDES_HORS_CAPTURE = new Set(['list', 'bench'])

/**
 * Découpe une commande en SEGMENTS indépendants. C'est le segment, jamais la commande entière, qui
 * porte la portée d'un marqueur : `npm test && npx vitest run src/ui` a un appel nu au second.
 * Les parenthèses de SOUS-SHELL sont des séparateurs au même titre : `(npm run lint)` exécute la
 * liste qu'elles délimitent, et un appel n'a pas à disparaître pour avoir été groupé.
 * @param {string} commande
 * @returns {string[]}
 */
const segmenter = (commande) => commande.split(/[|&;\n()]+/).map((segment) => segment.trim())

// Le sous-projet `server/` a son propre tsconfig : le typecheck racine n'y répond pas. Les deux
// façons d'y entrer n'ont PAS la même portée, et c'est le SEGMENT qui la porte :
//   `cd server` change le répertoire du shell — tout ce qui SUIT est dans le sous-projet (reporté) ;
//   `--prefix server` ne vaut que pour l'appel npm qui le porte — le segment suivant est à la RACINE.
// Évaluer ces marqueurs sur la commande ENTIÈRE masquait un vrai appel :
// `npm --prefix server run typecheck && tsc --noEmit` taisait le `tsc` RACINE du second segment.
const VERS_SERVER = /^cd\s+(\S+)/
const EST_SERVER = /(?:^|[\\/])server[\\/]?$/
const PREFIX_SERVER = /--prefix\s+server\b/
// Portes du dépôt : un segment qui les emprunte DÉJÀ n'est pas un appel nu. Test par SEGMENT là
// encore — `npm test && npx vitest run src/ui` n'émettait rien sur la commande entière.
const PORTE_TYPECHECK = /typecheck:fast|typecheck-fast\.mjs/
const PORTE_VITEST = /\bnpm\s+(?:run\s+)?test\b|scripts[\\/]test[\\/]run\.mjs/

/**
 * Segments de tête qui s'exécutent à la RACINE du dépôt, le sous-projet `server/` retiré (les
 * segments `cd …` eux-mêmes ne sont pas rendus : ils n'exécutent aucun runner). Unique autorité de
 * PORTÉE du dépôt : `server/` a son propre tsconfig et ses propres scripts, le train de la racine
 * n'y répond pas.
 * @param {string} commande
 * @returns {string[]}
 */
export function segmentsHorsServer(commande) {
  const racine = []
  let dansServer = false
  for (const segment of segmenter(commande)) {
    const cd = segment.match(VERS_SERVER)
    if (cd) {
      dansServer = EST_SERVER.test(cd[1])
      continue
    }
    if (dansServer || PREFIX_SERVER.test(segment)) continue
    racine.push(segment)
  }
  return racine
}

/**
 * `true` si la commande lance un `tsc --noEmit` NU à la RACINE (hors porte incrémentale, hors
 * sous-projet `server/`).
 * @param {string} commande
 * @returns {boolean}
 */
export function appelleTscNu(commande) {
  return segmentsHorsServer(commande).some(
    (segment) =>
      !LECTEURS.test(segment) &&
      !PORTE_TYPECHECK.test(segment) &&
      APPEL_TSC.test(segment) &&
      /--noEmit\b/.test(segment),
  )
}

/**
 * `true` si la commande lance `vitest` en direct (hors porte `npm test`, hors modes sans capture).
 * @param {string} commande
 * @returns {boolean}
 */
export function appelleVitestNu(commande) {
  return segmenter(commande).some((segment) => {
    if (LECTEURS.test(segment) || PORTE_VITEST.test(segment)) return false
    if (!APPEL_VITEST.test(segment)) return false
    if (DRAPEAUX_HORS_CAPTURE.test(segment)) return false
    const premier = segment.replace(APPEL_VITEST, '').trim().split(/\s+/)[0] ?? ''
    return !SOUS_COMMANDES_HORS_CAPTURE.has(premier)
  })
}
