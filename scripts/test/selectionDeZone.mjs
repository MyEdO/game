// LA SUITE D'UNE ZONE (#5037 L2) : sur un push dont chaque fichier est sous le dossier d'un seul projet
// (`zoneDuDiff`, scripts/gates/classerPush.mjs), la tranche de `scripts/test/run.mjs` ne joue que les tests qui
// peuvent lire ce projet. Un test le lit quand la clôture d'imports de son module (`clotureDImports`, arcs
// d'exécution, `import()` et `import.meta.glob` compris) atteint un module du projet ou la porte des projets
// (`porteDesProjets.mjs`, hors de laquelle les passerelles et l'intercepteur refusent toute lecture de `projets/`).
// La sélection est FERMÉE PAR DÉFAUT :
//  - un test hors de toute zone de `COUCHES` (`zoneDe` nul : `server/src`, `scripts/map`, `scripts/personnage-3d`) est
//    retenu, aucun mur ne ferme ses imports vers un projet ;
//  - un test qui atteint un LANCEUR (un module qui importe un spécificateur de `LANCEURS`) sans passer par une
//    passerelle gardée (un module qui importe la serrure, `serrureDesProjets.mjs`) est retenu : l'enfant lit hors de la
//    clôture, et seule une passerelle gardée refuse ce qu'il lirait sous `projets/` ;
//  - un test dont la clôture compte un site que la marche ne suit pas (spécificateur calculé, relatif non résolu,
//    chargeur non suivi) est retenu ;
//  - des `setupFiles` dont la clôture atteint l'un de ces modules, une zone qui n'est pas un projet ou une sélection
//    vide rendent la suite entière.
import { posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { analyserEnLots, arbreDuDisque, clotureDImports, grapheInverse } from '../guards/lib/importGraph.mjs'
import { dossierDe, estProjet, zoneDe } from '../guards/lib/couches.mjs'
import { TRAVAIL, depotDe, listerImage } from '../guards/lib/gitPorte.mjs'
import { porteDeTousLesProjets } from '../guards/lib/porteDesProjets.mjs'
import { CONFIG_VITEST, setupFilesDe } from './setupDeVitest.mjs'

/** Les spécificateurs dont l'import fait d'un module un LANCEUR de processus ou de fil : `child_process`, `worker_threads`,
 *  `cluster`, et le transport stdio du SDK MCP, qui lance son serveur (`StdioClientTransport`). */
export const LANCEURS = Object.freeze(['node:child_process', 'child_process', 'node:worker_threads', 'worker_threads', 'node:cluster', 'cluster',
  '@modelcontextprotocol/sdk/client/stdio.js'])

/** Les modules de la porte et de la serrure des projets, relatifs à la racine du dépôt. */
export const PORTE = 'scripts/guards/lib/porteDesProjets.mjs'
const SERRURE = 'scripts/guards/lib/serrureDesProjets.mjs'

/** Un spécificateur que la marche résout dans le dépôt : relatif, absolu ou alias `@/`. */
const relatifAuDepot = (spec) => spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/')

/**
 * La sélection de la suite `suite` (chemins relatifs POSIX, `suiteVitestDuDepot`) pour un diff de la seule zone `zone` :
 * `{ fichiers, motifs }`, `fichiers` triés, ou la suite entière avec le motif qui la rend (`entiere`). Git sous `env`.
 * @param {{ racine?: string, suite: readonly string[], zone: string, env?: NodeJS.ProcessEnv }} entree
 * @returns {{ fichiers: string[], entiere: string | null, motifs: Record<string, number> }}
 */
export function selectionDeLaZone({ racine = fileURLToPath(new URL('../..', import.meta.url)), suite, zone, env }) {
  const entiere = (motif) => ({ fichiers: [...suite], entiere: motif, motifs: {} })
  if (!estProjet(zone)) return entiere(`« ${zone} » n’est pas un projet de COUCHES`)
  const dossier = `${dossierDe(zone)}/`
  const base = resolve(racine).split('\\').join('/')
  const abs = (rel) => `${base}/${rel}`
  const rel = (a) => posix.relative(base, a)
  const fichiers = listerImage(depotDe(racine, { env, porte: porteDeTousLesProjets }), TRAVAIL)
  const setup = setupFilesDe(readFileSync(abs(CONFIG_VITEST), 'utf8'), analyserEnLots)
  const cache = new Map()
  /** Module ↦ ce qui le marque : `lecteur` (le projet ou la porte), `lanceur`, `inclassable`. */
  const marques = new Map()
  const marquer = (a, marque) => marques.set(rel(a), marques.get(rel(a)) ?? marque)
  const lanceurs = []
  /** Les sites relatifs au dépôt de chaque module, jugés résolus ou non une fois ses arcs posés au cache. */
  const relatifs = []
  clotureDImports([...suite, ...setup], {
    racine, typesEffaces: true, cache, porte: porteDeTousLesProjets, arbre: arbreDuDisque(fichiers.map(abs)),
    surSites: (a, sites) => {
      for (const { acquisition, genre, nature, spec } of sites) {
        if (nature === 'nonSuivi' || genre === 'chargeur' || (acquisition && spec === null)) marquer(a, 'inclassable')
        else if (acquisition && LANCEURS.includes(spec)) lanceurs.push(a)
        else if (acquisition && relatifAuDepot(spec)) relatifs.push([a, spec])
      }
    },
  })
  for (const [a, spec] of relatifs) if (!(cache.get(a) ?? []).some((arc) => arc.spec === spec)) marquer(a, 'inclassable')
  for (const a of lanceurs) marquer(a, 'lanceur')
  /** Les passerelles gardées : les modules qui importent la serrure. Un lanceur ne se lit pas au travers d'elles. */
  const gardees = new Set([...cache].filter(([, arcs]) => (arcs ?? []).some((arc) => rel(arc.cible) === SERRURE)).map(([a]) => a))
  for (const a of cache.keys()) if (rel(a) === PORTE || rel(a).startsWith(dossier)) marques.set(rel(a), 'lecteur')
  for (const t of suite) if (zoneDe(t) === null) marquer(abs(t), 'hors des zones')
  const inverse = grapheInverse(cache)
  const atteints = new Map()
  for (let vague = [...marques].map(([m, marque]) => [abs(m), marque]); vague.length;) {
    const suivante = []
    for (const [a, marque] of vague) {
      if (atteints.has(a) || (marque === 'lanceur' && gardees.has(a))) continue
      atteints.set(a, marque)
      for (const { importeur } of inverse.get(a) ?? []) suivante.push([importeur, marque])
    }
    vague = suivante
  }
  const parSetup = setup.find((s) => atteints.has(abs(s)))
  if (parSetup) return entiere(`le setup ${parSetup} atteint un module ${atteints.get(abs(parSetup))}`)
  const retenus = suite.filter((t) => atteints.has(abs(t))).sort()
  if (!retenus.length) return entiere('sélection vide')
  const motifs = {}
  for (const t of retenus) motifs[atteints.get(abs(t))] = (motifs[atteints.get(abs(t))] ?? 0) + 1
  return { fichiers: retenus, entiere: null, motifs }
}
