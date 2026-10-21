// Ce que la SUITE Vitest joue (#2651) — définition UNIQUE : les shards de la CI (`scripts/test/run.mjs`) et les gardes
// qui scannent les suites la consomment ; le périmètre (`scripts/test/perimetreDerivation.mjs`) en partage le prédicat.
// Le prédicat est `estDeLaSuiteVitest` (`racinesDeLaSuite.mjs`, d'où `vite.config.ts` tire `test.include` et
// `test.exclude`) ; celui de la suite du noyau (`vitest.noyau.config.ts`), `estDeLaSuiteDuNoyau`, se passe en `suite`.
// La LISTE vient de git (`TRAVAIL`) : ce que la CI joue, c'est l'arbre du commit, jamais un fichier
// ignoré — que le glob de Vitest, lui, prend s'il est présent sur le disque.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RACINES_DE_LA_SUITE, estDeLaSuiteVitest } from './racinesDeLaSuite.mjs'
import { TRAVAIL, depotDe, listerImage } from './gitPorte.mjs'
import { entreeDe } from './sourceCorpus.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Les fichiers de l'arbre de travail du dépôt de `racine` (`listerImage`, `TRAVAIL` : suivis et non suivis, hors
 *  ignorés et supprimés) que joue la suite `suite` (prédicat, `estDeLaSuiteVitest` par défaut), chemins POSIX relatifs,
 *  triés ; git lancé sous `env`. Une lecture git en échec LÈVE ; une suite VIDE lève aussi : jouer zéro test serait le
 *  pire des verts. */
export function suiteVitestDuDepot(racine = RACINE, { env, suite: estDeLaSuite = estDeLaSuiteVitest } = {}) {
  const suite = listerImage(depotDe(racine, { env }), TRAVAIL).filter((rel) => estDeLaSuite(rel)).sort()
  if (!suite.length) throw new Error(`suiteVitest : aucune suite Vitest sous ${racine} (${estDeLaSuite === estDeLaSuiteVitest ? `racines ${RACINES_DE_LA_SUITE.map((r) => r.motif).join(', ')}` : 'prédicat `suite` de l’appelant'})`)
  return suite
}

/** Les fichiers de la suite `suite` du dépôt de `racine` (`suiteVitestDuDepot`, git sous `env`), avec leur chemin
 *  absolu et leur texte, lu une fois par worker (`entreeDe`, mémo de `sourceCorpus.mjs`).
 *  @returns {{ abs: string, rel: string, text: string }[]} */
export function fichiersDeLaSuite(racine = RACINE, { env, suite } = {}) {
  return suiteVitestDuDepot(racine, { env, suite }).map((rel) => {
    const abs = join(racine, rel)
    return { abs, rel, text: entreeDe(abs).text }
  })
}
