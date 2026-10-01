// PORTE DE VERSION DE NODE (#1801) : `package.json` `engines.node`, lu ici, confronté au Node qui
// évalue ce module. Non conforme → message sur stderr et sortie `CODE_DE_REFUS`.
//
// Chargée sans condition, par effet d'évaluation — un point d'entrée `import.meta.main` (Node >= 22.18)
// ne se déclare pas « principal » sous un Node plus ancien et sort 0 sans rien faire. Les points
// d'entrée qui rendent un verdict refusent donc avant lui :
//   - `npm run gates` (`scripts/gates/toutes.mjs`), les `.mjs` que lancent les hooks shell du
//     `core.hooksPath` de `postinstall` (un `post-*` sort 0 malgré le refus), les pilotes
//     `merge.<nom>.driver` de `postinstall`, les hooks d'agent de `.claude/settings.json` et
//     `.codex/hooks.json` : la porte est leur premier
//     import, donc la première ÉVALUATION ; leur clôture d'imports STATIQUE, chargée et liée avant
//     toute évaluation, ne porte ni module TypeScript ni attribut d'import — ce qui en a besoin se
//     charge après la porte, par `import()` ;
//   - `npm install`/`npm ci` : `.npmrc` `engine-strict`.
// Preuve : `scripts/node-requis.test.mjs`, pour chaque point d'entrée de cette liste ; les modules Node
// s'y exécutent sous `--no-experimental-strip-types`, le chargement d'un Node 22 < 22.18. Sous un Node
// < 22, seule l'absence d'attribut d'import est tenue : une autre syntaxe inconnue d'un V8 plus ancien
// n'est pas gardée.
// Un script lancé seul (`npm run docs:check`) n'est pas couvert. `.npmrc` `node-options` le
// couvrirait, mais npm y REMPLACE le `NODE_OPTIONS` de l'appelant.
import { readFileSync } from 'node:fs'

/**
 * Code de sortie du refus : 2, le seul qui BLOQUE un hook d'agent `PreToolUse` (tout autre code non
 * nul laisse passer l'outil). Tout autre consommateur refuse sur tout code non nul.
 */
export const CODE_DE_REFUS = 2

const FORME = /^\s*>=\s*v?(\d+)\.(\d+)\.(\d+)\s*$/

/**
 * Message de refus, ou `null` si `version` satisfait `plage`. PUR.
 * Seule la forme `>=M.m.p` se lit : toute autre plage (ou son absence) est un refus qui la nomme.
 * @param {string | undefined} plage valeur de `engines.node`
 * @param {string} version `process.versions.node`
 * @returns {string | null}
 */
export function refusDeVersion(plage, version) {
  const exigee = FORME.exec(plage ?? '')
  if (!exigee) {
    return `[node-requis] package.json engines.node « ${plage} » : seule la forme \`>=M.m.p\` est lue par scripts/node-requis.mjs.`
  }
  const courante = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!courante) return `[node-requis] version de Node illisible : « ${version} ».`
  for (let i = 1; i <= 3; i += 1) {
    const ecart = Number(courante[i]) - Number(exigee[i])
    if (ecart > 0) return null
    if (ecart < 0) {
      return `[node-requis] Node ${version} ne satisfait pas package.json engines.node « ${plage.trim()} » : installe un Node conforme.`
    }
  }
  return null
}

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const refus = refusDeVersion(engines?.node, process.versions.node)
if (refus) {
  console.error(refus)
  process.exit(CODE_DE_REFUS)
}
