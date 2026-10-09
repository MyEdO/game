import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as gitPorte from '../../guards/lib/gitPorte.mjs'
import { correspondGlob, listerArbre, listerDossier } from '../../guards/lib/lister.mjs'
import { canoniser, dansLaMesure, perimetreDeMesure, projeterListingMesure, relatifSousRacine } from './chemin-mesure.mjs'
import { estUnDocMarkdown } from './ecriture-derives.mjs'
import { ecrireJsonAtomique } from '../../guards/lib/ecritureJsonAtomique.mjs'
import { clotureDImports } from '../../guards/lib/importGraph.mjs'

import { CACHE_FRAICHEUR } from './cache-fraicheur.mjs'
const empreinte = (bytes) => createHash('sha256').update(bytes).digest('hex')
const egaux = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const RACINE_OUTILLAGE = fileURLToPath(new URL('../../../', import.meta.url))

function mesurerOutillage(ancien) {
  if (ancien?.length && ancien.every(([rel, hash]) => hashFichier(RACINE_OUTILLAGE, rel) === hash)) return ancien
  const fichiers = clotureDImports(['scripts/docs/build-all.mjs', 'scripts/docs/lib/enregistreur-lectures.mjs', 'scripts/docs/lib/enregistreur-hooks.mjs'], { racine: RACINE_OUTILLAGE })
  return [...fichiers].sort().map((rel) => [rel, hashFichier(RACINE_OUTILLAGE, rel)])
}

export function nouvelleVue(racine, options, preuve = chargerPreuve(racine), mesures = lireMesure(racine, options, true), outillagePrecedent) {
  const entrees = Object.values({ ...mesures, ...Object.fromEntries(Object.entries(preuve?.generateurs ?? {}).map(([s, r]) => [s, r.mesure])) })
  const perimetre = perimetreDeMesure(racine)
  const ignores = perimetre.ignores
  const motifs = [options.generateurs.flatMap((g) => g.targets), ...options.generateurs.map((g) => [...g.targets, ...(g.injecte ?? [])])]
  const selections = new Map(motifs.map((m) => [JSON.stringify(m), m]))
  const cibles = new Map([...selections].map(([cle, m]) => [cle, options.ciblesSurDisque(m, racine)]))
  const fichiers = new Set(['package.json', 'package-lock.json', ...options.generateurs.map((g) => g.script), ...[...cibles.values()].flat(), ...entrees.flatMap((e) => e.fichiers ?? [])])
  const hashes = new Map([...fichiers].map((rel) => [rel, hashFichier(racine, rel)]))
  const listings = new Map([...new Set(entrees.flatMap((e) => e.dossiers ?? []))].map((rel) => [rel, listing(racine, rel)]))
  const requetes = new Map(entrees.flatMap((e) => (e.git ?? []).map((q) => [JSON.stringify(q), q])))
  const git = new Map([...requetes].map(([cle, q]) => [cle, gitPorte.relireRequeteMesuree(gitPorte.depotDe(racine), q)]))
  const demandes = new Map(entrees.flatMap((e) => (e.sondes ?? []).map((q) => [JSON.stringify(q), q])))
  const sondes = new Map([...demandes].map(([cle, q]) => [cle, sonde(racine, q)]))
  const outillage = mesurerOutillage(outillagePrecedent ?? Object.values(preuve?.generateurs ?? {})[0]?.sources?.contexte?.outillage)
  return { racine, hashes, listings, git, sondes, ignores, cibles, outillage, perimetre }
}

function cheminSous(racine, relatif) {
  if (typeof relatif !== 'string' || relatif.includes('\\') || path.posix.isAbsolute(relatif)
    || relatif.split('/').some((p) => p === '..' || p === '.') || /^[a-z]:/i.test(relatif)) throw new Error('chemin de preuve invalide')
  const absolu = path.resolve(racine, relatif)
  if (relatifSousRacine(canoniser(racine), absolu) !== relatif) throw new Error('chemin de preuve hors racine')
  return absolu
}

