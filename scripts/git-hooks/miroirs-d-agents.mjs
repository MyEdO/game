// Les miroirs d'agents (#2578) produits sur un INDEX par `runCompat`, unique producteur
// (`scripts/agents/compat-cli.mjs`), chargé depuis le dépôt qui commet. Le CODE du producteur est
// dans l'état de l'index, ou la famille saute, AVERTIE ; la gate `agents:check` de la CI juge.
// Point d'entrée des post-hooks : `post-commit`, `post-rewrite` (`git help githooks`) ; le
// `pre-commit` et le `pre-merge-commit` importent `produireLesMiroirs`.
import '../node-requis.mjs'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { INDEX, cheminGit, depotDe, ecartsDuTravail, entreesDe, natureDuChemin, racineDe, raisonCourte, rebaseEntame } from '../guards/lib/gitPorte.mjs'

const GENERATEUR = 'scripts/agents/compat-cli.mjs'
const NOYAU = 'scripts/agents/compat-core.mjs'
const DOSSIER_DES_REGISTRES = 'scripts/hooks'

/**
 * Les modules de la clôture d'imports de `racines` (`clotureDImports`, lue sur le disque, ce que Node
 * charge) qui diffèrent entre le disque et l'index de `depot` : écartés du travail (`ecartsDuTravail`)
 * ou absents de l'index. Aucun écart de module suivi : rien à marcher.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot @param {string} racine @param {string[]} racines
 * @param {{ ecarts: Set<string>, cache: Map<string, unknown> }} etat
 */
async function modulesSales(depot, racine, racines, etat) {
  const { clotureDImports, estModule } = await import('../guards/lib/importGraph.mjs')
  if (![...etat.ecarts].some((rel) => estModule(rel)) && racines.every((r) => entreesDe(depot, INDEX, [r]).size)) return []
  const membres = [...clotureDImports(racines, { racine, cache: etat.cache })]
  const suivis = entreesDe(depot, INDEX, membres)
  return membres.filter((rel) => etat.ecarts.has(rel) || !suivis.has(rel))
}

/**
 * Joue `runCompat` (mode `sync`) sur l'INDEX de `depot` (`dependancesDeLIndex`), dans le dépôt `racine`,
 * git sous `env` (celui de `depot`). Un producteur absent du disque comme de l'index : rien. Rend les
 * avertissements et les chemins écrits.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot @param {string} racine @param {{ env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<{ avertissements: string[], ecrits: string[] }>}
 */
export async function produireLesMiroirs(depot, racine, { env } = {}) {
  const avertissements = []
  const ecrits = []
  if (!existsSync(join(racine, GENERATEUR)) && !entreesDe(depot, INDEX, [GENERATEUR]).size) return { avertissements, ecrits }
  const etat = { ecarts: new Set(ecartsDuTravail(depot)), cache: new Map() }
  const generateur = await modulesSales(depot, racine, [GENERATEUR], etat)
  if (generateur.length) {
    avertissements.push(`miroirs d'agents NON produits : le producteur (compat-cli, compat-core) diffère entre le disque et l'index — ${generateur.join(', ')}`)
    return { avertissements, ecrits }
  }
  const url = (rel) => pathToFileURL(join(racine, rel)).href
  const { chargerRegistres, dependancesDeLIndex, runCompat } = await import(url(GENERATEUR))
  const { ENTREES_OUTIL } = await import(url(NOYAU))
  const modules = ENTREES_OUTIL.map(({ module }) => `${DOSSIER_DES_REGISTRES}/${module}`)
  let registres = new Map()
  if (modules.some((rel) => existsSync(join(racine, rel)) || entreesDe(depot, INDEX, [rel]).size)) {
    const sales = await modulesSales(depot, racine, modules, etat)
    if (sales.length) avertissements.push(`famille \`hook\` NON produite : ses registres (${modules.join(', ')}) diffèrent entre le disque et l'index — ${sales.join(', ')}`)
    else {
      try {
        registres = await chargerRegistres(join(racine, DOSSIER_DES_REGISTRES))
      } catch (e) {
        avertissements.push(`famille \`hook\` NON produite : import des registres (${modules.join(', ')}) en échec — ${raisonCourte(e?.message ?? e)}`)
      }
    }
  }
  const dependances = dependancesDeLIndex({ cwd: racine, env })
  const restes = await runCompat({ root: racine, mode: 'sync' }, {
    ...dependances,
    registres,
    atomicWrite: async (root, rel, data) => { await dependances.atomicWrite(root, rel, data); ecrits.push(rel) },
    rm: async (chemin, options) => { await dependances.rm(chemin, options); ecrits.push(chemin) },
  })
  const manuels = restes.filter((d) => d.safe === false || d.type.startsWith('unsafe-'))
  if (manuels.length)
    avertissements.push(`AVERTISSEMENT [miroir d'agents édité à la main] : RIEN n'est produit\n${manuels.map((d) => `  ${d.family}:${d.type}:${d.destination}: ${d.message}`).join('\n')}`)
  return { avertissements, ecrits }
}

/** Chaque avertissement sur stderr, préfixé, sa première ligne close par le juge (la CI). @param {string} prefixe @param {string[]} avertissements */
export function ecrireAvertissements(prefixe, avertissements) {
  for (const a of avertissements) {
    const [tete, ...details] = a.split('\n')
    process.stderr.write(`${prefixe} ${tete} ; la gate \`agents:check\` de la CI juge.\n${details.map((l) => `${l}\n`).join('')}`)
  }
}

/** Une opération de séquenceur (`cherry-pick`, `revert` à plusieurs commits) en cours ? */
const sequenceEnCours = (depot) => {
  const chemin = cheminGit(depot, 'sequencer')
  return chemin !== null && natureDuChemin(resolve(depot.cwd, chemin)) !== 'absent'
}

if (import.meta.main) {
  const hook = process.argv[2]
  const env = Object.fromEntries(Object.entries(process.env).filter(([cle]) => cle !== 'GIT_INDEX_FILE'))
  try {
    const racine = resolve(racineDe(depotDe(process.cwd(), { env })) ?? process.cwd())
    const depot = depotDe(racine, { env })
    if (hook === 'post-commit' && (rebaseEntame(depot) || sequenceEnCours(depot))) process.exit(0)
    const { avertissements, ecrits } = await produireLesMiroirs(depot, racine, { env })
    for (const a of avertissements) process.stderr.write(`[${hook}] ${a} ; la gate \`agents:check\` de la CI juge.\n`)
    if (ecrits.length) {
      const tete = entreesDe(depot, 'HEAD', ecrits)
      const index = entreesDe(depot, INDEX, ecrits)
      const aCommettre = ecrits.filter((rel) => tete.get(rel)?.sha !== index.get(rel)?.sha)
      process.stderr.write(aCommettre.length
        ? `[${hook}] miroirs d'agents produits dans l'index, HEAD ne les porte pas — À COMMETTRE : ${aCommettre.join(', ')}\n`
        : `[${hook}] miroirs d'agents de l'index réalignés sur HEAD : ${ecrits.join(', ')}\n`)
    }
  } catch (e) {
    process.stderr.write(`[${hook}] miroirs d'agents NON produits : ${raisonCourte(e?.message ?? e)}\n`)
  }
}
