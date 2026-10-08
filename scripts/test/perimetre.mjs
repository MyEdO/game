#!/usr/bin/env node
// PÉRIMÈTRE DE TESTS d'un diff (#2400) : `npm run test:perimetre [-- --base <ref> --tete <ref> --liste --budget <s> --docs]`.
// Les tests retenus se DÉRIVENT des fichiers touchés : le test touché, le test dont la clôture d'imports
// (`clotureDImports`, `typesEffaces`, `import.meta.glob` compris) atteint un fichier touché, le test dont
// une RACINE BALAYÉE (`racinesBalayees.mjs`) est un ancêtre d'un fichier touché (`ancetresDe`,
// `scripts/git-hooks/docs-rebuild.mjs`), M, A, D et R. Les `setupFiles` de `vite.config.ts` sont une
// racine de chaque test Vitest, au rang `setup` ; la toolchain touchée (`TOOLCHAIN`) retient la suite entière.
// Exécution : le lint des fichiers touchés (`lancerLint`), puis les tests sous `BUDGET_LOCAL_S` de MUR estimé,
// ordonnés par rang, spécificité de racine et signal (`planDExecution`, `signalDe`), estimés (`estimationsDe`,
// #2497) par la durée APPRISE ici (`DUREES`, reporters `dureesVitest.mjs` et `dureesNodeTest.mjs`), sinon par la
// durée de la CI de file (`DUREES_CI`, `dureesCi.mjs`) calibrée par population (`facteursCi`, `REPLI_FACTEUR_CI`),
// sinon inconnue ; le mur d'une famille est l'ordonnancement par liste SIMULÉ de ses fichiers dans l'ordre où son
// lanceur les démarre, sur ses workers, plus le surcoût de lancement appris (`murSimule`, `ordreDuLanceur`,
// `SURCOUTS`) ; le reste à la CI. Le mur nomme sa part estimée depuis la CI (`texteDuMur`).
// Docs dérivés : `selectionDesGenerateurs`, joués en `--check` sous `--docs` seulement.
// Le graphe résout contre la post-image ∪ la base : l'importeur pendu vers un fichier SUPPRIMÉ reste lié.
// Les spécificateurs non résolus, les lectures de module, leurs liaisons et leurs déclarations exportées se
// mémoïsent par blob sous `CACHE` ; l'évaluation de chaque module, avec les réponses des requêtes qu'elle a
// posées (`tracer`, `VARIANTES`). Tous signés par `versionDesMemos`.
import { spawnSync } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, posix, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { typescript, analyserCorpus } from '../guards/lib/dialecte.mjs'
import { clotureDImports, grapheInverse, resolveImport, aliasDuDepot, estModule, liaisonsDe, CHEMIN_TSCONFIG } from '../guards/lib/importGraph.mjs'
import { APPEL_DE_LECTURE, evaluateurDuDepot, evaluer, lecteurDExpressions, lectureDeModule, partiesDeRequete } from '../guards/lib/racinesBalayees.mjs'
import { RACINES_DE_LA_SUITE } from '../guards/lib/racinesDeLaSuite.mjs'
import { estSuiteVitest } from '../guards/lib/fichierVitest.mjs'
import { paquetsDArgv } from '../guards/lib/porteSpawn.mjs'
import { arbrePrincipal, baseCommune, ceQuiChange, depotDe, lireEnLot, listerImage, racineDe, SUIVI, TRAVAIL, TRONC } from '../guards/lib/gitPorte.mjs'
import { ancetresDe, LECTURES_DES_DEPENDANCES, selectionDesGenerateurs, sourcesMesurees } from '../git-hooks/docs-rebuild.mjs'
import { capaciteDuLanceur, codeEnfant, environnementDe, maxWorkersMono } from './partition.mjs'
import { DUREES_CI, dureesValides, memoCiDe, rapatrierDureesCi } from './dureesCi.mjs'
import { EXTS_LINT, lancerLint } from '../guards/lib/lintStage.mjs'
import { prendreVerrou } from './verrou.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Les fichiers dont un changement invalide toute dérivation : la suite entière est retenue. */
const TOOLCHAIN = Object.freeze([...LECTURES_DES_DEPENDANCES, 'vite.config.ts', 'tsconfig.json', 'scripts/guards/lib/racinesDeLaSuite.mjs'])

/** Le RANG d'un lien, du plus proche au plus lointain : touché, racine balayée (à rang égal, la plus
 *  SPÉCIFIQUE : `specificite`), import par distance, puis `setup` (le fichier n'est atteint que par les
 *  `setupFiles`, racine de TOUT test Vitest) et toolchain. */
const RANG_SETUP = 1_000_000
const RANG_TOOLCHAIN = RANG_SETUP + 1
const rangDe = (lien) => lien.nature === 'touché' ? 0 : lien.nature === 'racine balayée' ? 1
  : lien.nature === 'import' ? 1 + lien.distance : lien.nature === 'setup' ? RANG_SETUP : RANG_TOOLCHAIN

/** #2400 */
const BUDGET_LOCAL_S = 180

/** Les signaux d'un test d'import, du plus fort au plus faible (#2400) : il importe par NOM un export
 *  touché (`symbole`), il importe le module sans symbole touché (`module`), le reste. */
const SIGNAUX = Object.freeze(['symbole', 'module', 'reste'])

/** Le SURCOÛT de lancement de REPLI par famille, en ms, sans surcoût appris (`SURCOUTS`) : paramètre de BANC,
 *  `surcoutObserve` mesuré le 2026-10-07, 16 cœurs, contre le mur `max(Σ/workers, plus long)` — un MAJORANT du
 *  surcoût que mesure `murSimule`, qui ne descend jamais sous ce mur — : Vitest : 22 fichiers sur 2 workers, mur
 *  84,7 s ; node : 20 fichiers de moins de 3 s sur 15 workers, mur 4,5 s. */
const REPLI_SURCOUT_MS = Object.freeze({ vitest: 3749, node: 2911 })

/** Les POPULATIONS d'une durée de la CI, chacune son facteur (`facteursCi`). */
const POPULATIONS = Object.freeze(['vitest-node', 'vitest-jsdom', 'node'])

/** Les paires (durée apprise ici, durée CI) sous lesquelles une population prend son REPLI (`REPLI_FACTEUR_CI`). */
const PAIRES_MIN = 10

/** Le facteur durée ici / durée CI de REPLI par population, sous `PAIRES_MIN` paires : paramètre de BANC, Σlocal/ΣCI
 *  mesuré le 2026-10-08, 16 cœurs, contre le journal de la course 37724465833 (juge de design #2497). Node n'en a pas :
 *  `non calibré`, facteur 1. */
const REPLI_FACTEUR_CI = Object.freeze({ 'vitest-node': 0.9, 'vitest-jsdom': 3.5 })

/** Le mémo des durées apprises, sous `dossierDesMesures` : `{ [test]: ms }`. */
const DUREES = 'durees.json'

/** Le mémo des surcoûts de lancement appris, sous `dossierDesMesures` : `{ [famille]: ms }`. */
const SURCOUTS = 'surcouts.json'

/** L'attente d'un écrivain des mesures derrière un autre (`prendreVerrou`) : une écriture dure quelques ms. */
const ATTENTE_DES_MESURES = Object.freeze({ echeanceMs: 30_000, pasMs: 25 })

/** Les arguments de reporter d'un lancement Vitest, rapport de durées sous `sortie` (`dureesVitest.mjs`). */
const reportersVitest = (sortie) => ['--reporter=default', `--reporter=${pathToFileURL(join(RACINE, 'scripts/test/dureesVitest.mjs')).href}`, `--outputFile.durees=${sortie}`]

/** Le libellé d'un rang, pour le rapport. */
const libelleDuRang = (rang) => rang === 0 ? 'touché' : rang === 1 ? 'racine balayée' : rang === RANG_SETUP ? 'setup'
  : rang === RANG_TOOLCHAIN ? 'toolchain' : `import d=${rang - 1}`

/** Les paliers du rapport : le compte de tests retenus par rang. PURE. */
export function paliersDe(retenus) {
  const paliers = { 'touché': 0, 'racine balayée': 0, 'import d=1': 0, 'import d=2': 0, 'import d=3': 0, 'import d≥4': 0, 'setup seul': 0, 'toolchain seule': 0 }
  for (const lien of retenus.values()) {
    const cle = lien.nature === 'import' ? (lien.distance >= 4 ? 'import d≥4' : `import d=${lien.distance}`)
      : lien.nature === 'setup' ? 'setup seul' : lien.nature === 'toolchain' ? 'toolchain seule' : lien.nature
    paliers[cle] += 1
  }
  return paliers
}

