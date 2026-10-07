import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as gitPorte from '../../guards/lib/gitPorte.mjs'
import { correspondGlob, listerDossier } from '../../guards/lib/lister.mjs'
import { canoniser, dansLaMesure, ignoresGit, relatifSousRacine } from './chemin-mesure.mjs'
import { estUnDocMarkdown } from './ecriture-derives.mjs'

export const CACHE_FRAICHEUR = 'node_modules/.cache/docs-fraicheur.json'
const empreinte = (bytes) => createHash('sha256').update(bytes).digest('hex')
const egaux = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function cheminSous(racine, relatif) {
  if (typeof relatif !== 'string' || relatif.includes('\\') || path.posix.isAbsolute(relatif)
    || relatif.split('/').some((p) => p === '..' || p === '.') || /^[a-z]:/i.test(relatif)) throw new Error('chemin de preuve invalide')
  const absolu = path.resolve(racine, relatif)
  if (relatifSousRacine(canoniser(racine), absolu) !== relatif) throw new Error('chemin de preuve hors racine')
  return absolu
}

function hashFichier(racine, rel) {
  const absolu = cheminSous(racine, rel)
  if (!existsSync(absolu)) return null
  if (!statSync(absolu).isFile()) throw new Error(`fichier attendu : ${rel}`)
  return empreinte(readFileSync(absolu))
}

function lireMesure(racine, options, facultative = false) {
  let mesure
  try { mesure = JSON.parse(readFileSync(cheminSous(racine, options.sourcesLues), 'utf8')) } catch (e) {
    if (facultative && e.code === 'ENOENT') return {}
    throw e
  }
  if (!mesure || typeof mesure !== 'object' || Array.isArray(mesure)) throw new Error('mesure invalide')
  return mesure
}

function entreeValide(racine, entree) {
  if (!entree || !Array.isArray(entree.fichiers) || !Array.isArray(entree.dossiers) || !Array.isArray(entree.cibles)) throw new Error('mesure incomplète')
  for (const rel of [...entree.fichiers, ...entree.dossiers, ...entree.cibles]) cheminSous(racine, rel)
  if (entree.incomplet?.length) throw new Error(`mesure non certifiable : ${entree.incomplet.join(', ')}`)
}

function listing(racine, rel, ignores, derivees = new Set()) {
  return listerDossier(cheminSous(racine, rel), { absent: 'vide' })
    .filter((nom) => { const chemin = rel ? `${rel}/${nom}` : nom; return derivees.has(chemin) || dansLaMesure(chemin, ignores) })
}

function sonde(racine, requete) {
  const absolu = cheminSous(racine, requete.chemin)
  if (requete.type === 'exists') return { ...requete, existe: existsSync(absolu), nature: null }
  if (requete.type !== 'stat') throw new Error('type de sonde invalide')
  try {
    const stat = statSync(absolu)
    return { ...requete, existe: true, nature: stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : 'other' }
  } catch (e) {
    return { ...requete, existe: false, nature: null, ...(requete.code !== undefined ? { code: e.code } : {}) }
  }
}

function contexte(racine, g) {
  return {
    generateur: g,
    runtime: [process.version, process.platform, process.arch],
    outils: ['package.json', 'package-lock.json'].map((rel) => [rel, hashFichier(racine, rel)]),
  }
}

function mesurerSources(racine, g, entree, options) {
  entreeValide(racine, entree)
  const ignores = ignoresGit(racine)
  const fichiers = [...new Set([g.script, ...entree.fichiers])].sort()
  const dossiers = [...new Set(entree.dossiers)].sort()
  const derivees = new Set(options.ciblesSurDisque(options.generateurs.flatMap((g) => g.targets), racine))
  return {
    contexte: contexte(racine, g),
    fichiers: fichiers.map((rel) => [rel, hashFichier(racine, rel)]),
    dossiers: dossiers.map((rel) => [rel, listing(racine, rel, ignores, derivees)]),
    git: (entree.git ?? []).map((q) => gitPorte.relireRequeteMesuree(gitPorte.depotDe(racine), q)),
    sondes: (entree.sondes ?? []).map((q) => sonde(racine, q)),
  }
}

function sortiesDe(racine, g, options) {
  return [...new Set(options.ciblesSurDisque([...g.targets, ...(g.injecte ?? [])], racine))].sort()
}

function estDocPur(g, rel) {
  return estUnDocMarkdown(rel) && g.targets.some((motif) => correspondGlob(rel, motif))
}

function mesurerSorties(racine, g, options) {
  return sortiesDe(racine, g, options).map((rel) => {
    const hash = hashFichier(racine, rel)
    if (hash === null) throw new Error(`cible absente : ${rel}`)
    return [rel, hash]
  })
}

export function chargerPreuve(racine) {
  try {
    const cache = JSON.parse(readFileSync(cheminSous(racine, CACHE_FRAICHEUR), 'utf8'))
    return cache?.version === 2 && cache.generateurs && typeof cache.generateurs === 'object' ? cache : null
  } catch { return null }
}