function hashFichier(racine, rel, vue) {
  if (vue) return vue.hashes.get(rel)
  const absolu = cheminSous(racine, rel)
  let stat
  try { stat = lstatSync(absolu) } catch (e) {
    if (['ENOENT', 'ENOTDIR'].includes(e.code)) return null
    throw e
  }
  if (!stat.isFile()) throw new Error(`fichier attendu : ${rel}`)
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

function listing(racine, rel) {
  return listerDossier(cheminSous(racine, rel), { absent: 'vide', avecTypes: true })
}

function sonde(racine, requete, vue) {
  if (vue) return vue.sondes.get(JSON.stringify(requete))
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
    outillage: vue?.outillage ?? mesurerOutillage(),
    perimetre: (vue?.perimetre ?? perimetreDeMesure(racine)).signature,
  }
}

function mesurerSources(racine, g, entree, options, vue) {
  entreeValide(racine, entree)
  const ignores = vue?.ignores ?? perimetreDeMesure(racine).ignores
  const motifs = options.generateurs.flatMap((g) => g.targets)
  const motifsDeclares = options.generateurs.flatMap((g) => [...g.targets, ...(g.injecte ?? [])])
  const derivees = new Set(vue ? vue.cibles.get(JSON.stringify(motifs)) : options.ciblesSurDisque(motifs, racine))
  const admis = (rel) => dansLaMesure(rel, ignores, derivees, motifsDeclares)
  const fichiers = [...new Set([g.script, ...entree.fichiers.filter(admis)])].sort()
  const dossiers = [...new Set(entree.dossiers.filter(admis))].sort()
  return {
    contexte: contexte(racine, g, vue),
    fichiers: fichiers.map((rel) => [rel, hashFichier(racine, rel, vue)]),
    dossiers: dossiers.map((rel) => [rel, projeterListingMesure(rel, vue ? vue.listings.get(rel) : listing(racine, rel), ignores, derivees, [...g.targets, ...(g.injecte ?? [])], motifsDeclares)]),
    git: (entree.git ?? []).map((q) => vue ? vue.git.get(JSON.stringify(q)) : gitPorte.relireRequeteMesuree(gitPorte.depotDe(racine), q)),
    sondes: (entree.sondes ?? []).filter((q) => admis(q.chemin)).map((q) => sonde(racine, q, vue)),
  }
}

function sortiesDe(racine, g, options, vue) {
  const motifs = [...g.targets, ...(g.injecte ?? [])]
  return [...new Set(vue ? vue.cibles.get(JSON.stringify(motifs)) : options.ciblesSurDisque(motifs, racine))].sort()
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
  ecrireJsonAtomique(cheminSous(racine, CACHE_FRAICHEUR), preuve)
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
  const perimetre = perimetreDeMesure(racine)
  const ignores = perimetre.ignores
  const motifsDeclares = options.generateurs.flatMap((g) => [...g.targets, ...(g.injecte ?? [])])
  const chemins = new Set(perimetre.nature === 'git'
    ? [...gitPorte.listerImage(depot, gitPorte.INDEX), ...gitPorte.listerImage(depot, gitPorte.TRAVAIL)].filter((rel) => dansLaMesure(rel, ignores, new Set(), motifsDeclares))
    : listerArbre(racine, { filtre: (rel) => dansLaMesure(rel, ignores, new Set(), motifsDeclares), descendre: (rel) => dansLaMesure(rel, ignores, new Set(), motifsDeclares) }))
  for (const g of options.generateurs) {
    for (const rel of sortiesDe(racine, g, options)) chemins.add(rel)
    for (const rel of mesure[g.script]?.fichiers ?? []) chemins.add(rel)
  }
  const dossiers = new Set([''])
  const fichiers = new Set()
  const natures = new Map()
  for (const rel of chemins) {
    let stat
    let prefixe = ''
    let sousLien = false
    const segments = rel.split('/')
    for (const [rang, segment] of segments.entries()) {
      prefixe = prefixe ? `${prefixe}/${segment}` : segment
      if (!natures.has(prefixe)) {
        let nature = null
        try { nature = lstatSync(path.join(racine, prefixe)) } catch (e) {
          if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw e
        }
        natures.set(prefixe, nature)
      }
      stat = natures.get(prefixe)
      if (stat?.isSymbolicLink()) { sousLien = true; break }
      if (rang < segments.length - 1) dossiers.add(prefixe)
    }
    if (sousLien) continue
    if (!stat || stat.isFile()) fichiers.add(rel)
    if (stat?.isDirectory()) dossiers.add(rel)
  }
  for (const e of Object.values(mesure)) for (const rel of e.dossiers ?? []) dossiers.add(rel)
  const vue = nouvelleVue(racine, options, cache)
  return {
    cache,
    mesure,
    vue,
    fichiers: new Map([...fichiers].map((rel) => [rel, vue.hashes.has(rel) ? vue.hashes.get(rel) : hashFichier(racine, rel)])),
    dossiers: new Map([...dossiers].map((rel) => [rel, vue.listings.has(rel) ? structuredClone(vue.listings.get(rel)) : listing(racine, rel)])),
  }
}

