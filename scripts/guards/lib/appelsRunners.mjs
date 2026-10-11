// Reconnaître un APPEL de runner dans un segment exécuté — motifs de `scripts/hooks/codeur-gates-guard.mjs`
// (« ce segment lance-t-il un runner, ou ne fait-il que le MENTIONNER ? »), qui refuse à tout appelant les gates
// du train sur les segments profonds du socle (`pipelinesDeJetons`).
// Le contrat que chaque motif porte : le segment doit COMMENCER par l'exécutable (éventuellement
// `npx `/`node ` et son chemin), et les lecteurs de texte (grep, cat…) sont écartés d'emblée — une
// recherche de texte n'est pas un appel.

/** Lecteurs de texte, POSIX et PowerShell (`Get-Content`/`gc`, `Select-String`/`sls`, `Test-Path`, `Get-Item`/`gi`) :
 *  un segment qui commence par l'un d'eux MENTIONNE, il n'appelle pas. */
export const LECTEURS = /^(?:grep|egrep|fgrep|rg|cat|echo|type|findstr|Select-String|sls|Select-Object|Get-Content|gc|Test-Path|Get-Item|gi|sed|awk|head|tail|ls|wc|cut|sort|uniq)(?=\s|$)/i
/** Appel d'un exécutable local `outil`, sous ses graphies (`npx`, `npm exec`/`npm x` et leurs drapeaux, `node`, chemin,
 *  `.cmd`, `.js`, `.mjs`), suivi de la sous-commande `sousCommande` quand elle est donnée. */
export const appelDe = (outil, sousCommande) =>
  new RegExp(`^(?:npx\\s+|npm\\s+(?:exec|x)\\s+(?:-\\S+\\s+)*|node\\s+)?(?:\\S*[\\\\/])?${outil}(?:\\.cmd|\\.js|\\.mjs)?` +
    `${sousCommande ? `\\s+${sousCommande}` : ''}(?=\\s|$)`)
const APPEL_TSC = appelDe('tsc')
export const APPEL_VITEST = appelDe('vitest')
/** Drapeaux d'INFORMATION : l'outil rend sa version ou son aide, il ne lance rien. */
const DRAPEAUX_D_INFORMATION = ['--version', '-v', '--help', '-h']
/** `true` si le segment porte l'un des `drapeaux`, en mot entier. PURE. */
const porteUnDrapeau = (segment, drapeaux) => segment.split(/\s+/).some((mot) => drapeaux.includes(mot))
/** Modes où la capture en fichier n'a pas de sens : run interactif, sortie non composée d'un bilan. */
const DRAPEAUX_HORS_CAPTURE = ['--watch', '-w', '--ui', ...DRAPEAUX_D_INFORMATION]
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
  if (!APPEL_VITEST.test(segment) || porteUnDrapeau(segment, DRAPEAUX_HORS_CAPTURE)) return false
  const premier = segment.replace(APPEL_VITEST, '').trim().split(/\s+/)[0] ?? ''
  return !SOUS_COMMANDES_HORS_CAPTURE.has(premier)
}

export const APPEL_ESLINT = appelDe('eslint')
const APPEL_OXLINT = appelDe('oxlint')
const APPEL_PLAYWRIGHT = appelDe('playwright', 'test')
/** Drapeaux de node à valeur SÉPARÉE (`node --help`) : leur valeur n'est pas le script. */
const DRAPEAUX_NODE_A_VALEUR = ['--import', '--require', '-r', '--loader', '--experimental-loader', '--conditions', '-C',
  '--env-file', '--input-type', '--test-reporter', '--test-reporter-destination', '--test-name-pattern',
  '--test-skip-pattern', '--test-concurrency', '--test-timeout', '--test-shard']
/** Les drapeaux de node qui précèdent le script ou `--test`, valeur séparée comprise (source de motif). */
export const DRAPEAUX_NODE = `(?:(?:${DRAPEAUX_NODE_A_VALEUR.join('|')})\\s+\\S+\\s+|-\\S+\\s+)*`
/** `node --test`, ou `tsx --test` qui le relaie, drapeaux de node avant `--test` compris. */
const APPEL_NODE_TEST = new RegExp(`^(?:node|tsx)\\s+${DRAPEAUX_NODE}--test(?=[\\s=]|$)`)
/** Les lanceurs du dépôt que `npm run typecheck:fast` et `npm test` résolvent. */
const LANCEUR_DE_RUNNER = /^node\s+(?:\S*[\\/])?scripts[\\/](?:typecheck-fast\.mjs|test[\\/]run\.mjs)(?=\s|$)/
/** `scripts/lancer-local.mjs <paquet> [--cwd <dossier>] -- ` : le lanceur d'un outil de cet arbre, qui joue ce qui suit `--`. */
const LANCEUR_LOCAL = /^node\s+(?:\S*[\\/])?scripts[\\/]lancer-local\.mjs\s+.*?\s--\s+/

/**
 * `true` si le segment lance un runner hors de `npm run` : tsc, vitest, eslint, oxlint, `playwright test`, `node --test`,
 * le lanceur de `typecheck:fast` et de `npm test`, ou l'un d'eux sous `scripts/lancer-local.mjs` ; jamais sous un drapeau
 * d'information (`DRAPEAUX_D_INFORMATION`). Un segment `npm run <x>` se juge sur le nom de son script.
 * @param {string} segment
 * @returns {boolean}
 */
export function appelleUnRunner(segment) {
  if (LECTEURS.test(segment)) return false
  const joue = segment.replace(LANCEUR_LOCAL, '')
  if (porteUnDrapeau(joue, DRAPEAUX_D_INFORMATION)) return false
  return [LANCEUR_DE_RUNNER, APPEL_TSC, APPEL_VITEST, APPEL_ESLINT, APPEL_OXLINT, APPEL_PLAYWRIGHT, APPEL_NODE_TEST].some((motif) => motif.test(joue))
}
