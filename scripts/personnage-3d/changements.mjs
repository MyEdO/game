// Ce qui a changé pour la chaîne 3D (#3412, lot 4C), imprimé en JSON pour `scripts/personnage-3d/entrees.py` :
// `{ racines, base, chemins }`. `racines`, ce que lit la gate `personnage-3d:tests` (`ECRIT_LU`, scripts/gates/toutes.mjs) ;
// `base`, la base du diff de `classerPush` (`baseDuDiff`, scripts/gates/classerPush.mjs), `merge-base origin/main HEAD`
// hors de son contexte de push ; `chemins`, les chemins suivis changés de cette base à l'arbre de travail et les
// non-suivis non ignorés. Sans base, `base` et `chemins` valent `null` et `motif` dit pourquoi : l'appelant reconstruit
// tout.
//   node scripts/personnage-3d/changements.mjs
import { stdout } from 'node:process'
import { baseDuDiff } from '../gates/classerPush.mjs'
import { ECRIT_LU } from '../gates/toutes.mjs'
import { SUIVI, TRAVAIL, ceQuiChange, depotDe, listerImage } from '../guards/lib/gitPorte.mjs'

/** Les chemins suivis changés de `base` à l'arbre de travail, et les non-suivis non ignorés, triés. */
export function cheminsChanges(base) {
  const depot = depotDe(process.cwd())
  const suivis = new Set(listerImage(depot, SUIVI))
  const nonSuivis = listerImage(depot, TRAVAIL).filter((chemin) => !suivis.has(chemin))
  return [...new Set([...ceQuiChange(depot, base, SUIVI).chemins(), ...nonSuivis])].sort()
}

if (import.meta.main) {
  const racines = ECRIT_LU['personnage-3d:tests'].lit
  const socle = baseDuDiff({ sha: 'HEAD' })
  stdout.write(JSON.stringify(socle.base === null
    ? { racines, base: null, chemins: null, motif: socle.motif }
    : { racines, base: socle.base, chemins: cheminsChanges(socle.base) }))
}
