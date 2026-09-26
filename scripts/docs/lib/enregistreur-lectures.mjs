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
// générateur relit son propre .md en mode `--check`). `statSync` reste HORS empreinte : la sonde
// `V2-analyse.mjs` en a compté 255 sur 260 pointant des `*.test.*` et des snapshots, jamais lus.
// Un `readdirSync` enregistre le DOSSIER et son listing trié, restreint à la mesure : un fichier ajouté au dossier
// change ce que le générateur AURAIT lu, sans qu'aucun contenu ne bouge.
//
// Les ÉCRITURES sont mesurées elles aussi : un fichier écrit par le générateur n'est pas une de ses
// sources (le pied du doc ne peut pas dépendre de lui-même).
// Sortie : UN fichier par PID (`<WFRP_LECTURES_SORTIE>.<pid>.json`), écrit à la sortie du processus ;
// l'appelant fusionne le dossier (`fusionnerLectures`, `empreinte-sources.mjs`).
import fs from 'node:fs'
import path from 'node:path'
import { register, syncBuiltinESMExports } from 'node:module'
import { canoniser, dansLaMesure, relatifSousRacine } from './chemin-mesure.mjs'

const MARQUE = Symbol.for('wfrp.enregistreur-lectures')
const RACINE = process.env.WFRP_LECTURES_RACINE
const SORTIE = process.env.WFRP_LECTURES_SORTIE
const IGNORES = process.env.WFRP_LECTURES_IGNORES

/** Enveloppe `fs` et rend le collecteur — exporté pour que le test monte la mécanique à nu.
 *  `ignores` : l'ensemble `ignoresGit` de la racine. */
