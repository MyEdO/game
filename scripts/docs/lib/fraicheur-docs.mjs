import { createHash, randomUUID } from 'node:crypto'
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as gitPorte from '../../guards/lib/gitPorte.mjs'
import { correspondGlob, listerDossier } from '../../guards/lib/lister.mjs'
import { canoniser, dansLaMesure, ignoresGit, relatifSousRacine } from './chemin-mesure.mjs'
import { estUnDocMarkdown } from './ecriture-derives.mjs'

export const CACHE_FRAICHEUR = 'node_modules/.cache/docs-fraicheur.json'
const empreinte = (bytes) => createHash('sha256').update(bytes).digest('hex')
const egaux = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function nouvelleVue(racine) {
  return { racine, mesures: new Map() }
}

function dansVue(racine, vue, famille, cle, mesurer) {
  if (!vue) return mesurer()
  if (vue.racine !== racine) throw new Error('racine de vue différente')
  let mesures = vue.mesures.get(famille)
  if (!mesures) vue.mesures.set(famille, mesures = new Map())
  if (!mesures.has(cle)) mesures.set(cle, mesurer())
  return mesures.get(cle)
}

function cheminSous(racine, relatif, vue) {
  if (vue) return dansVue(racine, vue, 'chemin', relatif, () => cheminSous(racine, relatif))
  if (typeof relatif !== 'string' || relatif.includes('\\') || path.posix.isAbsolute(relatif)
    || relatif.split('/').some((p) => p === '..' || p === '.') || /^[a-z]:/i.test(relatif)) throw new Error('chemin de preuve invalide')
  const absolu = path.resolve(racine, relatif)
  if (relatifSousRacine(canoniser(racine), absolu) !== relatif) throw new Error('chemin de preuve hors racine')
  return absolu
}

