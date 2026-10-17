// Enregistreur de LECTURES d'un générateur de doc dérivé (#1679 L1b) — préchargeur `node --import`,
// posé par `scripts/docs/build-all.mjs` dans `NODE_OPTIONS` pour que TOUT sous-processus node
// l'hérite (`build-donnees.mjs` et `build-codex-relations.mjs` lancent des dumpers tsx, qui eux-mêmes
// re-spawnent). Ce qu'un générateur lit se MESURE ici : aucune liste de sources n'est écrite à la
// main (doctrine `user-doctrine-gardes-schema-unique-manifeste`, 2026-08-23).
//
// `module.syncBuiltinESMExports()` est OBLIGATOIRE après l'enveloppement : les liaisons nommées d'un
// builtin ESM sont figées à l'instanciation du module, donc un `import { readFileSync } from
// 'node:fs'` déjà chargé continue d'appeler la fonction d'origine. Mesure du juge de design
// (2026-09-02) : 5 lectures capturées sans l'appel, 1 006 avec.
//
// Périmètre : chemins sous `WFRP_LECTURES_RACINE` qui entrent dans la mesure (`dansLaMesure`, sur
// l'ensemble `perimetreDeMesure().ignores` calculé une fois par l'appelant et passé en JSON par `WFRP_LECTURES_IGNORES`,
// #1769), hors les cibles écrites par le générateur (`WFRP_LECTURES_CIBLE`, séparées par des virgules — un
// générateur relit son propre .md en mode `--check`).
// Un `readdirSync` enregistre le DOSSIER et son listing trié, restreint à la mesure : un fichier ajouté au dossier
// change ce que le générateur AURAIT lu, sans qu'aucun contenu ne bouge.
//
// Les ÉCRITURES sont mesurées elles aussi : un fichier écrit par le générateur n'est pas une de ses
// sources (un doc ne peut pas dépendre de lui-même).
// Sortie : UN fichier par PID (`<WFRP_LECTURES_SORTIE>.<pid>.json`), écrit à la sortie du processus ;
// l'appelant fusionne le dossier (`fusionnerLectures`, `ecriture-derives.mjs`).
import fs from 'node:fs'
import childProcess from 'node:child_process'
import path from 'node:path'
import { register, syncBuiltinESMExports } from 'node:module'
import { fileURLToPath } from 'node:url'
import { isMainThread } from 'node:worker_threads'
import { canoniser, canoniseurParDossier, dansLaMesure, estPipeNomme, projeterListingMesure, relatifSousRacine } from './chemin-mesure.mjs'
import { normaliserRequeteMesuree, verifierRequeteMesuree } from '../../guards/lib/requeteMesuree.mjs'
import { cheminAbsent, correspondGlob, parUnitesDeCode } from '../../guards/lib/lister.mjs'

const MARQUE = Symbol.for('wfrp.enregistreur-lectures')
const RACINE = process.env.WFRP_LECTURES_RACINE
const SORTIE = process.env.WFRP_LECTURES_SORTIE
const IGNORES = process.env.WFRP_LECTURES_IGNORES

/** Enveloppe `fs` et rend le collecteur — exporté pour que le test monte la mécanique à nu.
 *  `ignores` : l'ensemble `perimetreDeMesure().ignores` de la racine. */