/** La config Vitest d'où se lisent les `setupFiles`. */
const CONFIG_VITEST = 'vite.config.ts'

/** Les modules analysés par programme TypeScript (`analyserEnLots`). */
const LOT_D_ANALYSE = 400

/** Les VARIANTES gardées par évaluation de module (`evaluations`) : une par jeu de réponses, les tours du
 *  point fixe des lecteurs en posant plusieurs. */
const VARIANTES = 8

/** Le dossier des mémos, relatif à la racine du dépôt. */
const CACHE = 'node_modules/.cache/perimetre'

/** Les modules dont le code DÉCIDE du contenu des mémos : leur texte signe la version des mémos. Ce module en
 *  est : il calcule les mémos `declarations` (`declarationsDeLArbre`) et `liaisons` (leur projection). */
const VERSIONNANTS = Object.freeze(['scripts/guards/lib/importGraph.mjs', 'scripts/guards/lib/racinesBalayees.mjs', 'scripts/guards/lib/dialecte.mjs', 'scripts/test/perimetre.mjs'])
/** Les paquets dont la version DÉCIDE aussi des mémos : l'analyseur et le transpileur (`sourceALExecution`). */
const PAQUETS_VERSIONNANTS = ['typescript', 'rolldown']

/**
 * La version des mémos du dépôt de `racine` : le texte des `VERSIONNANTS`, le `tsconfig.json` du dépôt
 * (`CHEMIN_TSCONFIG`, lu par `sourceALExecution`) et la version installée des `PAQUETS_VERSIONNANTS`.
 * @param {string} racine
 * @param {(versionnant: string) => string} [lireVersionnant] le texte d'un `VERSIONNANTS`, relatif à ce dépôt
 */
export function versionDesMemos(racine, lireVersionnant = (f) => readFileSync(join(RACINE, f), 'utf8')) {
  const texte = (chemin) => { try { return readFileSync(chemin, 'utf8') } catch { return '' } }
  return blobDe([
    ...VERSIONNANTS.map(lireVersionnant),
    texte(join(racine, CHEMIN_TSCONFIG)),
    ...PAQUETS_VERSIONNANTS.map((p) => `${p}@${JSON.parse(texte(join(RACINE, 'node_modules', p, 'package.json')) || '{}').version ?? ''}`),
  ].join('\0'))
}

/** L'empreinte de blob git d'un texte (`git hash-object`). */
const blobDe = (texte) => {
  const octets = Buffer.from(texte, 'utf8')
  return createHash('sha1').update(`blob ${octets.length}\0`).update(octets).digest('hex')
}

/** Le test est-il une suite Vitest (`RACINES_DE_LA_SUITE`) ? une suite `node --test` (`scripts/**\/*.test.mjs`) ? */
const estTestVitest = (rel) => RACINES_DE_LA_SUITE.some(({ dir, exts }) => rel.startsWith(`${dir}/`) && exts.some((e) => rel.endsWith(e)) && estSuiteVitest(rel))
const estTestNode = (rel) => rel.startsWith('scripts/') && rel.endsWith('.test.mjs')

/** La racine `r` couvre-t-elle `chemin` (égalité, ou ANCÊTRE : `ancetresDe`) ? */
const couvre = (r, chemin) => chemin === r || ancetresDe(chemin).includes(r)

/**
 * Les fichiers touchés et les images d'un diff. `tete` absente : l'arbre de travail contre la base
 * commune avec `origin/main` (ou `base`), index, suivis modifiés et non suivis compris.
 * @returns {{ base: string, tete: string | null, touches: string[], post: string[], avant: string[] }}
 */
function imagesDuDiff(depot, { base, tete } = {}) {
  const borne = base ?? baseCommune(depot, TRONC.suivi, 'HEAD')
  if (!borne) throw new Error(`perimetre : base commune avec ${TRONC.suivi} introuvable — nommer --base`)
  const avant = listerImage(depot, borne)
  if (tete) return { base: borne, tete, touches: ceQuiChange(depot, borne, tete).chemins(), post: listerImage(depot, tete), avant }
  const post = listerImage(depot, TRAVAIL)
  const tete0 = new Set(listerImage(depot, 'HEAD'))
  const touches = [...new Set([...ceQuiChange(depot, borne, SUIVI).chemins(), ...post.filter((f) => !tete0.has(f))])].sort()
  return { base: borne, tete: null, touches, post, avant }
}

/** Les mémos du dossier `dossier` (JSON par famille), signés par `version` : une autre version les vide. */
export function memosDe(dossier, version) {
  const familles = {}
  const charger = (nom) => {
    if (familles[nom]) return familles[nom].entrees
    let entrees = {}
    try {
      const lu = JSON.parse(readFileSync(join(dossier, `${nom}.json`), 'utf8'))
      if (lu.version === version) entrees = lu.memos
    } catch { entrees = {} }
    familles[nom] = { entrees, sale: false }
    return entrees
  }
  return {
    lire: (nom, cle) => charger(nom)[cle],
    ecrire: (nom, cle, valeur) => { charger(nom)[cle] = valeur; familles[nom].sale = true },
    sauver: () => {
      for (const [nom, { entrees, sale }] of Object.entries(familles)) {
        if (!sale) continue
        mkdirSync(dossier, { recursive: true })
        writeFileSync(join(dossier, `${nom}.json`), JSON.stringify({ version, memos: entrees }))
      }
    },
  }
}

/** Les `setupFiles` de la config Vitest (`CONFIG_VITEST`), lus sur son arbre syntaxique. */
function setupFilesDe(texte) {
  if (texte === null) return []
  const ts = typescript()
  const [{ sourceFile }] = [...analyserCorpus([{ rel: CONFIG_VITEST, text: texte }])]
  const { expr } = lecteurDExpressions(CONFIG_VITEST, sourceFile)
  const vus = []
  const visiter = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'setupFiles') vus.push(...evaluer(expr(n.initializer)))
    n.forEachChild(visiter)
  }
  visiter(sourceFile)
  const non = vus.find((v) => !('chemin' in v))
  if (non) throw new Error(`perimetre : setupFiles de ${CONFIG_VITEST} illisible (${non.non ?? 'hors du dépôt'})`)
  return vus.map((v) => v.chemin)
}

/** @typedef {{ site: string, fichier: string, helper: string, raison: string, moduleBalaieLeDepot: boolean }} NonResolu */

/**
 * DÉRIVATION du périmètre. PURE hormis `lire` et les mémos.
 * @param {{ racine: string, touches: string[], post: string[], avant: string[], lire: (rels: string[]) => Map<string, string | null>, memos?: ReturnType<typeof memosDe> }} entree
 * @returns {{ retenus: Map<string, Lien>, toolchain: string[], nonResolus: NonResolu[], vitest: string[], node: string[], modules: number }}
 */
