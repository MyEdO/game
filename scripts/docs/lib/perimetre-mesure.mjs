// #1769
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cheminGit, cheminsIgnores, configurationDe, depotDe, nonSuivisIgnoresDe, politiqueExclusionsDe, racineDe } from '../../guards/lib/gitPorte.mjs'
import { cheminAbsent, listerArbre, listerDossier } from '../../guards/lib/lister.mjs'
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

const mesures = new Map()

/**
 * #2603 — Le périmètre précédent de la même racine se REPREND sans spawn de mesure quand il est
 * `fiable` (empreinte égale avant et après la mesure qui l'a produit et à celle de la mesure
 * précédente, repères et périmètre identiques aux siens) et que l'empreinte courante lui est égale ;
 * sinon, mesure fraîche.
 */
export function perimetreDeMesure(racine) {
  const cle = path.resolve(racine)
  const precedent = mesures.get(cle)
  const avant = precedent ? empreinteOuNull(racine, precedent.reperes) : null
  if (precedent?.fiable && avant === precedent.empreinte) return copie(precedent.perimetre)
  const { perimetre, reperes } = mesurer(racine)
  if (!reperes) {
    mesures.delete(cle)
    return perimetre
  }
  const apres = empreinteOuNull(racine, reperes)
  const fiable = apres !== null && avant === apres && precedent.empreinte === apres
    && JSON.stringify(precedent.reperes) === JSON.stringify(reperes) && formeDe(precedent.perimetre) === formeDe(perimetre)
  mesures.set(cle, { perimetre: copie(perimetre), reperes, empreinte: apres, fiable })
  return perimetre
}

const formeDe = (perimetre) => JSON.stringify([[...perimetre.ignores].sort(), perimetre.signature])

const copie = (perimetre) => ({ ...perimetre, ignores: new Set(perimetre.ignores), signature: structuredClone(perimetre.signature) })

function empreinteOuNull(racine, reperes) {
  try { return empreinteDuPerimetre(racine, reperes) } catch { return null }
}

/**
 * #2603 — Empreinte de CONTENU de toutes les entrées de `perimetreDeMesure` : environnement entier,
 * racine canonique, marqueurs `.git` des ancêtres et leur contenu, configuration brute, index,
 * `info/exclude`, fichier global, `.gitignore` des parents, et l'arbre (noms, natures, `.gitignore`)
 * hors des seuls dossiers que git ignore PAR MOTIF DE DOSSIER (`reperes.exclus`). Un `.git` sous la
 * racine (dépôt imbriqué) ou un lien dans l'arbre lève : leur contenu échappe à l'empreinte.
 */