export function installer({ racine, ignores, cibles = [] }) {
  if (!(ignores instanceof Set)) throw new TypeError('enregistreur-lectures : `ignores` (ensemble `ignoresGit`) absent — sans lui, chaque lecture serait écartée en silence')
  const base = canoniser(racine)
  const exclues = new Set(cibles)
  const fichiers = new Set()
  const dossiers = new Map()
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
    if (!rel || !dansLaMesure(rel, ignores) || exclues.has(rel)) return null
    return rel
  }

  const ecrits = new Set()
  const brut = {
    readFileSync: fs.readFileSync,
    // eslint-disable-next-line no-restricted-syntax -- crochet : il POSE le listing, il ne le consomme pas
    readdirSync: fs.readdirSync,
    openSync: fs.openSync,
    writeFileSync: fs.writeFileSync,
    appendFileSync: fs.appendFileSync,
    promisesReadFile: fs.promises.readFile,
    // eslint-disable-next-line no-restricted-syntax -- crochet : il POSE le listing, il ne le consomme pas
    promisesReaddir: fs.promises.readdir,
    promisesWriteFile: fs.promises.writeFile,
  }
  /** `openSync` sert aussi à écrire : seul le mode lecture (`r`, `rs`, `O_RDONLY`) est une source. */
  const estLecture = (drapeaux) =>
    drapeaux === undefined || drapeaux === null || drapeaux === 0 || /^rs?\+?$/.test(String(drapeaux))

  const noterFichier = (p) => {
    try {
      const rel = retenu(p, cheminsRejetes)
      if (rel) fichiers.add(rel)
    } catch { /* une lecture non enregistrable ne casse jamais le générateur */ }
  }
  const noterEcriture = (p) => {
    try {
      const rel = retenu(p)
      if (rel) ecrits.add(rel)
    } catch { /* idem */ }
  }
  const noterDossier = (p) => {
    try {
      const rel = retenu(p, cheminsRejetes)
      if (rel === null || dossiers.has(rel)) return
      // eslint-disable-next-line no-restricted-syntax -- lecture PRISTINE du crochet : passer par `listerDossier` rappellerait l'enveloppe
      dossiers.set(rel, brut.readdirSync(path.resolve(base, rel)).map(String).filter((n) => dansLaMesure(`${rel}/${n}`, ignores)).sort())
    } catch { /* idem */ }
  }

  // Une lecture qui ÉCHOUE n'est pas une source : un `.npmrc` sondé et absent n'a pas de blob à
  // hasher. Chaque enveloppe note APRÈS coup, sur le chemin qui a rendu un résultat.
  fs.readFileSync = function (p, ...a) { const r = brut.readFileSync.call(this, p, ...a); noterFichier(p); return r }
  // eslint-disable-next-line no-restricted-syntax -- crochet : il POSE le listing, il ne le consomme pas
  fs.readdirSync = function (p, ...a) { const r = brut.readdirSync.call(this, p, ...a); noterDossier(p); return r }
  fs.openSync = function (p, d, ...a) { const r = brut.openSync.call(this, p, d, ...a); (estLecture(d) ? noterFichier : noterEcriture)(p); return r }
  fs.promises.readFile = function (p, ...a) { return brut.promisesReadFile.call(this, p, ...a).then((r) => { noterFichier(p); return r }) }
  // eslint-disable-next-line no-restricted-syntax -- crochet : il POSE le listing, il ne le consomme pas
  fs.promises.readdir = function (p, ...a) { return brut.promisesReaddir.call(this, p, ...a).then((r) => { noterDossier(p); return r }) }
  fs.writeFileSync = function (p, ...a) { const r = brut.writeFileSync.call(this, p, ...a); noterEcriture(p); return r }
  fs.appendFileSync = function (p, ...a) { const r = brut.appendFileSync.call(this, p, ...a); noterEcriture(p); return r }
  fs.promises.writeFile = function (p, ...a) { return brut.promisesWriteFile.call(this, p, ...a).then((r) => { noterEcriture(p); return r }) }
  syncBuiltinESMExports()

  /** Retire l'enveloppe posée : deux installations dans un même processus s'empileraient. */
  const restaurer = () => {
    fs.readFileSync = brut.readFileSync
    // eslint-disable-next-line no-restricted-syntax -- crochet : il POSE le listing, il ne le consomme pas
    fs.readdirSync = brut.readdirSync
    fs.openSync = brut.openSync
    fs.writeFileSync = brut.writeFileSync
    fs.appendFileSync = brut.appendFileSync
    fs.promises.readFile = brut.promisesReadFile
    // eslint-disable-next-line no-restricted-syntax -- crochet : il POSE le listing, il ne le consomme pas
    fs.promises.readdir = brut.promisesReaddir
    fs.promises.writeFile = brut.promisesWriteFile
    syncBuiltinESMExports()
  }

  return {
    fichiers,
    dossiers,
    ecrits,
    restaurer,
    // Un fichier ÉCRIT par le générateur n'est pas une de ses sources, même s'il l'a relu avant
    // (`build-implemente.mjs` réinjecte un champ dans les fiches docs/raw qu'il vient de lire).
    rendu: () => ({
      fichiers: [...fichiers].filter((p) => !ecrits.has(p)).sort(),
      dossiers: Object.fromEntries([...dossiers].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
      ecrits: [...ecrits].sort(),
      cheminsRejetes: cheminsRejetes.size,
    }),
  }
}

if (RACINE && SORTIE && !globalThis[MARQUE]) {
  globalThis[MARQUE] = true
  if (!IGNORES) throw new Error('enregistreur-lectures : WFRP_LECTURES_IGNORES absent — sans lui, un chemin ignoré par git entrerait dans la mesure')
  const ignores = JSON.parse(fs.readFileSync(IGNORES, 'utf8'))
  const collecteur = installer({
    racine: RACINE,
    ignores: new Set(ignores),
    cibles: (process.env.WFRP_LECTURES_CIBLE ?? '').split(',').filter(Boolean),
  })
  // Ce qu'un THREAD DE HOOKS (tsx) charge et lit échappe à l'enveloppe de `fs` posée ici : le volet
  // `enregistreur-hooks.mjs` enregistre depuis ce thread-là les modules ET les fichiers lus.
  register(new URL('enregistreur-hooks.mjs', import.meta.url).href, {
    data: {
      racine: path.resolve(RACINE),
      sortie: SORTIE,
      ignores,
      cibles: (process.env.WFRP_LECTURES_CIBLE ?? '').split(',').filter(Boolean),
    },
  })
  process.on('exit', () => {
    try {
      fs.writeFileSync(`${SORTIE}.${process.pid}.json`, JSON.stringify(collecteur.rendu()))
    } catch { /* un enfant sans droit d'écriture ne fait pas échouer le générateur */ }
  })
}