function deriverPerimetre({ racine, touches, post, avant, lire, lireAvant, memos }) {
  const base = resolve(racine).split(sep).join('/')
  const abs = (rel) => `${base}/${rel}`
  const rel = (a) => a.slice(base.length + 1)
  const presents = new Set(post)
  const ensemble = new Set([...post, ...avant])
  const vitest = post.filter(estTestVitest)
  const node = post.filter(estTestNode)
  const setup = setupFilesDe(lire([CONFIG_VITEST]).get(CONFIG_VITEST) ?? null)
  const textes = new Map()
  const lireAbs = (abss) => {
    const lus = lire(abss.map(rel))
    return new Map(abss.map((a) => {
      const t = lus.get(rel(a)) ?? null
      if (t !== null && estModule(rel(a))) textes.set(rel(a), t)
      return [a, t]
    }))
  }
  const cache = new Map()
  clotureDImports([...vitest, ...node, ...setup], {
    racine, typesEffaces: true, cache,
    arbre: { existe: (a) => ensemble.has(rel(a)), lire: lireAbs, fichiers: [...ensemble].map(abs) },
    specificateurs: memos && {
      lire: (a, t) => memos.lire('specificateurs', `${posix.extname(a)}:${blobDe(t)}`),
      ecrire: (a, t, sites) => memos.ecrire('specificateurs', `${posix.extname(a)}:${blobDe(t)}`, sites.map(({ spec, motifs, nature, ligne }) => ({ spec, motifs, nature, ligne }))),
    },
  })
  /** @type {Map<string, { importeur: string, spec: string }[]>} */
  const inverse = new Map()
  for (const [cible, arcs] of grapheInverse(cache))
    inverse.set(rel(cible), arcs.map((a) => ({ importeur: rel(a.importeur), spec: a.spec })))
  /** La clôture des `setupFiles` : ce que tout test Vitest atteint par eux, hors des distances. */
  const clotureSetup = new Set()
  const pile = setup.map(abs)
  while (pile.length) {
    const a = pile.pop()
    if (clotureSetup.has(rel(a))) continue
    clotureSetup.add(rel(a))
    for (const arc of cache.get(a) ?? []) pile.push(arc.cible)
  }
  const estTest = (f) => presents.has(f) && (estTestVitest(f) || estTestNode(f))

  /** Tests qui atteignent `depart`, avec leur distance et la chaîne la plus courte (test → … → depart). */
  const remontees = new Map()
  const remonter = (depart) => {
    if (remontees.has(depart)) return remontees.get(depart)
    const precedent = new Map([[depart, null]])
    let vague = [depart]
    const atteints = new Map()
    for (let d = 0; vague.length; d += 1) {
      const suivante = []
      for (const f of vague) {
        if (estTest(f) && !atteints.has(f)) {
          const chaine = []
          for (let x = f; x !== null; x = precedent.get(x)) chaine.push(x)
          atteints.set(f, { distance: d, chaine })
        }
        for (const { importeur } of inverse.get(f) ?? [])
          if (!precedent.has(importeur)) { precedent.set(importeur, f); suivante.push(importeur) }
      }
      vague = suivante
    }
    remontees.set(depart, atteints)
    return atteints
  }

  /** @typedef {{ nature: 'touché' | 'toolchain' | 'import' | 'racine balayée' | 'setup', distance: number, rang?: number, chaine?: string[], racine?: string, specificite?: number, site?: string, touche: string }} Lien */
  /** @type {Map<string, Lien>} */
  const retenus = new Map()
  const retenir = (test, lien) => {
    const deja = retenus.get(test)
    const neuf = { ...lien, rang: rangDe(lien) }
    if (!deja || (neuf.rang - deja.rang || (neuf.specificite ?? 0) - (deja.specificite ?? 0) || neuf.distance - deja.distance) < 0) retenus.set(test, neuf)
  }
  /** La SPÉCIFICITÉ d'une racine : le nombre de fichiers de la post-image qu'elle couvre (`couvre`). */
  let couverts = null
  const specificiteDe = (racine) => {
    if (!couverts) {
      couverts = new Map()
      for (const f of post) for (const a of [f, ...ancetresDe(f)]) couverts.set(a, (couverts.get(a) ?? 0) + 1)
    }
    return couverts.get(racine) ?? 0
  }
  const parSetup = (lien) => { for (const t of vitest) retenir(t, { nature: 'setup', distance: 0, ...lien }) }
  const toolchain = touches.filter((t) => TOOLCHAIN.includes(t))
  if (toolchain.length) for (const t of [...vitest, ...node]) retenir(t, { nature: 'toolchain', distance: 0, touche: toolchain[0] })
  for (const t of touches) {
    if (estTest(t)) retenir(t, { nature: 'touché', distance: 0, touche: t })
    for (const [test, { distance, chaine }] of remonter(t)) if (distance > 0) retenir(test, { nature: 'import', distance, chaine, touche: t })
    if (clotureSetup.has(t)) parSetup({ touche: t })
  }

  const lectures = new Map()
  const lectureDe = (f) => {
    if (lectures.has(f)) return lectures.get(f)
    const texte = textes.get(f) ?? lire([f]).get(f) ?? null
    if (texte === null || !estModule(f)) return lectures.set(f, null).get(f)
    const cle = `${f}:${blobDe(texte)}`
    let lu = memos?.lire('lectures', cle)
    if (!lu) {
      const [{ sourceFile }] = [...analyserCorpus([{ rel: f, text: texte }])]
      lu = lectureDeModule(f, sourceFile)
      memos?.ecrire('lectures', cle, lu)
    }
    return lectures.set(f, lu).get(f)
  }
  /** Lit d'un coup les modules `fichiers` absents des mémos : un programme d'analyse par lot. */
  const prelire = (fichiers) => {
    const aLire = []
    for (const f of fichiers) {
      const texte = textes.get(f)
      if (lectures.has(f) || texte === undefined) continue
      const lu = memos?.lire('lectures', `${f}:${blobDe(texte)}`)
      if (lu) lectures.set(f, lu)
      else aLire.push({ rel: f, text: texte })
    }
    for (const { fichier, sourceFile } of analyserEnLots(aLire)) {
      const lu = lectureDeModule(fichier.rel, sourceFile)
      memos?.ecrire('lectures', `${fichier.rel}:${blobDe(fichier.text)}`, lu)
      lectures.set(fichier.rel, lu)
    }
  }
  const alias = aliasDuDepot(racine)
  const cibleDe = (f, spec) => {
    const arc = (cache.get(abs(f)) ?? []).find((a) => a.spec === spec)
    const cible = arc?.cible ?? resolveImport(abs(f), spec, (a) => ensemble.has(rel(a)), alias)
    return cible ? rel(cible) : null
  }
  /** Les modules LECTEURS : ceux qui appellent une lecture, puis, au point fixe, les importeurs qui
   *  nomment un relais exporté d'un lecteur. L'évaluateur se refait à chaque tour : un relais se juge
   *  sur l'ensemble final. */
  const lecteurs = new Set([...textes].filter(([, t]) => APPEL_DE_LECTURE.test(t)).map(([f]) => f))
  /** La réponse COURANTE à une requête de l'évaluateur (`partiesDeRequete`) : l'empreinte de la lecture
   *  d'un module (blob, `null` s'il n'est pas un module lisible), la cible d'un spécificateur — stables
   *  le temps d'une dérivation —, `peutLire`, qui suit les tours des lecteurs. */
  const stables = new Map()
  const reponseA = (requete) => {
    if (stables.has(requete)) return stables.get(requete)
    const [nature, f, spec] = partiesDeRequete(requete)
    if (nature === 'peutLire') return lecteurs.has(f)
    const texte = nature === 'lecture' ? textes.get(f) ?? lire([f]).get(f) ?? null : null
    return stables.set(requete, nature === 'cible' ? cibleDe(f, spec) : texte === null || !estModule(f) ? null : blobDe(texte)).get(requete)
  }
  /** L'évaluation `nature` (`sitesDe`, `relaisExportes`) du module `f`, mémoïsée sous `evaluations` avec
   *  les réponses de ses requêtes : une variante vaut tant que chacune de ses réponses tient. */
  const variante = (nature, f) => (memos?.lire('evaluations', `${nature}:${f}`) ?? [])
    .find(({ requetes }) => requetes.every(([r, reponse]) => reponseA(r) === reponse))
  const evaluationDe = (evaluateur, nature, f) => {
    const vue = variante(nature, f)
    if (vue) return vue.resultat
    const { resultat, requetes } = evaluateur.tracer(() => evaluateur[nature](f))
    const cle = `${nature}:${f}`
    memos?.ecrire('evaluations', cle, [{ requetes: [...requetes].map((r) => [r, reponseA(r)]), resultat }, ...(memos.lire('evaluations', cle) ?? [])].slice(0, VARIANTES))
    return resultat
  }
  /** Lit d'un coup les modules dont l'évaluation `nature` n'a pas de variante valide, et leurs imports. */
  const prelireManquants = (nature, fichiers) => {
    const manquants = fichiers.filter((f) => !variante(nature, f))
    prelire(new Set([...manquants, ...manquants.flatMap((f) => (cache.get(abs(f)) ?? []).map((arc) => rel(arc.cible)))]))
  }
  let evaluateur
  for (let frontiere = [...lecteurs]; ;) {
    evaluateur = evaluateurDuDepot({ lecture: lectureDe, cible: cibleDe, peutLire: (f) => lecteurs.has(f) })
    prelireManquants('relaisExportes', frontiere)
    const suivante = []
    for (const f of frontiere) {
      const noms = evaluationDe(evaluateur, 'relaisExportes', f)
      if (!noms.length) continue
      const motif = new RegExp(`\\b(?:${noms.join('|')})\\b|export\\s*\\*`)
      for (const { importeur } of inverse.get(f) ?? [])
        if (!lecteurs.has(importeur) && textes.has(importeur) && motif.test(textes.get(importeur))) { lecteurs.add(importeur); suivante.push(importeur) }
    }
    if (!suivante.length) break
    frontiere = [...lecteurs]
  }

  const nonResolus = []
  /** Les modules dont un site balaie la RACINE du dépôt : tout fichier touché retient les tests qui les atteignent. */
  const balaientLeDepot = new Set()
  const tries = [...lecteurs].sort()
  prelireManquants('sitesDe', tries)
  for (const f of tries) {
    for (const site of evaluationDe(evaluateur, 'sitesDe', f)) {
      const ici = `${f}:${site.ligne}`
      for (const v of site.valeurs) if ('non' in v) nonResolus.push({ site: ici, fichier: f, helper: site.appel, raison: v.non })
      for (const v of site.valeurs) {
        if (!('chemin' in v)) continue
        if (v.chemin === '') balaientLeDepot.add(f)
        const touche = touches.find((t) => couvre(v.chemin, t))
        if (!touche) continue
        const lien = { racine: v.chemin || '.', specificite: specificiteDe(v.chemin), site: `${ici} ${site.appel}`, touche }
        for (const [test, { distance }] of remonter(f)) retenir(test, { nature: 'racine balayée', distance, ...lien })
        if (clotureSetup.has(f)) parSetup(lien)
      }
    }
  }
  /** Le SIGNAL de chaque test d'import (`signalDe`) : exports touchés du module touché (base contre
   *  post-image), liaisons du dernier maillon de sa chaîne. */
  const cibles = [...new Set([...retenus.values()].filter((l) => l.nature === 'import' && estModule(l.touche)).map((l) => l.touche))]
  const avantDe = cibles.length && lireAvant ? lireAvant(cibles) : new Map()
  const [declarationsAvant, declarationsApres] = [(m) => avantDe.get(m) ?? null, (m) => textes.get(m) ?? null]
    .map((texte) => parBlob(cibles.map((rel) => ({ rel, text: texte(rel) })), 'declarations', memos,
      (rel, sourceFile) => [...declarationsDeLArbre(sourceFile)]))
  const exportsDe = new Map(cibles.map((m) => [m, nomsTouches(new Map(declarationsAvant.get(m) ?? []), new Map(declarationsApres.get(m) ?? []))]))
  const importeurs = [...new Set([...retenus.values()].filter((l) => l.nature === 'import').map((l) => l.chaine[l.chaine.length - 2]))]
  const liaisonsPar = parBlob(importeurs.map((rel) => ({ rel, text: textes.get(rel) ?? '' })), 'liaisons', memos, (rel, sourceFile, diagnostics) => {
    try {
      return liaisonsDe(rel, sourceFile, diagnostics).map(({ spec, forme, importe }) => ({ spec, forme, importe: importe ? { nom: importe.nom } : null }))
    } catch { return [] }
  })
  const signaux = new Map()
  for (const [test, lien] of retenus) {
    if (lien.nature !== 'import') continue
    const importeur = lien.chaine[lien.chaine.length - 2]
    const liaisons = (liaisonsPar.get(importeur) ?? []).filter((l) => l.spec && cibleDe(importeur, l.spec) === lien.touche)
    signaux.set(test, signalDe(lien, liaisons, exportsDe.get(lien.touche) ?? new Set()))
  }
  for (const n of nonResolus) n.moduleBalaieLeDepot = balaientLeDepot.has(n.fichier)
  return { retenus, toolchain, nonResolus, vitest, node, modules: cache.size, setup, signaux }
}

