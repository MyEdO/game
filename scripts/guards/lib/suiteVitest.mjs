// Ce que la SUITE Vitest joue : les fichiers de test des racines de `test.include`
// (`racinesDeLaSuite.mjs`, que `vite.config.ts` consomme).
import { readCorpus } from './sourceCorpus.mjs'
import { estSuiteVitest } from './fichierVitest.mjs'
import { RACINES_DE_LA_SUITE } from './racinesDeLaSuite.mjs'

/** Les fichiers de TEST des racines de la suite, lus aux extensions de leur motif, avec leur chemin
 *  POSIX depuis la racine du dépôt. Une racine qui DISPARAÎT fait LEVER `readCorpus` (refus du vide,
 *  par base) : l'appelant rougit en la nommant, au lieu de lire un périmètre amputé en silence.
 *  @returns {{ abs: string, rel: string, text: string }[]} */
export function fichiersDeLaSuite() {
  return RACINES_DE_LA_SUITE.flatMap(({ dir, exts }) =>
    readCorpus([dir], { exts: [...exts], tests: true }).filter(({ rel }) => estSuiteVitest(rel)),
  )
}
