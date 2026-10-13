// Les miroirs d'agents (#2578) produits sur un INDEX par `runCompat`, unique producteur
// (`scripts/agents/compat-cli.mjs`), chargé depuis le dépôt qui commet. Le CODE du producteur est
// dans l'état de l'index, ou la famille saute, AVERTIE ; la gate `agents:check` de la CI juge.
// Point d'entrée des post-hooks : `post-commit`, `post-merge`, `post-rewrite` (`git help githooks`) ;
// le `pre-commit` importe `produireLesMiroirs`.
import '../node-requis.mjs'
import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { journaliserLeHook } from './journal.mjs'
import { INDEX, ceQuiChange, cheminGit, depotDe, ecartsDuTravail, entreesDe, natureDuChemin, racineDe, raisonCourte, rebaseEntame, shaDe } from '../guards/lib/gitPorte.mjs'

const GENERATEUR = 'scripts/agents/compat-cli.mjs'
const NOYAU = 'scripts/agents/compat-core.mjs'

/** @typedef {{ memos: { sauver: () => void }, specificateurs: NonNullable<Parameters<typeof import('../guards/lib/importGraph.mjs').clotureDImports>[1]>['specificateurs'] }} Marches */

/**
 * Les mémos du dépôt de `racine` (`memosDuDepot`) et l'option `specificateurs` de `clotureDImports` qu'ils
 * portent, sous le régime de typage (`specificateursMemoises`).
 * @param {string} racine @returns {Promise<Marches>}
 */
async function marchesMemoisees(racine) {
  const { memosDuDepot, specificateursMemoises } = await import('../test/perimetre.mjs')
  const memos = memosDuDepot(racine)
  return { memos, specificateurs: specificateursMemoises(memos, { typesEffaces: false }) }
}

/**
 * Les membres de la clôture d'imports de `racines` (`clotureDImports`, lue sur le disque, ce que Node
 * charge, données comprises) qui diffèrent entre le disque et l'index de `depot` : écartés du travail
 * (`ecartsDuTravail`) ou absents de l'index.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot @param {string} racine @param {string[]} racines
 * @param {{ ecarts: Set<string>, cache: Map<string, unknown>, specificateurs: Marches['specificateurs'] }} etat
 */
async function modulesSales(depot, racine, racines, etat) {
  const { clotureDImports } = await import('../guards/lib/importGraph.mjs')
  const membres = [...clotureDImports(racines, { racine, cache: etat.cache, specificateurs: etat.specificateurs })]
  const suivis = entreesDe(depot, INDEX, membres)
  return membres.filter((rel) => etat.ecarts.has(rel) || !suivis.has(rel))
}

/**
 * Joue `runCompat` (mode `sync`) sur l'INDEX de `depot` (`dependancesDeLIndex`), dans le dépôt `racine`,
 * git sous `env` (celui de `depot`), ses marches sous `marches` (à défaut, `marchesMemoisees` de `racine`,
 * sauvées). Un producteur absent du disque comme de l'index : rien. Rend les avertissements et les chemins écrits.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot @param {string} racine @param {{ env?: NodeJS.ProcessEnv, marches?: Marches }} [opts]
 * @returns {Promise<{ avertissements: string[], ecrits: string[] }>}
 */
