// SÉLECTION des dérivés par lectures mesurées (#1773, #2193, #2603) : fonctions PURES, sans écrivain, que
// lit le périmètre de tests (`scripts/test/perimetre.mjs`).
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { ciblesLitterales, ciblesSurDisque, GENERATORS, SOURCES_LUES } from '../docs/build-all.mjs'
import { fichiersDOutillage } from '../docs/lib/fraicheur-docs.mjs'
import { correspondGlob, couvertParPathspec } from '../guards/lib/lister.mjs'

/** Les sources MESURÉES de l'arbre (`docs/.sources-lues.json`), ou `null` si le dérivé est illisible. */
export function sourcesMesurees(racine) {
  try { return JSON.parse(readFileSync(join(racine, SOURCES_LUES), 'utf8')) } catch { return null }
}

/** Les manifestes de dépendances : leurs lectures ne sont pas mesurées, un changement invalide toute
 *  sélection par lectures (docs dérivés, périmètre de tests). */
export const LECTURES_DES_DEPENDANCES = Object.freeze(['package.json', 'package-lock.json', 'server/package.json', 'server/package-lock.json'])

/** Les modules qui décident de la reconstruction d'un lot : modifiés, toute sélection par lectures tombe. */
const GRAPHE_DE_SELECTION = Object.freeze(['scripts/git-hooks/docs-rebuild.mjs', 'scripts/git-hooks/selection-des-derives.mjs'])

const parentDe = (chemin) => (chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '')

/** Les dossiers qui contiennent `chemin`, du parent à la racine (`''`) comprise. */
export function ancetresDe(chemin) {
  const ancetres = [parentDe(chemin)]
  while (ancetres.at(-1) !== '') ancetres.push(parentDe(ancetres.at(-1)))
  return ancetres
}

/** Requêtes Git dont la réponse ne dépend que de l'EMPLACEMENT du dépôt, jamais du contenu de l'arbre :
 *  aucun lot ne la change. */
const REQUETES_GIT_SANS_CHEMIN = new Set(['rev-parse --show-toplevel'])

/** Les verbes Git dont la sortie ne dépend que des chemins de leur pathspec (et de leur historique). */
const VERBES_A_PATHSPEC = new Set(['ls-files', 'log'])

/** Ceux dont les arguments non-options, sans `--`, sont des pathspecs. */
const VERBES_A_PATHSPEC_POSITIONNEL = new Set(['ls-files'])

/** Les SEULES options de `git ls-files` qui gardent sa sortie fonction du seul pathspec : `--others`,
 *  `--ignored` ou une exclusion la feraient dépendre de `.gitignore`. */
const OPTIONS_DE_LS_FILES_SANS_EXCLUSION = new Set(['-z', '--cached', '-c', '--full-name'])

/** Les SEULES options de `git log` qui gardent sa sortie fonction du seul pathspec : `--follow` ou un
 *  renommage détecté (`-M`, `--find-renames`) la feraient dépendre d'un chemin hors pathspec. Valeur après `=`. */
const OPTIONS_DE_LOG_SANS_RENOMMAGE = new Set(['-1', '--no-renames', '--diff-filter', '--format', '--pretty', '--max-count', '-z'])

/**
 * Les pathspecs d'une requête Git mesurée (`{ args, cwd }`), relatifs à la racine : `[]` pour une requête
 * de `REQUETES_GIT_SANS_CHEMIN`, `null` quand la sortie peut dépendre d'un chemin hors pathspec (verbe hors
 * `VERBES_A_PATHSPEC`, option hors liste, révision nommée, magie `:(…)`, joker `?` ou `[…]`) ou sans pathspec.
 */
