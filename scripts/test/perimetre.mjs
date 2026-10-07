#!/usr/bin/env node
// PÉRIMÈTRE DE TESTS d'un diff (#2400) : `npm run test:perimetre [-- --base <ref> --tete <ref> --liste --budget <s> --docs]`.
// Les tests retenus se DÉRIVENT des fichiers touchés : le test touché, le test dont la clôture d'imports
// (`clotureDImports`, `typesEffaces`, `import.meta.glob` compris) atteint un fichier touché, le test dont
// une RACINE BALAYÉE (`racinesBalayees.mjs`) est un ancêtre d'un fichier touché (`ancetresDe`,
// `scripts/git-hooks/docs-rebuild.mjs`), M, A, D et R. Les `setupFiles` de `vite.config.ts` sont une
// racine de chaque test Vitest, au rang `setup` ; la toolchain touchée (`TOOLCHAIN`) retient la suite entière.
// Exécution : le lint des fichiers touchés (`lancerLint`), puis les tests sous `BUDGET_LOCAL_S`, ordonnés par
// rang et par signal (`planDExecution`, `signalDe`), estimés par les durées APPRISES (`estimationsDe`,
// `DUREES`, rapports de `run.mjs` et de `dureesNodeTest.mjs`) ; le reste à la CI.
// Docs dérivés : `selectionDesGenerateurs`, joués en `--check` sous `--docs` seulement.
// Le graphe résout contre la post-image ∪ la base : l'importeur pendu vers un fichier SUPPRIMÉ reste lié.
// Les spécificateurs non résolus et les lectures de module se mémoïsent par blob sous `CACHE`, signés par
// `versionDesMemos`.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, posix, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { typescript, analyserCorpus } from '../guards/lib/dialecte.mjs'
import { clotureDImports, grapheInverse, resolveImport, aliasDuDepot, estModule, liaisonsDe, CHEMIN_TSCONFIG } from '../guards/lib/importGraph.mjs'
import { APPEL_DE_LECTURE, evaluateurDuDepot, evaluer, lecteurDExpressions, lectureDeModule } from '../guards/lib/racinesBalayees.mjs'
import { RACINES_DE_LA_SUITE } from '../guards/lib/racinesDeLaSuite.mjs'
import { estSuiteVitest } from '../guards/lib/fichierVitest.mjs'
import { paquetsDArgv } from '../guards/lib/porteSpawn.mjs'
import { baseCommune, ceQuiChange, depotDe, lireEnLot, listerImage, racineDe, SUIVI, TRAVAIL, TRONC } from '../guards/lib/gitPorte.mjs'
import { ancetresDe, LECTURES_DES_DEPENDANCES, selectionDesGenerateurs, sourcesMesurees } from '../git-hooks/docs-rebuild.mjs'
import { codeEnfant } from './partition.mjs'
import { EXTS_LINT, lancerLint } from '../guards/lib/lintStage.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Les fichiers dont un changement invalide toute dérivation : la suite entière est retenue. */
const TOOLCHAIN = Object.freeze([...LECTURES_DES_DEPENDANCES, 'vite.config.ts', 'tsconfig.json', 'scripts/guards/lib/racinesDeLaSuite.mjs'])

/** Le RANG d'un lien, du plus proche au plus lointain : touché, racine balayée, import par distance, puis
 *  `setup` (le fichier n'est atteint que par les `setupFiles`, racine de TOUT test Vitest) et toolchain. */
const RANG_SETUP = 1_000_000
const RANG_TOOLCHAIN = RANG_SETUP + 1
const rangDe = (lien) => lien.nature === 'touché' ? 0 : lien.nature === 'racine balayée' ? 1
  : lien.nature === 'import' ? 1 + lien.distance : lien.nature === 'setup' ? RANG_SETUP : RANG_TOOLCHAIN

/** #2400 */
const BUDGET_LOCAL_S = 180

/** Les signaux d'un test d'import, du plus fort au plus faible (#2400) : il importe par NOM un export
 *  touché (`symbole`), il importe le module sans symbole touché (`module`), le reste. */
const SIGNAUX = Object.freeze(['symbole', 'module', 'reste'])