function ecrirePreuve(racine, preuve) {
  const cible = cheminSous(racine, CACHE_FRAICHEUR)
  mkdirSync(path.dirname(cible), { recursive: true })
  const temporaire = `${cible}.${randomUUID()}.tmp`
  try { writeFileSync(temporaire, JSON.stringify(preuve)); renameSync(temporaire, cible) }
  finally { rmSync(temporaire, { force: true }) }
}

export function invaliderPreuve(racine, scripts) {
  const cache = chargerPreuve(racine)
  if (!cache) return
  for (const script of scripts) delete cache.generateurs[script]
  ecrirePreuve(racine, cache)
}

export function preparerPreuves(racine, options) {
  const cache = chargerPreuve(racine) ?? { version: 2, generateurs: {} }
  const mesure = lireMesure(racine, options, true)
  const depot = gitPorte.depotDe(racine)
  const chemins = new Set([...gitPorte.listerImage(depot, gitPorte.INDEX), ...gitPorte.listerImage(depot, gitPorte.TRAVAIL)])
  for (const g of options.generateurs) {
    for (const rel of sortiesDe(racine, g, options)) chemins.add(rel)
    for (const rel of mesure[g.script]?.fichiers ?? []) chemins.add(rel)
  }
  const ignores = ignoresGit(racine)
  const derivees = new Set(options.ciblesSurDisque(options.generateurs.flatMap((g) => g.targets), racine))
  const dossiers = new Set([''])
  for (const rel of chemins) {
    let parent = path.posix.dirname(rel)
    while (parent !== '.') { dossiers.add(parent); parent = path.posix.dirname(parent) }
  }
  for (const e of Object.values(mesure)) for (const rel of e.dossiers ?? []) dossiers.add(rel)
  return {
    cache,
    mesure,
    fichiers: new Map([...chemins].map((rel) => [rel, hashFichier(racine, rel)])),
    dossiers: new Map([...dossiers].map((rel) => [rel, listing(racine, rel, ignores, derivees)])),
  }
}

export function avantGenerateur(racine, g, options, preparation) {
  let connus
  try { connus = mesurerSources(racine, g, preparation.mesure[g.script], options) } catch { connus = null }
  return { connus, contexte: contexte(racine, g), preparation }
}

export function certifierGenerateur(racine, g, entree, options, avant) {
  try {
    const sources = mesurerSources(racine, g, entree, options)
    if (!egaux(sources.contexte, avant.contexte)) throw new Error('outillage modifié pendant génération')
    const anciensFichiers = new Map([...avant.preparation.fichiers, ...(avant.connus?.fichiers ?? [])])
    const anciensDossiers = new Map([...avant.preparation.dossiers, ...(avant.connus?.dossiers ?? [])])
    for (const [rel, hash] of sources.fichiers) {
      if (!anciensFichiers.has(rel) || anciensFichiers.get(rel) !== hash) throw new Error(`source modifiée ou non capturée : ${rel}`)
    }
    for (const [rel, noms] of sources.dossiers) {
      if (!anciensDossiers.has(rel) || !egaux(anciensDossiers.get(rel), noms)) throw new Error(`listing modifié ou non capturé : ${rel}`)
    }
    if (!egaux(sources.git, entree.git ?? []) || !egaux(sources.sondes, entree.sondes ?? [])) throw new Error('requête ou sonde modifiée pendant génération')
    const record = { mesure: entree, sources, sorties: mesurerSorties(racine, g, options) }
    if (!egaux(sources, mesurerSources(racine, g, entree, options))) throw new Error('source modifiée pendant certification')
    for (const [rel, hash] of record.sorties) avant.preparation.fichiers.set(rel, hash)
    const ignores = ignoresGit(racine)
    const derivees = new Set(options.ciblesSurDisque(options.generateurs.flatMap((g) => g.targets), racine))
    const parents = new Set()
    for (const [rel] of record.sorties) {
      let parent = path.posix.dirname(rel)
      while (parent !== '.') { parents.add(parent); parent = path.posix.dirname(parent) }
      parents.add('')
    }
    for (const rel of parents) avant.preparation.dossiers.set(rel, listing(racine, rel, ignores, derivees))
    return { ok: true, record }
  } catch (e) { return { ok: false, raison: e.message } }
}