export function avantGenerateur(racine, g, options, preparation) {
  const entree = preparation.mesure[g.script]
  const vue = nouvelleVue(racine, options, null, entree ? { [g.script]: entree } : {}, preparation.vue.outillage)
  const initial = contexte(racine, g, preparation.vue)
  const actuel = contexte(racine, g, vue)
  for (const champ of Object.keys(initial)) if (!egaux(initial[champ], actuel[champ])) throw new Error(`contexte modifié depuis préparation : ${champ}`)
  return { contexte: actuel, preparation, baseline: { fichiers: new Map(preparation.fichiers), dossiers: new Map([...preparation.dossiers].map(([rel, snapshot]) => [rel, { nature: snapshot.nature, entrees: snapshot.entrees.map(({ nom, nature }) => ({ nom, nature })) }])), ignores: new Set(vue.ignores), derivees: new Set(options.ciblesSurDisque(options.generateurs.flatMap((g) => g.targets), racine)) } }
}

export function certifierGenerateur(racine, g, entree, options, avant) {
  try {
    const preuve = { version: 2, generateurs: { [g.script]: { mesure: entree, sources: { contexte: avant.contexte } } } }
    const vue = nouvelleVue(racine, options, preuve, {})
    const sources = mesurerSources(racine, g, entree, options, vue)
    if (!egaux(sources.contexte, avant.contexte)) throw new Error('outillage modifié pendant génération')
    const anciensFichiers = avant.baseline.fichiers
    const anciensDossiers = avant.baseline.dossiers
    const motifsDeclares = options.generateurs.flatMap((g) => [...g.targets, ...(g.injecte ?? [])])
    for (const [rel, hash] of sources.fichiers) {
      if (!anciensFichiers.has(rel) || anciensFichiers.get(rel) !== hash) throw new Error(`source modifiée ou non capturée : ${rel}`)
    }
    for (const [rel, noms] of sources.dossiers) {
      const propres = [...g.targets, ...(g.injecte ?? [])]
      if (!anciensDossiers.has(rel) || !egaux(projeterListingMesure(rel, anciensDossiers.get(rel), avant.baseline.ignores, avant.baseline.derivees, propres, motifsDeclares), noms)) throw new Error(`listing modifié ou non capturé : ${rel}`)
    }
    const deriveesMesurees = new Set(options.ciblesSurDisque(options.generateurs.flatMap((g) => g.targets), racine))
    const sondesMesurees = (entree.sondes ?? []).filter((q) => dansLaMesure(q.chemin, vue.ignores, deriveesMesurees, motifsDeclares))
    if (!egaux(sources.git, entree.git ?? []) || !egaux(sources.sondes, sondesMesurees)) throw new Error('requête ou sonde modifiée pendant génération')
    const record = { mesure: entree, sources, sorties: mesurerSorties(racine, g, options, vue) }
    const finale = nouvelleVue(racine, options, preuve, {})
    if (!egaux(sources, mesurerSources(racine, g, entree, options, finale))) throw new Error('source modifiée pendant certification')
    const ignores = perimetreDeMesure(racine).ignores
    const derivees = new Set(options.ciblesSurDisque(options.generateurs.flatMap((g) => g.targets), racine))
    const parents = new Set()
    for (const [rel] of record.sorties) {
      let parent = path.posix.dirname(rel)
      while (parent !== '.') { parents.add(parent); parent = path.posix.dirname(parent) }
      parents.add('')
    }
    const listings = new Map([...parents].map((rel) => [rel, listing(racine, rel)]))
    const propres = [...g.targets, ...(g.injecte ?? [])]
    const observes = new Set(sources.dossiers.map(([rel]) => rel))
    const sortiesCertifiees = new Set(record.sorties.map(([rel]) => rel))
    const absentAvant = (rel) => {
      const capture = avant.baseline.dossiers.get(rel)
      if (capture) return capture.nature === 'absent'
      let enfant = path.posix.basename(rel)
      let parent = path.posix.dirname(rel)
      while (true) {
        if (parent === '.') parent = ''
        const snapshot = avant.baseline.dossiers.get(parent)
        if (snapshot) return snapshot.nature === 'absent' || (snapshot.nature === 'directory' && !snapshot.entrees.some((e) => e.nom === enfant))
        if (!parent) return false
        enfant = path.posix.basename(parent)
        parent = path.posix.dirname(parent)
      }
    }
    const validerStructure = (rel) => {
      if (observes.has(rel) || !absentAvant(rel)) throw new Error(`parent nouveau non structurel : ${rel}`)
      const snapshot = listings.get(rel) ?? listing(racine, rel)
      if (snapshot.nature !== 'directory' || !snapshot.entrees.length) throw new Error(`structure de sortie vide ou non répertoire : ${rel}`)
      for (const e of snapshot.entrees) {
        const chemin = rel ? `${rel}/${e.nom}` : e.nom
        if (e.nature === 'file' && sortiesCertifiees.has(chemin)) continue
        if (e.nature === 'directory' && [...sortiesCertifiees].some((p) => p.startsWith(`${chemin}/`))) { validerStructure(chemin); continue }
        throw new Error(`entrée non certifiée dans structure de sortie : ${chemin}`)
      }
      listings.set(rel, snapshot)
    }
    for (const [rel, actuel] of listings) {
      const precedent = avant.baseline.dossiers.get(rel)
      if (absentAvant(rel) && actuel.nature === 'directory' && !observes.has(rel)) { validerStructure(rel); continue }
      if (!precedent) throw new Error(`parent de sortie non capturé : ${rel}`)
      for (const e of precedent.entrees) {
        const chemin = rel ? `${rel}/${e.nom}` : e.nom
        if (e.nature === 'file' && !sortiesCertifiees.has(chemin) && avant.baseline.fichiers.has(chemin) && avant.baseline.fichiers.get(chemin) !== hashFichier(racine, chemin)) throw new Error(`source de parent modifiée : ${chemin}`)
      }
      const ancien = projeterListingMesure(rel, precedent, avant.baseline.ignores, avant.baseline.derivees, propres, motifsDeclares)
      const apres = projeterListingMesure(rel, actuel, ignores, derivees, propres, motifsDeclares)
      const noms = new Set(ancien.entrees.map((e) => e.nom))
      const nouveauxParents = new Set()
      if (!observes.has(rel)) for (const e of apres.entrees) {
        const chemin = rel ? `${rel}/${e.nom}` : e.nom
        if (!noms.has(e.nom) && e.nature === 'directory' && [...sortiesCertifiees].some((p) => p.startsWith(`${chemin}/`))) { validerStructure(chemin); nouveauxParents.add(e.nom) }
      }
      if (!egaux(ancien, { ...apres, entrees: apres.entrees.filter((e) => !nouveauxParents.has(e.nom)) })) throw new Error(`parent de sortie modifié ou non capturé : ${rel}`)
    }
    for (const [rel, hash] of record.sorties) avant.preparation.fichiers.set(rel, hash)
    for (const [rel, actuel] of listings) avant.preparation.dossiers.set(rel, actuel)
    return { ok: true, record }
  } catch (e) { return { ok: false, raison: e.message } }
}