/** La durée de REPLI d'un fichier de test par famille, en ms, sans durée apprise ni médiane (#2400). */
const REPLI_MS = Object.freeze({ vitest: 55_871, node: 3227 })

/** Le mémo des durées apprises, sous `CACHE` : `{ [test]: ms }`. */
const DUREES = 'durees.json'

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

/** Les modules analysés par programme TypeScript (`prelire`). */
const LOT_D_ANALYSE = 400

/** Le dossier des mémos, relatif à la racine du dépôt. */
const CACHE = 'node_modules/.cache/perimetre'

/** Les modules dont le code DÉCIDE du contenu des mémos : leur texte signe la version des mémos. */
const VERSIONNANTS = ['scripts/guards/lib/importGraph.mjs', 'scripts/guards/lib/racinesBalayees.mjs', 'scripts/guards/lib/dialecte.mjs']
/** Les paquets dont la version DÉCIDE aussi des mémos : l'analyseur et le transpileur (`sourceALExecution`). */
const PAQUETS_VERSIONNANTS = ['typescript', 'rolldown']

/**
 * La version des mémos du dépôt de `racine` : le texte des `VERSIONNANTS`, le `tsconfig.json` du dépôt
 * (`CHEMIN_TSCONFIG`, lu par `sourceALExecution`) et la version installée des `PAQUETS_VERSIONNANTS`.
 * @param {string} racine
 */