/** Les familles de tests, chacune lancée par son propre processus. */
const FAMILLES = Object.freeze(['vitest', 'node'])

/**
 * L'ORDRE dans lequel le lanceur de la famille `famille` démarre ses fichiers `[test, ms][]`. PURE.
 * - node : lexical (node v22, `internal/test_runner/runner` `createTestFileList` → `ArrayPrototypeSort`).
 * - vitest : durée décroissante (`BaseSequencer.sort`, node_modules/vitest/dist/chunks/index.DpLw24bj.js:13385-13414) ;
 *   ses autres clés — échec au run précédent d'abord, fichier sans résultat en cache d'abord, puis par taille — lisent
 *   le cache de Vitest, absent des mesures : non reproduites.
 */
const ordreDuLanceur = (famille, fichiers) => [...fichiers].sort(famille === 'node'
  ? ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
  : ([a, ma], [b, mb]) => mb - ma || (a < b ? -1 : a > b ? 1 : 0))

/** Le MUR simulé de durées `durees` démarrées dans cet ordre sur `workers` workers : chaque fichier va au premier
 *  worker libre (ordonnancement par liste). PURE. */
const murSimule = (durees, workers) => {
  const libres = Array.from({ length: Math.max(1, Math.min(workers, durees.length)) }, () => 0)
  for (const ms of durees) libres[libres.indexOf(Math.min(...libres))] += ms
  return Math.max(...libres)
}

/**
 * Le MUR estimé des fichiers `[test, ms][]` de chaque famille (#2400, #2474) : par famille lancée, son ordonnancement
 * par liste simulé dans l'ordre de son lanceur (`ordreDuLanceur`, `murSimule`) sur ses workers EFFECTIFS
 * (`workers`), plus son surcoût de lancement (`surcouts`) ; les familles s'enchaînent. PURE.
 * @param {Record<string, [string, number][]>} fichiers
 * @param {{ workers?: Record<string, number>, surcouts?: Record<string, number> }} [options]
 */
function murDesFichiers(fichiers, { workers = {}, surcouts = {} } = {}) {
  let mur = 0
  for (const f of FAMILLES) {
    const liste = fichiers[f] ?? []
    if (liste.length) mur += murSimule(ordreDuLanceur(f, liste).map(([, ms]) => ms), Math.max(1, workers[f] ?? 1)) + (surcouts[f] ?? 0)
  }
  return mur
}

/** Les fichiers `[test, ms][]` VIDES de chaque famille. PURE. */
const fichiersVides = () => tableTotale(FAMILLES, () => [])

/**
 * La politique d'exécution (#2400) : touché HORS budget, toujours lancé ; puis la racine balayée, les rangs
 * d'import, setup et toolchain dans l'ordre, chacun trié par signal (`SIGNAUX`), puis spécificité de la
 * racine (`specificite`, la plus petite d'abord), puis estimation croissante, puis chemin. Un test s'ajoute
 * tant que le MUR estimé (`murDesFichiers`) des tests lancés, diminué de celui des seuls touchés, reste ≤ `budget`
 * secondes ; celui qui déborde part à la CI et les suivants s'essaient encore (#2474). Hors du rang touché, un test de durée
 * INCONNUE (`estimationsDe`) part à la CI sans couper les suivants ; au rang touché, il est lancé hors estimation. PURE.
 * @param {Map<string, { rang: number, specificite?: number }>} retenus
 * @param {{ budget?: number, estimations?: Map<string, { ms: number }>, signaux?: Map<string, { signal: string }>, workers?: Record<string, number>, surcouts?: Record<string, number> }} [options]
 * Chaque mur porte ses tests lancés SANS DURÉE (`sansDuree`), dont il n'est qu'un minorant, et sa part estimée
 * depuis la CI (`murCiMs`, ses `nCi` tests lancés de source `ci`) : le mur moins le mur où leurs durées valent 0.
 * `murParFamille` : le mur de chaque famille seule.
 * @returns {{ lances: string[], aLaCI: string[], murMs: number, murBudgeteMs: number, sansDuree: number, murCiMs: number, nCi: number, murParFamille: Record<string, number>, rangs: { rang: string, murMs: number, sansDuree: number, murCiMs: number, nCi: number, lances: number, aLaCI: number, inconnues: number }[] }}
 */