function empreinteDuPerimetre(racine, reperes) {
  const h = createHash('sha256')
  const entree = (...champs) => h.update(`${JSON.stringify(champs)}\n`)
  entree('env', Object.entries(process.env).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
  entree('racine', canoniser(racine))
  for (const marqueur of marqueursGit(racine)) entree('.git', ...marqueur)
  entree('config', configurationDe(depotDe(racine)))
  entree('index', contenuDe(reperes.index, true))
  entree('exclude', reperes.exclude, contenuDe(reperes.exclude, true))
  entree('global', reperes.global, reperes.global && contenuDe(reperes.global, true))
  for (const rel of reperes.parents) entree('parent', rel, contenuDe(path.join(reperes.racineGit, rel)))
  const exclus = new Set(reperes.exclus)
  const marcher = (rel) => {
    for (const { nom, nature } of listerDossier(rel ? path.join(racine, rel) : racine, { absent: 'vide', avecTypes: true }).entrees) {
      const enfant = rel ? `${rel}/${nom}` : nom
      if (rel && nom.toLowerCase() === '.git') throw new Error(`dépôt imbriqué : ${enfant}`)
      if (nature === 'link') throw new Error(`lien dans l'arbre : ${enfant}`)
      entree('arbre', enfant, nature, nom.toLowerCase() === '.gitignore' ? contenuDe(path.join(racine, enfant)) : null)
      if (nature === 'directory' && !exclus.has(enfant)) marcher(enfant)
    }
  }
  marcher('')
  return h.digest('hex')
}

function contenuDe(chemin, suivre = false) {
  try {
    if (!suivre) {
      const stat = fs.lstatSync(chemin)
      if (stat.isSymbolicLink()) return { lien: fs.readlinkSync(chemin) }
      if (!stat.isFile()) return { nature: stat.isDirectory() ? 'directory' : 'other' }
    }
    return createHash('sha256').update(fs.readFileSync(chemin)).digest('hex')
  } catch (e) {
    if (cheminAbsent(e)) return null
    if (e.code === 'EISDIR') return { nature: 'directory' }
    throw e
  }
}

/** Marqueurs `.git` de la racine et de chaque ancêtre (forme lexicale et canonique) ; pour un
 *  dossier git qu'ils désignent, son `commondir`. git-scm.com/docs/gitrepository-layout */
function marqueursGit(racine) {
  const marqueurs = []
  const vus = new Set()
  const dossierGit = (dossier) => marqueurs.push([dossier, contenuDe(dossier, true), contenuDe(path.join(dossier, 'commondir'), true)])
  for (const depart of [path.resolve(racine), canoniser(racine)]) {
    for (let dossier = depart; ; dossier = path.dirname(dossier)) {
      const marqueur = path.join(dossier, '.git')
      if (!vus.has(marqueur)) {
        vus.add(marqueur)
        const contenu = contenuDe(marqueur)
        marqueurs.push([marqueur, contenu])
        if (contenu?.nature === 'directory') dossierGit(marqueur)
        else if (typeof contenu === 'string') {
          const pointeur = /^gitdir: *(.+?)\s*$/m.exec(fs.readFileSync(marqueur, 'utf8'))
          if (pointeur) dossierGit(path.resolve(dossier, pointeur[1]))
        }
      }
      if (path.dirname(dossier) === dossier) break
    }
  }
  return marqueurs
}

function mesurer(racine) {
  const base = canoniser(racine)
  const depot = depotDe(racine)
  const racineGit = racineDe(depot)
  if (racineGit !== null) {
    const brut = ignoresGit(base)
    const dossiers = [...brut].filter((rel) => fs.lstatSync(path.join(racine, rel)).isDirectory())
    const parMotif = [...cheminsIgnores(depot, dossiers.map((rel) => `${rel}/`))].map((rel) => rel.replace(/\/$/, ''))
    const { signature, reperes } = signatureGit(racine, base, depot, parMotif, racineGit)
    return {
      perimetre: { nature: 'git', ignores: new Set([...brut, ...EXCLUSIONS_FIXES]), signature },
      reperes: { ...reperes, index: path.resolve(racine, cheminGit(depot, 'index')) },
    }
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
  return { perimetre: { nature: 'physique', ignores: new Set(EXCLUSIONS_FIXES), signature: { nature: 'physique', exclusions: EXCLUSIONS_FIXES } }, reperes: null }
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

function signatureGit(racine, base, depot, parMotif, racineGit) {
  const gitCanonique = canoniser(racineGit)
  const prefixe = relatifSousRacine(gitCanonique, racine)
  if (prefixe === null) throw new Error('racine mesurée hors dépôt Git')
  const dossiersExclus = new Set([...EXCLUSIONS_FIXES, ...parMotif])
  const fichiers = listerArbre(racine, {
    filtre: (rel) => path.posix.basename(rel) === '.gitignore',
    descendre: (rel) => dansLaMesure(rel, dossiersExclus),
  })
  const politique = politiqueExclusionsDe(depot)
  const regles = [...new Set(['.gitignore', ...fichiers])].sort().map((rel) => {
    const chemin = path.join(racine, rel)
    return [prefixe ? `${prefixe}/${rel}` : rel, hashPolitique(chemin, true, base, rel)]
  })
  const parents = []
  for (let parent = path.posix.dirname(prefixe); prefixe && parent !== '.'; parent = path.posix.dirname(parent)) parents.push(`${parent}/.gitignore`)
  if (prefixe) parents.push('.gitignore')
  for (const rel of parents) regles.push([rel, hashPolitique(path.join(racineGit, rel), true, gitCanonique, rel)])
  const excludeEffectif = politique.exclude.chemin
  return {
    signature: {
      nature: 'git', exclusions: EXCLUSIONS_FIXES,
      fichiers: regles.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
      exclude: { chemin: canoniser(excludeEffectif), hash: hashPolitique(excludeEffectif) },
      global: { ...politique.global, hash: politique.global.chemin ? hashPolitique(politique.global.chemin) : null },
    },
    reperes: { racineGit, parents, exclus: ['.git', ...parMotif].sort(), exclude: excludeEffectif, global: politique.global.chemin },
  }
}
