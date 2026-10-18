// FONCTIONS PURES de la stratification de la présentation (#2792) : rangement d'un chemin par les
// règles de `regles.mjs`, comptes de lignes, lecture du `git log --numstat`, imports relatifs d'un
// test et leur résolution, échantillon déterministe. Aucune ne touche le disque ni git : `sonde.mjs`
// les compose. Testées par `stratifier.test.mjs`.
import { posix } from 'node:path'

/**
 * Le rangement de `chemin` : la PREMIÈRE règle de `regles` dont le motif correspond gagne. Rend
 * `{ categorie, indice }` (plus `famille` pour une règle `douteux`), `null` si aucune ne correspond.
 * @param {string} chemin chemin relatif POSIX à la racine du dépôt
 * @param {ReadonlyArray<{ motif: RegExp, categorie: string, famille?: string }>} regles
 * @returns {{ categorie: string, famille?: string, indice: number } | null}
 */
export function ranger(chemin, regles) {
  const indice = regles.findIndex((r) => r.motif.test(chemin))
  if (indice < 0) return null
  const { categorie, famille } = regles[indice]
  return famille === undefined ? { categorie, indice } : { categorie, famille, indice }
}

/** La clé d'agrégation d'un rangement : la catégorie, ou `douteux:<famille>`. */
export const cleDe = (rang) => (rang.categorie === 'douteux' ? `douteux:${rang.famille}` : rang.categorie)

/** Le nombre de lignes de `texte` au sens de `wc -l` : le nombre de `\n`. */
export function compterLignes(texte) {
  let n = 0
  for (let i = texte.indexOf('\n'); i >= 0; i = texte.indexOf('\n', i + 1)) n++
  return n
}

/** Le marqueur de commit que `sonde.mjs` passe à `--format`, suivi du sha. */
export const MARQUEUR_COMMIT = '@@commit '

/**
 * Le chemin DESTINATION d'une ligne `--numstat` à renommage : `a/{b => c}/d` → `a/c/d`,
 * `a/{ => c}/d` → `a/c/d`, `a => b` → `b` ; un chemin sans renommage est rendu tel quel.
 */
export function cheminDestination(chemin) {
  const accolade = /\{([^{}]*) => ([^{}]*)\}/
  if (accolade.test(chemin)) return chemin.replace(accolade, (_, __, apres) => apres).replace(/\/{2,}/g, '/').replace(/^\//, '')
  const fleche = chemin.indexOf(' => ')
  return fleche < 0 ? chemin : chemin.slice(fleche + 4)
}

/**
 * La sortie de `git log --numstat --format=<MARQUEUR_COMMIT>%H` en commits. Une ligne binaire
 * (`-\t-\t<chemin>`) n'entre pas dans `fichiers` : elle va dans `binaires`. Les renommages sont
 * rendus sous leur chemin destination (`cheminDestination`).
 * @param {string} texte
 * @returns {{ sha: string, fichiers: { chemin: string, ajouts: number, suppressions: number }[], binaires: string[] }[]}
 */
export function lireNumstat(texte) {
  /** @type {{ sha: string, fichiers: { chemin: string, ajouts: number, suppressions: number }[], binaires: string[] }[]} */
  const commits = []
  for (const ligne of texte.split('\n')) {
    if (ligne.startsWith(MARQUEUR_COMMIT)) {
      commits.push({ sha: ligne.slice(MARQUEUR_COMMIT.length).trim(), fichiers: [], binaires: [] })
      continue
    }
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(ligne)
    if (!m) continue
    const courant = commits.at(-1)
    if (!courant) throw new Error(`ligne --numstat avant tout marqueur de commit : ${ligne}`)
    const chemin = cheminDestination(m[3])
    if (m[1] === '-' || m[2] === '-') courant.binaires.push(chemin)
    else courant.fichiers.push({ chemin, ajouts: Number(m[1]), suppressions: Number(m[2]) })
  }
  return commits
}

const SPEC = String.raw`['"\x60](\.{1,2}/[^'"\x60]*|\.{1,2})['"\x60]`
const FORMES_IMPORT = [
  new RegExp(String.raw`\bfrom\s*${SPEC}`, 'g'),
  new RegExp(String.raw`\bimport\s*\(\s*${SPEC}`, 'g'),
  new RegExp(String.raw`\bimport\s*${SPEC}`, 'g'),
  new RegExp(String.raw`\bvi\.mock\(\s*${SPEC}`, 'g'),
]

/**
 * Les spécificateurs RELATIFS (`./`, `../`) que `texte` importe, sans doublon, dans l'ordre
 * d'apparition : `import … from`, `export … from`, `import '…'`, `import(…)`, `vi.mock(…)`.
 * @param {string} texte
 * @returns {string[]}
 */
export function importsRelatifs(texte) {
  /** @type {{ at: number, spec: string }[]} */
  const trouves = []
  for (const forme of FORMES_IMPORT) for (const m of texte.matchAll(forme)) trouves.push({ at: m.index, spec: m[1] })
  return [...new Set(trouves.sort((a, b) => a.at - b.at).map((t) => t.spec))]
}

/**
 * Le fichier que `specifiant` (relatif) désigne depuis le fichier `depuis` : le chemin tel quel,
 * puis `.ts`, `.tsx`, `/index.ts`, `/index.tsx` — le premier que `existe` connaît ; `null` sinon.
 * Une requête Vite (`?raw`…) est retirée avant la résolution.
 * @param {string} depuis chemin relatif POSIX du fichier importeur
 * @param {string} specifiant
 * @param {(chemin: string) => boolean} existe
 * @returns {string | null}
 */
export function resoudreImport(depuis, specifiant, existe) {
  const base = posix.normalize(posix.join(posix.dirname(depuis), specifiant.replace(/\?.*$/, '')))
  for (const candidat of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (existe(candidat)) return candidat
  return null
}

/** Un PRNG mulberry32 seedé par l'entier `graine` : rend un flottant de [0, 1). */
function mulberry32(graine) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** L'entier 32 bits d'une graine texte (FNV-1a). */
function hacher(texte) {
  let h = 0x811c9dc5
  for (const c of texte) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0
  return h
}

/**
 * `n` chemins tirés SANS REMISE dans `chemins`, de façon DÉTERMINISTE pour une même `graine` et un
 * même ensemble de chemins (l'ordre d'entrée ne compte pas : les chemins sont triés d'abord). Tous si
 * `n` dépasse leur nombre. Rendus dans l'ordre du tirage.
 * @param {readonly string[]} chemins
 * @param {number} n
 * @param {string | number} graine
 * @returns {string[]}
 */
export function tirerEchantillon(chemins, n, graine) {
  const pool = [...new Set(chemins)].sort()
  const alea = mulberry32(hacher(String(graine)))
  const k = Math.min(n, pool.length)
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(alea() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, k)
}