export function planDExecution(retenus, { budget = BUDGET_LOCAL_S, estimations = new Map(), signaux = new Map(), workers, surcouts } = {}) {
  const parRang = new Map()
  for (const [test, { rang }] of retenus) parRang.set(rang, [...(parRang.get(rang) ?? []), test])
  const cout = (t) => estimations.get(t)?.ms ?? 0
  const inconnue = (t) => (estimations.get(t)?.ms ?? null) === null
  const force = (t) => SIGNAUX.indexOf(signaux.get(t)?.signal ?? 'reste')
  const specificite = (t) => retenus.get(t).specificite ?? 0
  const deLaCi = (t) => estimations.get(t)?.source === 'ci'
  const mur = (fichiers) => murDesFichiers(fichiers, { workers, surcouts })
  const partCi = (complet, sansCi) => Math.max(0, Math.round(complet - sansCi))
  const cumuls = fichiersVides()
  const sansCi = fichiersVides()
  const avec = (t) => ({ ...cumuls, [familleDe(t)]: [...cumuls[familleDe(t)], [t, cout(t)]] })
  const lances = []
  const aLaCI = []
  const rangs = []
  let horsBudget = 0
  for (const rang of [...parRang.keys()].sort((a, b) => a - b)) {
    const tests = parRang.get(rang).sort((a, b) => force(a) - force(b) || specificite(a) - specificite(b) || cout(a) - cout(b) || (a < b ? -1 : 1))
    const avant = mur(cumuls)
    const avantSansCi = mur(sansCi)
    const bilan = { rang: libelleDuRang(rang), murMs: 0, sansDuree: 0, murCiMs: 0, nCi: 0, lances: 0, aLaCI: 0, inconnues: 0 }
    for (const t of tests) {
      if (inconnue(t)) bilan.inconnues += 1
      if (rang > 0 && inconnue(t)) {
        aLaCI.push(t)
        bilan.aLaCI += 1
        continue
      }
      if (rang > 0 && (budget === 0 || mur(avec(t)) - horsBudget > budget * 1000)) {
        aLaCI.push(t)
        bilan.aLaCI += 1
        continue
      }
      Object.assign(cumuls, avec(t))
      sansCi[familleDe(t)] = [...sansCi[familleDe(t)], [t, deLaCi(t) ? 0 : cout(t)]]
      if (rang === 0) horsBudget = mur(cumuls)
      if (inconnue(t)) bilan.sansDuree += 1
      if (deLaCi(t)) bilan.nCi += 1
      lances.push(t)
      bilan.lances += 1
    }
    bilan.murMs = mur(cumuls) - avant
    bilan.murCiMs = partCi(bilan.murMs, mur(sansCi) - avantSansCi)
    rangs.push(bilan)
  }
  const total = (cle) => rangs.reduce((n, r) => n + r[cle], 0)
  const murParFamille = tableTotale(FAMILLES, (f) => murDesFichiers({ [f]: cumuls[f] }, { workers, surcouts }))
  return { lances, aLaCI, murMs: mur(cumuls), murBudgeteMs: mur(cumuls) - horsBudget, sansDuree: total('sansDuree'),
    murCiMs: partCi(mur(cumuls), mur(sansCi)), nCi: total('nCi'), murParFamille, rangs }
}

/** Les modules `entrees` (`{ rel, text }`, `text` null : absent) analysés par lots de `LOT_D_ANALYSE`,
 *  un module par chemin et par lot. */
function* analyserEnLots(entrees) {
  const restes = [...entrees]
  while (restes.length) {
    const vus = new Set()
    const lot = []
    for (let i = 0; i < restes.length && lot.length < LOT_D_ANALYSE;)
      if (vus.has(restes[i].rel)) i += 1
      else { vus.add(restes[i].rel); lot.push(...restes.splice(i, 1)) }
    yield* analyserCorpus(lot)
  }
}

/**
 * `extraire(rel, sourceFile, diagnostics)` de chaque module `entrees`, mémoïsé sous la famille `famille`
 * par chemin et blob ; les absents des mémos s'analysent par lots. Un texte `null` rend `null`.
 * @returns {Map<string, unknown>}
 */
function parBlob(entrees, famille, memos, extraire) {
  const rendus = new Map()
  const aLire = []
  for (const e of entrees) {
    if (e.text === null) { rendus.set(e.rel, null); continue }
    const vu = memos?.lire(famille, `${e.rel}:${blobDe(e.text)}`)
    if (vu !== undefined) rendus.set(e.rel, vu)
    else aLire.push(e)
  }
  for (const { fichier, sourceFile, diagnostics } of analyserEnLots(aLire)) {
    const rendu = extraire(fichier.rel, sourceFile, diagnostics)
    memos?.ecrire(famille, `${fichier.rel}:${blobDe(fichier.text)}`, rendu)
    rendus.set(fichier.rel, rendu)
  }
  return rendus
}

/** La famille d'un test : `vitest` ou `node`. */
const familleDe = (test) => estTestNode(test) ? 'node' : 'vitest'

/** La POPULATION d'un test (`POPULATIONS`) : `node`, ou Vitest par son environnement (`environnementDe`, `jsdom` ou
 *  non) ; `null` si son environnement ne se lit pas. PURE. */
const populationDe = (t, environnementDe) => {
  if (familleDe(t) === 'node') return 'node'
  const environnement = environnementDe(t)
  return environnement === null ? null : environnement === 'jsdom' ? 'vitest-jsdom' : 'vitest-node'
}

/**
 * Le FACTEUR durée ici / durée CI de chaque population (#2497) : Σlocal/ΣCI de ses paires (`locales` ∩ `ci`) dès
 * `PAIRES_MIN` paires ; sinon son repli de banc (`REPLI_FACTEUR_CI`), à défaut 1, `non calibré`. PURE.
 * @param {{ locales?: Record<string, number>, ci?: { vitest?: Record<string, number>, node?: Record<string, number> }, environnementDe: (test: string) => string | null }} p
 * @returns {Record<string, { valeur: number, paires: number, origine: 'paires' | 'repli' | 'non calibré' }>}
 */
export function facteursCi({ locales = {}, ci = {}, environnementDe }) {
  const sommes = tableTotale(POPULATIONS, () => ({ local: 0, ci: 0, paires: 0 }))
  for (const famille of FAMILLES) for (const [t, ms] of Object.entries(ci[famille] ?? {})) {
    const population = Object.hasOwn(locales, t) ? populationDe(t, environnementDe) : null
    if (population === null) continue
    sommes[population] = { local: sommes[population].local + locales[t], ci: sommes[population].ci + ms, paires: sommes[population].paires + 1 }
  }
  return tableTotale(POPULATIONS, (p) => {
    const { local, ci: somme, paires } = sommes[p]
    if (paires >= PAIRES_MIN && somme > 0) return { valeur: local / somme, paires, origine: 'paires' }
    return Object.hasOwn(REPLI_FACTEUR_CI, p) ? { valeur: REPLI_FACTEUR_CI[p], paires, origine: 'repli' } : { valeur: 1, paires, origine: 'non calibré' }
  })
}

/**
 * L'ESTIMATION de durée de chaque test (#2400, #2497), par priorité : sa durée APPRISE ici (`locales`, source
 * `locale`) ; sinon sa durée de la CI (`ci`, `memoCiDe`) × le facteur de sa population (`facteurs`, `facteursCi`),
 * source `ci` ; sinon `null`, source `inconnue` — hors du rang touché son test part à la CI, au rang touché il
 * est lancé et le mur devient un minorant (`planDExecution`). PURE.
 * @param {string[]} tests
 * @param {{ locales?: Record<string, number>, ci?: { run?: number, vitest?: Record<string, number>, node?: Record<string, number> }, facteurs?: ReturnType<typeof facteursCi>, environnementDe?: (test: string) => string | null }} [sources]
 * @returns {Map<string, { ms: number | null, source: 'locale' | 'ci' | 'inconnue', ciMs?: number, population?: string, facteur?: { valeur: number, paires: number, origine: string }, run?: number }>}
 */
export function estimationsDe(tests, { locales = {}, ci = {}, facteurs = {}, environnementDe = () => null } = {}) {
  return new Map(tests.map((t) => {
    if (Object.hasOwn(locales, t)) return [t, { ms: locales[t], source: 'locale' }]
    const duree = ci[familleDe(t)] ?? {}
    const population = Object.hasOwn(duree, t) ? populationDe(t, environnementDe) : null
    if (population === null || !facteurs[population]) return [t, { ms: null, source: 'inconnue' }]
    const facteur = facteurs[population]
    return [t, { ms: Math.round(duree[t] * facteur.valeur), source: 'ci', ciMs: duree[t], population, facteur, run: ci.run }]
  }))
}

/** Le MUR `murMs` en texte : sa part estimée depuis la CI (`murCiMs`, `nCi` tests ; nulle, le plus long l'absorbe) ;
 *  avec `sansDuree` tests lancés sans durée, un MINORANT `≥ X s`. PURE. */