export function enregistrerPreuve(racine, options, preparation, records, vue) {
  const cache = { version: 2, generateurs: { ...preparation.cache.generateurs } }
  vue ??= nouvelleVue(racine, options, { version: 2, generateurs: { ...cache.generateurs, ...Object.fromEntries([...records].filter(([, r]) => r)) } })
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

export function recordValide(racine, g, options, record, { sorties = true, vue } = {}) {
  try {
    if (!record) return { ok: false, raison: 'certificat absent' }
    vue ??= nouvelleVue(racine, options, { version: 2, generateurs: { [g.script]: record } })
    const sources = mesurerSources(racine, g, record.mesure, options, vue)
    for (const champ of ['contexte', 'fichiers', 'dossiers', 'git', 'sondes']) {
      if (egaux(record.sources[champ], sources[champ])) continue
      const precedent = record.sources[champ]
      const courant = sources[champ]
      const anciens = ['fichiers', 'dossiers'].includes(champ) ? new Map(precedent) : null
      const actuels = anciens && new Map(courant)
      const chemins = anciens ? [...new Set([...anciens.keys(), ...actuels.keys()])].filter((rel) => !egaux(anciens.get(rel), actuels.get(rel))) : []
      return { ok: false, raison: `sources différentes : ${champ}${chemins.length ? ` : ${chemins.join(', ')}` : ''}` }
    }
    if (sorties) {
      const actuelles = mesurerSorties(racine, g, options, vue)
      if (!egaux(record.sorties, actuelles)) {
        const anciennes = new Map(record.sorties)
        const presentes = new Map(actuelles)
        const chemins = [...new Set([...anciennes.keys(), ...presentes.keys()])].filter((rel) => anciennes.get(rel) !== presentes.get(rel))
        return { ok: false, raison: `sorties différentes : ${chemins.join(', ')}` }
      }
    }
    return { ok: true }
  } catch (e) { return { ok: false, raison: e.message } }
}

export function preuveValide(racine, options, preuve = chargerPreuve(racine)) {
  if (!preuve || options.generateurs.some((g) => !preuve.generateurs[g.script])) return { ok: false, raison: 'cache absent ou incomplet' }
  let vue
  try { vue = nouvelleVue(racine, options, preuve) } catch (e) { return { ok: false, raison: e.message } }
  for (const g of options.generateurs) {
    const vu = recordValide(racine, g, options, preuve.generateurs[g.script], { vue })
    if (!vu.ok) return { ...vu, script: g.script }
  }
  return { ok: true, preuve }
}

export function copierDocsFrais({ principal, cible, apresPreparation, apresCopie, ...options }) {
  try {
    const head = gitPorte.shaDe(gitPorte.depotDe(principal), 'HEAD')
    if (head !== gitPorte.shaDe(gitPorte.depotDe(cible), 'HEAD')) return { ok: false, complete: true, raison: 'HEAD différents' }
    const cache = chargerPreuve(principal)
    if (!cache) return { ok: false, complete: true, raison: 'cache absent' }
    const hashCache = hashFichier(principal, CACHE_FRAICHEUR)
    const hashMesure = hashFichier(principal, options.sourcesLues)
    lireMesure(principal, options)
    const mesure = lireMesure(cible, options, true)
    const cacheLocal = chargerPreuve(cible) ?? { version: 2, generateurs: {} }
    const vuePrincipalAvant = nouvelleVue(principal, options, cache)
    const sourcesAvant = new Map()
    const validitesPrincipales = new Map()
    const docsPurs = new Map()
    for (const g of options.generateurs) {
      const record = cache.generateurs[g.script]
      if (!record) continue
      entreeValide(principal, record.mesure)
      sourcesAvant.set(g.script, mesurerSources(principal, g, record.mesure, options, vuePrincipalAvant))
      const validite = recordValide(principal, g, options, record, { vue: vuePrincipalAvant }).ok
      validitesPrincipales.set(g.script, validite)
      if (!validite) continue
      for (const [rel, hash] of record.sorties.filter(([r]) => estDocPur(r, options))) {
        if (!existsSync(cheminSous(principal, rel))) return { ok: false, complete: true, raison: `doc absent : ${rel}` }
        const producteur = options.generateurDe(rel, options.generateurs)
        if (producteur.script === g.script) docsPurs.set(rel, { hash, producteur })
      }
    }
    const provisoires = new Map()
    for (const [rel, { hash, producteur }] of docsPurs) {
      if (existsSync(cheminSous(cible, rel))) continue
      if (!validitesPrincipales.get(producteur.script)) continue
      if (hashFichier(principal, rel) !== hash) continue
      const destination = cheminSous(cible, rel)
      invaliderPreuve(cible, [producteur.script])
      mkdirSync(path.dirname(destination), { recursive: true })
      copyFileSync(cheminSous(principal, rel), destination, constants.COPYFILE_EXCL)
      if (hashFichier(cible, rel) !== hash) return { ok: false, complete: true, raison: 'doc modifié pendant préparation' }
      provisoires.set(rel, hash)
    }
    apresPreparation?.()
    for (const [rel, hash] of provisoires) if (hashFichier(cible, rel) !== hash) return { ok: false, complete: true, raison: 'doc provisoire modifié avant retrait' }
    const vueCiblePreparee = nouvelleVue(cible, options, { version: 2, generateurs: { ...Object.fromEntries(Object.entries(cacheLocal.generateurs).map(([s, r]) => [`local:${s}`, r])), ...cache.generateurs } })
    const selection = new Set()
    const records = new Map()
    for (const g of options.generateurs) {
      const record = cache.generateurs[g.script]
      const local = cacheLocal.generateurs[g.script]
      if (recordValide(cible, g, options, local, { vue: vueCiblePreparee }).ok) {
        records.set(g.script, local)
        continue
      }
      if (!validitesPrincipales.get(g.script) || !recordValide(cible, g, options, record, { sorties: false, vue: vueCiblePreparee }).ok
        || record.sorties.some(([rel, hash]) => hashFichier(cible, rel, vueCiblePreparee) !== hash)) selection.add(g.script)
      else records.set(g.script, record)
    }
    for (const [rel, hash] of provisoires) {
      if (!selection.has(options.generateurDe(rel, options.generateurs).script)) continue
      if (hashFichier(cible, rel) !== hash) return { ok: false, complete: true, raison: 'doc provisoire modifié avant retrait' }
      rmSync(cheminSous(cible, rel))
    }
    const copies = new Set([...provisoires.keys()].filter((rel) => !selection.has(options.generateurDe(rel, options.generateurs).script)))
    for (const [rel, { hash, producteur }] of docsPurs) {
      if (selection.has(producteur.script)) continue
      if (records.get(producteur.script) !== cache.generateurs[producteur.script]) continue
      if (hashFichier(principal, rel) !== hash) return { ok: false, complete: true, raison: 'doc principal modifié pendant copie' }
      const destination = cheminSous(cible, rel)
      invaliderPreuve(cible, [producteur.script])
      mkdirSync(path.dirname(destination), { recursive: true })
      copyFileSync(cheminSous(principal, rel), destination)
      copies.add(rel)
    }
    for (const [script, record] of records) mesure[script] = record.mesure
    mkdirSync(path.dirname(cheminSous(cible, options.sourcesLues)), { recursive: true })
    writeFileSync(cheminSous(cible, options.sourcesLues), JSON.stringify(mesure))
    apresCopie?.()
    const vuePrincipalFinale = nouvelleVue(principal, options, cache)
    const vueCibleFinale = nouvelleVue(cible, options, { version: 2, generateurs: Object.fromEntries(records) })
    if (hashFichier(principal, CACHE_FRAICHEUR) !== hashCache || hashFichier(principal, options.sourcesLues) !== hashMesure
      || gitPorte.shaDe(gitPorte.depotDe(principal), 'HEAD') !== head || gitPorte.shaDe(gitPorte.depotDe(cible), 'HEAD') !== head) {
      return { ok: false, complete: true, raison: 'preuve, mesure ou HEAD modifié pendant copie' }
    }
    for (const g of options.generateurs) {
      if (!cache.generateurs[g.script]) continue
      if (!egaux(sourcesAvant.get(g.script), mesurerSources(principal, g, cache.generateurs[g.script].mesure, options, vuePrincipalFinale))) {
        return { ok: false, complete: true, raison: 'source principale modifiée pendant copie' }
      }
    }
    for (const g of options.generateurs.filter((g) => !selection.has(g.script))) {
      const record = records.get(g.script)
      if ((record === cache.generateurs[g.script] && !recordValide(principal, g, options, record, { vue: vuePrincipalFinale }).ok) || !recordValide(cible, g, options, record, { vue: vueCibleFinale }).ok) {
        return { ok: false, complete: true, raison: 'sources ou copies modifiées pendant copie' }
      }
    }
    const preparation = { cache: cacheLocal }
    enregistrerPreuve(cible, options, preparation, records, vueCibleFinale)
    return { ok: true, copies: copies.size, scriptsARegenerer: options.generateurs.filter((g) => selection.has(g.script)).map((g) => g.script), complete: false, raison: 'attestations par générateur' }
  } catch (e) { return { ok: false, complete: true, raison: e.message } }
}
