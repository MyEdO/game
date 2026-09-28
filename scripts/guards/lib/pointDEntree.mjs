/**
 * Détection écrite À LA MAIN du point d'entrée d'un module (« ce module est-il le script lancé ? »).
 * La réponse unique est celle de la plateforme, `import.meta.main` (Node >= 22.18, `package.json`
 * `engines`) : elle ne compare aucun chemin, et répond donc pareil pour un `argv[1]` relatif, un lien
 * symbolique, la casse d'une lettre de lecteur ou un `.mts` lancé par tsx.
 *
 * La lecture porte sur l'AST (`globalesNode.mjs`, qui définit les valeurs, les formes lues et ce qui
 * est HORS DE PORTÉE) : un commentaire ou une chaîne n'est pas du code. Est une détection :
 *   1. toute LECTURE de l'élément 1 d'`argv`, quel que soit l'usage (comparaison, message,
 *      transmission) : `[1]`, `.at(1)`, `.slice(1[, n])` suivi de `[0]`/`.at(0)`/`.shift()`, une
 *      déstructuration de tableau dont l'élément d'indice 1, hors reste, est lié (`[, x] = argv`,
 *      `[x] = argv.slice(1)`, `{ argv: [, x] } = process`), en déclaration comme en affectation ;
 *      `argv` y est lu sur `process`, `globalThis.process`, `global.process`, `require('node:process')`,
 *      un import de `node:process` (défaut, espace de noms, nommé `argv` avec ou sans alias), et tout
 *      NOM lié à l'une de ces expressions ou à une tranche d'`argv` ;
 *   2. `require.main`, `process.mainModule`, `module.parent` ;
 *   3. l'identité du module (`import.meta.url`, `import.meta.filename`, `__filename`) dans un opérande
 *      d'une égalité (`===`, `!==`, `==`, `!=`, `Object.is(`) ou dans un argument de `argv.includes(`,
 *      `argv.indexOf(`, `argv.lastIndexOf(`, sans franchir d'instruction ni de fonction ;
 *   4. `import.meta.main` lié à un nom (déclaration, affectation, déstructuration) : un seul terme, lu
 *      là où il décide (`if (import.meta.main)`).
 * N'en sont PAS : `process.argv.slice(2)` et ses déstructurations, `[, , x] = process.argv`,
 * `argv.includes('--write')`, `import.meta.url.startsWith('file:')`, un `basename(import.meta.filename)`
 * dans un message, `if (import.meta.main)`, `module.exports`, `module.paths`.
 * HORS DE PORTÉE, en plus de celui de `globalesNode.mjs` : le code d'un processus enfant écrit dans
 * une chaîne (`node -e`, `data:text/javascript`, fichier écrit puis lancé) ; `.slice(1, 2).pop()`,
 * `.slice(1, 2).at(-1)` ; un parcours d'`argv` par rappel (`some`, `find`, `findIndex`) ou par
 * `for…of`, `argv.join(…)`, `String(argv)` : chacun lit TOUS les éléments, et seul le prédicat dit s'il
 * cherche le script lancé ou balaie des drapeaux ; `import.meta.main` placé dans une propriété d'objet
 * ou rendu par `export default` : la décision se prend chez le lecteur de l'objet ou de l'export.
 */
import ts from 'typescript'
import { methodeAppelee, sitesDeGlobalesNode } from './globalesNode.mjs'

/**
 * Termes sans lesquels aucune règle ne conclut (préfiltre de `globalesNode.mjs`) : `main` n'est lu
 * que sur une valeur `require` (issue de `require`, `module.require` ou `createRequire`), `parent`
 * que sur `module`.
 */
const TERMES = [/argv|mainModule|\bmeta\b|__filename/, [/\bmain\b/, /require/i], [/\bparent\b/, /\bmodule\b/]]

const EGALITES = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
])
const MODULE_PRINCIPAL = ['require.main', 'process.mainModule', 'module.parent']
const RECHERCHES_DANS_ARGV = new Set(['includes', 'indexOf', 'lastIndexOf'])

/** L'identité du module est-elle opérande d'une égalité (`Object.is` compris), ou argument d'une
 *  recherche dans `argv` (`RECHERCHES_DANS_ARGV`) ? */
function identiteComparee(noeud, valeursDe) {
  for (let enfant = noeud, p = noeud.parent; p && !ts.isSourceFile(p) && !ts.isStatement(p) && !ts.isFunctionLike(p); enfant = p, p = p.parent) {
    if (ts.isBinaryExpression(p) && EGALITES.has(p.operatorToken.kind)) return true
    const appel = ts.isCallExpression(p) && p.arguments.includes(enfant) ? methodeAppelee(p) : null
    if (appel?.methode === 'is' && ts.isIdentifier(appel.objet) && appel.objet.text === 'Object') return true
    if (appel && RECHERCHES_DANS_ARGV.has(appel.methode)) {
      if ([...valeursDe(appel.objet)].some((v) => v.startsWith('argv:'))) return true
    }
  }
  return false
}

/**
 * Détections du point d'entrée écrites à la main dans une source.
 * @param {string} source texte du fichier
 * @param {string} [chemin] nom du fichier, qui fixe le dialecte de parse
 * @returns {{ ligne: number, extrait: string }[]} `ligne` 1-based, valable pour la source d'origine
 */
export function detectionsDePointDEntree(source, chemin = 'source.ts') {
  return sitesDeGlobalesNode(source, chemin, {
    termes: TERMES,
    retenir: ({ noeud, sorte, valeurs, valeursDe }) => {
      if (sorte !== 'nom' && valeurs.has('element:1')) return true
      if (sorte !== 'nom' && MODULE_PRINCIPAL.some((v) => valeurs.has(v))) return true
      if (sorte !== 'expression' && valeurs.has('import.meta.main')) return true
      return sorte === 'expression' && valeurs.has('identite') && identiteComparee(noeud, valeursDe)
    },
  })
}
