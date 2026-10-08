// Décision « ce chemin lu est-il sous la racine MESURÉE ? » (#1721) — module partagé par les
// deux volets de l'enregistreur de lectures (thread principal `enregistreur-lectures.mjs`, thread des
// hooks `enregistreur-hooks.mjs`).
//
// NTFS est INSENSIBLE À LA CASSE : `c:\…` et `C:\…`, ou un segment dont la casse diffère de celle de
// la racine, désignent le même fichier. Une comparaison d'octets (`abs.startsWith(base + sep)`)
// rejette ces lectures-là, et `docs/.sources-lues.json` perd des sources sans que rien ne le dise.
//
// Décision « ce chemin sous la racine entre-t-il dans la mesure ? » (#1769) — même feuille : la mesure
// est celle du plan GIT. Ce que git IGNORE (un `__pycache__` posé par un script Python, `node_modules`)
// n'est ni un fichier lu, ni un dossier listé, ni une entrée de listing : un clone propre ne l'a pas.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cheminsIgnores, depotDe, nonSuivisIgnoresDe, politiqueExclusionsDe, racineDe } from '../../guards/lib/gitPorte.mjs'
import { listerArbre } from '../../guards/lib/lister.mjs'
import { CACHE_FRAICHEUR } from './cache-fraicheur.mjs'

/** Ancêtre EXISTANT le plus proche d'un chemin absolu (lui-même s'il existe), ou `null` quand rien
 *  n'existe jusqu'à la racine (lecteur absent). */
export function ancetreExistant(abs, { strict = false } = {}) {
  let ancetre = abs
  while (true) {
    if (strict) {
      try { fs.statSync(ancetre); return ancetre }
      catch (e) {
        if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw new Error(`ancêtre illisible : ${ancetre} — ${e.code ?? e.message}`, { cause: e })
      }
    } else if (fs.existsSync(ancetre)) return ancetre
    const parent = path.dirname(ancetre)
    if (parent === ancetre) return null
    ancetre = parent
  }
}

/**
 * Forme CANONIQUE d'un chemin : `fs.realpathSync.native` rend la casse telle que le disque la porte
 * et suit jonctions et noms courts 8.3. Un chemin ABSENT du disque (le fichier d'un Write de
 * création) se canonise par son ancêtre EXISTANT le plus proche, le reste recollé tel quel : la
 * jonction traversée en amont est suivie quand même (#1973). Sans `strict`, une lecture illisible
 * garde la forme lexicale ; avec `strict`, seuls ENOENT et ENOTDIR permettent la remontée.
 *
 * DIRECTION de ce que suivre une jonction change : un fichier lu SOUS la racine par une jonction qui
 * pointe HORS d'elle devient un chemin hors racine — il est compté REJETÉ, pas retenu (mesuré sur une
 * jonction réelle). L'inverse tient aussi : la racine étant canonisée, un chemin atteint par une
 * jonction qui pointe DANS la racine y rentre.
 */
export function canoniser(chemin, { strict = false } = {}) {
  const abs = path.resolve(chemin)
  let ancetre = ancetreExistant(abs, { strict })
  while (ancetre !== null) {
    try { return path.join(fs.realpathSync.native(ancetre), path.relative(ancetre, abs)) }
    catch (e) {
      if (!strict) return abs
      if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw new Error(`canonisation physique illisible : ${ancetre} — ${e.code ?? e.message}`, { cause: e })
      const parent = path.dirname(ancetre)
      if (parent === ancetre) return abs
      ancetre = ancetreExistant(parent, { strict })
    }
  }
  return abs
}

/**
 * Chemin RELATIF POSIX du chemin lu sous la racine, `''` pour la racine elle-même, ou `null` quand
 * il est HORS racine (le seul cas qui compte comme rejet). La racine est attendue déjà canonique
 * (`canoniser` une fois à l'installation) : les deux formes se comparent alors sur la même base.
 * `canoniserChemin` s'injecte pour qu'un appelant qui mesure des milliers de lectures mémorise la
 * canonisation (un `realpathSync.native` est un appel système).
 */
export function relatifSousRacine(racineCanonique, chemin, canoniserChemin = canoniser) {
  const rel = path.relative(racineCanonique, canoniserChemin(chemin))
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null
  return rel.split(path.sep).join('/')
}

/**
 * Chemins IGNORÉS par git sous la racine, en UNE invocation : `--directory` rend un dossier ignoré en
 * entier sous son seul nom (`scripts/raw/lib/__pycache__`), sans descendre dedans. Un fichier SUIVI
 * n'y figure jamais, même s'il répond à un motif de `.gitignore`. Coût mesuré (2026-09-26, worktree,
 * Windows, 10 appels) : 56 à 693 ms selon la charge, d'où un seul appel par `docs:build`, transmis aux processus mesurés.
 */
export function ignoresGit(racine) {
  return nonSuivisIgnoresDe(depotDe(racine))
}

