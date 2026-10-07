// L'ÉVÉNEMENT DE FRONTIÈRE du stock CSS (#1806 D1″/D2″) : un module qui FRANCHIT la frontière de la
// base au commit (`franchissements`, `cssCouches.mjs`) — revendiqué au manifeste par une primitive
// réutilisée, second importeur gagné, ou ajouté à `FEUILLES_PARTAGEES` — sort ses sites de
// `CSS_IDENTITE_ECRAN_RATCHET` / `CSS_ESPACEMENT_RATCHET` sans les guérir. Le message le DIT :
// `RECLASSEMENT: <module> +N — <motif #ticket>`, UNE ligne par module franchi, N = son prix (`ventiler`,
// `cssCouches.mjs`). Trois refus : un franchissement sans ligne, une ligne sans franchissement, un N
// faux.
//
// Le discriminant est la FRONTIÈRE lue dans chaque côté (`coteCss`, `cssImages.mjs`) — manifeste,
// `FEUILLES_PARTAGEES`, `fichier`s réutilisés —, jamais le libellé `nature` qu'un commit écrit lui-même.
//
// FRONTIÈRE : cette lib CALCULE ; le VERDICT appartient aux appelants — la porte du commit
// (`scripts/git-hooks/porte-du-commit.mjs`), la porte de plage au push (`plageStock.mjs`), chaque
// commit contre sa base (#1806 D3″).
import {
  CHEMIN_COUCHES, CHEMIN_MANIFESTE, RACINE_DES_MODULES, manifesteDe, modulesDePrimitive, modulesExemptes, ventiler,
} from './cssCouches.mjs'
import { RACINE_DES_SOURCES, importsDansLArbre, nomsDImport, nomsDImportDe } from './cssImages.mjs'
import { CHEMIN_TSCONFIG, estModule } from './importGraph.mjs'
import { MOTIF_MIN, declarationsDuMessage, gesteSurLesCommitsFautifs, mesuresNonCouvertes } from './stocksNominatifs.mjs'

/** Le mot-clé de la ligne de message. */
const MOT_RECLASSEMENT = 'RECLASSEMENT'

/** Un motif de reclassement nomme le ticket qui le porte. */
const TICKET = /#\d+/

/**
 * Les modules FRANCHIS d'un commit, avec leur prix par volet (`ventiler`), lus sur deux côtés
 * `{ manifeste, partagees, reutilises, lire }` (`coteCss`). Seuls les candidats — exemptés au commit,
 * pas à la base — sont lus : le prix d'un module ne dépend que de ses propres clés (fichier, réf).
 * @param {{ manifeste: readonly { id: string, fichier?: string, css?: string }[], partagees: readonly string[], reutilises: ReadonlySet<string>, lire: (f: string) => string | null }} base
 * @param {typeof base} commit
 * @returns {{ module: string, identite: number, espacement: number, n: number }[]} `n > 0`, triés
 */
export function franchisDesCotes(base, commit) {
  const exB = modulesExemptes(base)
  const candidats = [...modulesExemptes(commit)].filter((m) => !exB.has(m))
  const mesures = modulesDePrimitive(base.manifeste)
  const dansLImage = (m) => (m.startsWith(RACINE_DES_MODULES) && m.endsWith('.css')) || mesures.has(m)
  const image = (cote, retenir) => ({
    ...cote,
    fichiers: candidats.filter(retenir).map((rel) => ({ rel, text: cote.lire(rel) })).filter((f) => f.text !== null),
  })
  return ventiler(image(base, dansLImage), image(commit, () => true)).franchis.filter((f) => f.n > 0)
}