export function installer({ racine, ignores, cibles = [], motifsPropres = [], motifsDeclares = [], ciblesDerivees = [], observer }) {
  if (!(ignores instanceof Set)) throw new TypeError('enregistreur-lectures : `ignores` (ensemble du périmètre de mesure) absent — sans lui, chaque lecture serait écartée en silence')
  if (!Array.isArray(ciblesDerivees) || ciblesDerivees.some((p) => typeof p !== 'string' || !p || p.includes('\\') || path.isAbsolute(p) || p.split('/').includes('..'))) throw new TypeError('enregistreur-lectures : cibles dérivées hors racine')
  const base = canoniser(racine)
  const exclues = new Set(cibles)
  const derivees = new Set(ciblesDerivees)
  const admissible = (rel) => dansLaMesure(rel, ignores, derivees, motifsDeclares)
  const fichiers = new Set()
  const dossiers = new Map()
  const git = new Map()
  const sondes = new Map()
  const incomplet = new Set()
  let mesureEnCours = false
  const mesurer = (geste) => {
    if (mesureEnCours) return
    mesureEnCours = true
    try { const delta = geste(); if (delta) observer?.(delta) } catch (e) {
      incomplet.add(String(e.message))
      try { observer?.({ incomplet: [String(e.message)] }) } catch {}
    }
    finally { mesureEnCours = false }
  }
  // Chemins LUS hors racine, refusés : un rejet muet est indiscernable d'une absence de lecture. Des
  // CHEMINS CANONIQUES DISTINCTS, comme `fichiers` : une même lecture passe par plusieurs appels de
  // `fs` enveloppés (`openSync` puis `readFileSync`), et deux casses désignent le même fichier.
  const cheminsRejetes = new Set()
  // Un `realpathSync.native` est un appel système (0,048 ms mesuré) et un générateur relit les mêmes
  // chemins des milliers de fois : la canonisation se mémorise pour la durée de la mesure.
  const canoniserMemo = canoniseurParDossier()

  /**
   * Chemin RELATIF POSIX retenu, ou `null` (hors racine, exclu, cible, ou descripteur de fichier).
   * `rejets` reçoit les chemins HORS racine — fourni par les LECTURES seules, une écriture hors
   * racine (le fichier de mesure lui-même) n'est pas une source refusée.
   */
  const retenu = (p, rejets) => {
    if (typeof p === 'number') return null
    const cheminBrut =
      typeof p === 'string' ? p
      : Buffer.isBuffer(p) ? p.toString('utf8')
      : p instanceof URL && p.protocol === 'file:' ? decodeURIComponent(p.pathname).replace(/^\/([A-Za-z]:)/, '$1')
      : null
    if (!cheminBrut) return null
    const abs = path.resolve(base, cheminBrut)
    const rel = relatifSousRacine(base, abs, canoniserMemo)
    if (rel === null) {
      rejets?.add(canoniserMemo(abs))
      return null
    }
    if (!rel || !admissible(rel)) return null
    if (exclues.has(rel) || motifsPropres.some((motif) => correspondGlob(rel, motif))) {
      try { if (brut.lstatSync(abs).isFile()) return null }
      catch (e) { if (cheminAbsent(e)) return null; throw e }
    }
    return rel
  }

  const ecrits = new Set()
  const brut = {
    readFileSync: fs.readFileSync,
    // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
    readdirSync: fs.readdirSync, opendirSync: fs.opendirSync, readdir: fs.readdir, globSync: fs.globSync, glob: fs.glob,
    // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
    promisesReaddir: fs.promises.readdir, promisesOpendir: fs.promises.opendir, promisesGlob: fs.promises.glob,
    openSync: fs.openSync,
    writeFileSync: fs.writeFileSync,
    appendFileSync: fs.appendFileSync,
    promisesReadFile: fs.promises.readFile,
    promisesWriteFile: fs.promises.writeFile,
    existsSync: fs.existsSync,
    statSync: fs.statSync,
    lstatSync: fs.lstatSync,
    accessSync: fs.accessSync,
    promisesStat: fs.promises.stat,
    promisesLstat: fs.promises.lstat,
    execFileSync: childProcess.execFileSync,
    spawnSync: childProcess.spawnSync,
  }
  /** `openSync` sert aussi à écrire : seul le mode lecture (`r`, `rs`, `O_RDONLY`) est une source. */
  const estLecture = (drapeaux) =>
    drapeaux === undefined || drapeaux === null || drapeaux === 0 || /^rs?\+?$/.test(String(drapeaux))

  const noterFichier = (p) => {
    mesurer(() => {
      const rel = retenu(p, cheminsRejetes)
      if (rel) { fichiers.add(rel); return { fichiers: [rel] } }
    })
  }
  const noterEcriture = (p) => {
    mesurer(() => {
      const rel = retenu(p)
      if (rel) { ecrits.add(rel); return { ecrits: [rel] } }
    })
  }
  /** Entrées TYPÉES et triées d'un dossier, lues sans l'enveloppe. */
  // eslint-disable-next-line murs/ordre-total -- lecture PRISTINE du crochet : passer par `listerDossier` rappellerait l'enveloppe
  const entreesDe = (abs) => brut.readdirSync(abs, { withFileTypes: true }).map((e) => ({ nom: e.name, nature: e.isSymbolicLink() ? 'link' : e.isFile() ? 'file' : e.isDirectory() ? 'directory' : 'other' })).sort((a, b) => parUnitesDeCode(a.nom, b.nom))
  /** Listing projeté de `rel`, ou `null` s'il est déjà mesuré. */
  const listingNeuf = (rel) => {
    if (dossiers.has(rel)) return null
    dossiers.set(rel, projeterListingMesure(rel, { nature: 'directory', entrees: entreesDe(path.resolve(base, rel)) }, ignores, derivees, [...cibles, ...motifsPropres], motifsDeclares))
    return dossiers.get(rel)
  }
  const noterDossier = (p) => {
    mesurer(() => {
      const rel = retenu(p, cheminsRejetes)
      const listing = rel === null ? null : listingNeuf(rel)
      if (listing) return { dossiers: { [rel]: listing } }
    })
  }

  /** Sonde neuve sur un chemin RETENU, ou `null` si elle est déjà mesurée. `extra` : paramètres rejoués (`mode` d'un `access`). */
  const sondeNeuve = (chemin, type, valeur, erreur, extra = {}) => {
    const nature = type === 'exists' || type === 'access' ? null : valeur?.isFile() ? 'file' : valeur?.isDirectory() ? 'directory' : valeur ? 'other' : null
    const sonde = { chemin, type, existe: type === 'exists' || type === 'access' ? valeur : Boolean(valeur), nature, ...extra,
      ...(erreur?.code ? { code: erreur.code } : {}) }
    const cle = JSON.stringify(sonde)
    if (sondes.has(cle)) return null
    sondes.set(cle, sonde)
    return sonde
  }
  const noterSonde = (p, type, valeur, erreur, extra) => mesurer(() => {
    const chemin = retenu(p, cheminsRejetes)
    const sonde = chemin === null ? null : sondeNeuve(chemin, type, valeur, erreur, extra)
    if (sonde) return { sondes: [sonde] }
  })
  /** Une lecture ou un listing qui ÉCHOUE n'a pas de contenu à hasher : son issue tient à l'existence et à la nature
   *  du chemin, que la sonde `stat` porte et que la certification rejoue. */
  const noterEchec = (p) => mesurer(() => {
    const chemin = retenu(p, cheminsRejetes)
    if (chemin === null) return
    let r, erreur
    try { r = brut.statSync(p) } catch (e) { erreur = e }
    const sonde = sondeNeuve(chemin, 'stat', r, erreur)
    if (sonde) return { sondes: [sonde] }
  })
  /**
   * Un glob énumère sans lister : chaque dossier qu'il PARCOURT, depuis le préfixe statique du motif,
   * entre en `dossiers` (profondeur bornée par le motif, sauf `**`) ; un préfixe absent est une sonde.
   */
  const noterGlob = (motifs, options) => mesurer(() => {
    const delta = { dossiers: {}, sondes: [] }
    const depart = options?.cwd instanceof URL ? fileURLToPath(options.cwd) : path.resolve(options?.cwd ?? process.cwd())
    const parcourir = (abs, profondeur) => {
      if (estPipeNomme(abs)) return
      const rel = retenu(abs, cheminsRejetes)
      let entrees
      try { entrees = entreesDe(abs) } catch (e) {
        if (!cheminAbsent(e)) throw e
        const sonde = rel === null ? null : sondeNeuve(rel, 'exists', false)
        if (sonde) delta.sondes.push(sonde)
        return
      }
      const listing = rel === null ? null : listingNeuf(rel)
      if (listing) delta.dossiers[rel] = listing
      if (profondeur > 1)
        for (const e of entrees) if (e.nature === 'directory' && (rel === null || retenu(path.join(abs, e.nom)) !== null)) parcourir(path.join(abs, e.nom), profondeur - 1)
    }
    for (const motif of [motifs].flat().map(String)) {
      const segments = motif.split(/[\\/]/)
      const joker = segments.findIndex((s) => /[*?[{]/.test(s))
      const statique = path.resolve(depart, segments.slice(0, joker < 0 ? segments.length : joker).join('/') || '.')
      if (joker < 0) {
        const chemin = retenu(statique, cheminsRejetes)
        const sonde = chemin === null ? null : sondeNeuve(chemin, 'exists', brut.existsSync(statique))
        if (sonde) delta.sondes.push(sonde)
      } else parcourir(statique, segments.slice(joker).includes('**') ? Infinity : segments.length - joker)
    }
    return delta
  })
  const noterGit = (commande, args, options, vu) => {
    if (!/(?:^|[\\/])git(?:\.exe)?$/i.test(String(commande))) return
    mesurer(() => {
      const cwd = relatifSousRacine(base, path.resolve(options?.cwd ?? process.cwd()), canoniserMemo)
      if (cwd === null) throw new Error('requête Git mesurée hors racine')
      if (options?.input !== undefined || options?.env !== undefined || options?.shell) throw new Error('requête Git mesurée avec entrée, environnement ou shell non rejouable')
      const requete = normaliserRequeteMesuree(base, { args: args ?? [], cwd, ...(vu.canal ? { canal: vu.canal } : {}), status: vu.status, stdout: vu.stdout, stderr: vu.stderr })
      verifierRequeteMesuree(requete)
      if (vu.error || vu.signal || vu.status === null) throw new Error('requête Git mesurée sans résultat')
      const cle = JSON.stringify(requete)
      if (!git.has(cle)) { git.set(cle, requete); return { git: [requete] } }
    })
  }

  // Chaque enveloppe note APRÈS coup : une source sur le chemin qui a rendu un résultat, une sonde (`noterEchec`)
  // sur celui qui a échoué.
  /** Appel synchrone : `succes` sur le résultat, `noterEchec` puis relève sur l'erreur. */
  const synchrone = (original, succes) => function (p, ...a) {
    let r
    try { r = original.call(this, p, ...a) } catch (e) { noterEchec(p, e); throw e }
    succes(p, r, a)
    return r
  }
  const promesse = (original, succes) => function (p, ...a) {
    return original.call(this, p, ...a).then((r) => { succes(p, r, a); return r }, (e) => { noterEchec(p, e); throw e })
  }
  fs.readFileSync = synchrone(brut.readFileSync, noterFichier)
  fs.openSync = function (p, d, ...a) {
    let r
    try { r = brut.openSync.call(this, p, d, ...a) } catch (e) { if (estLecture(d)) noterEchec(p, e); throw e }
    ;(estLecture(d) ? noterFichier : noterEcriture)(p)
    return r
  }
  fs.promises.readFile = promesse(brut.promisesReadFile, noterFichier)
  /** Appel à rappel final : `succes` ou `noterEchec` avant de rendre la main au rappel. */
  const aRappel = (original, succes) => function (p, ...a) {
    const rappel = a.pop()
    return original.call(this, p, ...a, (e, r) => { if (e) noterEchec(p, e); else succes(p, r, a); rappel(e, r) })
  }
  /** Un glob se mesure AVANT l'appel (`noterGlob`) : synchrone, à rappel ou itérateur. */
  const avantGlob = (original) => function (motifs, ...a) { noterGlob(motifs, typeof a[0] === 'function' ? undefined : a[0]); return original.call(this, motifs, ...a) }
  // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
  Object.assign(fs, { readdirSync: synchrone(brut.readdirSync, noterDossier), opendirSync: synchrone(brut.opendirSync, noterDossier), readdir: aRappel(brut.readdir, noterDossier), globSync: avantGlob(brut.globSync), glob: avantGlob(brut.glob) })
  Object.assign(fs.promises, { readdir: promesse(brut.promisesReaddir, noterDossier), opendir: promesse(brut.promisesOpendir, noterDossier), glob: avantGlob(brut.promisesGlob) })
  fs.writeFileSync = function (p, ...a) { const r = brut.writeFileSync.call(this, p, ...a); noterEcriture(p); return r }
  fs.appendFileSync = function (p, ...a) { const r = brut.appendFileSync.call(this, p, ...a); noterEcriture(p); return r }
  fs.promises.writeFile = function (p, ...a) { return brut.promisesWriteFile.call(this, p, ...a).then((r) => { noterEcriture(p); return r }) }
  fs.existsSync = function (p) { const r = brut.existsSync.call(this, p); noterSonde(p, 'exists', r); return r }
  fs.statSync = function (p, ...a) {
    try { const r = brut.statSync.call(this, p, ...a); noterSonde(p, 'stat', r); return r }
    catch (e) { noterSonde(p, 'stat', undefined, e); throw e }
  }
  fs.promises.stat = function (p, ...a) { return brut.promisesStat.call(this, p, ...a).then((r) => { noterSonde(p, 'stat', r); return r }, (e) => { noterSonde(p, 'stat', undefined, e); throw e }) }
  fs.lstatSync = function (p, ...a) {
    try { const r = brut.lstatSync.call(this, p, ...a); noterSonde(p, 'lstat', r); return r }
    catch (e) { noterSonde(p, 'lstat', undefined, e); throw e }
  }
  fs.promises.lstat = function (p, ...a) { return brut.promisesLstat.call(this, p, ...a).then((r) => { noterSonde(p, 'lstat', r); return r }, (e) => { noterSonde(p, 'lstat', undefined, e); throw e }) }
  fs.accessSync = function (p, mode) {
    const extra = mode === undefined ? {} : { mode }
    try { const r = brut.accessSync.call(this, p, mode); noterSonde(p, 'access', true, undefined, extra); return r }
    catch (e) { noterSonde(p, 'access', false, e, extra); throw e }
  }
  childProcess.execFileSync = function (commande, args, options) {
    try { const r = brut.execFileSync.call(this, commande, args, options); noterGit(commande, args, options, { canal: 'stdout', status: 0, stdout: r, stderr: '' }); return r }
    catch (e) { noterGit(commande, args, options, e); throw e }
  }
  childProcess.spawnSync = function (commande, args, options) { const r = brut.spawnSync.call(this, commande, args, options); noterGit(commande, args, options, r); return r }
  syncBuiltinESMExports()

  /** Retire l'enveloppe posée : deux installations dans un même processus s'empileraient. */
  const restaurer = () => {
    fs.readFileSync = brut.readFileSync
    // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
    Object.assign(fs, { readdirSync: brut.readdirSync, opendirSync: brut.opendirSync, readdir: brut.readdir, globSync: brut.globSync, glob: brut.glob })
    Object.assign(fs.promises, { readdir: brut.promisesReaddir, opendir: brut.promisesOpendir, glob: brut.promisesGlob })
    fs.openSync = brut.openSync
    fs.writeFileSync = brut.writeFileSync
    fs.appendFileSync = brut.appendFileSync
    fs.promises.readFile = brut.promisesReadFile
    fs.promises.writeFile = brut.promisesWriteFile
    fs.existsSync = brut.existsSync
    fs.statSync = brut.statSync
    fs.lstatSync = brut.lstatSync
    fs.accessSync = brut.accessSync
    fs.promises.stat = brut.promisesStat
    fs.promises.lstat = brut.promisesLstat
    childProcess.execFileSync = brut.execFileSync
    childProcess.spawnSync = brut.spawnSync
    syncBuiltinESMExports()
  }

  const rendu = () => ({
    fichiers: [...fichiers].filter((p) => !ecrits.has(p)).sort(),
    dossiers: Object.fromEntries([...dossiers].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    ecrits: [...ecrits].sort(), cheminsRejetes: cheminsRejetes.size,
    git: [...git].sort(([a], [b]) => parUnitesDeCode(a, b)).map(([, v]) => v),
    sondes: [...sondes].filter(([, v]) => !ecrits.has(v.chemin)).sort(([a], [b]) => parUnitesDeCode(a, b)).map(([, v]) => v),
    incomplet: [...incomplet].sort(),
  })
  return {
    fichiers,
    dossiers,
    ecrits,
    restaurer,
    // Un fichier ÉCRIT par le générateur n'est pas une de ses sources, même s'il l'a relu avant
    // (`build-implemente.mjs` réinjecte un champ dans les fiches docs/raw qu'il vient de lire).
    rendu,
  }
}

if (isMainThread && RACINE && SORTIE && !globalThis[MARQUE]) {
  globalThis[MARQUE] = true
  if (!IGNORES) throw new Error('enregistreur-lectures : WFRP_LECTURES_IGNORES absent — sans lui, un chemin ignoré par git entrerait dans la mesure')
  const ignores = JSON.parse(fs.readFileSync(IGNORES, 'utf8'))
  const ciblesDerivees = process.env.WFRP_LECTURES_CIBLES_DERIVEES
    ? JSON.parse(fs.readFileSync(process.env.WFRP_LECTURES_CIBLES_DERIVEES, 'utf8')) : []
  const collecteur = installer({
    racine: RACINE,
    ignores: new Set(ignores),
    cibles: (process.env.WFRP_LECTURES_CIBLE ?? '').split(',').filter(Boolean),
    ciblesDerivees,
    motifsPropres: JSON.parse(process.env.WFRP_LECTURES_MOTIFS_PROPRES ?? '[]'),
    motifsDeclares: JSON.parse(process.env.WFRP_LECTURES_MOTIFS_DECLARES ?? '[]'),
  })
  // Ce qu'un THREAD DE HOOKS (tsx) charge et lit échappe à l'enveloppe de `fs` posée ici : le volet
  // `enregistreur-hooks.mjs` enregistre depuis ce thread-là les modules ET les fichiers lus.
  register(new URL('enregistreur-hooks.mjs', import.meta.url).href, {
    data: {
      racine: path.resolve(RACINE),
      sortie: SORTIE,
      ignores,
      cibles: (process.env.WFRP_LECTURES_CIBLE ?? '').split(',').filter(Boolean),
      ciblesDerivees,
      motifsPropres: JSON.parse(process.env.WFRP_LECTURES_MOTIFS_PROPRES ?? '[]'),
      motifsDeclares: JSON.parse(process.env.WFRP_LECTURES_MOTIFS_DECLARES ?? '[]'),
    },
  })
  process.on('exit', () => {
    try {
      fs.writeFileSync(`${SORTIE}.${process.pid}.json`, JSON.stringify(collecteur.rendu()))
    } catch { /* un enfant sans droit d'écriture ne fait pas échouer le générateur */ }
  })
}