export async function produireLesMiroirs(depot, racine, { env, marches } = {}) {
  const avertissements = []
  const ecrits = []
  if (!existsSync(join(racine, GENERATEUR)) && !entreesDe(depot, INDEX, [GENERATEUR]).size) return { avertissements, ecrits }
  if (!marches) {
    const propres = await marchesMemoisees(racine)
    try {
      return await produireLesMiroirs(depot, racine, { env, marches: propres })
    } finally {
      propres.memos.sauver()
    }
  }
  const etat = { ecarts: new Set(ecartsDuTravail(depot)), cache: new Map(), specificateurs: marches.specificateurs }
  const generateur = await modulesSales(depot, racine, [GENERATEUR], etat)
  if (generateur.length) {
    avertissements.push(`miroirs d'agents NON produits : le producteur (compat-cli, compat-core) diffère entre le disque et l'index — ${generateur.join(', ')}`)
    return { avertissements, ecrits }
  }
  const url = (rel) => pathToFileURL(join(racine, rel)).href
  const { MODULES_DES_REGISTRES: modules, chargerRegistres, dependancesDeLIndex, runCompat } = await import(url(GENERATEUR))
  let registres = new Map()
  if (modules.some((rel) => existsSync(join(racine, rel)) || entreesDe(depot, INDEX, [rel]).size)) {
    const sales = await modulesSales(depot, racine, modules, etat)
    if (sales.length) avertissements.push(`famille \`hook\` NON produite : ses registres (${modules.join(', ')}) diffèrent entre le disque et l'index — ${sales.join(', ')}`)
    else {
      try {
        registres = await chargerRegistres()
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
    rm: async (chemin, options) => { await dependances.rm(chemin, options); ecrits.push(relative(racine, chemin).replaceAll('\\', '/')) },
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

/**
 * Le post-commit produit-il ? Oui si l'index de `depot` s'écarte de HEAD sur une destination
 * (`DESTINATIONS`), si le commit a touché une destination, une entrée non-JS du producteur
 * (`ENTREES_DU_PRODUCTEUR`) ou un membre de la clôture d'imports de son code (`RACINES_DU_PRODUCTEUR`,
 * `clotureDImports`, lue sur le disque, données comprises, sous `marches`), si HEAD n'a pas de parent, ou
 * si le producteur manque au disque (`produireLesMiroirs` tranche).
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot @param {string} racine @param {Marches} marches
 */
async function commitAProduire(depot, racine, marches) {
  if (![GENERATEUR, NOYAU].every((rel) => existsSync(join(racine, rel)))) return true
  const url = (rel) => pathToFileURL(join(racine, rel)).href
  const { DESTINATIONS } = await import(url(NOYAU))
  if (ceQuiChange(depot, 'HEAD', INDEX).chemins('', DESTINATIONS).length) return true
  if (!shaDe(depot, 'HEAD^')) return true
  const { ENTREES_DU_PRODUCTEUR, RACINES_DU_PRODUCTEUR } = await import(url(GENERATEUR))
  const touches = ceQuiChange(depot, 'HEAD^', 'HEAD').chemins('')
  const sous = (rel) => (r) => rel === r || rel.startsWith(`${r}/`)
  if (touches.some((rel) => [...DESTINATIONS, ...ENTREES_DU_PRODUCTEUR].some(sous(rel)))) return true
  const { clotureDImports } = await import('../guards/lib/importGraph.mjs')
  const code = clotureDImports(RACINES_DU_PRODUCTEUR, { racine, specificateurs: marches.specificateurs })
  return touches.some((rel) => code.has(rel))
}

/** Une opération de séquenceur (`cherry-pick`, `revert` à plusieurs commits) en cours ? */
const sequenceEnCours = (depot) => {
  const chemin = cheminGit(depot, 'sequencer')
  return chemin !== null && natureDuChemin(resolve(depot.cwd, chemin)) !== 'absent'
}

if (import.meta.main) {
  const hook = process.argv[2]
  journaliserLeHook(hook)
  const env = Object.fromEntries(Object.entries(process.env).filter(([cle]) => cle !== 'GIT_INDEX_FILE'))
  try {
    const racine = resolve(racineDe(depotDe(process.cwd(), { env })) ?? process.cwd())
    const depot = depotDe(racine, { env })
    if (hook === 'post-commit' && (rebaseEntame(depot) || sequenceEnCours(depot))) process.exit(0)
    const marches = await marchesMemoisees(racine)
    try {
      if (hook !== 'post-commit' || await commitAProduire(depot, racine, marches)) {
        const { avertissements, ecrits } = await produireLesMiroirs(depot, racine, { env, marches })
        ecrireAvertissements(`[${hook}]`, avertissements)
        if (ecrits.length) {
          const tete = entreesDe(depot, 'HEAD', ecrits)
          const index = entreesDe(depot, INDEX, ecrits)
          const aCommettre = ecrits.filter((rel) => tete.get(rel)?.sha !== index.get(rel)?.sha)
          process.stderr.write(aCommettre.length
            ? `[${hook}] miroirs d'agents produits dans l'index, HEAD ne les porte pas — À COMMETTRE : ${aCommettre.join(', ')}\n`
            : `[${hook}] miroirs d'agents de l'index réalignés sur HEAD : ${ecrits.join(', ')}\n`)
        }
      }
    } finally {
      marches.memos.sauver()
    }
  } catch (e) {
    process.stderr.write(`[${hook}] miroirs d'agents NON produits : ${raisonCourte(e?.message ?? e)}\n`)
  }
}
