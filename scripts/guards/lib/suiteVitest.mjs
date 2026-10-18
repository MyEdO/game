// Ce que la SUITE Vitest joue (#2651) — définition UNIQUE : les shards de la CI (`scripts/test/run.mjs`), le
// périmètre (`scripts/test/perimetreDerivation.mjs`) et les gardes qui scannent les suites la consomment. Le prédicat
// est `estDeLaSuiteVitest` (`racinesDeLaSuite.mjs`, d'où `vite.config.ts` tire `test.include`) : le glob et la liste
// coïncident par construction. La LISTE vient de git (`TRAVAIL`) : ce que la CI joue, c'est l'arbre du commit, jamais
// un fichier ignoré.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RACINES_DE_LA_SUITE, estDeLaSuiteVitest } from './racinesDeLaSuite.mjs'
import { TRAVAIL, depotDe, listerImage } from './gitPorte.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Les suites Vitest de l'arbre de travail du dépôt de `racine` (`listerImage`, `TRAVAIL` : suivis et non suivis, hors
 *  ignorés et supprimés), chemins POSIX relatifs, triés ; git lancé sous `env`. Une lecture git en échec LÈVE ; une
 *  suite VIDE lève aussi : jouer zéro test serait le pire des verts. */
export function suiteVitestDuDepot(racine = RACINE, { env } = {}) {
  const suite = listerImage(depotDe(racine, { env }), TRAVAIL).filter(estDeLaSuiteVitest).sort()
  if (!suite.length) throw new Error(`suiteVitest : aucune suite Vitest sous ${racine} (racines ${RACINES_DE_LA_SUITE.map((r) => r.motif).join(', ')})`)
  return suite
}

/** Les suites Vitest du dépôt de `racine` (`suiteVitestDuDepot`, git sous `env`), avec leur chemin absolu et leur texte.
 *  @returns {{ abs: string, rel: string, text: string }[]} */
export function fichiersDeLaSuite(racine = RACINE, { env } = {}) {
  return suiteVitestDuDepot(racine, { env }).map((rel) => {
    const abs = join(racine, rel)
    return { abs, rel, text: readFileSync(abs, 'utf8') }
  })
}
