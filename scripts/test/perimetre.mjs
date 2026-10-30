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
// Suite du noyau (#2817) : la dérivation ne la voit pas (la suite principale l'exclut) ; dès qu'un fichier de `src/` est
// touché, elle se joue ENTIÈRE par `npm run test:noyau` (`suiteDuNoyauALancer`, `MOTIF_HORS_STORE`).
// Le graphe résout contre la post-image ∪ la base : l'importeur pendu vers un fichier SUPPRIMÉ reste lié.
// Les spécificateurs non résolus, les lectures de module, leurs liaisons et leurs déclarations exportées se
// mémoïsent par blob sous `CACHE` ; l'évaluation de chaque module, avec les réponses des requêtes qu'elle a
// posées (`tracer`, `VARIANTES`). Tous signés par `versionDesMemosDeDerivation` (`perimetreDerivation.mjs`).
import { availableParallelism, tmpdir } from 'node:os'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { paquetsDArgv } from '../guards/lib/porteSpawn.mjs'
import { citeArgument } from '../guards/lib/commandeShell.mjs'
import { depotDe, lireEnLot, racineDe } from '../guards/lib/gitPorte.mjs'
import { selectionDesGenerateurs, sourcesMesurees } from '../git-hooks/selection-des-derives.mjs'
import { DRAPEAU_REGIME, EMPREINTES_WORKER_MO, PORTEE_LOT_S, capaciteDuLanceur, environnementDe, maxWorkersMono } from './partition.mjs'
import { DUREES_CI, memoCiDe, rapatrierDureesCi } from './dureesCi.mjs'
import { EXTENSIONS_DE_SCRIPT } from '../guards/lib/dialecte.mjs'
import { appelDuLint, lancerLint } from '../guards/lib/lintStage.mjs'
import { lireArguments } from './argumentsPerimetre.mjs'
import { prendreVerrouAsync, tenantEnUneLigne } from './verrou.mjs'
import { verrouGestesLourds } from './verrouGestesLourds.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { ecrireJsonAtomique, lireTextePublie } from '../guards/lib/ecritureJsonAtomique.mjs'
import { dossierDesMesures, mesuresDe } from './mesures.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { GATES_D_AUDIT, estTestNode, gateDe } from '../gates/testsParGate.mjs'
import { ECRIT_LU } from '../gates/toutes.mjs'
import { CONCURRENCE_SANS_PROFIL, lancerNodeMesure, profilsDuLancement } from './memoire.mjs'
import { spawnBorne, diagnosticArret } from '../guards/lib/processusBorne.mjs'
import { BACKOFFS_MS, attendreSync } from '../guards/lib/spawnResilient.mjs'
import { CACHE, lireDuDisque, RANG_SETUP, RANG_TOOLCHAIN, depuisDTO } from './perimetreDerivation.mjs'
import { estDeLaSuiteDuNoyau, SUITES_VITEST_DE_CI } from '../guards/lib/racinesDeLaSuite.mjs'
import { RACINES_DES_ZONES } from '../guards/lib/couches.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** #2400 */
const BUDGET_LOCAL_S = 180

/** Les signaux d'un test d'import, du plus fort au plus faible (#2400) : il importe par NOM un export
 *  touché (`symbole`), il importe le module sans symbole touché (`module`), le reste. */
const SIGNAUX = Object.freeze(['symbole', 'module', 'reste'])

/** Le SURCOÛT de lancement de REPLI par famille, en ms, sans surcoût appris (`SURCOUTS`) : paramètre de BANC,
 *  `surcoutObserve` mesuré le 2026-10-07, 16 cœurs, contre le mur `max(Σ/workers, plus long)` — un MAJORANT du
 *  surcoût que mesure `murSimule`, qui ne descend jamais sous ce mur — : Vitest : 22 fichiers sur 2 workers, mur
 *  84,7 s ; node : 20 fichiers de moins de 3 s sur 15 workers, mur 4,5 s. */
export const REPLI_SURCOUT_MS = Object.freeze({ vitest: 3749, node: 2911 })

/** Borne du vieil espace V8 de l'enfant de `derivationBornee`, en Mo : paramètre de BANC, mesuré le 2026-10-28 sur un
 *  conteneur de 4 cœurs et 15,7 Go, Node 24.22.0, dérivation `balayages` sans mémos, par paliers de
 *  `--max-old-space-size` : l'arbre ea6f10e50e meurt à 580 et passe à 640 ; un seul test ajouté par le lot de #3080
 *  (`retrait-des-entrees-nommees.test.mjs`) décale les lots `LOT_D_ANALYSE` qui le suivent, l'arbre meurt alors à 640 et
 *  passe à 720 ; à 1024, 122 s et 1 193 Mo de mémoire résidente au pic (#3080). */
export const TAS_DERIVATION_MO = 1024

/** Les POPULATIONS d'une durée de la CI, chacune son facteur (`facteursCi`). */
const POPULATIONS = Object.freeze(['vitest-node', 'vitest-jsdom', 'node'])

/** Les paires (durée apprise ici, durée CI) sous lesquelles une population prend son REPLI (`REPLI_FACTEUR_CI`). */
const PAIRES_MIN = 10

/** Le facteur durée ici / durée CI de REPLI de chaque population, sous `PAIRES_MIN` paires : paramètre de BANC, Σlocal/ΣCI
 *  (`facteursCi`) mesuré le 2026-10-08, 16 cœurs, sur le mémo commun après 3 runs réels et la course 37757884555 :
 *  vitest-node 128 paires, vitest-jsdom 23, node 163 (#2497). */
export const REPLI_FACTEUR_CI = Object.freeze({ 'vitest-node': 2.16, 'vitest-jsdom': 3.63, node: 5.85 })

/** Le mémo des durées apprises, sous `dossierDesMesures` : `{ [test]: ms }`. */
const DUREES = 'durees.json'

/** Le NOM d'un mémo `base` dont la valeur dépend du modèle `modele` : une valeur écrite sous un autre modèle, par du
 *  code d'une autre version, n'est jamais lue, ni écrasée. PURE. */
export const nomDuMemo = (base, modele) => `${base}.${modele}.json`

/** Le MODÈLE du mur (`murDesFichiers`) : changé à chaque changement du sens du mur, donc du surcoût appris. */
const MODELE_DU_MUR = 'parents-sequentiels-servis'

/** Le mémo des surcoûts de lancement appris, sous `dossierDesMesures` : `{ [famille]: ms }`, sous `MODELE_DU_MUR`. */
export const SURCOUTS = nomDuMemo('surcouts', MODELE_DU_MUR)

/** `fichier` est sous le chemin `lu` d'un `lit` d'`ECRIT_LU` : le dossier entier s'il finit par `/`, le fichier sinon. */
const sousLeChemin = (fichier, lu) => (lu.endsWith('/') ? fichier.startsWith(lu) : fichier === lu)

/** Les lignes de journal des gates DÉLÉGUÉES à la CI (`delegueeAuPerimetre` d'`ECRIT_LU`, #3145) qu'un des fichiers
 *  `touches` désigne par leur `lit`, chacune avec son premier touché. PURE. */