/**
 * Le geste déplace-t-il la frontière (#1806 E) ? Il touche le manifeste, `FEUILLES_PARTAGEES`
 * (`cssCouches.mjs`) ou les alias (`tsconfig.json`) ; ou il AJOUTE ou SUPPRIME (`nesOuMorts`, chemins
 * `--diff-filter=AD`) un module de code qui porte un nom d'import d'un `fichier` (`nomsDImportDe`) — vide
 * compris : l'ordre de repli de `resolveImport` (`importGraph.mjs`) peut alors faire changer de cible un
 * import que rien ne réécrit ; ou un module de `src/` qu'il touche n'importe pas les mêmes `fichier`s
 * du manifeste dans la base et au commit (`importsDansLArbre`, chaque côté résolu dans son arbre). Le manifeste
 * est celui de la base ; `nesOuMorts` et les côtés ne sont lus qu'à défaut des chemins.
 * @param {{ chemins: Iterable<string>, nesOuMorts: () => readonly string[],
 *   base: import('./cssImages.mjs').SourceCss, commit: import('./cssImages.mjs').SourceCss, racine?: string }} p
 * @returns {boolean}
 */
export function deplaceLaFrontiere({ chemins, nesOuMorts, base, commit, racine = '.' }) {
  const touches = [...chemins]
  if (touches.some((f) => f === CHEMIN_COUCHES || f === CHEMIN_MANIFESTE || f === CHEMIN_TSCONFIG)) return true
  const manifeste = manifesteDe(base.lire(CHEMIN_MANIFESTE))
  const noms = nomsDImport(manifeste)
  if (!noms.size) return false
  if (nesOuMorts().some((f) => estModule(f) && nomsDImportDe(f).some((n) => noms.has(n)))) return true
  const modules = touches.filter((f) => f.startsWith(`${RACINE_DES_SOURCES}/`) && estModule(f))
  if (!modules.length) return false
  const fichiers = new Set(manifeste.flatMap(({ fichier }) => (typeof fichier === 'string' ? [fichier] : [])))
  const arcs = (cote) => importsDansLArbre(cote, modules, { racine }).map(([, cibles]) => cibles.filter((c) => fichiers.has(c)).sort().join('\n'))
  const deBase = arcs(base)
  const duCommit = arcs(commit)
  return deBase.some((a, i) => a !== duCommit[i])
}

/** Les lignes `RECLASSEMENT:` d'un message dont le motif porte son `#<ticket>`. */
export const lignesDeReclassement = (message) =>
  declarationsDuMessage(message, MOT_RECLASSEMENT).filter((d) => TICKET.test(d.motif))

/**
 * Les ÉCARTS entre les franchissements d'un commit et les lignes de son message (vide = couvert) :
 * un module franchi sans UNE ligne au N exact (`mesuresNonCouvertes`, juge unique avec `CLIQUET:`),
 * et toute ligne qui nomme un module qui n'a pas franchi.
 * @param {ReturnType<typeof franchisDesCotes>} franchis @param {{ fichier: string, n: number }[]} lignes
 * @returns {{ module: string, n: number | null, declare: number | null, declarees?: number[] }[]}
 *   `n` = le prix, `null` pour une ligne sans franchissement.
 */
export function ecartsDeReclassement(franchis, lignes) {
  const nonCouverts = mesuresNonCouvertes(franchis.map((f) => ({ fichier: f.module, n: f.n })), lignes)
    .map(({ fichier, n, declare, declarees }) => ({ module: fichier, n, declare, ...(declarees ? { declarees } : {}) }))
  const franchi = new Set(franchis.map((f) => f.module))
  const orphelines = lignes.filter((d) => !franchi.has(d.fichier)).map((d) => ({ module: d.fichier, n: null, declare: d.n }))
  return [...nonCouverts, ...orphelines]
}