export function perimetreDeMesure(racine) {
  const base = canoniser(racine)
  const depot = depotDe(racine)
  const racineGit = racineDe(depot)
  if (racineGit !== null) {
    const ignores = new Set([...ignoresGit(base), ...EXCLUSIONS_FIXES])
    return { nature: 'git', ignores, signature: signatureGit(racine, base, depot, ignores, racineGit) }
  }
  const volume = path.resolve(base, path.sep)
  const segments = path.relative(volume, base).split(path.sep).filter(Boolean)
  const ancetres = [base, ...segments.map((_segment, i) => path.join(volume, ...segments.slice(0, segments.length - i - 1)))]
  for (const ancetre of ancetres) {
    try { fs.lstatSync(path.join(ancetre, '.git')) } catch (erreur) {
      if (erreur.code === 'ENOENT') continue
      throw erreur
    }
    throw new Error('marqueur .git présent sans dépôt valide')
  }
  return { nature: 'physique', ignores: new Set(EXCLUSIONS_FIXES), signature: { nature: 'physique', exclusions: EXCLUSIONS_FIXES } }
}

const EXCLUSIONS_FIXES = ['.git', 'node_modules', path.posix.dirname(CACHE_FRAICHEUR)].sort()

function hashPolitique(chemin, sansSuivre = false, racineCanonique, relatifAttendu) {
  if (racineCanonique && relatifSousRacine(racineCanonique, path.dirname(chemin)) !== path.posix.dirname(relatifAttendu).replace(/^\.$/, ''))
    throw new Error(`politique hors racine : ${relatifAttendu}`)
  let stat
  try { stat = sansSuivre ? fs.lstatSync(chemin) : fs.statSync(chemin) } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
  if (stat.isSymbolicLink()) return { lien: fs.readlinkSync(chemin) }
  if (racineCanonique && relatifSousRacine(racineCanonique, chemin) !== relatifAttendu) throw new Error(`politique hors racine : ${relatifAttendu}`)
  if (!stat.isFile()) throw new Error(`politique attendue dans un fichier : ${chemin}`)
  return createHash('sha256').update(fs.readFileSync(chemin)).digest('hex')
}

function signatureGit(racine, base, depot, ignores, racineGit) {
  const gitCanonique = canoniser(racineGit)
  const prefixe = relatifSousRacine(gitCanonique, racine)
  if (prefixe === null) throw new Error('racine mesurée hors dépôt Git')
  const dossiersExclus = new Set([...cheminsIgnores(depot, [...ignores].map((rel) => `${rel}/`))].map((rel) => rel.replace(/\/$/, '')))
  const fichiers = listerArbre(racine, {
    filtre: (rel) => path.posix.basename(rel) === '.gitignore',
    descendre: (rel) => dansLaMesure(rel, dossiersExclus),
  })
  const politique = politiqueExclusionsDe(depot)
  const regles = [...new Set(['.gitignore', ...fichiers])].sort().map((rel) => {
    const chemin = path.join(racine, rel)
    return [prefixe ? `${prefixe}/${rel}` : rel, hashPolitique(chemin, true, base, rel)]
  })
  for (let parent = path.posix.dirname(prefixe); prefixe && parent !== '.'; parent = path.posix.dirname(parent)) {
    const rel = `${parent}/.gitignore`
    const chemin = path.join(racineGit, rel)
    regles.push([rel, hashPolitique(chemin, true, gitCanonique, rel)])
  }
  if (prefixe) regles.push(['.gitignore', hashPolitique(path.join(racineGit, '.gitignore'), true, gitCanonique, '.gitignore')])
  const excludeEffectif = politique.exclude.chemin
  return {
    nature: 'git', exclusions: EXCLUSIONS_FIXES,
    fichiers: regles.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
    exclude: { chemin: canoniser(excludeEffectif), hash: hashPolitique(excludeEffectif) },
    global: { ...politique.global, hash: politique.global.chemin ? hashPolitique(politique.global.chemin) : null },
  }
}

/**
 * Le chemin RELATIF POSIX (`relatifSousRacine`) entre-t-il dans la mesure ? Non s'il est ignoré par
 * git (`ignoresGit`), lui ou l'un de ses dossiers parents, ni s'il est sous `.git` — le dépôt lui-même,
 * que `ls-files` ne rend jamais. SEULE décision du périmètre : fichier lu, dossier listé et entrée de
 * listing passent tous ici.
 */
export function dansLaMesure(rel, ignores, derivees = new Set()) {
  if (EXCLUSIONS_FIXES.some((p) => rel === p || rel.startsWith(`${p}/`))) return false
  if (derivees.has(rel) || [...derivees].some((p) => p.startsWith(`${rel}/`))) return true
  for (let fin = rel.length; fin > 0; fin = rel.lastIndexOf('/', fin - 1)) if (ignores.has(rel.slice(0, fin))) return false
  return true
}

export const CONTRATS_DE_DERIVATION = [{ fonction: ancetreExistant, lectures: 'corpus', retour: 'corpus' }, { fonction: canoniser, lectures: 'corpus', retour: 'corpus' }]