export const lignesDeDelegation = (touches, ecritLu = ECRIT_LU) => Object.entries(ecritLu).flatMap(([gate, { lit, delegueeAuPerimetre }]) => {
  const touche = delegueeAuPerimetre && touches.find((t) => lit.some((lu) => sousLeChemin(t, lu)))
  return touche ? [`→ CI gate ${gate} : déléguée (${delegueeAuPerimetre}), désignée par ${touche}`] : []
})

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

/** Les familles de tests, chacune lancée par son propre processus. */
const FAMILLES = Object.freeze(['vitest', 'node'])

/**
 * L'ORDRE dans lequel le lanceur de la famille `famille` démarre ses fichiers `[test, ms][]` (chemins POSIX). PURE.
 * - node : lexical sur le chemin au séparateur NATIF `separateur` (node v22, `internal/test_runner/runner`
 *   `createTestFileList` → `ArrayPrototypeSort` des chemins du glob).
 * - vitest : durée décroissante (`BaseSequencer.sort`, node_modules/vitest/dist/chunks/index.DpLw24bj.js:13385-13414) ;
 *   ses autres clés — échec au run précédent d'abord, fichier sans résultat en cache d'abord, puis par taille — lisent
 *   le cache de Vitest, absent des mesures : non reproduites.
 */
export const ordreDuLanceur = (famille, fichiers, separateur = sep) => {
  const natif = (chemin) => chemin.split('/').join(separateur)
  return [...fichiers].sort(famille === 'node'
    ? ([a], [b]) => (natif(a) < natif(b) ? -1 : natif(a) > natif(b) ? 1 : 0)
    : ([a, ma], [b, mb]) => mb - ma || (a < b ? -1 : a > b ? 1 : 0))
}

/** Le MUR simulé de durées `durees` démarrées dans cet ordre sur `workers` workers : chaque fichier va au premier
 *  worker libre (ordonnancement par liste). PURE. */
const murSimule = (durees, workers) => {
  const libres = Array.from({ length: Math.max(1, Math.min(workers, durees.length)) }, () => 0)
  for (const ms of durees) libres[libres.indexOf(Math.min(...libres))] += ms
  return Math.max(...libres)
}

/** Les paquets de lancement des tests `tests` d'une famille, un lancement par paquet : leurs chemins triés, groupés sous
 *  le budget séquentiel estimé `budgetMs`, puis sous `paquetsDArgv`. Lu par le plan (`murDesFichiers`, `planDExecution`),
 *  dont le lancement (`principal`) joue les paquets. PURE. */