export function pathspecsDeRequeteGit({ args = [], cwd = '' }) {
  if (REQUETES_GIT_SANS_CHEMIN.has(args.join(' '))) return []
  const [verbe, ...reste] = args
  if (!VERBES_A_PATHSPEC.has(verbe)) return null
  const tiret = reste.indexOf('--')
  const avant = tiret < 0 ? reste : reste.slice(0, tiret)
  const positionnel = VERBES_A_PATHSPEC_POSITIONNEL.has(verbe)
  const nus = avant.filter((a) => !a.startsWith('-'))
  const optionSure = (option) => (positionnel ? OPTIONS_DE_LS_FILES_SANS_EXCLUSION.has(option) : OPTIONS_DE_LOG_SANS_RENOMMAGE.has(option))
  if (avant.some((a) => a.startsWith('-') && !optionSure(a.split('=')[0])) || (!positionnel && nus.length)) return null
  const specs = [...(positionnel ? nus : []), ...(tiret < 0 ? [] : reste.slice(tiret + 1))]
  if (!specs.length || specs.some((p) => p.startsWith(':') || /[?[\\]/.test(p))) return null
  return specs.map((p) => posix.normalize(posix.join(cwd, p)).replace(/\/$/, '')).map((p) => (p === '.' ? '' : p))
}

/**
 * Vrai si le lot peut avoir périmé un doc dérivé. La réponse se DÉRIVE de la mesure
 * (`docs/.sources-lues.json`, #1773). Façons, pour un lot, de périmer un doc dérivé :
 *   1. le chemin EST une source lue, ou une cible ;
 *   2. un de ses ANCÊTRES est un dossier LISTÉ — un fichier posé dans un dossier NEUF change le
 *      listing du premier ancêtre qui existait (#2193) ;
 *   3. le chemin, ou un de ses ancêtres, est SONDÉ (`sondes` : existence, nature) ;
 *   4. le chemin est couvert par le pathspec d'une requête `git` mesurée ; une requête sans portée
 *      lisible (`pathspecsDeRequeteGit` → `null`) le couvre toujours ;
 *   5. sans restriction par générateur, il vit sous `docs/`.
 * Lot inconnu ou mesure illisible → régénération conservatrice.
 * `seulement` (des `script` de `GENERATORS`) restreint la mesure aux entrées de ces générateurs ; un
 * membre SANS entrée fait régénérer, comme une mesure illisible (#2193).
 */
export function touchesDocSources(chemins, mesure, { seulement = null } = {}) {
  if (chemins === null || mesure === null) return true
  if (seulement && seulement.some((script) => !Object.hasOwn(mesure, script))) return true
  const fichiers = new Set()
  const dossiers = new Set()
  const sondes = new Set()
  const pathspecs = []
  for (const e of seulement ? seulement.map((script) => mesure[script]) : Object.values(mesure)) {
    for (const f of e.fichiers ?? []) fichiers.add(f)
    for (const c of e.cibles ?? []) fichiers.add(c)
    for (const d of e.dossiers ?? []) dossiers.add(d)
    for (const s of e.sondes ?? []) sondes.add(s.chemin)
    for (const requete of e.git ?? []) {
      const specs = pathspecsDeRequeteGit(requete)
      if (specs === null) return chemins.length > 0
      pathspecs.push(...specs)
    }
  }
  return chemins.some((brut) => {
    const chemin = brut.split('\\').join('/')
    return fichiers.has(chemin) || (!seulement && chemin.startsWith('docs/')) || ancetresDe(chemin).some((a) => dossiers.has(a)) ||
      [chemin, ...ancetresDe(chemin)].some((a) => sondes.has(a)) ||
      pathspecs.some((spec) => couvertParPathspec(chemin, spec))
  })
}

/**
 * Les générateurs que le lot peut périmer : ceux que `touchesDocSources` retient, puis la clôture DESCENDANTE
 * seule — un producteur retenu tire ses lecteurs. Un producteur NON retenu a des sorties fraîches
 * (cible absente → tous) : son lecteur ne le tire pas.
 */
export function selectionDesGenerateurs({ lot, mesure, cwd, generateurs = GENERATORS }) {
  const tous = (raison) => ({ scripts: generateurs.map((g) => g.script), complete: true, raison })
  if (lot === null) return tous('plage Git inconnue')
  if (lot.some((f) => LECTURES_DES_DEPENDANCES.includes(f))) return tous('toolchain modifiée : lectures des dépendances non mesurées')
  if (!mesure || generateurs.some((g) => !Array.isArray(mesure[g.script]?.fichiers) || !Array.isArray(mesure[g.script]?.dossiers) || !Array.isArray(mesure[g.script]?.cibles))) return tous('mesure absente ou incomplète')
  const outillage = fichiersDOutillage()
  if (lot.some((f) => GRAPHE_DE_SELECTION.includes(f) || outillage.has(f))) return tous('graphe ou outil de mesure modifié')
  if (generateurs.some((g) => mesure[g.script].cibles.some((c) => !existsSync(join(cwd, c))) ||
    ciblesLitterales([...g.targets, ...(g.injecte ?? [])]).some((c) => !existsSync(join(cwd, c))))) return tous('cible absente')
  const selection = new Set(generateurs.filter((g) => touchesDocSources(lot, mesure, { seulement: [g.script] })).map((g) => g.script))
  const sorties = (g) => [...g.targets, ...(g.injecte ?? [])]
  let changement = true
  while (changement) {
    const avant = selection.size
    for (const g of generateurs) {
      if (!selection.has(g.script) && generateurs.some((producteur) => selection.has(producteur.script) &&
        (mesure[g.script].fichiers.some((f) => sorties(producteur).some((c) => correspondGlob(f, c))) ||
          touchesDocSources(ciblesSurDisque(sorties(producteur), cwd), mesure, { seulement: [g.script] })))) selection.add(g.script)
    }
    changement = selection.size !== avant
  }
  return { scripts: generateurs.filter((g) => selection.has(g.script)).map((g) => g.script), complete: false, raison: 'sources mesurées et préalables' }
}