/**
 * Franchissements d'un commit, PUR : `franchisDesCotes(base, commit)` ; pour une FUSION (`parents` =
 * les côtés de `^1` et `^2`, `base` = celui de leur base commune), à TROIS VOIES (#2223) : la fusion
 * franchit les modules qu'elle exempte et que la fusion automatique de ses parents n'exempte pas — le
 * côté qui a changé son exemption fait foi, l'autre sinon. Chacun se paie contre le parent qui l'a
 * libéré : le premier qui ne l'exempte pas.
 * @param {{ base: Parameters<typeof franchisDesCotes>[0], commit: Parameters<typeof franchisDesCotes>[1], parents?: Parameters<typeof franchisDesCotes>[0][] }} cotes
 * @returns {ReturnType<typeof franchisDesCotes>}
 */
export function franchisDuCommit({ base, commit, parents = [] }) {
  if (!parents.length) return franchisDesCotes(base, commit)
  const [exB, ex1, ex2] = [base, ...parents].map(modulesExemptes)
  const exempteALaFusionAutomatique = (m) => (ex1.has(m) === exB.has(m) ? ex2.has(m) : ex1.has(m))
  const liberateur = (m) => (ex1.has(m) ? 1 : 0)
  return parents
    .flatMap((parent, i) => franchisDesCotes(parent, commit).filter((f) => !exempteALaFusionAutomatique(f.module) && liberateur(f.module) === i))
    .sort((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0))
}

/**
 * Les écarts d'un COMMIT jugé contre sa base, une fusion à trois voies (`franchisDuCommit`).
 * @param {{ message: string }} p
 * @param {Parameters<typeof franchisDuCommit>[0]} cotes
 */
export function reclassementsNonDeclares({ message }, cotes) {
  return ecartsDeReclassement(franchisDuCommit(cotes), lignesDeReclassement(message))
}

/** Un écart, en clair. */
const ceQueDitLeModule = (e) => {
  if (e.n === null) return `${e.module} : ligne \`+${e.declare}\` sans franchissement`
  if (e.declarees) return `${e.module} : franchi au prix ${e.n}, ${e.declarees.length} lignes (${e.declarees.map((n) => `+${n}`).join(', ')}) — une seule par module`
  if (e.declare === null) return `${e.module} : franchi au prix ${e.n}, aucune ligne`
  return `${e.module} : franchi au prix ${e.n}, la ligne annonce \`+${e.declare}\``
}

/**
 * Refus lisible : où (commit ou rien), chaque écart, et le geste. Une image illisible (`illisible`)
 * est dite par son commit.
 * @param {({ sha?: string, fusion?: boolean, ecarts: ReturnType<typeof ecartsDeReclassement> } | { sha: string, fusion: boolean, illisible: string })[]} refus
 */
export function raisonDeRefusDeReclassement(refus) {
  const lignes = refus.map((r) => {
    const ou = r.sha ? `${r.sha.slice(0, 9)}${r.fusion ? ' (fusion)' : ''} ` : ''
    if ('illisible' in r) return `${ou}injugeable : ${r.illisible}`
    return `${ou}${r.ecarts.map(ceQueDitLeModule).join(', ')}`
  })
  const desCommits = refus.filter((r) => r.sha)
  const geste = desCommits.length
    ? `porter au message du commit fautif — ${gesteSurLesCommitsFautifs(desCommits)} —`
    : 'porter au message'
  return (
    `⛔ RECLASSEMENT CSS : ${lignes.join(' || ')}. Un module FRANCHIT la frontière quand il devient ` +
    `exempté au commit sans l'être à sa base — revendiqué au manifeste (${CHEMIN_MANIFESTE}) par une ` +
    `primitive réutilisée, second importeur gagné, ou ajouté à \`FEUILLES_PARTAGEES\` (${CHEMIN_COUCHES}) — ` +
    `et ses sites quittent le stock (xxi) sans guérir. Geste : ${geste} ` +
    `\`RECLASSEMENT: <module> +N — <motif>\` (motif d’au moins ${MOTIF_MIN} caractères, portant son ` +
    '`#<ticket>`), UNE ligne par module franchi, N = ses sites sortis ; aucune ligne pour un module qui ' +
    'n’a pas franchi.'
  )
}