export function versionDesMemos(racine) {
  const texte = (chemin) => { try { return readFileSync(chemin, 'utf8') } catch { return '' } }
  return blobDe([
    ...VERSIONNANTS.map((f) => readFileSync(join(RACINE, f), 'utf8')),
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

/**
 * DÉRIVATION du périmètre. PURE hormis `lire` et les mémos.
 * @param {{ racine: string, touches: string[], post: string[], avant: string[], lire: (rels: string[]) => Map<string, string | null>, memos?: ReturnType<typeof memosDe> }} entree
 * @returns {{ retenus: Map<string, Lien>, toolchain: string[], nonResolus: { site: string, helper: string, raison: string }[], vitest: string[], node: string[], modules: number }}
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

  /** @typedef {{ nature: 'touché' | 'toolchain' | 'import' | 'racine balayée' | 'setup', distance: number, rang?: number, chaine?: string[], racine?: string, site?: string, touche: string }} Lien */
  /** @type {Map<string, Lien>} */
  const retenus = new Map()
  const retenir = (test, lien) => {
    const deja = retenus.get(test)
    const rang = rangDe(lien)
    if (!deja || rang < deja.rang || (rang === deja.rang && lien.distance < deja.distance)) retenus.set(test, { ...lien, rang })
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
    for (let i = 0; i < aLire.length; i += LOT_D_ANALYSE)
      for (const { fichier, sourceFile } of analyserCorpus(aLire.slice(i, i + LOT_D_ANALYSE))) {
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
  let evaluateur
  prelire(new Set([...lecteurs, ...[...lecteurs].flatMap((f) => (cache.get(abs(f)) ?? []).map((arc) => rel(arc.cible)))]))
  for (let frontiere = [...lecteurs]; ;) {
    evaluateur = evaluateurDuDepot({ lecture: lectureDe, cible: cibleDe, peutLire: (f) => lecteurs.has(f) })
    const suivante = []
    for (const f of frontiere) {
      const noms = evaluateur.relaisExportes(f)
      if (!noms.length) continue
      const motif = new RegExp(`\\b(?:${noms.join('|')})\\b|export\\s*\\*`)
      for (const { importeur } of inverse.get(f) ?? [])
        if (!lecteurs.has(importeur) && textes.has(importeur) && motif.test(textes.get(importeur))) { lecteurs.add(importeur); suivante.push(importeur) }
    }
    if (!suivante.length) break
    prelire(suivante)
    frontiere = [...lecteurs]
  }

  const nonResolus = []
  for (const f of [...lecteurs].sort()) {
    for (const site of evaluateur.sitesDe(f)) {
      const ici = `${f}:${site.ligne}`
      for (const v of site.valeurs) if ('non' in v) nonResolus.push({ site: ici, helper: site.appel, raison: v.non })
      for (const v of site.valeurs) {
        if (!('chemin' in v)) continue
        const touche = touches.find((t) => couvre(v.chemin, t))
        if (!touche) continue
        const lien = { racine: v.chemin || '.', site: `${ici} ${site.appel}`, touche }
        for (const [test, { distance }] of remonter(f)) retenir(test, { nature: 'racine balayée', distance, ...lien })
        if (clotureSetup.has(f)) parSetup(lien)
      }
    }
  }
  /** Le SIGNAL de chaque test d'import (`signalDe`) : exports touchés du module touché (base contre
   *  post-image), liaisons du dernier maillon de sa chaîne. */
  const cibles = [...new Set([...retenus.values()].filter((l) => l.nature === 'import' && estModule(l.touche)).map((l) => l.touche))]
  const avantDe = cibles.length && lireAvant ? lireAvant(cibles) : new Map()
  const exportsDe = new Map(cibles.map((m) => [m, exportsTouches(m, avantDe.get(m) ?? null, textes.get(m) ?? null)]))
  const signaux = new Map()
  for (const [test, lien] of retenus) {
    if (lien.nature !== 'import') continue
    const importeur = lien.chaine[lien.chaine.length - 2]
    const liaisons = (() => {
      try { return liaisonsDe(importeur, textes.get(importeur) ?? '').filter((l) => l.spec && cibleDe(importeur, l.spec) === lien.touche) } catch { return [] }
    })()
    signaux.set(test, signalDe(lien, liaisons, exportsDe.get(lien.touche) ?? new Set()))
  }
  return { retenus, toolchain, nonResolus, vitest, node, modules: cache.size, setup, signaux }
}

/**
 * La politique d'exécution (#2400) : touché et racine balayée HORS budget, toujours lancés ; puis les
 * rangs d'import, setup et toolchain dans l'ordre, chacun trié par signal (`SIGNAUX`), puis estimation
 * croissante, puis chemin. Un test s'ajoute tant que l'estimation cumulée reste ≤ `budget` secondes ; le
 * premier qui déborde part à la CI avec tous les suivants. PURE.
 * @param {Map<string, { rang: number }>} retenus
 * @param {{ budget?: number, estimations?: Map<string, { ms: number }>, signaux?: Map<string, { signal: string }> }} [options]
 * @returns {{ lances: string[], aLaCI: string[], rangs: { rang: string, estimeMs: number, lances: number, aLaCI: number }[] }}
 */
export function planDExecution(retenus, { budget = BUDGET_LOCAL_S, estimations = new Map(), signaux = new Map() } = {}) {
  const parRang = new Map()
  for (const [test, { rang }] of retenus) parRang.set(rang, [...(parRang.get(rang) ?? []), test])
  const cout = (t) => estimations.get(t)?.ms ?? 0
  const force = (t) => SIGNAUX.indexOf(signaux.get(t)?.signal ?? 'reste')
  const lances = []
  const aLaCI = []
  const rangs = []
  let cumul = 0
  let coupe = false
  for (const rang of [...parRang.keys()].sort((a, b) => a - b)) {
    const tests = parRang.get(rang).sort((a, b) => force(a) - force(b) || cout(a) - cout(b) || (a < b ? -1 : 1))
    const bilan = { rang: libelleDuRang(rang), estimeMs: tests.reduce((n, t) => n + cout(t), 0), lances: 0, aLaCI: 0 }
    for (const t of tests) {
      if (rang > 1 && (coupe || budget === 0 || cumul + cout(t) > budget * 1000)) {
        coupe = true
        aLaCI.push(t)
        bilan.aLaCI += 1
        continue
      }
      if (rang > 1) cumul += cout(t)
      lances.push(t)
      bilan.lances += 1
    }
    rangs.push(bilan)
  }
  return { lances, aLaCI, rangs }
}

/** La famille d'un test : `vitest` ou `node`. */
const familleDe = (test) => estTestNode(test) ? 'node' : 'vitest'

/**
 * L'ESTIMATION de durée de chaque test (#2400) : sa durée apprise, sinon la médiane des durées apprises
 * de sa famille, sinon `repli` de sa famille. PURE.
 * @param {string[]} tests @param {Record<string, number>} durees @param {Record<string, number>} [repli]
 * @returns {Map<string, { ms: number, source: 'apprise' | 'médiane' | 'repli' }>}
 */
export function estimationsDe(tests, durees, repli = REPLI_MS) {
  const medianes = {}
  for (const famille of ['vitest', 'node']) {
    const valeurs = Object.entries(durees).filter(([t]) => familleDe(t) === famille).map(([, ms]) => ms).sort((a, b) => a - b)
    if (valeurs.length) medianes[famille] = valeurs.length % 2 ? valeurs[(valeurs.length - 1) / 2] : (valeurs[valeurs.length / 2 - 1] + valeurs[valeurs.length / 2]) / 2
  }
  return new Map(tests.map((t) => [t, Object.hasOwn(durees, t) ? { ms: durees[t], source: 'apprise' }
    : Object.hasOwn(medianes, familleDe(t)) ? { ms: medianes[familleDe(t)], source: 'médiane' } : { ms: repli[familleDe(t)], source: 'repli' }]))
}

/**
 * Les déclarations EXPORTÉES d'un module, nom → texte (`export *` sous `*`, l'export par défaut sous
 * `default`) ; un export local `export { a as b }` porte le texte de la déclaration de `a`. `null` : aucune.
 * @param {string} rel @param {string | null} texte @returns {Map<string, string>}
 */
export function declarationsExportees(rel, texte) {
  const exportees = new Map()
  if (texte === null) return exportees
  const ts = typescript()
  const [{ sourceFile }] = [...analyserCorpus([{ rel, text: texte }])]
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
  const a = declarationsExportees(rel, avant)
  const b = declarationsExportees(rel, apres)
  return new Set([...new Set([...a.keys(), ...b.keys()])].filter((nom) => a.get(nom) !== b.get(nom)))
}

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
  if (lien.nature === 'racine balayée') return `racine balayée ${lien.racine} (site ${lien.site}), ${lien.touche}`
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
  const lire = images.tete
    ? (rels) => lireEnLot(depot, images.tete, rels)
    : (rels) => new Map(rels.map((r) => {
      try { return [r, readFileSync(join(racine, r), 'utf8')] } catch { return [r, null] }
    }))
  const memos = memosDe(dossierDesMemos, versionDesMemos(racine))
  const lireAvant = (rels) => lireEnLot(depot, images.base, rels)
  const derive = deriverPerimetre({ racine, touches: images.touches, post: images.post, avant: images.avant, lire, lireAvant, memos })
  memos.sauver()
  return { ...images, ...derive }
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

/** Les durées apprises du dossier `dossier` (`DUREES`), `{}` si absentes ou illisibles. */
const dureesDe = (dossier) => {
  try { return JSON.parse(readFileSync(join(dossier, DUREES), 'utf8')) } catch { return {} }
}

/** Le libellé d'une durée en secondes. */
const secondes = (ms) => `${(ms / 1000).toFixed(1)} s`

function principal() {
  const options = lireArguments(process.argv.slice(2))
  const debut = performance.now()
  const racine = racineDe(depotDe(RACINE)) ?? RACINE
  const { base, tete, touches, post, retenus, toolchain, nonResolus, vitest, node, modules, signaux } = perimetreDuDepot(racine, options)
  const duree = Math.round(performance.now() - debut)
  const docs = selectionDesGenerateurs({ lot: touches, mesure: sourcesMesurees(racine), cwd: racine })
  const cache = join(racine, CACHE)
  const durees = dureesDe(cache)
  const estimations = estimationsDe([...retenus.keys()], durees)
  const budget = options.budget ?? BUDGET_LOCAL_S
  const plan = planDExecution(retenus, { budget, estimations, signaux })
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
  for (const [test, lien] of [...retenus].sort(([a], [b]) => (a < b ? -1 : 1)))
    console.log(`  ${test} ← ${texteDuLien(lien)}${texteDuSignal(test)} ~${secondes(estimations.get(test).ms)} (${estimations.get(test).source})`)
  const jouerDocs = options.docs && !docs.complete && docs.scripts.length > 0
  journal(`docs dérivés : ${docs.scripts.length} générateur(s) (${docs.raison}) ${jouerDocs ? 'en --check' : `→ CI${docs.complete || !docs.scripts.length ? '' : ' (`--docs` pour les jouer)'}`}${docs.scripts.length ? ` : ${docs.scripts.join(', ')}` : ''}`)
  journal(`balayages non résolus : ${nonResolus.length} site(s)`)
  for (const { site, helper, raison } of nonResolus) console.log(`  non résolu ${site} ${helper} — ${raison}`)
  const sources = [...estimations.values()].reduce((n, { source }) => ({ ...n, [source]: (n[source] ?? 0) + 1 }), {})
  journal(`estimations : ${Object.entries(sources).map(([s, n]) => `${s} ${n}`).join(' | ') || 'aucune'}`)
  for (const r of plan.rangs)
    journal(`  ${r.rang} : estimé ${secondes(r.estimeMs)}, ${r.lances} lancé(s)${r.aLaCI ? ` ; ${r.aLaCI} fichier(s) ${r.rang.replace('import ', '')} restent à la CI` : ''}`)
  journal(`budget ${budget} s (touché et racine balayée hors budget) : ${plan.lances.length} lancé(s) ; → CI ${plan.aLaCI.length}`)
  journal(`lint : ${aLinter(touches, post).length} fichier(s) touché(s)${options.liste ? ' (non joué sous --liste)' : ''}`)
  if (options.liste) return 0
  const lint = lintDesTouches(racine, touches, post)
  for (const d of lint.defauts) console.log(`  ${d.site} ${d.gravite} ${d.regle} — ${d.message}`)
  let code = lint.code
  const lances = new Set(plan.lances)
  mkdirSync(cache, { recursive: true })
  const rapport = (famille) => join(cache, `${famille}-${process.pid}.json`)
  const lancements = [
    ...paquetsDArgv(vitest.filter((t) => lances.has(t))).map((p) => ['scripts/test/run.mjs', ...p, '--reporter=default', '--reporter=json', `--outputFile.json=${rapport('vitest')}`]),
    ...paquetsDArgv(node.filter((t) => lances.has(t))).map((p) => ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
      `--test-reporter=${pathToFileURL(join(RACINE, 'scripts/test/dureesNodeTest.mjs')).href}`, `--test-reporter-destination=${rapport('node')}`, ...p]),
    ...(jouerDocs ? [['scripts/docs/build-all.mjs', '--check', '--only', ...docs.scripts]] : []),
  ]
  for (const args of lancements) {
    const r = spawnSync(process.execPath, args, { cwd: racine, stdio: 'inherit' })
    if (code === 0) code = codeEnfant(r.status, r.signal)
    apprendre(racine, cache, rapport)
  }
  return code
}

/** Fusionne dans `DUREES` les rapports de durées du dernier lancement (Vitest JSON, `dureesNodeTest`), puis les efface. */
function apprendre(racine, cache, rapport) {
  const base = resolve(racine).split(sep).join('/')
  const relDe = (a) => a.split(sep).join('/').replace(`${base}/`, '')
  const appris = {}
  for (const famille of ['vitest', 'node']) {
    let lu
    try { lu = JSON.parse(readFileSync(rapport(famille), 'utf8')) } catch { continue }
    if (famille === 'vitest') for (const r of lu.testResults ?? []) appris[relDe(r.name)] = r.endTime - r.startTime
    else for (const [f, ms] of Object.entries(lu)) appris[relDe(f)] = Math.round(ms)
    rmSync(rapport(famille), { force: true })
  }
  if (Object.keys(appris).length) writeFileSync(join(cache, DUREES), JSON.stringify({ ...dureesDe(cache), ...appris }))
}

if (import.meta.main) {
  try {
    process.exitCode = principal()
  } catch (erreur) {
    console.error(`[perimetre] ${erreur.message}`)
    process.exitCode = 2
  }
}