export const texteDuMur = (murMs, { sansDuree = 0, murCiMs = 0, nCi = 0 } = {}) =>
  `${sansDuree ? '≥ ' : ''}${secondes(murMs)}${nCi ? `, dont ${secondes(murCiMs)} estimées depuis la CI (${nCi} test(s)${murCiMs === 0 ? ', absorbées par le plus long' : ''})` : ''}${sansDuree ? ` (minorant : ${sansDuree} test(s) sans durée)` : ''}`

/**
 * Les déclarations EXPORTÉES d'un module, nom → texte (`export *` sous `*`, l'export par défaut sous
 * `default`) ; un export local `export { a as b }` porte le texte de la déclaration de `a`. `null` : aucune.
 * @param {string} rel @param {string | null} texte @returns {Map<string, string>}
 */
export function declarationsExportees(rel, texte) {
  if (texte === null) return new Map()
  const [{ sourceFile }] = [...analyserCorpus([{ rel, text: texte }])]
  return declarationsDeLArbre(sourceFile)
}

/** `declarationsExportees` d'un arbre déjà analysé. */
function declarationsDeLArbre(sourceFile) {
  const exportees = new Map()
  const ts = typescript()
  const texteDe = (n) => n.getText(sourceFile)
  const nomsDe = (s) => ts.isVariableStatement(s) ? s.declarationList.declarations.flatMap((d) => ts.isIdentifier(d.name) ? [d.name.text] : [])
    : s.name && ts.isIdentifier(s.name) ? [s.name.text] : []
  const locales = new Map()
  for (const s of sourceFile.statements) for (const nom of nomsDe(s)) locales.set(nom, texteDe(s))
  for (const s of sourceFile.statements) {
    const modificateurs = s.modifiers ?? []
    if (ts.isExportAssignment(s)) exportees.set('default', texteDe(s))
    else if (ts.isExportDeclaration(s)) {
      if (!s.exportClause) exportees.set('*', `${exportees.get('*') ?? ''}${texteDe(s)}`)
      else if (ts.isNamespaceExport(s.exportClause)) exportees.set(s.exportClause.name.text, texteDe(s))
      else for (const e of s.exportClause.elements)
        exportees.set(e.name.text, s.moduleSpecifier ? texteDe(s) : locales.get((e.propertyName ?? e.name).text) ?? texteDe(s))
    } else if (modificateurs.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      for (const nom of modificateurs.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ? ['default'] : nomsDe(s)) exportees.set(nom, texteDe(s))
  }
  return exportees
}

/** Les exports TOUCHÉS d'un module entre deux images (`null` : absent) : ajoutés, supprimés ou modifiés. PURE. */
export function exportsTouches(rel, avant, apres) {
  return nomsTouches(declarationsExportees(rel, avant), declarationsExportees(rel, apres))
}

/** Les noms dont la déclaration diffère entre deux tables (`declarationsExportees`). PURE. */
const nomsTouches = (a, b) => new Set([...new Set([...a.keys(), ...b.keys()])].filter((nom) => a.get(nom) !== b.get(nom)))

/**
 * Le SIGNAL d'un test d'import (`SIGNAUX`) : le dernier maillon de sa chaîne (`importeur` → `touche`)
 * importe-t-il par nom un export touché ? Oui : `symbole` à d=1, `module` au-delà. Non : `module` à d=1,
 * `reste` au-delà : un import par espace de noms, par défaut ou `export *` n'est pas un import par nom. PURE.
 * @param {{ distance: number }} lien @param {{ forme: string, importe: { nom: string } | null }[]} liaisons
 *   les liaisons du maillon vers `touche` @param {Set<string>} touches les exports touchés de `touche`
 */
export function signalDe(lien, liaisons, touches) {
  const noms = [...new Set(liaisons.filter((l) => l.forme === 'nommee' && l.importe && touches.has(l.importe.nom)).map((l) => l.importe.nom))].sort()
  if (noms.length) return lien.distance === 1 ? { signal: 'symbole', noms } : { signal: 'module', noms }
  return lien.distance === 1 ? { signal: 'module', noms: [] } : { signal: 'reste', noms: [] }
}

/** Le texte d'un lien, pour le rapport « test ← lien ». */
function texteDuLien(lien) {
  if (lien.nature === 'import') return `import, distance ${lien.distance} : ${lien.chaine.join(' → ')}`
  if (lien.nature === 'racine balayée') return `racine balayée ${lien.racine} (spécificité ${lien.specificite}, site ${lien.site}), ${lien.touche}`
  if (lien.nature === 'setup') return `setup : ${lien.racine ? `racine balayée ${lien.racine} (site ${lien.site}), ` : ''}${lien.touche}`
  return `${lien.nature} : ${lien.touche}`
}

/** Les arguments de la CLI. */
export function lireArguments(args) {
  const options = { liste: false }
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--liste' || a === '--docs') { options[a.slice(2)] = true; continue }
    const valeur = args[i + 1]
    if (!['--base', '--tete', '--budget'].includes(a) || valeur === undefined || valeur.startsWith('--'))
      throw new Error('usage : test:perimetre -- [--base <ref>] [--tete <ref>] [--liste] [--budget <s>] [--docs]')
    i += 1
    if (a === '--budget') {
      if (!/^\d+$/.test(valeur)) throw new Error(`--budget attend un entier de secondes, reçu « ${valeur} »`)
      options.budget = Number(valeur)
    } else options[a.slice(2)] = valeur
  }
  if (options.tete && !options.base) throw new Error('--tete exige --base')
  return options
}

/**
 * Le périmètre du dépôt de `racine` : images du diff (`imagesDuDiff`), post-image lue sur le disque
 * (arbre de travail) ou dans `tete`, mémos sous `dossierDesMemos`.
 */
export function perimetreDuDepot(racine, { base, tete } = {}, { dossierDesMemos = join(racine, CACHE) } = {}) {
  const depot = depotDe(racine)
  const images = imagesDuDiff(depot, { base, tete })
  const lire = images.tete ? (rels) => lireEnLot(depot, images.tete, rels) : lireDuDisque(racine)
  const memos = memosDe(dossierDesMemos, versionDesMemos(racine))
  const lireAvant = (rels) => lireEnLot(depot, images.base, rels)
  const derive = deriverPerimetre({ racine, touches: images.touches, post: images.post, avant: images.avant, lire, lireAvant, memos })
  memos.sauver()
  return { ...images, ...derive, lire }
}

/** Le lecteur des fichiers `rels` de l'arbre de travail de `racine` (`null` : absent). */
const lireDuDisque = (racine) => (rels) => new Map(rels.map((r) => {
  try { return [r, readFileSync(join(racine, r), 'utf8')] } catch { return [r, null] }
}))

/**
 * Les balayages NON RÉSOLUS du dépôt de `racine` (#2400) : chaque valeur `non` d'un site de lecture ou de
 * listage des modules qu'atteint la clôture d'au moins un test, sur l'arbre de travail ; mémos sous
 * `dossierDesMemos`.
 * @returns {NonResolu[]}
 */
export function balayagesNonResolus(racine, { dossierDesMemos = join(racine, CACHE) } = {}) {
  const memos = memosDe(dossierDesMemos, versionDesMemos(racine))
  const { nonResolus } = deriverPerimetre({ racine, touches: [], post: listerImage(depotDe(racine), TRAVAIL), avant: [], lire: lireDuDisque(racine), memos })
  memos.sauver()
  return nonResolus
}

/** Les fichiers touchés PRÉSENTS dont l'extension est lintée (`EXTS_LINT`). PURE. */
const aLinter = (touches, post) => touches.filter((t) => post.includes(t) && EXTS_LINT.some((e) => t.endsWith(e)))

/**
 * Le LINT des fichiers touchés (`aLinter`) par la couture `lancerLint` : ses défauts et son code de sortie.
 * @param {string} racine @param {string[]} touches @param {string[]} post
 * @param {typeof lancerLint} [lancer]
 */
export function lintDesTouches(racine, touches, post, lancer = lancerLint) {
  const fichiers = aLinter(touches, post)
  if (!fichiers.length) return { fichiers, defauts: [], code: 0 }
  const { defauts, codeSortie } = lancer(racine, fichiers, { cwd: racine })
  return { fichiers, defauts, code: codeSortie || (defauts.length ? 1 : 0) }
}

