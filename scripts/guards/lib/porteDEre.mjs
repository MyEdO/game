// LA PORTE D'UNE ÈRE : le code d'une porte tel que le tronc le portait quand un commit l'a quitté (#2503).
//
// L'ÈRE d'un commit est `merge-base` de ce commit avec le tronc que sa plage EXCLUT (`debut` d'un push
// vers le tronc, `TRONC.suivi` sinon) : l'arbre du tronc qu'il connaît, jamais son arbre propre (une
// branche qui affaiblit la porte en c1 se jugerait elle-même en c2). Seule une FENÊTRE, qui n'exclut
// que `debut`, voit un commit déjà sur `TRONC.suivi` être sa propre ère.
// La porte de l'ère est CHARGÉE depuis cet arbre : sa fermeture d'imports (`clotureDImports`, dynamiques
// comprises) y est lue par `lireEnLot` ; identique à celle du disque de `racine`, c'est le module qui
// tourne déjà ; sinon des HOOKS DE CHARGEMENT (`registerHooks`, `ereSousLesUrlsDuDepot`) la servent sous
// les URL du dépôt marquées `?ere=<sha>`. `import.meta.url` d'un module d'ère est donc l'URL réelle du
// dépôt plus la requête, que `fileURLToPath` ignore : toute racine qui en dérive (`RACINE` de
// `bindingsVivants.mjs`, `sourceCorpus.mjs`, `RACINE_DU_CODE`) reste celle du dépôt, et un spécificateur
// nu (`typescript`) s'y résout.
//
// Une ère SANS la porte au chemin de `module` (base antérieure à la porte, porte déplacée), une porte qui
// ne se charge pas, à qui manque un export, ou dont la sonde de VIE échoue : `juge` nul et une NOTE,
// l'appelant juge par la porte actuelle et rend la note. Aucun commit n'échappe à toute porte.
// L'arbre de l'ère se lit chemin par chemin (`lireEnLot`), jamais listé en entier.
//
// Limites (#2503) :
// - une branche de base ancienne garde la sémantique de sa base jusqu'à sa prochaine fusion du tronc :
//   celle de son pre-commit, sous laquelle ses commits ont été acceptés ;
// - le budget mesure l'ère contre `merge_group.base_sha` (file empilée), le tronc que SA plage exclut
//   (`budget-contexte.mjs`, `controlerBudgetDeLaPlage`).
import { createHash } from 'node:crypto'
import { registerHooks } from 'node:module'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baseCommune, lireEnLot } from './gitPorte.mjs'
import { clotureDImports } from './importGraph.mjs'
import { parUnitesDeCode } from './lister.mjs'

/** La racine du code qui tourne. */
const RACINE_DU_CODE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Le chemin POSIX de `url` relatif à `racine` : le `module` d'une porte, nommé par son propre code. */
export const cheminDuModule = (url, racine = RACINE_DU_CODE) => relative(racine, fileURLToPath(url)).split(sep).join('/')

/**
 * L'ère de `sha` : sa base commune avec `tronc`, le tronc que la plage exclut ; `null` s'il est illisible.
 * @param {import('./gitPorte.mjs').Depot} depot @param {string} sha @param {string} tronc @returns {string | null}
 */
export const ereDuCommit = (depot, sha, tronc) => baseCommune(depot, sha, tronc)

/** Empreinte d'une fermeture `[chemin, texte][]`. */
const empreinteDe = (textes) => createHash('sha256').update(JSON.stringify([...textes].sort(([a], [b]) => parUnitesDeCode(a, b)))).digest('hex')

/**
 * La fermeture d'imports de `module` sur le disque de `racine` : `[chemin, texte][]`, chaque texte tel que
 * `clotureDImports` l'a lu pour l'analyser (`specificateurs.ecrire`) ; `null` pour un membre qui n'est pas un
 * module.
 * @param {string} module @param {string} [racine] @returns {[string, string | null][]}
 */
export function fermetureSurDisque(module, racine = RACINE_DU_CODE) {
  const base = resolve(racine).split(sep).join('/')
  /** @type {Map<string, string>} */
  const lus = new Map()
  const membres = clotureDImports([module], { racine, dynamiques: true, specificateurs: { lire: () => undefined, ecrire: (abs, texte) => lus.set(abs, texte) } })
  return [...membres].map((rel) => [rel, lus.get(`${base}/${rel}`) ?? null])
}

/** @type {Map<string, string>} */
const fermeturesDuDisque = new Map()

