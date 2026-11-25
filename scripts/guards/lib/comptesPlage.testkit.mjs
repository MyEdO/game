// Kit des bancs de la PORTE DES COMPTES (#2705, `jugerLesComptes`, scripts/guards/lib/corpusDesComptes.mts) : le banc des
// dépôts jetables (scripts/guards/comptes-plage.test.mjs) et celui de la copie du dépôt réel
// (scripts/corpus-isole/guards/comptes-plage-depot-reel.test.mjs).
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { envDeDepotForge } from './depotGabarit.mjs'

/** Racine du dépôt qui porte la mesure. */
export const RACINE = fileURLToPath(new URL('../../../', import.meta.url))

/** Le lancement du processus `tsx` qui rend, en JSON sur sa sortie, les verdicts de `jugerLesComptes` sur chaque
 *  `[base, tete]` du dépôt `racine` (la mesure d'un commit s'y mémoïse), sous l'env d'un dépôt forgé. Les verdicts sont
 *  sa sortie ENTIÈRE : la génération et la mesure d'une image tournent dans des processus enfants à sortie capturée. */
export function lancementDuJugement(racine, plages) {
  const module = (rel) => JSON.stringify(pathToFileURL(join(RACINE, rel)).href)
  const code = [
    `import { depotDe } from ${module('scripts/guards/lib/gitPorte.mjs')};`,
    `import { jugerLesComptes } from ${module('scripts/guards/lib/corpusDesComptes.mts')};`,
    'const [racine, plages] = JSON.parse(process.argv[1]);',
    'const depot = depotDe(racine);',
    'const verdicts = plages.map(([base, tete, message]) => jugerLesComptes({ depot, base, tete, message }));',
    'process.stdout.write(JSON.stringify(verdicts));',
  ].join('\n')
  return {
    argv: [join(RACINE, 'node_modules/tsx/dist/cli.mjs'), '--input-type=module', '-e', code, '--', JSON.stringify([racine, plages])],
    cwd: RACINE, env: envDeDepotForge(), maxBuffer: 1 << 26,
  }
}