/** Le mémo `nom` du dossier `dossier` lu par `valider` (`DUREES`, `SURCOUTS` : `dureesValides` ; `DUREES_CI` :
 *  `memoCiDe`) ; `{}` s'il est absent ou illisible. */
const memoDe = (dossier, nom, valider = dureesValides) => {
  let lu
  try { lu = JSON.parse(readFileSync(join(dossier, nom), 'utf8')) } catch { return {} }
  return valider(lu)
}

/** Écrit `entrees` au mémo `nom` de `mesures` ; un échec s'imprime avec sa cause, sans lever : apprendre ne change
 *  pas le verdict des tests. Rend `true` si l'écriture a eu lieu. */
export function ecrireLesMesures(mesures, nom, entrees) {
  try {
    mesures.ecrire(nom, entrees)
    return true
  } catch (erreur) {
    console.log(`[perimetre] mesures non écrites — ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return false
  }
}

/** Le dossier des MESURES de la machine (#2400) : durées et surcoûts appris sont des faits de la machine, pas de
 *  l'arbre ; ils vivent sous le répertoire git COMMUN du dépôt de `racine` (`arbrePrincipal`), partagé par ses
 *  worktrees. */
export function dossierDesMesures(racine) {
  const principal = arbrePrincipal(depotDe(racine))
  if (!principal.disponible) throw new Error(`perimetre : mesures sans dossier commun — ${principal.raison}`)
  return join(principal.valeur, '.git', 'perimetre')
}

/**
 * Les MESURES sous `dossier` (`DUREES`, `SURCOUTS`, `DUREES_CI`), que plusieurs sessions écrivent, sous verrou
 * (`prendreVerrou`) et d'un geste (`ecrireJsonAtomique`). `lire(nom, valider)` : `memoDe`. `ecrire(nom, entrees)`
 * relit et fusionne entrée par entrée — la mesure écrite, la plus récente, gagne. `remplacer(nom, valeur)` écrit
 * `valeur` entière, sans fusion.
 * @param {string} dossier
 */
export function mesuresDe(dossier) {
  const sousVerrou = (nom, valeur) => {
    mkdirSync(dossier, { recursive: true })
    const prise = prendreVerrou({ chemin: join(dossier, `${nom}.verrou`), libelle: `mesures ${nom} du périmètre`, attente: ATTENTE_DES_MESURES })
    if (prise.etat !== 'pris') throw new Error(prise.message)
    try { ecrireJsonAtomique(join(dossier, nom), valeur()) } finally { prise.liberer() }
  }
  return {
    lire: (nom, valider) => memoDe(dossier, nom, valider),
    ecrire: (nom, entrees) => sousVerrou(nom, () => ({ ...memoDe(dossier, nom), ...entrees })),
    remplacer: (nom, valeur) => sousVerrou(nom, () => valeur),
  }
}

/**
 * Les WORKERS de chaque famille d'un lancement (#2400) : ceux que `run.mjs` sert à UN processus Vitest
 * (`capaciteDuLanceur`, `maxWorkersMono`) — les reporters du périmètre (`reportersVitest` : `--reporter`,
 * `--outputFile`) sont des `DRAPEAUX_MONO` (scripts/test/partition.mjs:205), sans partage node/jsdom —, et la
 * concurrence par défaut de `node --test` (`--test-concurrency`, doc Node : `os.availableParallelism() - 1`).
 * @param {NodeJS.ProcessEnv} env
 */
export function workersDuLancement(env) {
  return { vitest: maxWorkersMono(capaciteDuLanceur(env).servis), node: Math.max(1, availableParallelism() - 1) }
}

/**
 * Le SURCOÛT observé d'un lancement de la famille `famille` (#2400, #2474) : son mur RÉEL `murMs`, moins le mur
 * simulé de ses fichiers `appris` (`{ [test]: ms }`) sur ses workers effectifs (`murDesFichiers` sans surcoût),
 * plancher 0. PURE.
 * @param {string} famille @param {number} murMs @param {Record<string, number>} appris @param {Record<string, number>} workers
 */
export function surcoutObserve(famille, murMs, appris, workers) {
  const estime = murDesFichiers({ [famille]: Object.entries(appris) }, { workers })
  return Math.max(0, Math.round(murMs - estime))
}

/** Le libellé d'une durée en secondes. */
const secondes = (ms) => `${(ms / 1000).toFixed(1)} s`
/** L'estimation d'un test en texte (`estimationsDe`) : apprise ici, de la CI calibrée (sa course, son facteur, sa
 *  population), de la CI non calibrée, ou inconnue. PURE. */
export const texteDeLEstimation = ({ ms, source, run, facteur, population }) => {
  if (ms === null) return ' durée inconnue'
  if (source === 'locale') return ` ~${secondes(ms)} (apprise ici)`
  if (facteur.origine === 'non calibré') return ` ~${secondes(ms)} (CI ${run}, non calibrée, ${population})`
  return ` ~${secondes(ms)} (CI ${run} × ${facteur.valeur.toFixed(2)}${facteur.origine === 'repli' ? ' repli de banc' : ''}, ${population})`
}

/** Le texte de l'écart d'un mur réel `reelMs` à son estimation `estimeMs`, en %. PURE. */
const texteDeLEcart = (reelMs, estimeMs) => {
  if (estimeMs <= 0) return 'écart non défini'
  const pourcent = Math.round(((reelMs - estimeMs) / estimeMs) * 100)
  return `écart ${pourcent > 0 ? '+' : ''}${pourcent} %`
}

/** Le RAPPORT de durées du lancement `i` de la famille `famille`, sous `dossier`, propre au processus `pid`. PURE. */
export const rapportDuLancement = (dossier, pid) => (famille, i) => join(dossier, `${famille}-${pid}-${i}.json`)

/**
 * Le PLAN d'exécution des tests `retenus` sur les `mesures` (`mesuresDe`) : durées apprises ici (`DUREES`) et de
 * la CI (`DUREES_CI`), environnements des tests Vitest lus par `lire` (`environnementDe`), facteurs
 * (`facteursCi`), estimations (`estimationsDe`), surcoûts (`SURCOUTS`, `REPLI_SURCOUT_MS`), plan (`planDExecution`).
 * @param {Map<string, { rang: number, specificite?: number }>} retenus
 * @param {{ mesures: ReturnType<typeof mesuresDe>, lire: (rels: string[]) => Map<string, string | null>, budget?: number, signaux?: Map<string, { signal: string }>, workers?: Record<string, number> }} p
 */
export function planDuPerimetre(retenus, { mesures, lire, budget, signaux, workers }) {
  const locales = mesures.lire(DUREES)
  const ci = mesures.lire(DUREES_CI, memoCiDe)
  const aLire = [...new Set([...retenus.keys(), ...Object.keys(ci.vitest ?? {}).filter((t) => Object.hasOwn(locales, t))])].filter((t) => familleDe(t) === 'vitest')
  const environnements = new Map([...lire(aLire)].map(([t, texte]) => [t, texte === null ? null : environnementDe(texte)]))
  const environnementDuTest = (t) => environnements.get(t) ?? null
  const facteurs = facteursCi({ locales, ci, environnementDe: environnementDuTest })
  const estimations = estimationsDe([...retenus.keys()], { locales, ci, facteurs, environnementDe: environnementDuTest })
  const surcouts = { ...REPLI_SURCOUT_MS, ...mesures.lire(SURCOUTS) }
  return { ci, facteurs, estimations, surcouts, plan: planDExecution(retenus, { budget, estimations, signaux, workers, surcouts }) }
}

function principal() {
  const options = lireArguments(process.argv.slice(2))
  const debut = performance.now()
  const racine = racineDe(depotDe(RACINE)) ?? RACINE
  const { base, tete, touches, post, retenus, toolchain, nonResolus, vitest, node, modules, signaux, lire } = perimetreDuDepot(racine, options)
  const duree = Math.round(performance.now() - debut)
  const docs = selectionDesGenerateurs({ lot: touches, mesure: sourcesMesurees(racine), cwd: racine })
  const cache = join(racine, CACHE)
  const rapport = rapportDuLancement(cache, process.pid)
  const mesures = mesuresDe(dossierDesMesures(racine))
  const rapatriement = options.liste ? null : rapatrierDureesCi({ mesures, cwd: racine })
  const budget = options.budget ?? BUDGET_LOCAL_S
  const workers = workersDuLancement(process.env)
  const { ci, facteurs, estimations, surcouts, plan } = planDuPerimetre(retenus, { mesures, lire, budget, signaux, workers })
  const part = (liste) => liste.filter((t) => retenus.has(t)).length
  const journal = (texte) => console.log(`[perimetre] ${texte}`)
  journal(`base ${base} → ${tete ?? 'arbre de travail'} : ${touches.length} fichier(s) touché(s)`)
  journal(`dérivation : ${duree} ms, ${modules} modules au graphe`)
  if (toolchain.length) journal(`toolchain touchée (${toolchain.join(', ')}) ⇒ suite entière`)
  journal(`sélection : ${retenus.size} test(s) / ${vitest.length + node.length} — vitest ${part(vitest)}/${vitest.length}, node ${part(node)}/${node.length}`)
  journal(`rangs : ${Object.entries(paliersDe(retenus)).map(([palier, n]) => `${palier} ${n}`).join(' | ')}`)
  const texteDuSignal = (test) => {
    const s = signaux.get(test)
    return s ? ` [${s.signal}${s.noms.length ? ` : ${s.noms.join(', ')}` : ''}]` : ''
  }
  const lancesAuPlan = new Set(plan.lances)
  for (const [test, lien] of [...retenus].sort(([a], [b]) => (a < b ? -1 : 1)))
    console.log(`  ${test} ← ${texteDuLien(lien)}${texteDuSignal(test)}${texteDeLEstimation(estimations.get(test))} → ${lancesAuPlan.has(test) ? 'lancé' : 'CI'}`)
  const jouerDocs = options.docs && !docs.complete && docs.scripts.length > 0
  journal(`docs dérivés : ${docs.scripts.length} générateur(s) (${docs.raison}) ${jouerDocs ? 'en --check' : `→ CI${docs.complete || !docs.scripts.length ? '' : ' (`--docs` pour les jouer)'}`}${docs.scripts.length ? ` : ${docs.scripts.join(', ')}` : ''}`)
  journal(`balayages non résolus : ${nonResolus.length} site(s)`)
  for (const { site, helper, raison } of nonResolus) console.log(`  non résolu ${site} ${helper} — ${raison}`)
  const sources = [...estimations.values()].reduce((n, { source }) => ({ ...n, [source]: (n[source] ?? 0) + 1 }), {})
  journal(`estimations : ${Object.entries(sources).map(([s, n]) => `${s} ${n}`).join(' | ') || 'aucune'} ; durées CI : ${ci.run ? `course ${ci.run} du ${ci.date} (${ci.sha.slice(0, 9)})` : 'aucune mémorisée'}`)
  journal(`facteurs CI : ${Object.entries(facteurs).map(([p, f]) => `${p} ${f.valeur.toFixed(2)} (${f.origine === 'paires' ? `${f.paires} paires` : `${f.origine === 'repli' ? 'repli de banc' : 'non calibré'}, ${f.paires} paire(s)`})`).join(' | ')}`)
  journal(rapatriement === null ? 'CI non rapatriée — --liste n’écrit rien'
    : !rapatriement.disponible ? `CI non rapatriée — ${rapatriement.raison}`
      : rapatriement.valeur.etat === 'refus' ? `CI non rapatriée — ${rapatriement.valeur.raison}`
        : `CI ${rapatriement.valeur.etat === 'deja' ? 'déjà mémorisée' : 'rapatriée'} : course ${rapatriement.valeur.memo.run}`)
  journal(`mur : workers vitest ${workers.vitest}, node ${workers.node} ; surcoût de lancement vitest ${secondes(surcouts.vitest)}, node ${secondes(surcouts.node)}`)
  for (const r of plan.rangs)
    journal(`  ${r.rang} : mur estimé ${texteDuMur(r.murMs, r)}, ${r.lances} lancé(s)${r.inconnues ? ` ; ${r.inconnues} de durée inconnue ${r.rang === 'touché' ? 'lancé(s) hors estimation' : 'à la CI'}` : ''}${r.aLaCI ? ` ; ${r.aLaCI} fichier(s) ${r.rang.replace('import ', '')} restent à la CI` : ''}`)
  journal(`budget ${budget} s de mur (touché hors budget) : ${plan.lances.length} lancé(s), mur estimé ${texteDuMur(plan.murMs, plan)}, dont ${secondes(plan.murBudgeteMs)} au budget ; → CI ${plan.aLaCI.length}`)
  journal(`lint : ${aLinter(touches, post).length} fichier(s) touché(s)${options.liste ? ' (non joué sous --liste)' : ''}`)
  if (options.liste) return 0
  const lint = lintDesTouches(racine, touches, post)
  for (const d of lint.defauts) console.log(`  ${d.site} ${d.gravite} ${d.regle} — ${d.message}`)
  let code = lint.code
  const lances = new Set(plan.lances)
  mkdirSync(cache, { recursive: true })
  const paquets = [
    ...paquetsDArgv(vitest.filter((t) => lances.has(t))).map((p) => ({ famille: 'vitest', p })),
    ...paquetsDArgv(node.filter((t) => lances.has(t))).map((p) => ({ famille: 'node', p })),
  ]
  const lancements = [
    ...paquets.map(({ famille, p }, i) => {
      const sortie = rapport(famille, i)
      return { famille, sortie, args: famille === 'vitest' ? ['scripts/test/run.mjs', ...p, ...reportersVitest(sortie)]
        : ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
          `--test-reporter=${pathToFileURL(join(RACINE, 'scripts/test/dureesNodeTest.mjs')).href}`, `--test-reporter-destination=${sortie}`, ...p] }
    }),
    ...(jouerDocs ? [{ famille: null, sortie: null, args: ['scripts/docs/build-all.mjs', '--check', '--only', ...docs.scripts] }] : []),
  ]
  const reels = {}
  for (const { famille, sortie, args } of lancements) {
    if (sortie) rmSync(sortie, { force: true })
    const debutDuLancement = performance.now()
    const r = spawnSync(process.execPath, args, { cwd: racine, stdio: 'inherit' })
    const murMs = performance.now() - debutDuLancement
    if (code === 0) code = codeEnfant(r.status, r.signal)
    if (!famille) continue
    reels[famille] = (reels[famille] ?? 0) + murMs
    const appris = apprendre(racine, sortie, mesures)
    if (!Object.keys(appris).length) continue
    const surcout = surcoutObserve(famille, murMs, appris, workers)
    journal(`${famille} : ${Object.keys(appris).length} fichier(s), mur réel ${secondes(murMs)} ; surcoût observé ${secondes(surcout)}`)
    ecrireLesMesures(mesures, SURCOUTS, { [famille]: surcout })
  }
  for (const [famille, murMs] of Object.entries(reels))
    journal(`${famille} : mur réel ${secondes(murMs)} pour ${secondes(plan.murParFamille[famille])} estimés au plan (${texteDeLEcart(murMs, plan.murParFamille[famille])})`)
  const reelTotal = Object.values(reels).reduce((a, b) => a + b, 0)
  journal(`mur réel total ${secondes(reelTotal)} pour ${plan.sansDuree ? '≥ ' : ''}${secondes(plan.murMs)} estimés (${texteDeLEcart(reelTotal, plan.murMs)})`)
  return code
}

/** Fusionne dans les `DUREES` de `mesures` (`mesuresDe`) le rapport de durées `rapport` d'UN lancement
 *  (`rapportDuLancement` ; `dureesVitest` ou `dureesNodeTest` : `{ [chemin absolu]: ms }`, chemins rendus relatifs), puis
 *  l'efface, que l'écriture (`ecrireLesMesures`) réussisse ou échoue. Rend les durées apprises ; `{}` sans rapport. */
export function apprendre(racine, rapport, mesures) {
  const base = resolve(racine).split(sep).join('/')
  const relDe = (a) => a.split(sep).join('/').replace(`${base}/`, '')
  let lu
  try { lu = JSON.parse(readFileSync(rapport, 'utf8')) } catch { return {} } finally { rmSync(rapport, { force: true }) }
  const appris = Object.fromEntries(Object.entries(lu).map(([f, ms]) => [relDe(f), Math.round(ms)]))
  if (Object.keys(appris).length) ecrireLesMesures(mesures, DUREES, appris)
  return appris
}

if (import.meta.main) {
  try {
    process.exitCode = principal()
  } catch (erreur) {
    console.error(`[perimetre] ${erreur.message}`)
    process.exitCode = 2
  }
}
