// #1769
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cheminsIgnores, depotDe, nonSuivisIgnoresDe, politiqueExclusionsDe, racineDe } from '../../guards/lib/gitPorte.mjs'
import { cheminAbsent, listerArbre } from '../../guards/lib/lister.mjs'
import { canoniser, dansLaMesure, EXCLUSIONS_FIXES, relatifSousRacine } from './chemin-mesure.mjs'
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
      if (cheminAbsent(erreur)) continue
      throw erreur
    }
    throw new Error('marqueur .git présent sans dépôt valide')
  }
  return { nature: 'physique', ignores: new Set(EXCLUSIONS_FIXES), signature: { nature: 'physique', exclusions: EXCLUSIONS_FIXES } }
}

function hashPolitique(chemin, sansSuivre = false, racineCanonique, relatifAttendu) {
  if (racineCanonique && relatifSousRacine(racineCanonique, path.dirname(chemin)) !== path.posix.dirname(relatifAttendu).replace(/^\.$/, ''))
    throw new Error(`politique hors racine : ${relatifAttendu}`)
  let stat
  try { stat = sansSuivre ? fs.lstatSync(chemin) : fs.statSync(chemin) } catch (e) {
    if (cheminAbsent(e)) return null
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
  const dossiers = [...ignores].filter((rel) => !EXCLUSIONS_FIXES.includes(rel) && fs.lstatSync(path.join(racine, rel)).isDirectory())
  const dossiersExclus = new Set([...EXCLUSIONS_FIXES, ...[...cheminsIgnores(depot, dossiers.map((rel) => `${rel}/`))].map((rel) => rel.replace(/\/$/, ''))])
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