export function paquetsDeLancement(tests, { estimations, budgetMs = Infinity } = {}) {
  const ordonnes = [...new Set(tests)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const groupes = []
  let courant = [], poids = 0
  const finir = () => { if (courant.length) groupes.push(courant); courant = []; poids = 0 }
  for (const test of ordonnes) {
    const ms = estimations?.get(test)?.ms
    if (budgetMs !== Infinity && (!(ms > 0) || !Number.isFinite(ms) || ms > budgetMs || budgetMs <= 0)) {
      finir(); groupes.push([test]); continue
    }
    if (courant.length && poids + (ms ?? 0) > budgetMs) finir()
    courant.push(test)
    poids += ms ?? 0
  }
  finir()
  return groupes.flatMap((groupe) => paquetsDArgv(groupe))
}

/**
 * Le MUR estimé des fichiers `[test, ms][]` de chaque famille (#2400, #2474) : par famille lancée, son ordonnancement
 * par liste simulé dans l'ordre de son lanceur (`ordreDuLanceur`, `murSimule`) sur ses workers EFFECTIFS
 * (`workers`), plus son surcoût de lancement (`surcouts`) par lancement, un par paquet (`paquetsDeLancement`) ; les
 * familles s'enchaînent. PURE.
 * @param {Record<string, [string, number][]>} fichiers
 * @param {{ workers?: Record<string, number>, surcouts?: Record<string, number> }} [options]
 */
function murDesFichiers(fichiers, { workers = {}, surcouts = {}, paquets = (f, tests) => paquetsDeLancement(tests), workersNode = () => workers.node ?? 1 } = {}) {
  let mur = 0
  for (const f of FAMILLES) {
    const liste = fichiers[f] ?? []
    const durees = new Map(liste)
    for (const paquet of paquets(f, liste.map(([t]) => t)))
      mur += murSimule(ordreDuLanceur(f, paquet.map((t) => [t, durees.get(t)])).map(([, ms]) => ms),
        Math.max(1, f === 'node' ? workersNode(paquet) : workers[f] ?? 1)) + (surcouts[f] ?? 0)
  }
  return mur
}

/** Les fichiers `[test, ms][]` VIDES de chaque famille. PURE. */
const fichiersVides = () => tableTotale(FAMILLES, () => [])

/**
 * La politique d'exécution (#2400) : touché HORS budget, toujours lancé, hors un test d'une gate d'audit
 * (`GATES_D_AUDIT`, `gateDe`), qui part à la CI à tout rang, touché compris (#2586) ; puis la racine balayée, les rangs
 * d'import, setup et toolchain dans l'ordre, chacun trié par signal (`SIGNAUX`), puis spécificité de la
 * racine (`specificite`, la plus petite d'abord), puis estimation croissante, puis chemin. Un test s'ajoute
 * tant que le MUR estimé (`murDesFichiers`) des tests lancés, diminué de celui des seuls touchés, reste ≤ `budget`
 * secondes ; celui qui déborde part à la CI et les suivants s'essaient encore (#2474). Hors du rang touché, un test de durée
 * INCONNUE (`estimationsDe`) part à la CI sans couper les suivants ; au rang touché, il est lancé hors estimation. PURE.
 * @param {Map<string, { rang: number, specificite?: number }>} retenus
 * @param {{ budget?: number, estimations?: Map<string, { ms: number }>, signaux?: Map<string, { signal: string }>, workers?: Record<string, number>, surcouts?: Record<string, number> }} [options]
 * Chaque mur porte ses tests lancés SANS DURÉE (`sansDuree`), dont il n'est qu'un minorant, et sa part estimée
 * depuis la CI (`murCiMs`, ses `nCi` tests lancés de source `ci`) : le mur cumulé moins le même mur où les durées CI
 * de CE rang (au total : de tous) valent 0, les autres gardant les leurs ; jamais planchée (`texteDuMur`).
 * `murParFamille` : le mur de chaque famille seule ; `sansDureeParFamille` : ses tests lancés sans durée ; `causes` : les
 * renvois à la CI par cause (`CAUSES_DE_RENVOI`).
 * @returns {{ lances: string[], aLaCI: string[], causes: Record<string, number>, murMs: number, murBudgeteMs: number, sansDuree: number, murCiMs: number, nCi: number, murParFamille: Record<string, number>, sansDureeParFamille: Record<string, number>, rangs: { rang: string, murMs: number, sansDuree: number, murCiMs: number, nCi: number, lances: number, aLaCI: number, inconnues: number }[] }}
 */
export function planDExecution(retenus, { budget = BUDGET_LOCAL_S, estimations = new Map(), signaux = new Map(), workers, surcouts, workersNode } = {}) {
  const parRang = new Map()
  for (const [test, { rang }] of retenus) parRang.set(rang, [...(parRang.get(rang) ?? []), test])
  const cout = (t) => estimations.get(t)?.ms ?? 0
  const inconnue = (t) => (estimations.get(t)?.ms ?? null) === null
  const force = (t) => SIGNAUX.indexOf(signaux.get(t)?.signal ?? 'reste')
  const specificite = (t) => retenus.get(t).specificite ?? 0
  const deLaCi = (t) => estimations.get(t)?.source === 'ci'
  const paquets = (famille, tests) => paquetsDeLancement(tests, famille === 'node'
    ? { estimations, budgetMs: Math.min(30 * 60_000, Math.max(0, budget * 1000)) } : {})
  const optionsDuMur = { workers, surcouts, paquets, workersNode }
  const mur = (fichiers) => murDesFichiers(fichiers, optionsDuMur)
  const partCi = (fichiers, tests) => Math.round(mur(fichiers) - mur(tableTotale(FAMILLES, (f) => fichiers[f].map(([t, ms]) => [t, tests.has(t) ? 0 : ms]))))
  const cumuls = fichiersVides()
  const avec = (t) => ({ ...cumuls, [familleDe(t)]: [...cumuls[familleDe(t)], [t, cout(t)]] })
  const lances = []
  const aLaCI = []
  const causes = tableTotale(CAUSES_DE_RENVOI, () => 0)
  const rangs = []
  let horsBudget = 0
  for (const rang of [...parRang.keys()].sort((a, b) => a - b)) {
    const tests = parRang.get(rang).sort((a, b) => force(a) - force(b) || specificite(a) - specificite(b) || cout(a) - cout(b) || (a < b ? -1 : 1))
    const avant = mur(cumuls)
    const ciDuRang = new Set()
    const bilan = { rang: libelleDuRang(rang), murMs: 0, sansDuree: 0, murCiMs: 0, nCi: 0, lances: 0, aLaCI: 0, inconnues: 0 }
    for (const t of tests) {
      const renvoi = GATES_D_AUDIT.includes(gateDe(t)) ? 'audit'
        : rang > 0 && inconnue(t) ? 'durée inconnue'
          : rang > 0 && (budget === 0 || mur(avec(t)) - horsBudget > budget * 1000) ? 'budget' : null
      if (renvoi !== 'audit' && inconnue(t)) bilan.inconnues += 1
      if (renvoi) {
        aLaCI.push(t)
        causes[renvoi] += 1
        bilan.aLaCI += 1
        continue
      }
      Object.assign(cumuls, avec(t))
      if (rang === 0) horsBudget = mur(cumuls)
      if (inconnue(t)) bilan.sansDuree += 1
      if (deLaCi(t)) ciDuRang.add(t)
      if (deLaCi(t)) bilan.nCi += 1
      lances.push(t)
      bilan.lances += 1
    }
    bilan.murMs = mur(cumuls) - avant
    bilan.murCiMs = partCi(cumuls, ciDuRang)
    rangs.push(bilan)
  }
  const total = (cle) => rangs.reduce((n, r) => n + r[cle], 0)
  const murParFamille = tableTotale(FAMILLES, (f) => murDesFichiers({ [f]: cumuls[f] }, optionsDuMur))
  const sansDureeParFamille = tableTotale(FAMILLES, (f) => lances.filter((t) => familleDe(t) === f && inconnue(t)).length)
  const paquetsDuPlan = tableTotale(FAMILLES, (f) => paquets(f, cumuls[f].map(([t]) => t)))
  return { lances, aLaCI, causes, murMs: mur(cumuls), murBudgeteMs: mur(cumuls) - horsBudget, sansDuree: total('sansDuree'),
    murCiMs: partCi(cumuls, new Set(lances.filter(deLaCi))), nCi: total('nCi'), murParFamille, sansDureeParFamille, rangs,
    paquets: paquetsDuPlan, concurrencesNode: paquetsDuPlan.node.map((p) => workersNode?.(p) ?? workers?.node ?? 1) }
}

/** Les causes d'un renvoi à la CI (`planDExecution`). */
const CAUSES_DE_RENVOI = Object.freeze(['budget', 'audit', 'durée inconnue'])

/**
 * Le BILAN du périmètre (#2651), en fichiers (l'unité `Test Files` de Vitest) : joués (`joues`, mesurés aux rapports ;
 * sous `--liste`, le plan), retenus et suite, par famille, et les renvois à la CI par cause (`causes`). Il ne dit
 * « suite entière » que d'une suite entièrement jouée, ou, sous `--liste`, entièrement au plan. PURE.
 * @param {{ joues: Set<string>, retenus: Map<string, unknown>, vitest: string[], node: string[], causes: Record<string, number>, liste: boolean }} p
 */
function ligneDeBilan({ joues, retenus, vitest, node, causes, liste }) {
  const compte = (suite) => [suite.filter((t) => joues.has(t)).length, suite.filter((t) => retenus.has(t)).length, suite.length]
  const [l, r, s] = compte([...vitest, ...node])
  const parFamille = Object.entries({ vitest, node }).map(([f, suite]) => `${f} ${compte(suite).join('/')}`).join(', ')
  const renvois = Object.values(causes).reduce((a, b) => a + b, 0)
  const entiere = s > 0 && l === s ? ` — suite entière ${liste ? 'au plan' : 'jouée'}` : ''
  return `bilan : ${liste ? 'à jouer' : 'joué(s)'} ${l} / retenu(s) ${r} / suite ${s} fichier(s)${entiere} (${parFamille}) ;`
    + ` → CI ${renvois} (${CAUSES_DE_RENVOI.map((c) => `${c} ${causes[c]}`).join(', ')})`
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
 * `PAIRES_MIN` paires ; sinon son repli de banc (`REPLI_FACTEUR_CI`). PURE.
 * @param {{ locales?: Record<string, number>, ci?: { vitest?: Record<string, number>, node?: Record<string, number> }, environnementDe: (test: string) => string | null }} p
 * @returns {Record<string, { valeur: number, paires: number, origine: 'paires' | 'repli' }>}
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
    return { valeur: REPLI_FACTEUR_CI[p], paires, origine: 'repli' }
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

/** La part CI `murCiMs` de `nCi` tests d'un mur, en texte (`texteDuMur`). PURE. */
const texteDeLaPartCi = (murCiMs, nCi) => murCiMs < 0 ? `, part CI non séparable (${nCi} test(s) estimés depuis la CI)`
  : `, dont ${secondes(murCiMs)} estimées depuis la CI (${nCi} test(s)${murCiMs === 0 ? ', absorbées par le plus long' : ''})`

/** Le MUR `murMs` en texte : sa part estimée depuis la CI (`murCiMs`, `nCi` tests ; #2497 : EXACTEMENT nulle, le
 *  plus long l'absorbe ; négative, anomalie d'ordonnancement, non séparable — jamais planchée) ; avec `sansDuree` tests
 *  lancés sans durée, un MINORANT `≥ X s`. PURE. */
export const texteDuMur = (murMs, { sansDuree = 0, murCiMs = 0, nCi = 0 } = {}) =>
  `${sansDuree ? '≥ ' : ''}${secondes(murMs)}${nCi ? texteDeLaPartCi(murCiMs, nCi) : ''}${sansDuree ? ` (minorant : ${sansDuree} test(s) sans durée)` : ''}`

/** Le texte d'un lien, pour le rapport « test ← lien ». */
function texteDuLien(lien) {
  if (lien.nature === 'import') return `import, distance ${lien.distance} : ${lien.chaine.join(' → ')}`
  if (lien.nature === 'racine balayée') return `racine balayée ${lien.racine} (spécificité ${lien.specificite}, site ${lien.site}), ${lien.touche}`
  if (lien.nature === 'setup') return `setup : ${lien.racine ? `racine balayée ${lien.racine} (site ${lien.site}), ` : ''}${lien.touche}`
  return `${lien.nature} : ${lien.touche}`
}

/** Les fichiers touchés PRÉSENTS dont l'extension est lintée (`EXTENSIONS_DE_SCRIPT`). PURE. */
const aLinter = (touches, post) => touches.filter((t) => post.includes(t) && EXTENSIONS_DE_SCRIPT.some((e) => t.endsWith(e)))

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

/** Le texte d'un échec `erreur` suivi de sa chaîne de `cause`, chacune nommée par son `code`, sinon son `name`
 *  (#2586). PURE. */
export function texteDeLEchec(erreur) {
  const vus = new Set([erreur])
  let texte = erreur instanceof Error ? erreur.message : String(erreur)
  for (let c = erreur?.cause; c !== undefined && c !== null && !vus.has(c); c = c?.cause) {
    vus.add(c)
    texte += ` — cause ${c instanceof Error ? `${c.code ?? c.name} : ${c.message}` : String(c)}`
  }
  return texte
}

/** Écrit `entrees` au mémo `nom` de `mesures` ; un échec s'imprime avec sa chaîne de causes (`texteDeLEchec`), sans
 *  lever : apprendre ne change pas le verdict des tests, et un mémo illisible fait déjà échouer le plan, qui le lit
 *  avant tout lancement (`planDuPerimetre`, #2586). Rend `true` si l'écriture a eu lieu. */
export function ecrireLesMesures(mesures, nom, entrees) {
  try {
    mesures.ecrire(nom, entrees)
    return true
  } catch (erreur) {
    console.log(`[perimetre] mesures non écrites — ${texteDeLEchec(erreur)}`)
    return false
  }
}

/**
 * Les WORKERS de chaque famille d'un lancement (#2400) sous le régime `regime` : ceux que `run.mjs` sert à UN
 * processus Vitest (`capaciteDuLanceur`, `maxWorkersMono`) — le `--reporter` du périmètre (`reportersVitest`) est un
 * `DRAPEAUX_MONO` (scripts/test/partition.mjs, `separerArguments`), sans partage node/jsdom —, et la
 * concurrence par défaut de `node --test` (`--test-concurrency`, doc Node : `os.availableParallelism() - 1`).
 * @param {NodeJS.ProcessEnv} env @param {'suite' | 'lot'} regime
 */
export function workersDuLancement(env, regime) {
  return { vitest: maxWorkersMono(capaciteDuLanceur(env, regime).servis), node: Math.max(1, availableParallelism() - 1) }
}

/** Les arguments `node` du lancement de la suite du noyau (`npm run test:noyau`, `vitest.noyau.config.ts`) sur ses
 *  `fichiers`. PURE. */
export const argumentsDuNoyau = (fichiers) =>
  ['scripts/lancer-local.mjs', 'vitest', '--', 'vitest', 'run', '--config', SUITES_VITEST_DE_CI['test:noyau'].config, ...fichiers]

/** La suite du noyau à lancer (#2817) : ENTIÈRE, les tests du noyau et de ses hôtes de la post-image `post`, dès qu'un
 *  des fichiers `touches` est sous une racine des zones (`RACINES_DES_ZONES` : leur fermeture y vit) ; rien sinon. La
 *  dérivation ne la voit pas. PURE. */
export const suiteDuNoyauALancer = (touches, post) => (touches.some((t) => RACINES_DES_ZONES.some((r) => t.startsWith(`${r}/`))) ? post.filter((t) => estDeLaSuiteDuNoyau(t)) : [])

/** Les arguments `node` du lancement Vitest d'un paquet de tests : `run.mjs` sous le régime `regime` (`DRAPEAU_REGIME`),
 *  les reporters écrivant le rapport `sortie` (`reportersVitest`). PURE. */
export const argumentsVitest = (paquet, sortie, regime) =>
  ['scripts/test/run.mjs', `${DRAPEAU_REGIME}=${regime}`, ...paquet, ...reportersVitest(sortie)]

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

/**
 * Le bilan d'UN lancement de la famille `famille` (#2497) : son surcoût observé (`surcoutObserve`) sur les workers
 * SERVIS de sa `lecture` (`apprendre`), jamais sur ceux du plan (`planifies`) — `null`, aucun surcoût, sans workers
 * servis —, et sa ligne de journal, qui dit les servis quand ils diffèrent du plan. PURE.
 * @param {string} famille @param {number} murMs @param {{ appris: Record<string, number>, workers: number | null }} lecture @param {number} planifies
 * @returns {{ surcout: number | null, texte: string }}
 */
export function bilanDuLancement(famille, murMs, { appris, workers: servis }, planifies) {
  const tete = `${famille} : ${Object.keys(appris).length} fichier(s), mur réel ${secondes(murMs)}`
  if (servis === null) return { surcout: null, texte: `${tete} ; workers servis non rapportés : aucun surcoût appris` }
  const surcout = surcoutObserve(famille, murMs, appris, { [famille]: servis })
  return { surcout, texte: `${tete}${servis === planifies ? '' : `, servis ${servis}, plan ${planifies}`} ; surcoût observé ${secondes(surcout)}` }
}

/** Le fichier d'un site de défaut de lint `<chemin>:<ligne>:<colonne>` (`defautsDeRapport`), `null` sans fichier. */
const fichierDuSite = (site) => /^(.+):\d+:\d+$/.exec(site)?.[1] ?? null

/** La ligne de fin d'un run ROUGE (`code` non nul), `null` sur un run vert. Elle nomme la commande qui ne relance QUE
 *  les fichiers en échec des `lancements` (`{ famille: 'vitest' | 'node' | 'noyau' | 'docs', code, echecs, args, refus? }`, chemins
 *  POSIX relatifs rapportés par `apprendre`) — `npm test -- <vitest>`, `node --test <node>`, `npm run test:noyau -- <noyau>` —, et l'appel du lint (`appelLint()`,
 *  `appelDuLint`) sur les seuls fichiers que nomment les défauts du lint `lint` (`lintDesTouches`) ; et elle NOMME chaque
 *  refus d'admission (`refus`, posé sur `CODE_DIFFERE`) avec sa raison, puis chaque rouge sans fichier : lancement
 *  rouge muet, défaut de lint sans site (panne d'outillage), lint rouge sans défaut, docs dérivés rouges (leur
 *  commande). PURE. */
export function ligneDeRelance({ code, lancements, lint, appelLint }) {
  if (code === 0) return null
  const liste = (fichiers) => [...new Set(fichiers)].sort().map(citeArgument).join(' ')
  const commandes = []
  const muets = []
  for (const [lanceur, famille] of [['npm test --', 'vitest'], ['node --test', 'node']]) {
    const deLaFamille = lancements.filter((l) => l.famille === famille)
    const fichiers = deLaFamille.flatMap((l) => l.echecs)
    if (fichiers.length) commandes.push(`${lanceur} ${liste(fichiers)}`)
    const sansFichier = deLaFamille.filter((l) => l.code !== 0 && !l.echecs.length && !l.refus).length
    if (sansFichier) muets.push(`${famille} : ${sansFichier} lancement(s) rouge(s) sans fichier en échec rapporté`)
  }
  const lintes = lint.defauts.map(({ site }) => fichierDuSite(site)).filter((f) => f !== null)
  if (lintes.length) commandes.push(`${appelLint().join(' ')} ${liste(lintes)}`)
  for (const { site, message } of lint.defauts) if (fichierDuSite(site) === null) muets.push(`lint ${site} : ${message}`)
  if (lint.code !== 0 && !lint.defauts.length) muets.push('lint rouge, son rapport ne nomme aucun défaut')
  for (const { args } of lancements.filter((l) => l.famille === 'noyau' && l.code !== 0 && !l.refus)) commandes.push(`npm run test:noyau -- ${liste(args.filter((a) => estDeLaSuiteDuNoyau(a)))}`)
  for (const { args } of lancements.filter((l) => l.famille === 'docs' && l.code !== 0 && !l.refus)) muets.push(`docs dérivés rouges : node ${args.map(citeArgument).join(' ')}`)
  const relancer = commandes.length ? [`relancer les SEULS fichiers en échec, puis un dernier test:perimetre : ${commandes.join(' ; ')}`] : []
  const nommer = muets.length ? [`rouge sans fichier nommé : ${muets.join(' ; ')}`] : []
  const refuses = lancements.filter((l) => l.refus).map((l) => `${l.famille} : ${l.refus}`)
  const refuser = refuses.length ? [`refus d'admission, aucun test joué : ${refuses.join(' ; ')}`] : []
  return `rouge — ${[...refuser, ...relancer, ...nommer].join(' — ') || 'aucun rapport ne nomme de fichier en échec'}`
}

/** Le libellé d'une durée en secondes. */
const secondes = (ms) => `${(ms / 1000).toFixed(1)} s`
/** L'estimation d'un test en texte (`estimationsDe`) : apprise ici, de la CI calibrée (sa course, son facteur — de
 *  paires ou de repli —, sa population), ou inconnue. PURE. */
export const texteDeLEstimation = ({ ms, source, run, facteur, population }) => {
  if (ms === null) return ' durée inconnue'
  if (source === 'locale') return ` ~${secondes(ms)} (apprise ici)`
  return ` ~${secondes(ms)} (CI ${run} × ${facteur.valeur.toFixed(2)}${facteur.origine === 'repli' ? ' repli de banc' : ''}, ${population})`
}

/** Le mur RÉEL `reelMs` face à son estimation `estimeMs` et leur écart en % ; avec `sansDuree` tests lancés sans durée,
 *  l'estimation est un MINORANT (`≥`) et l'écart un MAJORANT (`≤`). PURE. */
export const texteDuReel = (reelMs, estimeMs, sansDuree = 0) => {
  const pourcent = Math.round(((reelMs - estimeMs) / estimeMs) * 100)
  const ecart = estimeMs <= 0 ? 'écart non défini' : `écart ${sansDuree ? '≤ ' : ''}${pourcent > 0 ? '+' : ''}${pourcent} %`
  return `mur réel ${secondes(reelMs)} pour ${sansDuree ? '≥ ' : ''}${secondes(estimeMs)} estimés (${ecart}${sansDuree ? `, estimation minorante : ${sansDuree} test(s) sans durée` : ''})`
}

/** Le RAPPORT de durées du lancement `i` de la famille `famille`, sous `dossier`, propre au processus `pid`. PURE. */
export const rapportDuLancement = (dossier, pid) => (famille, i) => join(dossier, `${famille}-${pid}-${i}.json`)

/**
 * Le PLAN du lancement et son RÉGIME Vitest (`EMPREINTES_WORKER_MO`, #2497), seule source du lancement et du journal :
 * `planDuPerimetre` sous les workers du régime `lot` (`workersDe`) ; si le mur vitest de ce plan dépasse
 * `PORTEE_LOT_S`, le plan sous les workers de `suite` fait foi. PURE.
 * @param {Map<string, { rang: number, specificite?: number }>} retenus
 * @param {{ mesures: ReturnType<typeof mesuresDe>, lire: (rels: string[]) => Map<string, string | null>, budget?: number, signaux?: Map<string, { signal: string }>, workersDe: (regime: 'lot' | 'suite') => Record<string, number> }} p
 */
export function planDuLancement(retenus, { workersDe, ...p }) {
  const sous = (regime) => {
    const workers = workersDe(regime)
    return { regime, workers, ...planDuPerimetre(retenus, { ...p, workers }) }
  }
  const lot = sous('lot')
  return lot.plan.murParFamille.vitest <= PORTEE_LOT_S * 1000 ? lot : sous('suite')
}

/**
 * Le PLAN d'exécution des tests `retenus` sur les `mesures` (`mesuresDe`) : durées apprises ici (`DUREES`) et de
 * la CI (`DUREES_CI`), environnements des tests Vitest lus par `lire` (`environnementDe`), facteurs
 * (`facteursCi`), estimations (`estimationsDe`), surcoûts (`SURCOUTS`, `REPLI_SURCOUT_MS`), plan (`planDExecution`).
 * @param {Map<string, { rang: number, specificite?: number }>} retenus
 * @param {{ mesures: ReturnType<typeof mesuresDe>, lire: (rels: string[]) => Map<string, string | null>, budget?: number, signaux?: Map<string, { signal: string }>, workers?: Record<string, number> }} p
 */
export function planDuPerimetre(retenus, { mesures, lire, budget, signaux, workers, configurationNode }) {
  const locales = mesures.lire(DUREES)
  const ci = mesures.lire(DUREES_CI, memoCiDe)
  const aLire = [...new Set([...retenus.keys(), ...Object.keys(ci.vitest ?? {}).filter((t) => Object.hasOwn(locales, t))])].filter((t) => familleDe(t) === 'vitest')
  const environnements = new Map([...lire(aLire)].map(([t, texte]) => [t, texte === null ? null : environnementDe(texte)]))
  const environnementDuTest = (t) => environnements.get(t) ?? null
  const facteurs = facteursCi({ locales, ci, environnementDe: environnementDuTest })
  const estimations = estimationsDe([...retenus.keys()], { locales, ci, facteurs, environnementDe: environnementDuTest })
  const surcouts = { ...REPLI_SURCOUT_MS, ...mesures.lire(SURCOUTS) }
  const profils = configurationNode ? profilsDuLancement({ ...configurationNode, mesures,
    fichiers: [...retenus.keys()].filter((t) => familleDe(t) === 'node'), argv: argumentsNode('') }).entrees : null
  const utilisables = new Set(profils?.filter((p) => p.utilisable).map((p) => p.fichier))
  const workersNode = profils ? (paquet) => configurationNode.forcer || paquet.some((t) => !utilisables.has(t)) ? CONCURRENCE_SANS_PROFIL : workers?.node ?? 1 : undefined
  return { ci, facteurs, estimations, surcouts, plan: planDExecution(retenus, { budget, estimations, signaux, workers, surcouts, workersNode }) }
}

const argumentsNode = (sortie) => ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
  `--test-reporter=${pathToFileURL(join(RACINE, 'scripts/test/dureesNodeTest.mjs')).href}`, `--test-reporter-destination=${sortie}`]

/** Le LANCEMENT du périmètre du dépôt de `racine` sous les arguments `args` (`lireArguments`) : dérivation, journal, lint,
 *  tests au plan, ligne de relance (`ligneDeRelance`) ; rend le code de sortie. `platform` va à `lancerNodeMesure`. */
export async function principal(args, racine, { env = process.env, verrou, signal, platform } = {}) {
  const configuration = verrou ?? verrouGestesLourds(racine)
  const prise = await prendreVerrouAsync({
    ...configuration, env, signal, cwd: racine, commande: 'test:perimetre',
    attente: { ...configuration.attente, annoncer: (tenant) => console.error('[verrou] ' + tenantEnUneLigne(tenant)) },
  })
  if (prise.etat !== 'pris') { console.error(prise.message); return CODE_DIFFERE }
  let retraitPermis = true
  try { return await executerPerimetre(args, racine, { env: { ...env, ...prise.env }, signal, platform, retenir: () => { retraitPermis = false } }) }
  finally { if (retraitPermis) prise.liberer() }
}
async function executerPerimetre(args, racine, { env, signal, retenir, platform }) {
  const options = lireArguments(args)
  const debut = performance.now()
  const { base, tete, touches, post, retenus, toolchain, nonResolus, vitest, node, modules, signaux, lire } = await perimetreDuDepot(racine, options, { lectureSeule: options.liste, env, signal, retenir })
  const duree = Math.round(performance.now() - debut)
  const docs = selectionDesGenerateurs({ lot: touches, mesure: sourcesMesurees(racine), cwd: racine })
  const cache = join(racine, CACHE)
  const rapport = rapportDuLancement(cache, process.pid)
  const mesures = mesuresDe(dossierDesMesures(racine))
  const rapatriement = options.liste ? null : rapatrierDureesCi({ mesures, cwd: racine })
  const budget = options.budget ?? BUDGET_LOCAL_S
  const { regime, workers, ci, facteurs, estimations, surcouts, plan } =
    planDuLancement(retenus, { mesures, lire, budget, signaux, configurationNode: { racine, env, forcer: options.reacquerirMemoire }, workersDe: (r) => workersDuLancement(env, r) })
  const part = (liste) => liste.filter((t) => retenus.has(t)).length
  const journal = (texte) => console.log(`[perimetre] ${texte}`)
  journal(`base ${base} → ${tete ?? 'arbre de travail'} : ${touches.length} fichier(s) touché(s)`)
  journal(`dérivation : ${duree} ms, ${modules} modules au graphe`)
  if (toolchain.length) journal(`toolchain touchée (${toolchain.join(', ')}) ⇒ toute la suite est retenue`)
  journal(`sélection : ${retenus.size} fichier(s) retenu(s) sur ${vitest.length + node.length} — vitest ${part(vitest)}/${vitest.length}, node ${part(node)}/${node.length}`)
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
  journal(`facteurs CI : ${Object.entries(facteurs).map(([p, f]) => `${p} ${f.valeur.toFixed(2)} (${f.origine === 'paires' ? `${f.paires} paires` : `repli de banc, ${f.paires} paire(s)`})`).join(' | ')}`)
  journal(rapatriement === null ? 'CI non rapatriée — --liste n’écrit rien'
    : !rapatriement.disponible ? `CI non rapatriée — ${rapatriement.raison}`
      : rapatriement.valeur.etat === 'refus' ? `CI non rapatriée — ${rapatriement.valeur.raison}`
        : `CI ${rapatriement.valeur.etat === 'deja' ? 'déjà mémorisée' : 'rapatriée'} : course ${rapatriement.valeur.memo.run}`)
  journal(`mur : régime vitest ${regime} (${EMPREINTES_WORKER_MO[regime]} Mo par worker) sur un mur vitest ${plan.sansDureeParFamille.vitest ? '≥ ' : ''}${secondes(plan.murParFamille.vitest)} (portée du lot ${PORTEE_LOT_S} s), workers vitest ${workers.vitest}, node par paquet ${plan.concurrencesNode.join(', ') || 'aucun'} ; surcoût de lancement vitest ${secondes(surcouts.vitest)}, node ${secondes(surcouts.node)}`)
  for (const r of plan.rangs)
    journal(`  ${r.rang} : mur estimé ${texteDuMur(r.murMs, r)}, ${r.lances} lancé(s)${r.inconnues ? ` ; ${r.inconnues} de durée inconnue ${r.rang === 'touché' ? 'lancé(s) hors estimation' : 'à la CI'}` : ''}${r.aLaCI ? ` ; ${r.aLaCI} fichier(s) ${r.rang.replace('import ', '')} restent à la CI` : ''}`)
  journal(`budget ${budget} s de mur (touché hors budget) : ${plan.lances.length} lancé(s), mur estimé ${texteDuMur(plan.murMs, plan)}, dont ${secondes(plan.murBudgeteMs)} au budget ; → CI ${plan.aLaCI.length}`)
  for (const t of plan.aLaCI.filter((t) => GATES_D_AUDIT.includes(gateDe(t))))
    journal(`→ CI ${t} : audit du dépôt réel, gate ${gateDe(t)} (${texteDuLien(retenus.get(t))})`)
  for (const ligne of lignesDeDelegation(touches)) journal(ligne)
  journal(`lint : ${aLinter(touches, post).length} fichier(s) touché(s)${options.liste ? ' (non joué sous --liste)' : ''}`)
  const noyau = suiteDuNoyauALancer(touches, post)
  journal(`suite du noyau : ${noyau.length ? `entière (un fichier de src/ touché), ${noyau.length} fichier(s)` : 'aucun fichier de src/ touché'}${noyau.length ? ` : ${noyau.join(', ')}` : ''}${options.liste && noyau.length ? ' (non joué sous --liste)' : ''}`)
  const bilan = (joues, liste) => journal(ligneDeBilan({ joues, retenus, vitest, node, causes: plan.causes, liste }))
  if (options.liste) {
    bilan(new Set(plan.lances), true)
    return 0
  }
  const lint = lintDesTouches(racine, touches, post)
  for (const d of lint.defauts) console.log(`  ${d.site} ${d.gravite} ${d.regle} — ${d.message}`)
  mkdirSync(cache, { recursive: true })
  const paquets = [
    ...plan.paquets.vitest.map((p) => ({ famille: 'vitest', p })),
    ...plan.paquets.node.map((p) => ({ famille: 'node', p })),
  ]
  const lancements = [
    ...paquets.map(({ famille, p }, i) => {
      const sortie = rapport(famille, i)
      return { famille, sortie, args: famille === 'vitest' ? argumentsVitest(p, sortie, regime)
        : [...argumentsNode(sortie), ...p] }
    }),
    ...(noyau.length ? [{ famille: null, nom: 'noyau', sortie: null, args: argumentsDuNoyau(noyau) }] : []),
    ...(jouerDocs ? [{ famille: null, nom: 'docs', sortie: null, args: ['scripts/docs/build-all.mjs', '--check', '--only', ...docs.scripts] }] : []),
  ]
  const { code, reels, joues, fichiersJoues } = await executerLancements({ lancements, racine, node, env, signal, mesures, journal, retenir, cache, workers, code: lint.code, forcer: options.reacquerirMemoire, platform })
  for (const [famille, murMs] of Object.entries(reels))
    journal(`${famille} au plan : ${texteDuReel(murMs, plan.murParFamille[famille], plan.sansDureeParFamille[famille])}`)
  journal(`total : ${texteDuReel(Object.values(reels).reduce((a, b) => a + b, 0), plan.murMs, plan.sansDuree)}`)
  bilan(fichiersJoues, false)
  const relance = ligneDeRelance({ code, lancements: joues, lint, appelLint: () => appelDuLint(racine) })
  if (relance) journal(relance)
  return code
}

/** La raison d'un refus d'admission `r` : son `message`, sinon la dernière ligne non vide de sa `sortie`. PURE. */
export const raisonDuRefus = (r) => r.message ?? (r.sortie ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).at(-1) ?? 'raison non rapportée'

/** Joue les `lancements` dans l'ordre (#2586) : node par `lancerNode`, vitest et docs par `lancer`. Une clôture non
 *  confirmée (`retenir`) ou un lancement interrompu arrête la suite sans apprendre ; sinon chaque famille apprend ses
 *  durées (`apprendre`) et son surcoût (`bilanDuLancement`). Rend le premier code non nul, le mur réel par famille,
 *  les lancements joués et les fichiers joués (`fichiersJoues`, ceux que leur rapport mesure). */
export async function executerLancements({ lancements, racine, node, env, signal, mesures, journal, retenir, cache, workers, code, forcer, platform }, { lancerNode = lancerNodeMesure, lancer = spawnBorne } = {}) {
  const reels = {}
  const joues = []
  const fichiersJoues = new Set()
  for (const { famille, nom = 'docs', sortie, args } of lancements) {
    if (sortie) rmSync(sortie, { force: true })
    const debutDuLancement = performance.now()
    const fichiers = famille === 'node' ? args.filter((a) => node.includes(a)) : []
    const r = famille === 'node'
      ? await lancerNode({ racine, fichiers, argv: args.filter((a) => !fichiers.includes(a)), env, signal, mesures, journal, forcer, platform })
      : await lancer({ argv: args, cwd: racine, env, signal, fichier: join(cache, 'lancement-' + process.pid + '.log'),
        limiteMs: 30 * 60_000, maxBuffer: 16 * 2 ** 20 })
    if (famille !== 'node' && r.sortie) process.stdout.write(r.sortie)
    if (r.arret?.etat !== 'mort') {
      retenir()
      const codeDuLancement = r.code || 1
      if (code === 0) code = codeDuLancement
      joues.push({ famille: famille ?? nom, code: codeDuLancement, echecs: [], args })
      journal(`clôture non confirmée : ${famille ?? nom}, arrêt ${r.arret?.etat ?? 'aucun'}, code ${r.code} ; lancements interrompus, verrou et traces conservés`)
      diagnosticArret(r, journal, '')
      break
    }
    const murMs = performance.now() - debutDuLancement
    if (r.annulee || r.expiree || r.error) {
      const codeDuLancement = r.code || 1
      if (code === 0) code = codeDuLancement
      joues.push({ famille: famille ?? nom, code: codeDuLancement, echecs: [], args })
      journal(`lancement interrompu : ${famille ?? nom} ; rapports conservés, aucun apprentissage`)
      diagnosticArret(r, journal, '')
      break
    }
    const codeDuLancement = r.code
    if (code === 0) code = codeDuLancement
    const refus = codeDuLancement === CODE_DIFFERE ? { refus: raisonDuRefus(r) } : {}
    if (!famille) { joues.push({ famille: nom, code: codeDuLancement, echecs: [], args, ...refus }); continue }
    reels[famille] = (reels[famille] ?? 0) + murMs
    const lecture = apprendre(racine, sortie, mesures, famille, famille === 'node' ? r.concurrence ?? null : workers[famille])
    for (const f of Object.keys(lecture.appris)) fichiersJoues.add(f)
    joues.push({ famille, code: codeDuLancement, echecs: lecture.echecs, args, ...refus })
    if (!Object.keys(lecture.appris).length) continue
    const { surcout, texte } = bilanDuLancement(famille, murMs, lecture, workers[famille])
    journal(texte)
    if (surcout !== null) ecrireLesMesures(mesures, SURCOUTS, { [famille]: surcout })
  }
  return { code, reels, joues, fichiersJoues }
}

/** Les fichiers en échec `echecs` d'un rapport, `[]` s'ils ne sont pas une liste de chaînes. PURE. */
const echecsDuRapport = (echecs) => (Array.isArray(echecs) && echecs.every((f) => typeof f === 'string') ? echecs : [])

/** La lecture du rapport de durées `lu` d'UN lancement de chaque famille : ses durées `{ [chemin absolu]: ms }`, ses
 *  fichiers en échec (`echecsDuRapport`) et ses workers SERVIS, `null` s'ils ne sont pas un entier ≥ 1. vitest :
 *  `{ workers, durees, echecs }` de `dureesVitest.mjs` ; node : `{ durees, echecs }` de `dureesNodeTest.mjs`, workers
 *  `planifies` : la concurrence servie par `lancerNodeMesure` (doc Node `--test-concurrency`). PURE. */
const LECTURES_DE_RAPPORT = Object.freeze({
  vitest: (lu) => ({ durees: lu?.durees ?? {}, echecs: echecsDuRapport(lu?.echecs), workers: Number.isInteger(lu?.workers) && lu.workers >= 1 ? lu.workers : null }),
  node: (lu, planifies) => ({ durees: lu?.durees ?? {}, echecs: echecsDuRapport(lu?.echecs), workers: planifies }),
})

/** Fusionne dans les `DUREES` de `mesures` (`mesuresDe`) les durées du rapport `rapport` d'UN lancement de la famille
 *  `famille` (`rapportDuLancement`, `LECTURES_DE_RAPPORT` ; chemins rendus relatifs), puis l'efface, que l'écriture
 *  (`ecrireLesMesures`) réussisse ou échoue. Rend les durées apprises, les workers servis et les fichiers en échec, chemins
 *  relatifs ; `{ appris: {}, workers: null, echecs: [] }` sans rapport ; un rapport illisible lève avec sa `cause` (#2586). */
export function apprendre(racine, rapport, mesures, famille, planifies) {
  const base = resolve(racine).split(sep).join('/')
  const relDe = (a) => a.split(sep).join('/').replace(`${base}/`, '')
  let lu
  try { lu = JSON.parse(readFileSync(rapport, 'utf8')) }
  catch (cause) {
    if (cause?.code === 'ENOENT') return { appris: {}, workers: null, echecs: [] }
    throw new Error(`perimetre : rapport ${rapport} illisible`, { cause })
  }
  finally { rmSync(rapport, { force: true }) }
  const { durees, echecs, workers } = LECTURES_DE_RAPPORT[famille](lu, planifies)
  const appris = Object.fromEntries(Object.entries(durees).map(([f, ms]) => [relDe(f), Math.round(ms)]))
  if (Object.keys(appris).length) ecrireLesMesures(mesures, DUREES, appris)
  return { appris, workers, echecs: echecs.map(relDe) }
}

/** L'entrée du CLI (#2586) : le code de `executer` (`principal`) ; une levée s'imprime avec sa chaîne de causes (`texteDeLEchec`)
 *  et rend 2. */
export async function entreeDuCli(argv, racine, { executer = principal } = {}) {
  try { return await executer(argv, racine) }
  catch (erreur) {
    console.error(`[perimetre] ${texteDeLEchec(erreur)}`)
    return 2
  }
}

if (import.meta.main) process.exitCode = await entreeDuCli(process.argv.slice(2), racineDe(depotDe(RACINE)) ?? RACINE)

/** Le stade publié sous `marqueur` (`marqueurDeStade`), DIAGNOSTIC seul : il ne lève jamais (#2586). Absent : `lancement` ;
 *  tenu par un tiers (`lireTextePublie`), relu sous les paliers `BACKOFFS_MS` (`attendre`) ; invalide, ou tenu au-delà :
 *  `illisible`, avec sa `panne`. @returns {{ texte: string, panne?: Error }} */
function stadeAtteint(marqueur, attendre) {
  try {
    for (let essai = 0; ; essai += 1) {
      const publie = lireTextePublie(marqueur)
      if (publie !== undefined) {
        const { stade, module } = JSON.parse(publie)
        return { texte: `stade ${stade}, module ${module ?? '—'}` }
      }
      if (!existsSync(marqueur)) return { texte: 'stade lancement, module —' }
      if (essai >= BACKOFFS_MS.length) throw new Error(`tenu par un tiers au-delà de ${BACKOFFS_MS.join(' + ')} ms`)
      attendre(BACKOFFS_MS[essai])
    }
  } catch (panne) {
    return { texte: `stade illisible (marqueur ${marqueur} : ${panne.message}), module —`, panne }
  }
}

/** La dérivation de `entree` dans un ENFANT borné (#2603) : `perimetreDerivation.mjs` sous `lancer`, `limiteMs` et
 *  `TAS_DERIVATION_MO` de tas, son DTO relu par `depuisDTO`. Un échec lève en nommant le stade atteint (`stadeAtteint`, `attendre`) ; le
 *  dossier temporaire ne se retire que sous preuve de mort de l'enfant, sinon `retenir`. */
export async function derivationBornee(entree, { limiteMs = 180_000, lancer = spawnBorne, env = process.env, signal, retenir = () => {}, attendre = attendreSync, module = fileURLToPath(new URL('./perimetreDerivation.mjs', import.meta.url)) } = {}) {
  const temporaire = mkdtempSync(join(tmpdir(), 'perimetre-derivation-'))
  const debut = performance.now()
  let retraitPermis = true
  try {
    const input = join(temporaire, 'entree.json'), output = join(temporaire, 'sortie.json'), marqueur = join(temporaire, 'stade.json')
    ecrireJsonAtomique(input, entree, { indentation: 0 })
    const vu = await lancer({ argv: [`--max-old-space-size=${TAS_DERIVATION_MO}`, module, input, output, marqueur], fichier: join(temporaire, 'journal.txt'), limiteMs, cwd: entree.racine, env, signal, site: 'perimetre' })
    const bornes = `durée ${Math.round(performance.now() - debut)} ms, limite ${limiteMs} ms`
    retraitPermis = vu.arret?.etat === 'mort'
    if (!retraitPermis) retenir()
    if (vu.code !== 0 || vu.expiree || vu.annulee || vu.arret?.etat !== 'mort') {
      const { texte, panne } = stadeAtteint(marqueur, attendre)
      const erreur = vu.error ? `, erreur ${vu.error.code ?? 'ERREUR_ENFANT'} : ${vu.error.message}` : ''
      throw new Error(`perimetre : dérivation échouée au ${texte}, ${bornes}, code ${vu.code}, arrêt ${vu.arret?.etat ?? 'aucun'}${erreur}\n${vu.sortie ?? ''}`, { cause: vu.error ?? panne })
    }
    let dto
    try { dto = JSON.parse(readFileSync(output, 'utf8')) } catch (cause) { throw new Error(`perimetre : DTO absent ou tronqué au ${stadeAtteint(marqueur, attendre).texte}, ${bornes}`, { cause }) }
    try { return depuisDTO(dto) }
    catch (e) { throw new Error(`${e.message} au ${stadeAtteint(marqueur, attendre).texte}, ${bornes}`, { cause: e }) }
  } finally { if (retraitPermis) rmSync(temporaire, { recursive: true, force: true }) }
}

/** Le périmètre du dépôt de `racine` (#2603) : images du diff et dérivation par `derivationBornee`, post-image lue sur
 *  le disque (arbre de travail) ou dans `tete`, mémos sous `dossierDesMemos`. */
export async function perimetreDuDepot(racine, { base, tete } = {}, { dossierDesMemos = join(racine, CACHE), lectureSeule = false, env, signal, retenir } = {}) {
  const derive = await derivationBornee({ racine, base, tete, dossierDesMemos, lectureSeule }, { env, signal, retenir })
  const lire = derive.tete ? (rels) => lireEnLot(depotDe(racine, { env }), derive.tete, rels) : lireDuDisque(racine)
  return { ...derive, lire }
}

/** Les balayages NON RÉSOLUS du dépôt de `racine` (#2400) : chaque valeur `non` d'un site de lecture ou de listage
 *  des modules qu'atteint la clôture d'au moins un test, sur l'arbre de travail (`derivationBornee`, mode
 *  `balayages`) ; mémos sous `dossierDesMemos`.
 *  @returns {Promise<import('./perimetreDerivation.mjs').NonResolu[]>} */
export async function balayagesNonResolus(racine, { dossierDesMemos = join(racine, CACHE), lectureSeule = false } = {}) {
  return (await derivationBornee({ racine, dossierDesMemos, lectureSeule, mode: 'balayages' })).nonResolus
}