function hashFichier(racine, rel, vue) {
  if (vue) return dansVue(racine, vue, 'hash', rel, () => hashFichier(racine, rel))
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

function entreeValide(racine, entree, vue) {
  if (!entree || !Array.isArray(entree.fichiers) || !Array.isArray(entree.dossiers) || !Array.isArray(entree.cibles)) throw new Error('mesure incomplète')
  for (const rel of [...entree.fichiers, ...entree.dossiers, ...entree.cibles]) cheminSous(racine, rel, vue)
  if (entree.incomplet?.length) throw new Error(`mesure non certifiable : ${entree.incomplet.join(', ')}`)
}

function listing(racine, rel, ignores, derivees = new Set()) {
  return listerDossier(cheminSous(racine, rel), { absent: 'vide' })
    .filter((nom) => { const chemin = rel ? `${rel}/${nom}` : nom; return derivees.has(chemin) || dansLaMesure(chemin, ignores) })
}

function sonde(racine, requete, vue) {
  if (vue) return dansVue(racine, vue, 'sonde', JSON.stringify(requete), () => sonde(racine, requete))
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

function contexte(racine, g, vue) {
  return {
    generateur: g,
    runtime: [process.version, process.platform, process.arch],
    outils: ['package.json', 'package-lock.json'].map((rel) => [rel, hashFichier(racine, rel, vue)]),
  }
}

function mesurerSources(racine, g, entree, options, vue) {
  entreeValide(racine, entree, vue)
  const ignores = dansVue(racine, vue, 'ignores', '', () => ignoresGit(racine))
  const fichiers = [...new Set([g.script, ...entree.fichiers])].sort()
  const dossiers = [...new Set(entree.dossiers)].sort()
  const motifs = options.generateurs.flatMap((g) => g.targets)
  const derivees = new Set(dansVue(racine, vue, 'cibles', JSON.stringify(motifs), () => options.ciblesSurDisque(motifs, racine)))
  const filtre = JSON.stringify([[...ignores], [...derivees]])
  return {
    contexte: contexte(racine, g, vue),
    fichiers: fichiers.map((rel) => [rel, hashFichier(racine, rel, vue)]),
    dossiers: dossiers.map((rel) => [rel, dansVue(racine, vue, 'listing', JSON.stringify([rel, filtre]), () => listing(racine, rel, ignores, derivees))]),
    git: (entree.git ?? []).map((q) => dansVue(racine, vue, 'git', JSON.stringify(q), () => gitPorte.relireRequeteMesuree(gitPorte.depotDe(racine), q))),
    sondes: (entree.sondes ?? []).map((q) => sonde(racine, q, vue)),
  }
}

function sortiesDe(racine, g, options, vue) {
  const motifs = [...g.targets, ...(g.injecte ?? [])]
  return [...new Set(dansVue(racine, vue, 'cibles', JSON.stringify(motifs), () => options.ciblesSurDisque(motifs, racine)))].sort()
}

function estDocPur(rel, options) {
  return estUnDocMarkdown(rel) && options.estCiblePure(rel, options.generateurs)
}

function mesurerSorties(racine, g, options, vue) {
  return sortiesDe(racine, g, options, vue).map((rel) => {
    const hash = hashFichier(racine, rel, vue)
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

export function enregistrerPreuve(racine, options, preparation, records, vue) {
  const cache = { version: 2, generateurs: { ...preparation.cache.generateurs } }
  const derniersEcrivains = new Map()
  for (const [script, record] of records) {
    const g = options.generateurs.find((g) => g.script === script)
    for (const [rel, hash] of record?.sorties ?? (g ? sortiesDe(racine, g, options, vue).map((rel) => [rel, null]) : [])) derniersEcrivains.set(rel, hash)
  }
  for (const [script, record] of records) {
    const g = options.generateurs.find((g) => g.script === script)
    const sorties = record && g ? mesurerSorties(racine, g, options, vue) : []
    const pures = (liste) => liste.filter(([rel]) => g.targets.some((motif) => correspondGlob(rel, motif)))
    if (record && g && recordValide(racine, g, options, record, { sorties: false, vue }).ok && egaux(pures(record.sorties), pures(sorties))
      && sorties.every(([rel, hash]) => derniersEcrivains.get(rel) === hash)) {
      cache.generateurs[script] = { ...record, sorties }
    } else delete cache.generateurs[script]
  }
  for (const script of Object.keys(cache.generateurs)) if (!options.generateurs.some((g) => g.script === script)) delete cache.generateurs[script]
  ecrirePreuve(racine, cache)
  return { ok: true, preuve: cache }
}

function recordValide(racine, g, options, record, { sorties = true, vue } = {}) {
  try {
    if (!record) return { ok: false, raison: 'certificat absent' }
    if (!egaux(record.sources, mesurerSources(racine, g, record.mesure, options, vue))) return { ok: false, raison: 'sources différentes' }
    if (sorties && !egaux(record.sorties, mesurerSorties(racine, g, options, vue))) return { ok: false, raison: 'sorties différentes' }
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

export function copierDocsFrais({ principal, cible, selecteur, apresPreparation, apresCopie, ...options }) {
  try {
    const head = gitPorte.shaDe(gitPorte.depotDe(principal), 'HEAD')
    if (head !== gitPorte.shaDe(gitPorte.depotDe(cible), 'HEAD')) return { ok: false, complete: true, raison: 'HEAD différents' }
    const cache = chargerPreuve(principal)
    if (!cache || options.generateurs.some((g) => !cache.generateurs[g.script])) return { ok: false, complete: true, raison: 'cache absent ou incomplet' }
    const hashCache = hashFichier(principal, CACHE_FRAICHEUR)
    const hashMesure = hashFichier(principal, options.sourcesLues)
    const mesureActuelle = lireMesure(principal, options)
    const mesure = {}
    const vuePrincipalAvant = nouvelleVue(principal)
    const sourcesAvant = new Map()
    const validitesPrincipales = new Map()
    const docsPurs = new Map()
    for (const g of options.generateurs) {
      const record = cache.generateurs[g.script]
      entreeValide(principal, record.mesure, vuePrincipalAvant)
      entreeValide(principal, mesureActuelle[g.script], vuePrincipalAvant)
      mesure[g.script] = record.mesure
      sourcesAvant.set(g.script, mesurerSources(principal, g, record.mesure, options, vuePrincipalAvant))
      for (const [rel, hash] of record.sorties.filter(([r]) => estDocPur(r, options))) {
        if (!existsSync(cheminSous(principal, rel))) return { ok: false, complete: true, raison: `doc absent : ${rel}` }
        const producteur = options.generateurDe(rel, options.generateurs)
        if (producteur.script === g.script) docsPurs.set(rel, { hash, producteur })
      }
      for (const rel of options.ciblesSurDisque(g.targets.filter(estUnDocMarkdown), principal)) {
        if (!existsSync(cheminSous(principal, rel))) return { ok: false, complete: true, raison: `doc absent : ${rel}` }
      }
    }
    invaliderPreuve(cible, options.generateurs.map((g) => g.script))
    const provisoires = new Map()
    for (const [rel, { hash, producteur }] of docsPurs) {
      if (existsSync(cheminSous(cible, rel))) continue
      if (!validitesPrincipales.has(producteur.script)) validitesPrincipales.set(producteur.script, recordValide(principal, producteur, options, cache.generateurs[producteur.script], { vue: vuePrincipalAvant }).ok)
      if (!validitesPrincipales.get(producteur.script)) continue
      if (hashFichier(principal, rel) !== hash) continue
      const destination = cheminSous(cible, rel)
      mkdirSync(path.dirname(destination), { recursive: true })
      copyFileSync(cheminSous(principal, rel), destination, constants.COPYFILE_EXCL)
      if (hashFichier(cible, rel) !== hash) return { ok: false, complete: true, raison: 'doc modifié pendant préparation' }
      provisoires.set(rel, hash)
    }
    apresPreparation?.()
    const vueCiblePreparee = nouvelleVue(cible)
    const graines = new Set()
    for (const g of options.generateurs) {
      const record = cache.generateurs[g.script]
      if (!recordValide(principal, g, options, record, { vue: vuePrincipalAvant }).ok || !recordValide(cible, g, options, record, { sorties: false, vue: vueCiblePreparee }).ok) graines.add(g.script)
      for (const [rel, hash] of record.sorties) {
        if (!estDocPur(rel, options) && hashFichier(cible, rel, vueCiblePreparee) !== hash) graines.add(g.script)
      }
    }
    const plan = selecteur({ lot: [], scriptsInitiaux: [...graines], mesure, cwd: principal, generateurs: options.generateurs })
    if (plan.complete) return { ok: false, complete: true, raison: plan.raison }
    const selection = new Set(plan.scripts)
    for (const [rel, hash] of provisoires) {
      if (!selection.has(options.generateurDe(rel, options.generateurs).script)) continue
      if (hashFichier(cible, rel) !== hash) return { ok: false, complete: true, raison: 'doc provisoire modifié avant retrait' }
      rmSync(cheminSous(cible, rel))
    }
    const copies = new Set()
    for (const [rel, { hash, producteur }] of docsPurs) {
      if (selection.has(producteur.script)) continue
      if (hashFichier(principal, rel) !== hash) return { ok: false, complete: true, raison: 'doc principal modifié pendant copie' }
      const destination = cheminSous(cible, rel)
      mkdirSync(path.dirname(destination), { recursive: true })
      copyFileSync(cheminSous(principal, rel), destination)
      copies.add(rel)
    }
    const records = new Map(options.generateurs.filter((g) => !selection.has(g.script)).map((g) => [g.script, cache.generateurs[g.script]]))
    mkdirSync(path.dirname(cheminSous(cible, options.sourcesLues)), { recursive: true })
    writeFileSync(cheminSous(cible, options.sourcesLues), JSON.stringify(mesure))
    apresCopie?.()
    const vuePrincipalFinale = nouvelleVue(principal)
    const vueCibleFinale = nouvelleVue(cible)
    if (hashFichier(principal, CACHE_FRAICHEUR) !== hashCache || hashFichier(principal, options.sourcesLues) !== hashMesure
      || gitPorte.shaDe(gitPorte.depotDe(principal), 'HEAD') !== head || gitPorte.shaDe(gitPorte.depotDe(cible), 'HEAD') !== head) {
      return { ok: false, complete: true, raison: 'preuve, mesure ou HEAD modifié pendant copie' }
    }
    for (const g of options.generateurs) {
      if (!egaux(sourcesAvant.get(g.script), mesurerSources(principal, g, cache.generateurs[g.script].mesure, options, vuePrincipalFinale))) {
        return { ok: false, complete: true, raison: 'source principale modifiée pendant copie' }
      }
    }
    for (const g of options.generateurs.filter((g) => !selection.has(g.script))) {
      const record = records.get(g.script)
      if (!recordValide(principal, g, options, record, { vue: vuePrincipalFinale }).ok || !recordValide(cible, g, options, record, { vue: vueCibleFinale }).ok) {
        return { ok: false, complete: true, raison: 'sources ou copies modifiées pendant copie' }
      }
    }
    const preparation = { cache: { version: 2, generateurs: {} } }
    enregistrerPreuve(cible, options, preparation, records, vueCibleFinale)
    return { ok: true, copies: copies.size, scriptsARegenerer: plan.scripts, complete: false, raison: plan.raison }
  } catch (e) { return { ok: false, complete: true, raison: e.message } }
}
