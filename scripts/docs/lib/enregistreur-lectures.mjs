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
// l'ensemble `ignoresGit` calculé une fois par l'appelant et passé en JSON par `WFRP_LECTURES_IGNORES`,
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
import { isMainThread } from 'node:worker_threads'
import { canoniser, dansLaMesure, relatifSousRacine } from './chemin-mesure.mjs'
import { normaliserRequeteMesuree, verifierRequeteMesuree } from '../../guards/lib/gitPorte.mjs'
import { parUnitesDeCode } from '../../guards/lib/lister.mjs'

const MARQUE = Symbol.for('wfrp.enregistreur-lectures')
const RACINE = process.env.WFRP_LECTURES_RACINE
const SORTIE = process.env.WFRP_LECTURES_SORTIE
const IGNORES = process.env.WFRP_LECTURES_IGNORES

/** Enveloppe `fs` et rend le collecteur — exporté pour que le test monte la mécanique à nu.
 *  `ignores` : l'ensemble `ignoresGit` de la racine. */
export function installer({ racine, ignores, cibles = [], ciblesDerivees = [], observer }) {
  if (!(ignores instanceof Set)) throw new TypeError('enregistreur-lectures : `ignores` (ensemble `ignoresGit`) absent — sans lui, chaque lecture serait écartée en silence')
  if (!Array.isArray(ciblesDerivees) || ciblesDerivees.some((p) => typeof p !== 'string' || !p || p.includes('\\') || path.isAbsolute(p) || p.split('/').includes('..'))) throw new TypeError('enregistreur-lectures : cibles dérivées hors racine')
  const base = canoniser(racine)
  const exclues = new Set(cibles)
  const derivees = new Set(ciblesDerivees)
  const parentsDerives = new Set(ciblesDerivees.flatMap((p) => {
    const parents = []
    for (let d = path.posix.dirname(p); d !== '.'; d = path.posix.dirname(d)) parents.push(d)
    return parents
  }))
  const admissible = (rel) => rel !== '.git' && !rel.startsWith('.git/') && rel !== 'node_modules' && !rel.startsWith('node_modules/') && (dansLaMesure(rel, ignores) || derivees.has(rel) || parentsDerives.has(rel))
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
  const canoniques = new Map()
  const canoniserMemo = (p) => {
    let c = canoniques.get(p)
    if (c === undefined) canoniques.set(p, (c = canoniser(p)))
    return c
  }

  /**
   * Chemin RELATIF POSIX retenu, ou `null` (hors racine, exclu, cible, ou descripteur de fichier).
   * `rejets` reçoit les chemins HORS racine — fourni par les LECTURES seules, une écriture hors
   * racine (le fichier de mesure lui-même) n'est pas une source refusée.
   */
  const retenu = (p, rejets) => {
    if (typeof p === 'number') return null
    const brut =
      typeof p === 'string' ? p
      : Buffer.isBuffer(p) ? p.toString('utf8')
      : p instanceof URL && p.protocol === 'file:' ? decodeURIComponent(p.pathname).replace(/^\/([A-Za-z]:)/, '$1')
      : null
    if (!brut) return null
    const abs = path.resolve(base, brut)
    const rel = relatifSousRacine(base, abs, canoniserMemo)
    if (rel === null) {
      rejets?.add(canoniserMemo(abs))
      return null
    }
    if (!rel || !admissible(rel) || exclues.has(rel)) return null
    return rel
  }

  const ecrits = new Set()
  const brut = {
    readFileSync: fs.readFileSync,
    // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
    readdirSync: fs.readdirSync,
    openSync: fs.openSync,
    writeFileSync: fs.writeFileSync,
    appendFileSync: fs.appendFileSync,
    promisesReadFile: fs.promises.readFile,
    // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
    promisesReaddir: fs.promises.readdir,
    promisesWriteFile: fs.promises.writeFile,
    existsSync: fs.existsSync,
    statSync: fs.statSync,
    promisesStat: fs.promises.stat,
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
  const noterDossier = (p) => {
    mesurer(() => {
      const rel = retenu(p, cheminsRejetes)
      if (rel === null || dossiers.has(rel)) return
      // eslint-disable-next-line murs/ordre-total -- lecture PRISTINE du crochet : passer par `listerDossier` rappellerait l'enveloppe
      dossiers.set(rel, brut.readdirSync(path.resolve(base, rel)).map(String).filter((n) => admissible(`${rel}/${n}`)).sort())
      return { dossiers: { [rel]: dossiers.get(rel) } }
    })
  }

  const noterSonde = (p, type, valeur, erreur) => mesurer(() => {
    const chemin = retenu(p, cheminsRejetes)
    if (chemin === null) return
    const nature = type === 'exists' ? null : valeur?.isFile() ? 'file' : valeur?.isDirectory() ? 'directory' : valeur ? 'other' : null
    const sonde = { chemin, type, existe: type === 'exists' ? valeur : Boolean(valeur), nature,
      ...(erreur?.code ? { code: erreur.code } : {}) }
    const cle = JSON.stringify(sonde)
    if (!sondes.has(cle)) { sondes.set(cle, sonde); return { sondes: [sonde] } }
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

  // Une lecture qui ÉCHOUE n'est pas une source : un `.npmrc` sondé et absent n'a pas de blob à
  // hasher. Chaque enveloppe note APRÈS coup, sur le chemin qui a rendu un résultat.
  fs.readFileSync = function (p, ...a) { const r = brut.readFileSync.call(this, p, ...a); noterFichier(p); return r }
  // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
  fs.readdirSync = function (p, ...a) { const r = brut.readdirSync.call(this, p, ...a); noterDossier(p); return r }
  fs.openSync = function (p, d, ...a) { const r = brut.openSync.call(this, p, d, ...a); (estLecture(d) ? noterFichier : noterEcriture)(p); return r }
  fs.promises.readFile = function (p, ...a) { return brut.promisesReadFile.call(this, p, ...a).then((r) => { noterFichier(p); return r }) }
  // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
  fs.promises.readdir = function (p, ...a) { return brut.promisesReaddir.call(this, p, ...a).then((r) => { noterDossier(p); return r }) }
  fs.writeFileSync = function (p, ...a) { const r = brut.writeFileSync.call(this, p, ...a); noterEcriture(p); return r }
  fs.appendFileSync = function (p, ...a) { const r = brut.appendFileSync.call(this, p, ...a); noterEcriture(p); return r }
  fs.promises.writeFile = function (p, ...a) { return brut.promisesWriteFile.call(this, p, ...a).then((r) => { noterEcriture(p); return r }) }
  fs.existsSync = function (p) { const r = brut.existsSync.call(this, p); noterSonde(p, 'exists', r); return r }
  fs.statSync = function (p, ...a) {
    try { const r = brut.statSync.call(this, p, ...a); noterSonde(p, 'stat', r); return r }
    catch (e) { noterSonde(p, 'stat', undefined, e); throw e }
  }
  fs.promises.stat = function (p, ...a) { return brut.promisesStat.call(this, p, ...a).then((r) => { noterSonde(p, 'stat', r); return r }, (e) => { noterSonde(p, 'stat', undefined, e); throw e }) }
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
    fs.readdirSync = brut.readdirSync
    fs.openSync = brut.openSync
    fs.writeFileSync = brut.writeFileSync
    fs.appendFileSync = brut.appendFileSync
    fs.promises.readFile = brut.promisesReadFile
    // eslint-disable-next-line murs/ordre-total -- crochet : il POSE le listing, il ne le consomme pas
    fs.promises.readdir = brut.promisesReaddir
    fs.promises.writeFile = brut.promisesWriteFile
    fs.existsSync = brut.existsSync
    fs.statSync = brut.statSync
    fs.promises.stat = brut.promisesStat
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
    },
  })
  process.on('exit', () => {
    try {
      fs.writeFileSync(`${SORTIE}.${process.pid}.json`, JSON.stringify(collecteur.rendu()))
    } catch { /* un enfant sans droit d'écriture ne fait pas échouer le générateur */ }
  })
}
