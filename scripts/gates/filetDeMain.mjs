// LE FILET DE `main` (#5037 L2, verdict de design du ticket, commentaire 7173868815) : une entrée de file dont le push
// a une zone (`zoneDuPush`) n'a joué que la sélection de sa zone (`selectionDeLaZone`, scripts/test/selectionDeZone.mjs) ;
// après sa fusion, `.github/workflows/filet-de-main.yml` rejoue la suite ENTIÈRE sur `main`, et un raté de sélection y
// rougit. Ce script écrit `filet=true|false` : `false` quand aucune entrée du push n'avait de zone, la file ayant alors
// joué toute la suite. FERMÉ PAR DÉFAUT : une histoire illisible ou une erreur écrivent `filet=true`.
import { env, stderr, stdout } from 'node:process'
import { depotDe, grapheDe } from '../guards/lib/gitPorte.mjs'
import { classerPush, shaNul, zoneDuPush } from './classerPush.mjs'
import { ECRIT_LU } from './toutes.mjs'

/**
 * Le FILET d'un push sur `main` de `avant` à `apres`. Chaque entrée de file est un commit de la chaîne des premiers
 * parents de `apres` jusqu'à `avant`, jugé contre son premier parent : la base de son `merge_group`
 * (`merge_method: 'MERGE'`, scripts/ops/ruleset-main.mjs). `filet` dès qu'une entrée a une zone (`zoneDe`), ou que la
 * chaîne n'atteint pas `avant` dans `graphe`. PURE.
 * @param {{ avant: string | undefined, apres: string, graphe: readonly { sha: string, parents: string[] }[],
 *   zoneDe: (entree: { base: string, sha: string }) => string | null }} p
 * @returns {{ filet: boolean, motif: string }}
 */
export function filetDuPush({ avant, apres, graphe, zoneDe }) {
  if (shaNul(avant)) return { filet: true, motif: 'aucun sha avant le push' }
  const parSha = new Map(graphe.map((c) => [c.sha, c]))
  const entrees = []
  for (let sha = apres; sha !== avant;) {
    const base = parSha.get(sha)?.parents[0]
    if (!base) return { filet: true, motif: `la chaîne des premiers parents de ${apres} n’atteint pas ${avant}` }
    entrees.push({ base, sha })
    sha = base
  }
  const zonees = entrees.map((e) => ({ ...e, zone: zoneDe(e) })).filter((e) => e.zone)
  return zonees.length
    ? { filet: true, motif: zonees.map((e) => `${e.sha} : zone ${e.zone}`).join(' ; ') }
    : { filet: false, motif: `${entrees.length} entrée(s) sans zone : la file a joué la suite entière` }
}

if (import.meta.main) {
  let verdict
  try {
    const avant = env.AVANT
    const apres = env.APRES
    verdict = filetDuPush({
      avant, apres,
      graphe: shaNul(avant) ? [] : grapheDe(depotDe(process.cwd()), [`${avant}..${apres}`]) ?? [],
      zoneDe: ({ base, sha }) => {
        const { fichiers, mods } = classerPush({ base, sha })
        return zoneDuPush(fichiers, { ecritLu: ECRIT_LU, mods })
      },
    })
  } catch (erreur) {
    verdict = { filet: true, motif: `erreur : ${erreur.message}` }
  }
  stdout.write(`filet=${verdict.filet}\n`)
  stderr.write(`[filetDeMain] filet=${verdict.filet} — ${verdict.motif}\n`)
}