/** L'empreinte de la fermeture de `module` sur le disque de `racine`, mémoïsée : le code qui tourne ne change pas. */
function fermetureDuDisque(racine, module) {
  const cle = `${racine}\0${module}`
  if (!fermeturesDuDisque.has(cle)) fermeturesDuDisque.set(cle, empreinteDe(fermetureSurDisque(module, racine)))
  return fermeturesDuDisque.get(cle)
}

/** La fermeture de `module` dans l'arbre `ere` de `depot` : `null` si `module` n'y est pas. Chaque texte se
 *  lit par `lireEnLot`, à la première question de la fermeture sur son chemin. */
function fermetureDeLEre(depot, ere, racine, module) {
  const base = resolve(racine).split(sep).join('/')
  const rel = (abs) => (abs.startsWith(`${base}/`) ? abs.slice(base.length + 1) : null)
  const lus = new Map()
  const lu = (chemin) => {
    if (!lus.has(chemin)) for (const [c, texte] of lireEnLot(depot, ere, [chemin])) lus.set(c, texte)
    return lus.get(chemin) ?? null
  }
  if (lu(module) === null) return null
  const membres = clotureDImports([module], {
    racine,
    dynamiques: true,
    arbre: {
      existe: (abs) => rel(abs) !== null && lu(rel(abs)) !== null,
      lire: (abss) => new Map(abss.map((abs) => [abs, lu(rel(abs))])),
    },
  })
  return [...membres].map((m) => [m, lu(m)])
}

/** Les textes servis, par ère : `ere` → (chemin absolu → texte). @type {Map<string, Map<string, string>>} */
const TEXTES_DES_ERES = new Map()

/** Le format de chargement d'un membre d'ère, par son extension (`"type": "module"` du dépôt). */
const FORMATS = Object.freeze({ '.mjs': 'module', '.js': 'module', '.ts': 'module-typescript', '.mts': 'module-typescript', '.json': 'json' })

/** L'ère d'une URL `file:` marquée, `null` sinon. */
const ereDeLUrl = (url) => (url?.startsWith('file:') ? new URL(url).searchParams.get('ere') : null)

/** Un spécificateur qui désigne un FICHIER (relatif, absolu, `file:`), par opposition à un nu. */
const estUnFichier = (specificateur) => /^(?:file:|\.{1,2}\/|\/)/.test(specificateur)

/** Le texte de `url` dans son ère, ou l'erreur qui le nomme : jamais le disque. */
function texteDeLEre(url, ere) {
  const chemin = fileURLToPath(url)
  const texte = TEXTES_DES_ERES.get(ere)?.get(chemin)
  if (texte === undefined) throw new Error(`\`${chemin}\` absent de l'arbre de l'ère ${ere.slice(0, 9)}`)
  return texte
}

/** Les hooks, posés une fois par processus : ils ne servent QUE les URL marquées `?ere=<sha>`. Une
 *  cible de fichier se résout par l'URL de son parent marqué (la résolution par défaut exige le fichier
 *  sur le disque) ; un spécificateur nu se résout depuis l'URL réelle, donc le `node_modules` du dépôt. */
let hooksPoses = false
function ereSousLesUrlsDuDepot() {
  if (hooksPoses) return
  hooksPoses = true
  registerHooks({
    resolve(specificateur, contexte, suivant) {
      const ere = ereDeLUrl(specificateur.startsWith('file:') ? specificateur : null) ?? ereDeLUrl(contexte.parentURL)
      if (!ere) return suivant(specificateur, contexte)
      if (!estUnFichier(specificateur)) return suivant(specificateur, { ...contexte, parentURL: contexte.parentURL.split('?')[0] })
      const url = new URL(specificateur, contexte.parentURL)
      url.search = `?ere=${ere}`
      texteDeLEre(url.href, ere)
      return { url: url.href, shortCircuit: true }
    },
    load(url, contexte, suivant) {
      const ere = ereDeLUrl(url)
      if (!ere) return suivant(url, contexte)
      const extension = extname(fileURLToPath(url))
      if (!FORMATS[extension]) throw new Error(`\`${fileURLToPath(url)}\` : extension \`${extension}\` sans format de chargement d'ère`)
      return { format: FORMATS[extension], source: texteDeLEre(url, ere), shortCircuit: true }
    },
  })
}

