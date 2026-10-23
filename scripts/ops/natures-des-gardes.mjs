// COMPTE DES MODULES DE GARDE PAR NATURE (#2942, #2724), à une révision ou sur l'arbre de travail, joué par
// `npm run ops:natures-des-gardes -- [<rév>|arbre]…` (sans argument : l'arbre).
//
// Les modules comptés sont les `scripts/guards/lib/*.mjs` hors `*.test.mjs`. Leur nature est celle de la colonne
// « Nature » de l'annexe A de `docs/plans/2026-10-18-gardes-vers-structure.md`, lue sur l'arbre : `OUTIL` est un outil,
// toute autre nature (F1, F2, F1->F2…) une garde. Deux exceptions :
//   - la STRUCTURE, le greffon de lint qui tient les couches (#2882), n'est ni garde ni outil : la table, ses murs
//     et leur visiteur d'arcs (`MODULES_DE_LA_STRUCTURE`) ;
//   - un module absent de l'annexe porte la nature que lui donne `NATURES_HORS_ANNEXE`, lue sur son en-tête.
// Un module sans nature est listé, et le code de sortie est 1 : on lui écrit sa ligne avant de compter.
//
// Le compte est PUR (`compter`) ; `main` lit l'annexe et les listes de modules.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOSSIER = 'scripts/guards/lib'
const PLAN = 'docs/plans/2026-10-18-gardes-vers-structure.md'

/** Le mot qui désigne l'arbre de travail, à la place d'une révision. */
export const ARBRE = 'arbre'

/** Le greffon de lint de la structure (constat de #2942) : la table `COUCHES`, les murs qui la lisent, leur greffon et
 *  leur visiteur d'arcs, et le second greffon d'oxlint (`jsPlugins` d'`oxlint.config.mjs`). */
export const MODULES_DE_LA_STRUCTURE = Object.freeze(['arcsDImport.mjs', 'couches.mjs', 'couchesLint.mjs', 'interneLint.mjs', 'mursLint.mjs', 'reglesCoeurLint.mjs'])

/** Les modules absents de l'annexe A, classés sur leur en-tête : nés depuis l'inventaire du 2026-10-18 (#2882, #2928),
 *  ou présents ce jour-là sans ligne. */
export const NATURES_HORS_ANNEXE = Object.freeze({
  'arretNatif.mjs': 'OUTIL',
  'categorieDeRefus.mjs': 'OUTIL',
  'clesCanoniques.mjs': 'OUTIL',
  'clesDeStockage.mjs': 'GARDE',
  'fermetureDuNoyau.mjs': 'GARDE',
  'fileBornee.mjs': 'OUTIL',
  'gdscript.mjs': 'OUTIL',
  'gdscriptSansRegle.mjs': 'GARDE',
  'modulesSubstitues.mjs': 'GARDE',
  'porteursDesComptes.mjs': 'OUTIL',
  'racinesPresentes.mjs': 'OUTIL',
  'reexportations.mjs': 'GARDE',
})

/** Les natures de l'annexe A d'un texte du plan : `module` → `Nature`. PUR. */
export function naturesDeLAnnexe(plan) {
  const debut = plan.indexOf('## Annexe A')
  const fin = plan.indexOf('## Annexe B')
  if (debut < 0 || fin < debut) throw new Error(`natures-des-gardes : annexe A introuvable dans ${PLAN}`)
  const natures = new Map()
  for (const ligne of plan.slice(debut, fin).split('\n')) {
    const m = /^\| `([^`]+\.mjs)` \| ([^|]+) \|/.exec(ligne)
    if (m) natures.set(m[1], m[2].trim())
  }
  return natures
}

/** Les modules comptés d'une liste de noms de fichiers du dossier, triés par unités de code. PUR. */
export const modulesComptes = (noms) => noms.filter((n) => n.endsWith('.mjs') && !n.endsWith('.test.mjs')).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/** Le compte par nature des modules `modules`, selon les natures de l'annexe `natures`. PUR. */
export function compter(modules, natures) {
  const compte = { modules: modules.length, gardes: [], outils: [], structure: [], sansNature: [] }
  for (const m of modules) {
    if (MODULES_DE_LA_STRUCTURE.includes(m)) { compte.structure.push(m); continue }
    const nature = natures.get(m) ?? NATURES_HORS_ANNEXE[m]
    if (nature === undefined) compte.sansNature.push(m)
    else if (nature === 'OUTIL') compte.outils.push(m)
    else compte.gardes.push(m)
  }
  return compte
}

/** La ligne stable d'un compte. PUR. */
export const ligneDuCompte = (cible, c) =>
  `${cible} : modules=${c.modules} gardes=${c.gardes.length} outils=${c.outils.length} structure=${c.structure.length}` +
  (c.sansNature.length ? ` sans-nature=${c.sansNature.length} (${c.sansNature.join(', ')})` : '')

function nomsA(cible) {
  if (cible === ARBRE) return readdirSync(join(RACINE, DOSSIER))
  return execFileSync('git', ['-C', RACINE, 'ls-tree', '--name-only', `${cible}:${DOSSIER}/`], { encoding: 'utf8' }).split('\n').filter(Boolean)
}

function main() {
  const cibles = process.argv.slice(2)
  const natures = naturesDeLAnnexe(readFileSync(join(RACINE, PLAN), 'utf8'))
  let sansNature = false
  for (const cible of cibles.length ? cibles : [ARBRE]) {
    const compte = compter(modulesComptes(nomsA(cible)), natures)
    console.log(ligneDuCompte(cible, compte))
    sansNature ||= compte.sansNature.length > 0
  }
  if (sansNature) process.exitCode = 1
}

if (import.meta.main) main()
