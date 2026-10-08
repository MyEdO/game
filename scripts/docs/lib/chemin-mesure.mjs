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
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

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
  const sortie = execFileSync(
    'git',
    ['-c', 'core.quotepath=false', 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
    { cwd: racine, encoding: 'utf8', maxBuffer: 1 << 28 },
  )
  return new Set(sortie.split('\0').filter(Boolean).map((p) => p.replace(/\/$/, '')))
}

/**
 * Le chemin RELATIF POSIX (`relatifSousRacine`) entre-t-il dans la mesure ? Non s'il est ignoré par
 * git (`ignoresGit`), lui ou l'un de ses dossiers parents, ni s'il est sous `.git` — le dépôt lui-même,
 * que `ls-files` ne rend jamais. SEULE décision du périmètre : fichier lu, dossier listé et entrée de
 * listing passent tous ici.
 */
export function dansLaMesure(rel, ignores) {
  if (rel === '.git' || rel.startsWith('.git/')) return false
  for (let fin = rel.length; fin > 0; fin = rel.lastIndexOf('/', fin - 1)) if (ignores.has(rel.slice(0, fin))) return false
  return true
}

export const CONTRATS_DE_DERIVATION = [{ fonction: ancetreExistant, lectures: 'corpus' }, { fonction: canoniser, lectures: 'corpus' }]