/** Sert la fermeture `textes` de l'ère `ere` sous les URL de `racine` ; rend l'URL marquée d'un membre. */
function servirLEre(ere, racine, textes) {
  ereSousLesUrlsDuDepot()
  if (!TEXTES_DES_ERES.has(ere)) TEXTES_DES_ERES.set(ere, new Map())
  const servis = TEXTES_DES_ERES.get(ere)
  for (const [rel, texte] of textes) if (texte !== null) servis.set(join(racine, rel), texte)
  return (rel) => `${pathToFileURL(join(racine, rel)).href}?ere=${ere}`
}

/** @type {WeakMap<Function, Map<string, Promise<object>>>} */
const memoParVie = new WeakMap()

/**
 * Le juge de l'ère `ere` : le module `module` de son arbre, ses `exports` vérifiés, sa `vie` sondée.
 * `vie({ module, charger })` rend vrai si la porte vit ; `charger(rel)` importe un membre de la même
 * fermeture. Mémoïsé par ère dans le processus.
 * @param {import('./gitPorte.mjs').Depot} depot @param {string} ere
 * @param {{ racine?: string, module: string, exports: string[], vie: (p: { module: object, charger: (rel: string) => Promise<object> }) => unknown | Promise<unknown> }} porte
 * @returns {Promise<{ juge: object | null, note: string | null, source: 'disque' | 'arbre' | null }>}
 */
export function jugeDeLEre(depot, ere, { racine = RACINE_DU_CODE, module, exports, vie }) {
  if (!memoParVie.has(vie)) memoParVie.set(vie, new Map())
  const memo = memoParVie.get(vie)
  const cle = JSON.stringify([racine, module, exports, ere])
  if (!memo.has(cle)) memo.set(cle, chargerLaPorte(depot, ere, { racine, module, exports, vie }))
  return memo.get(cle)
}

/**
 * Les `commits` groupés par ÈRE (`ereDuCommit` contre `tronc`), chacun avec le juge de son ère
 * (`jugeDeLEre`, `porte`), dans l'ordre de première apparition : `[{ ere, commits, juge, note }]`.
 * `juge` nul : l'appelant juge par sa porte actuelle (ère sans la porte, non chargeable, ou tronc illisible,
 * que la note dit).
 * @template {{ sha: string }} C
 * @param {import('./gitPorte.mjs').Depot} depot @param {readonly C[]} commits @param {string} tronc
 * @param {Parameters<typeof jugeDeLEre>[2]} porte
 * @returns {Promise<{ ere: string | null, commits: C[], juge: object | null, note: string | null }[]>}
 */
export async function groupesParEre(depot, commits, tronc, porte) {
  /** @type {Map<string | null, C[]>} */
  const groupes = new Map()
  for (const c of commits) {
    const ere = ereDuCommit(depot, c.sha, tronc)
    groupes.set(ere, [...(groupes.get(ere) ?? []), c])
  }
  const rendus = []
  for (const [ere, groupe] of groupes) {
    const vu = ere
      ? await jugeDeLEre(depot, ere, porte)
      : { juge: null, note: `${groupe.map((c) => c.sha.slice(0, 9)).join(', ')} sans ère (tronc \`${tronc}\` illisible) : jugé(s) par la porte actuelle` }
    rendus.push({ ere, commits: groupe, juge: vu.juge, note: vu.note })
  }
  return rendus
}

async function chargerLaPorte(depot, ere, { racine, module, exports, vie }) {
  const ere9 = ere.slice(0, 9)
  const inchargeable = (raison) => ({ juge: null, note: `${ere9} non chargeable : ${raison}`, source: null })
  let textes
  try {
    textes = fermetureDeLEre(depot, ere, racine, module)
  } catch (e) {
    return inchargeable(`arbre illisible (${e.message})`)
  }
  if (!textes) return { juge: null, note: `${ere9} sans la porte \`${module}\` : jugé(s) par la porte actuelle`, source: null }
  const source = fermetureDuDisque(racine, module) === empreinteDe(textes) ? 'disque' : 'arbre'
  const urlDe = source === 'disque' ? (rel) => pathToFileURL(join(racine, rel)).href : servirLEre(ere, racine, textes)
  try {
    const charger = (rel) => import(urlDe(rel))
    const juge = await charger(module)
    const manquants = exports.filter((nom) => typeof juge[nom] !== 'function')
    if (manquants.length) return inchargeable(`export(s) absent(s) de \`${module}\` : ${manquants.join(', ')}`)
    if (!(await vie({ module: juge, charger }))) return inchargeable('sonde de vie négative')
    return { juge, note: null, source }
  } catch (e) {
    return inchargeable(e?.message ?? String(e))
  }
}