export function enregistrerPreuve(racine, options, preparation, records) {
  const cache = { version: 2, generateurs: { ...preparation.cache.generateurs } }
  const derniersEcrivains = new Map()
  for (const [script, record] of records) {
    const g = options.generateurs.find((g) => g.script === script)
    for (const [rel, hash] of record?.sorties ?? (g ? sortiesDe(racine, g, options).map((rel) => [rel, null]) : [])) derniersEcrivains.set(rel, hash)
  }
  for (const [script, record] of records) {
    const g = options.generateurs.find((g) => g.script === script)
    const sorties = record && g ? mesurerSorties(racine, g, options) : []
    const pures = (liste) => liste.filter(([rel]) => g.targets.some((motif) => correspondGlob(rel, motif)))
    if (record && g && recordValide(racine, g, options, record, { sorties: false }).ok && egaux(pures(record.sorties), pures(sorties))
      && sorties.every(([rel, hash]) => derniersEcrivains.get(rel) === hash)) {
      cache.generateurs[script] = { ...record, sorties }
    } else delete cache.generateurs[script]
  }
  for (const script of Object.keys(cache.generateurs)) if (!options.generateurs.some((g) => g.script === script)) delete cache.generateurs[script]
  ecrirePreuve(racine, cache)
  return { ok: true, preuve: cache }
}

function recordValide(racine, g, options, record, { sorties = true } = {}) {
  try {
    if (!record) return { ok: false, raison: 'certificat absent' }
    if (!egaux(record.sources, mesurerSources(racine, g, record.mesure, options))) return { ok: false, raison: 'sources différentes' }
    if (sorties && !egaux(record.sorties, mesurerSorties(racine, g, options))) return { ok: false, raison: 'sorties différentes' }
    return { ok: true }
  } catch (e) { return { ok: false, raison: e.message } }
}

export function preuveValide(racine, options, preuve = chargerPreuve(racine)) {
  if (!preuve || options.generateurs.some((g) => !preuve.generateurs[g.script])) return { ok: false, raison: 'cache absent ou incomplet' }
  for (const g of options.generateurs) {
    const vu = recordValide(racine, g, options, preuve.generateurs[g.script])
    if (!vu.ok) return { ...vu, script: g.script }
  }
  return { ok: true, preuve }
}

export function copierDocsFrais({ principal, cible, selecteur, apresCopie, ...options }) {
  try {
    if (gitPorte.shaDe(gitPorte.depotDe(principal), 'HEAD') !== gitPorte.shaDe(gitPorte.depotDe(cible), 'HEAD')) return { ok: false, complete: true, raison: 'HEAD différents' }
    const cache = chargerPreuve(principal)
    if (!cache || options.generateurs.some((g) => !cache.generateurs[g.script])) return { ok: false, complete: true, raison: 'cache absent ou incomplet' }
    const mesureActuelle = lireMesure(principal, options)
    const mesure = {}
    const graines = new Set()
    for (const g of options.generateurs) {
      const record = cache.generateurs[g.script]
      entreeValide(principal, record.mesure)
      entreeValide(principal, mesureActuelle[g.script])
      for (const [rel] of record.sorties.filter(([r]) => estDocPur(g, r))) {
        if (!existsSync(cheminSous(principal, rel))) return { ok: false, complete: true, raison: `doc absent : ${rel}` }
      }
      mesure[g.script] = record.mesure
      for (const rel of options.ciblesSurDisque(g.targets.filter(estUnDocMarkdown), principal)) {
        if (!existsSync(cheminSous(principal, rel))) return { ok: false, complete: true, raison: `doc absent : ${rel}` }
      }
      if (!recordValide(principal, g, options, record).ok || !recordValide(cible, g, options, record, { sorties: false }).ok) graines.add(g.script)
      for (const [rel, hash] of record.sorties) {
        if (!estDocPur(g, rel)) {
          if (hashFichier(cible, rel) !== hash) graines.add(g.script)
        }
      }
    }
    const plan = selecteur({ lot: [], scriptsInitiaux: [...graines], mesure, cwd: principal, generateurs: options.generateurs })
    if (plan.complete) return { ok: false, complete: true, raison: plan.raison }
    const selection = new Set(plan.scripts)
    invaliderPreuve(cible, options.generateurs.map((g) => g.script))
    const records = new Map()
    let copies = 0
    for (const g of options.generateurs) {
      const record = cache.generateurs[g.script]
      if (selection.has(g.script)) continue
      for (const [rel] of record.sorties.filter(([r]) => estDocPur(g, r))) {
        const destination = cheminSous(cible, rel)
        mkdirSync(path.dirname(destination), { recursive: true })
        copyFileSync(cheminSous(principal, rel), destination)
        copies++
      }
      records.set(g.script, record)
    }
    mkdirSync(path.dirname(cheminSous(cible, options.sourcesLues)), { recursive: true })
    writeFileSync(cheminSous(cible, options.sourcesLues), JSON.stringify(mesure))
    apresCopie?.()
    for (const g of options.generateurs.filter((g) => !selection.has(g.script))) {
      const record = records.get(g.script)
      if (!recordValide(principal, g, options, record).ok || !recordValide(cible, g, options, record).ok) {
        return { ok: false, complete: true, raison: 'sources ou copies modifiées pendant copie' }
      }
    }
    const preparation = { cache: { version: 2, generateurs: {} } }
    enregistrerPreuve(cible, options, preparation, records)
    return { ok: true, copies, scriptsARegenerer: plan.scripts, complete: false, raison: plan.raison }
  } catch (e) { return { ok: false, complete: true, raison: e.message } }
}
