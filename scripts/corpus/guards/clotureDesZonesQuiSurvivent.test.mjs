// MUR DE CLÔTURE DES ZONES QUI SURVIVENT (#3058, #3337) : la clôture d'imports (`clotureDImports`, arcs de valeur et de
// type, `import()`, `require` et ses liaisons `createRequire(…)`, `tsImport` de `tsx/esm/api`, chargeurs de Vitest,
// motifs d'`import.meta.glob`, spécificateurs relatifs, alias et `/…`) de chaque module, production, suites et bancs,
// d'une zone qui survit (`survit`, `couches.mjs`) ne compte aucun module d'une zone qui n'y survit pas
// (`fermeParLaSurvie`), par un module hors des zones compris : celui qu'ouvre `murs/tests-survivants` à un instrument,
// ou l'`outillage` déclaré (`horsZoneOuvert`) à la production, qui ouvre un module hors des zones, jamais une zone qui
// ne survit pas ; et aucun de ses membres ne charge un paquet de l'hôte web que la zone ferme (`paquetFerme`).
// ACQUISITIONS CALCULÉES (#3058 B2) : chaque acquisition calculée d'un membre se lit en forme fermée
// (`valeursDAcquisition`, `racinesBalayees.mjs`) ; ses fichiers et les modules des dossiers qu'elle descend entrent
// dans la clôture, jusqu'au point fixe ; une valeur hors de la liste, vide ou introuvable, et un chargeur que la lecture
// ne suit pas (`chargeur` de `sitesDeModule`), sont rouges. Mesuré sur l'arbre de travail, rouge sur des transits forgés.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUCHES, PAQUETS_DE_L_HOTE_WEB, estZone, fermeParLaSurvie, paquetFerme, zoneDe } from '../../guards/lib/couches.mjs'
import { paquetDe } from '../../guards/lib/couchesLint.mjs'
import { cibleLexicale } from '../../guards/lib/interneLint.mjs'
import { EXTENSIONS_DE_SCRIPT, analyserTexte, typescript } from '../../guards/lib/dialecte.mjs'
import { ciblesDEcritureDeCommande, lancementDInterpreteur } from '../../guards/lib/ecrituresShell.mjs'
import { forgerDepot } from '../../guards/lib/depotGabarit.mjs'
import { evaluer, lecteurDExpressions, valeursDAcquisition } from '../../guards/lib/racinesBalayees.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { TRAVAIL, depotDe, fichiersIgnoresDe, listerImage } from '../../guards/lib/gitPorte.mjs'
import { CHEMIN_TSCONFIG, aliasDe, arbreDuDisque, clotureDImports, estModule, grapheInverse, resolveImport } from '../../guards/lib/importGraph.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

const EXTERIEURS_JS = new Set(['node', 'node.exe', 'tsx', 'npx'])
const LANCEURS_NODE = new Set(['fork', 'spawn', 'spawnSync', 'execFile', 'execFileSync'])
const LANCEURS_SHELL = new Set(['exec', 'execSync'])
const MOT_OPAQUE = '\0'
const PAQUETS_DE_L_OUTILLAGE = new Set(Object.values(COUCHES).flatMap((c) => Object.values(c.paquetsDOutillage ?? {}).flat()))
const PAQUETS_FERMES_AUX_ENFANTS = new Set(PAQUETS_DE_L_HOTE_WEB.filter((p) => !PAQUETS_DE_L_OUTILLAGE.has(p)))

/** Les entrées d'enfants bornées par leur lancement Node, depuis leur cwd. Le code en ligne, les
 *  options d'environnement, les relais et les argv indéterminés demandent une mesure distincte. */
function entreesDesEnfants(rel, sourceFile, sites, depot, racine, image) {
  const estModuleEnfant = (spec) => spec === 'node:child_process' || spec === 'child_process'
  const estOutilLocal = (spec) => spec?.endsWith('/lancer-local.mjs') && depot.cible(rel, spec) === 'scripts/lancer-local.mjs'
  if (!sites.some(({ spec }) => estModuleEnfant(spec) || estOutilLocal(spec))) return []

  const ts = typescript()
  const lire = lecteurDExpressions(rel, sourceFile)
  const motDExpression = (e) => {
    if (e.k === 'lit' && typeof e.v === 'string') return e.v
    const valeurs = evaluer(e, { lambdas: lire.lambdas })
    return valeurs.length === 1 && 'chemin' in valeurs[0] ? resolve(racine, valeurs[0].chemin) : MOT_OPAQUE
  }
  const mot = (n) => {
    if (!n) return MOT_OPAQUE
    if (ts.isStringLiteralLikeNode(n)) return n.text
    const valeurs = valeursDAcquisition(rel, sourceFile, n, depot)
    if (valeurs.length === 1) {
      if ('specificateur' in valeurs[0]) return valeurs[0].specificateur
      if ('fichier' in valeurs[0]) return resolve(racine, valeurs[0].fichier)
    }
    return motDExpression(lire.expr(n))
  }
  const argvDe = (n) => {
    if (!n) return []
    if (!ts.isArrayLiteralExpression(n)) {
      const e = lire.expr(n)
      return e.k === 'liste' ? e.v.map(motDExpression) : [MOT_OPAQUE]
    }
    const args = []
    for (const e of n.elements) {
      if (ts.isSpreadElement(e)) return [...args, MOT_OPAQUE]
      args.push(mot(e))
    }
    return args
  }
  const option = (options, nom) => {
    if (!options) return undefined
    if (!ts.isObjectLiteralExpression(options)) return null
    for (const p of [...options.properties].reverse()) {
      if (ts.isSpreadAssignment(p) || ts.isComputedPropertyName(p.name)) return null
      if (p.name.text !== nom) continue
      if (ts.isShorthandPropertyAssignment(p)) return p.name
      return ts.isPropertyAssignment(p) ? p.initializer : null
    }
  }
  const estNode = (n) => n && ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)
    && n.expression.text === 'process' && n.name.text === 'execPath'
  const lancements = []
  const relever = (n, scripts, cwd, opaque, paquets = []) => {
    const cibles = scripts.flatMap((script) => {
      if (!script || script.includes(MOT_OPAQUE) || cwd === MOT_OPAQUE) return []
      const cible = relative(racine, resolve(racine, cwd, script)).split('\\').join('/')
      return image.has(cible) && estModule(cible) ? [cible] : []
    })
    lancements.push({
      site: rel + ':' + lire.ligneDe(n),
      cibles,
      paquets,
      opaque: opaque || cibles.length < scripts.length,
    })
  }
  const interpreter = (n, commande, argv, cwd) => {
    const lancement = lancementDInterpreteur([commande, ...argv])
    const scripts = lancement?.scripts ?? []
    const paquets = (lancement?.prechargements ?? []).map(paquetDe).filter((p) => p !== null)
    relever(n, scripts, cwd, !scripts.length || lancement.enLigne !== undefined, paquets)
  }
  const visiter = (n) => {
    if (ts.isCallExpression(n)) {
      const cible = lire.cibleAppele(n)
      const [premier, args, options, quatrieme] = n.arguments
      if (cible?.k === 'importe' && estOutilLocal(cible.spec) && cible.nom === 'sortieOutilLocal'
        && mot(args) === 'tsx' && mot(options) === 'tsx') {
        interpreter(n, 'tsx', argvDe(quatrieme), mot(premier))
      } else if (cible?.k === 'importe' && estModuleEnfant(cible.spec) && LANCEURS_SHELL.has(cible.nom)) {
        const commande = mot(premier)
        const optionCwd = option(args, 'cwd')
        const cwd = optionCwd === undefined ? racine : mot(optionCwd)
        if (commande !== MOT_OPAQUE && cwd !== MOT_OPAQUE) {
          const scripts = ciblesDEcritureDeCommande(commande, { scripts: true, base: resolve(racine, cwd), lireTexte: () => null })
            .filter(({ operation }) => operation === 'script')
          if (scripts.length) relever(n, scripts.map(({ chemin }) => chemin), racine, false)
        }
      } else if (cible?.k === 'importe' && estModuleEnfant(cible.spec) && LANCEURS_NODE.has(cible.nom)) {
        const opt = args && ts.isObjectLiteralExpression(args) ? args : options
        const optionCwd = option(opt, 'cwd')
        const cwd = optionCwd === undefined ? racine : mot(optionCwd)
        if (cible.nom === 'fork') {
          const execPath = option(opt, 'execPath')
          const execArgv = option(opt, 'execArgv')
          if (execPath === undefined || estNode(execPath) || mot(execPath) === 'node') {
            interpreter(n, 'node', [...(execArgv === null ? [MOT_OPAQUE] : argvDe(execArgv)), mot(premier)], cwd)
          }
        } else {
          const commande = estNode(premier) ? 'node' : mot(premier)
          const shell = option(opt, 'shell')
          if (EXTERIEURS_JS.has(commande)) {
            const argv = shell === undefined || shell?.kind === ts.SyntaxKind.FalseKeyword
              ? argvDe(opt === args ? undefined : args) : [MOT_OPAQUE]
            interpreter(n, commande, argv, cwd)
          }
        }
      }
    }
    n.forEachChild(visiter)
  }
  visiter(sourceFile)
  return lancements
}

/**
 * Les TRANSITS des zones qui survivent dans `fichiers` (chemins relatifs à `racine`, l'ensemble que la marche lit) : par
 * zone qui survit, la clôture de ses modules, acquisitions calculées suivies jusqu'au point fixe, chaque membre dont la
 * zone n'y survit pas, avec ses importeurs de la clôture, chaque paquet de l'hôte web qu'un membre charge et que la zone
 * ferme au module (`paquetFerme`, sous l'outillage du module, `surSites`), et chaque acquisition calculée d'un membre
 * que la forme fermée ne résout pas. Les acquisitions calculées se relèvent une fois par module (`surSites`, sous le
 * cache de marche partagé) et se jugent par groupe.
 * Les fichiers ignorés n'entrent que par acquisition.
 * @param {string} racine @param {readonly string[]} fichiers @param {readonly string[]} [ignores]
 * @returns {{ cloture: Set<string>, transits: string[], suivis: number, enfants: Set<string>, lancements: Map }}
 */
function transitsDesZonesQuiSurvivent(racine, fichiers, ignores = []) {
  const modules = fichiers.filter((rel) => estModule(rel) && estZone(zoneDe(rel)) && COUCHES[zoneDe(rel)].survit === true)
  // Par zone, et par paquets que l'outillage du module lui ouvre (`paquetsDOutillage`).
  const ouverts = (rel) => PAQUETS_DE_L_HOTE_WEB.filter((p) => !paquetFerme(zoneDe(rel), p, rel)).join(',')
  const parGroupe = Map.groupBy(modules, (rel) => `${zoneDe(rel)}|${ouverts(rel)}`)
  const abs = (rel) => join(racine, rel).split('\\').join('/')
  const relDe = (a) => relative(racine, a).split('\\').join('/')
  const image = new Set([...fichiers, ...ignores])
  const arbre = arbreDuDisque([...image].map(abs))
  const alias = aliasDe(image.has(CHEMIN_TSCONFIG) ? readFileSync(abs(CHEMIN_TSCONFIG), 'utf8') : null, racine)
  const cibleDe = (rel, spec) => {
    const c = resolveImport(abs(rel), spec, arbre.existe, alias, 'dynamique', racine)
    return c === null ? null : relDe(c)
  }
  const arbres = new Map()
  const depot = {
    arbreDe: (rel) => {
      if (!image.has(rel) || !estModule(rel)) return null
      if (!arbres.has(rel)) arbres.set(rel, analyserTexte({ rel, text: readFileSync(abs(rel), 'utf8') }).sourceFile)
      return arbres.get(rel)
    },
    cible: (rel, spec) => { const c = cibleDe(rel, spec); return c !== null && image.has(c) ? c : null },
  }
  const cache = new Map()
  const cloture = new Set()
  const transits = []
  const paquets = new Map()
  const lancements = new Map()
  /** Par module, ses acquisitions calculées : site, et valeurs (`valeursDAcquisition`) ou chargeur non suivi. */
  const calcules = new Map()
  const surSites = (a, sites, sourceFile) => {
    const rel = relDe(a)
    for (const { acquisition, spec } of sites)
      if (acquisition && spec !== null && cibleLexicale(a, spec, racine) === null && paquetDe(spec) !== null) paquets.set(rel, [...(paquets.get(rel) ?? []), paquetDe(spec)])
    const juges = sites.filter((s) => s.genre === 'chargeur' || (s.acquisition && s.spec === null)).map((s) => ({
      site: `${rel}:${s.ligne} « ${s.texte.replace(/\s+/g, ' ')} »`,
      valeurs: s.genre === 'chargeur' ? null : valeursDAcquisition(rel, sourceFile, s.noeud.arguments?.[0], depot),
    }))
    if (juges.length) calcules.set(rel, juges)
    const enfants = entreesDesEnfants(rel, sourceFile, sites, depot, racine, image)
    if (enfants.length) lancements.set(rel, enfants)
  }
  /** Une marche inclut les acquisitions calculées jusqu'au point fixe, quel que soit son point d'entrée. */
  const marche = (racines) => {
    const calculesVers = new Map()
    const paquetsCalcules = []
    const rouges = []
    let membres
    for (let racinesDuTour = racines; ;) {
      membres = clotureDImports(racinesDuTour, { racine, cache, arbre, surSites })
      calculesVers.clear()
      paquetsCalcules.length = 0
      rouges.length = 0
      for (const rel of [...membres].sort())
        for (const { site, valeurs } of calcules.get(rel) ?? []) {
          if (valeurs === null) { rouges.push(`chargeur non suivi — ${site}`); continue }
          if (!valeurs.length) rouges.push(`acquisition calculée sans valeur — ${site}`)
          for (const v of valeurs) {
            if ('non' in v) { rouges.push(`acquisition calculée non résolue — ${site} : ${v.non}`); continue }
            const nu = 'specificateur' in v && !/^[./]/.test(v.specificateur) && cibleDe(rel, v.specificateur) === null
            if (nu) {
              const paquet = paquetDe(v.specificateur)
              if (paquet !== null) paquetsCalcules.push({ paquet, site })
              continue
            }
            const cibles = 'fichier' in v ? [v.fichier].filter((f) => image.has(f))
              : 'dossier' in v ? [...image].filter((f) => estModule(f) && (v.dossier === '' || f.startsWith(`${v.dossier}/`)))
                : [cibleDe(rel, v.specificateur)].filter((c) => c !== null && image.has(c))
            if (!cibles.length) rouges.push(`acquisition calculée introuvable — ${site} : ${JSON.stringify(v)}`)
            for (const c of cibles) calculesVers.set(c, [...(calculesVers.get(c) ?? []), `${site} (acquisition calculée)`])
          }
        }
      const neufs = [...calculesVers.keys()].filter((c) => !membres.has(c))
      if (!neufs.length) return { membres, calculesVers, paquetsCalcules, rouges }
      racinesDuTour = [...racinesDuTour, ...neufs]
    }
  }
  let suivis = 0
  for (const racines of parGroupe.values()) {
    const de = zoneDe(racines[0])
    const { membres, calculesVers, paquetsCalcules, rouges } = marche(racines)
    for (const { paquet, site } of paquetsCalcules)
      if (paquetFerme(de, paquet, racines[0])) transits.push(`${de} : paquet ${paquet} ← ${site} (acquisition calculée)`)
    suivis += calculesVers.size
    for (const rel of membres) cloture.add(rel)
    const inverse = grapheInverse(cache)
    for (const rel of [...membres].filter((m) => fermeParLaSurvie(de, zoneDe(m))).sort()) {
      const importeurs = (inverse.get(abs(rel)) ?? []).map((a) => relDe(a.importeur)).filter((i) => membres.has(i))
      transits.push(`${de} : ${rel} ← ${[...new Set([...importeurs, ...(calculesVers.get(rel) ?? [])])].sort().join(', ')}`)
    }
    for (const rel of [...membres].sort())
      for (const paquet of new Set(paquets.get(rel))) if (paquetFerme(de, paquet, racines[0])) transits.push(`${de} : paquet ${paquet} ← ${rel}`)
    transits.push(...rouges.map((r) => `${de} : ${r}`))
  }
  // L'enfant est un exécutable indépendant. Son graphe ne donne aucun droit d'import au lanceur.
  const enfants = new Set()
  const departs = new Set(cloture)
  for (const rel of departs)
    for (const { site, cibles, paquets: precharges } of lancements.get(rel) ?? []) {
      for (const paquet of new Set(precharges))
        if (PAQUETS_FERMES_AUX_ENFANTS.has(paquet))
          transits.push(`processus enfant : paquet ${paquet} (préchargement) ← ${site}`)
      for (const entree of cibles) {
        if (enfants.has(entree)) continue
        enfants.add(entree)
        const { membres, paquetsCalcules, rouges } = marche([entree])
        for (const rouge of rouges) transits.push(`processus enfant : ${rouge} ← ${entree} ← ${site}`)
        for (const { paquet, site: acquisition } of paquetsCalcules)
          if (PAQUETS_FERMES_AUX_ENFANTS.has(paquet))
            transits.push(`processus enfant : paquet ${paquet} ← ${acquisition} (acquisition calculée) ← ${entree} ← ${site}`)
        for (const membre of membres) {
          departs.add(membre)
          const zone = zoneDe(membre)
          if (estZone(zone) && !COUCHES[zone].survit)
            transits.push(`processus enfant : ${membre} ← ${entree} ← ${site}`)
          for (const paquet of new Set(paquets.get(membre)))
            if (PAQUETS_FERMES_AUX_ENFANTS.has(paquet))
              transits.push(`processus enfant : paquet ${paquet} ← ${membre} ← ${entree} ← ${site}`)
        }
      }
    }
  return { cloture, transits, suivis, enfants, lancements }
}

/** La clôture sur le corpus de travail et les cibles ignorées qu'un chargement peut réellement lire. */
function transitsDuTravail(depot) {
  const fichiers = listerImage(depot, TRAVAIL)
  const pathspecs = [...EXTENSIONS_DE_SCRIPT, '.json'].map((ext) => ':(glob)**/*' + ext)
  const ignores = fichiersIgnoresDe(depot, ...pathspecs, ':(exclude,glob)**/node_modules/**')
  return transitsDesZonesQuiSurvivent(depot.cwd, fichiers, ignores)
}

test('CLÔTURE : aucun module d’une zone qui survit, production comprise, n’atteint, de proche en proche, une zone qui n’y survit pas', () => {
  const { cloture, transits, suivis, enfants } = transitsDuTravail(depotDe(RACINE))
  assert.deepEqual(transits, [], 'transit vers une zone qui ne survit pas (`fermeParLaSurvie`), ou acquisition calculée non résolue : chaque ligne nomme la zone du module racine, le module atteint et ses importeurs, ou le site')
  // Témoins de MESURE : la marche traverse un module hors des zones, ce que `murs/tests-survivants` et `murs/purete-imports`
  // ne suivent pas, et suit au moins une acquisition calculée.
  assert.ok([...cloture].some((rel) => zoneDe(rel) === null), 'la clôture ne traverse aucun module hors des zones : le mur ne mesure plus le transit')
  assert.ok(suivis > 0, 'aucune acquisition calculée suivie : le mur ne mesure plus les acquisitions calculées')
  assert.ok(enfants.size > 0, 'aucun point d’entrée Node suivi depuis un lancement')
})

/** Mesure la fixture temporaire (chemin → texte). */
function dansArbreForge(fichiers, mesurer) {
  const racine = mkdtempSync(join(tmpdir(), 'cloture-zones-survivantes-'))
  try {
    for (const [rel, code] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(racine, rel)), { recursive: true })
      writeFileSync(join(racine, rel), code)
    }
    return mesurer(racine)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

/** Les transits d'un arbre forgé. */
function forger(fichiers) {
  return dansArbreForge(fichiers, (racine) => transitsDesZonesQuiSurvivent(racine, Object.keys(fichiers)).transits)
}

/** Les ponts vers le module hors des zones qui acquiert Three, sous chaque forme d'arc que la marche lit. */
const PONTS = {
  relatif: "export { valeur as x } from './transit/dep.ts';\n",
  'chemin `/…`': "export { valeur as x } from '/scripts/transit/dep.ts';\n",
  'alias `@/`': "export { valeur as x } from '@/dep';\n",
  'gabarit sans expression': 'export const x = () => import(`./transit/dep.ts`);\n',
  'import.meta.glob': "export const x = import.meta.glob('./transit/*.ts', { eager: true });\n",
  'vi.importActual': "import { vi } from 'vitest';\nexport const x = () => vi.importActual('./transit/dep.ts');\n",
  'vi.mock': "import { vi } from 'vitest';\nvi.mock('./transit/dep.ts');\nexport const x = 1;\n",
  'liaison `createRequire(…)`': "import { createRequire } from 'node:module';\nconst r = createRequire(import.meta.url);\nexport const x = r('./transit/dep.ts');\n",
  'type seul': "export type { U as x } from './transit/dep.ts';\n",
  'tsImport': "import { tsImport } from 'tsx/esm/api';\nexport const x = () => tsImport('./transit/dep.ts', import.meta.url);\n",
}

test('CLÔTURE : un paquet fermé atteint par un module hors des zones est rouge sous chaque forme d’arc ; la traversée vers une zone ouverte passe', () => {
  const commun = {
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['scripts/transit/*'] } } }),
    'src/noyau/a.test.ts': "import { x } from '../../scripts/pont.mjs';\nexport const a = x;\n",
    'scripts/transit/dep.ts': "export { Mesh as valeur } from 'three';\nexport type U = number;\n",
  }
  const formes = Object.keys(PONTS)
  assert.deepEqual(tableTotale(formes, (forme) => forger({ ...commun, 'scripts/pont.mts': PONTS[forme] })),
    tableTotale(formes, () => ['noyau : paquet three ← scripts/transit/dep.ts']))
  const paquet = forger({ ...commun, 'scripts/pont.mts': "import type { Mesh } from 'three';\nexport type x = Mesh;\nexport { z } from 'zod';\n" })
  assert.deepEqual(paquet, ['noyau : paquet three ← scripts/pont.mts'], 'un paquet fermé atteint en transit, même pour un type ; zod passe')
  assert.deepEqual(forger({
    'hotes/c.bench.ts': "import { y } from '../scripts/neutre.mjs';\nexport const c = y;\n",
    'scripts/neutre.mjs': "export { z as y } from '../src/noyau/z.ts';\n",
    'src/noyau/z.ts': 'export const z = 1;\n',
  }), [])
})

test('CLÔTURE : un enfant Node, son préchargeur ou le script de tsx suivent leurs propres imports', () => {
  const commun = {
    'src/noyau/a.test.ts': "import '../../scripts/lanceur.mjs';",
    'scripts/lancer-local.mjs': 'export function sortieOutilLocal() {}',
    'scripts/enfant.mjs': "import './transit.mjs';",
    'scripts/transit.mjs': "export { valeur } from 'react';",
    'scripts/neutre.mjs': 'export const valeur = 1;',
  }
  const appels = [
    "import { spawnSync as lancer } from 'node:child_process';\nlancer(process.execPath, ['scripts/enfant.mjs']);",
    "import { execFile } from 'child_process';\nconst fichier = './enfant.mjs'; execFile('node', [fichier], { cwd: 'scripts' });",
    "import { fork } from 'node:child_process';\nfork('./enfant.mjs', { cwd: 'scripts' });",
    "import { spawn } from 'node:child_process';\nspawn('node', ['--import', './enfant.mjs', './neutre.mjs'], { cwd: 'scripts' });",
    "import { spawn } from 'node:child_process';\nspawn('node', ['--require=./enfant.mjs', './neutre.mjs'], { cwd: 'scripts' });",
    "import { sortieOutilLocal } from './lancer-local.mjs';\nsortieOutilLocal(process.cwd(), 'tsx', 'tsx', ['scripts/enfant.mjs']);",
    `import { exec } from 'node:child_process';\nexec("cd scripts && npx tsx './enfant.mjs'");`,
  ]
  for (const lanceur of appels) {
    const arbre = { ...commun, 'scripts/lanceur.mjs': lanceur }
    assert.deepEqual(forger(arbre), [
      'processus enfant : paquet react ← scripts/transit.mjs ← scripts/enfant.mjs ← scripts/lanceur.mjs:2',
    ])
    assert.deepEqual(forger({ ...arbre, 'scripts/transit.mjs': "export { valeur } from 'three';" }), [])
  }
  assert.deepEqual(forger({
    ...commun,
    'scripts/lanceur.mjs': appels[0],
    'scripts/enfant.mjs': "const cible = './transit.mjs'; export const charger = () => import(cible);",
  }), ['processus enfant : paquet react ← scripts/transit.mjs ← scripts/enfant.mjs ← scripts/lanceur.mjs:2'])
  const precharger = (paquet) => forger({
    ...commun,
    'scripts/lanceur.mjs': `import { spawn } from 'node:child_process';\nspawn('node', ['--import', '${paquet}', 'scripts/neutre.mjs']);`,
  })
  assert.deepEqual(precharger('react'), ['processus enfant : paquet react (préchargement) ← scripts/lanceur.mjs:2'])
  assert.deepEqual(precharger('three'), [])
})

test('CLÔTURE : un module de production atteint Three par un pont hors des zones ; l’évaluateur d’assets de Godot peut l’utiliser', () => {
  const hote = { 'hotes/x.mjs': "import { y } from '../scripts/pont.mjs';\nexport const x = y;\n" }
  const pont = { 'scripts/pont.mjs': "export { Mesh as y } from 'three';\n" }
  assert.deepEqual(forger({ ...hote, ...pont }), ['hotes : paquet three ← scripts/pont.mjs'])
  assert.deepEqual(forger({
    'hotes/godot/asset/evaluateur/x.mjs': "export { y as x } from '../../../../scripts/pont.mjs';\n",
    ...pont,
  }), [])
  assert.deepEqual(forger({ ...hote,
    'scripts/pont.mjs': "export { e as y } from '../src/lib/e.ts';\n",
    'src/lib/e.ts': 'export const e = 1;\n',
  }), [])
})

/** Une suite du noyau qui importe le pont, un module qui acquiert Three et un module autorisé. */
const SOCLE_CALCULE = {
  'src/noyau/a.test.ts': "import { x } from '../../scripts/pont.mjs';\nexport const a = x;\n",
  'scripts/transit/dep.ts': "export { Mesh } from 'three';\n",
  'src/noyau/z.ts': 'export const z = 1;\n',
  'scripts/guards/lib/lister.mjs': 'export const listerEntrees = () => ({ entrees: [] });\n',
  'scripts/reg.mjs': "export const REG = ['../src/noyau/z.ts'];\nexport const CFG = { p: '../src/noyau/z.ts' };\n",
  'scripts/reg2.mjs': "export const P = '../src/noyau/z.ts'.replace('src/noyau/z.ts', 'scripts/transit/dep.ts');\n",
  'scripts/mut.mjs': "import { REG, CFG } from './reg.mjs';\nREG.push('./transit/dep.ts');\nCFG.p = './transit/dep.ts';\n",
}

const LISTER = "import { listerEntrees } from './guards/lib/lister.mjs';\n"

const DESCENTE_TRANSIT = `${LISTER}import { join } from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nconst D = fileURLToPath(new URL('../scripts/transit/', import.meta.url));\nexport const x = () => listerEntrees(D).entrees.map((f) => import(pathToFileURL(join(D, f.nom)).href));\n`

/** Les acquisitions non suivies et le paquet fermé chargé par un spécificateur calculé, avec le site à nommer. */
const ROUGES_CALCULES = {
  'replace': ["export const x = () => import('../src/noyau/z.ts'.replace('src/noyau/z.ts', 'scripts/transit/dep.ts'));\n", 'scripts/pont.mjs:1'],
  'replaceAll': ["export const x = () => import('../src/noyau/z.ts'.replaceAll('src/noyau/z.ts', 'scripts/transit/dep.ts'));\n", 'scripts/pont.mjs:1'],
  'split/join': ["export const x = () => import('../src/noyau/z.ts'.split('src/noyau/z.ts').join('scripts/transit/dep.ts'));\n", 'scripts/pont.mjs:1'],
  'slice': ["const s = '../src/noyau/z.ts#./transit/dep.ts';\nexport const x = () => import(s.slice(18));\n", 'scripts/pont.mjs:2'],
  '`join` homonyme local': ["const join = () => './transit/dep.ts';\nexport const x = () => import(join('../src/noyau', 'z.ts'));\n", 'scripts/pont.mjs:2'],
  '`replace` dans un autre module': ["import { P } from './reg2.mjs';\nexport const x = () => import(P);\n", 'scripts/pont.mjs:2'],
  '`push` local': ["const L = ['../src/noyau/z.ts'];\nL.push('./transit/dep.ts');\nexport const x = () => Promise.all(L.map((m) => import(m)));\n", 'scripts/pont.mjs:3'],
  '`Object.assign`': ["const C = { p: '../src/noyau/z.ts' };\nObject.assign(C, { p: './transit/dep.ts' });\nexport const x = () => import(C.p);\n", 'scripts/pont.mjs:3'],
  'registre muté ailleurs': ["import './mut.mjs';\nimport { REG } from './reg.mjs';\nexport const x = () => import(REG.find((m) => m));\n", 'scripts/pont.mjs:3'],
  'objet muté ailleurs': ["import './mut.mjs';\nimport { CFG } from './reg.mjs';\nexport const x = () => import(CFG.p);\n", 'scripts/pont.mjs:3'],
  '`createRequire` renommé': ["import { createRequire as cr } from 'node:module';\nconst r = cr(import.meta.url);\nexport const x = r('./transit/dep.ts');\n", 'scripts/pont.mjs:1'],
  'liaison `createRequire` recopiée': ["import { createRequire } from 'node:module';\nconst q = createRequire(import.meta.url);\nconst r = q;\nexport const x = r('./transit/dep.ts');\n", 'scripts/pont.mjs:3'],
  'espace de Vitest': ["import * as V from 'vitest';\nexport const x = () => V.vi.importActual('./transit/dep.ts');\n", 'scripts/pont.mjs:2'],
  '`vi` déstructuré': ["import { vi } from 'vitest';\nconst { importActual } = vi;\nexport const x = () => importActual('./transit/dep.ts');\n", 'scripts/pont.mjs:2'],
  'descente sous deux `dirname` et un suffixe': [`${LISTER}import { dirname, join } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst D = fileURLToPath(new URL('../src/noyau/', import.meta.url));\nexport const x = () => listerEntrees(D).entrees.map((f) => import(join(dirname(dirname(join(D, f.nom))), '../scripts/transit/dep.ts')));\n`, 'scripts/pont.mjs:5'],
  'descente sur un espace': [`${LISTER}import { join } from 'node:path';\nimport { tmpdir } from 'node:os';\nimport { pathToFileURL } from 'node:url';\nconst D = join(tmpdir(), 'x');\nexport const x = () => listerEntrees(D).entrees.map((f) => import(pathToFileURL(join(D, f.nom)).href));\n`, 'scripts/pont.mjs:6'],
  'F1 boucle sur un littéral': ["for (const m of ['./transit/dep.ts']) await import(m);\nexport const x = 1;\n", 'scripts/pont.mjs:1'],
  'F3 segment inconnu': ["import { join } from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nconst D = fileURLToPath(new URL('../src/', import.meta.url));\nexport const x = () => import(pathToFileURL(join(D, process.env.X)).href);\n", 'scripts/pont.mjs:4'],
  'F4 relais': ['export const x = (p) => import(p);\n', 'scripts/pont.mjs:1'],
  'F5 paquet de l’hôte web': ["const nom = 'three';\nexport const x = () => import(nom);\n", 'scripts/pont.mjs:2'],
  'F8 `require` lié et `vi.importActual` calculés dans un kit': ["import { k } from './kit.testkit.mjs';\nexport const x = k;\n", 'scripts/kit.testkit.mjs:5', { 'scripts/kit.testkit.mjs': "import { createRequire } from 'node:module';\nimport { vi } from 'vitest';\nconst r = createRequire(import.meta.url);\nconst s = './transit/dep.ts';\nexport const k = () => [r(s), vi.importActual(s), vi.importActual(process.env.X)];\n" }],
  'valeur vide': ["const V = Object.freeze([].map(Object.freeze));\nexport const x = () => import(V.find((v) => v).s);\n", 'scripts/pont.mjs:2'],
}

/** La ligne rouge d'un arbre forgé qui nomme `site` sous la zone `zone`, sinon tous ses transits. */
const rougeAuSite = (transits, zone, site) => transits.find((t) => t.startsWith(`${zone} : `) && t.includes(`${site} «`)) ? 'rouge au site' : transits

test('CLÔTURE : une acquisition calculée d’un membre nomme le site si elle charge directement un paquet fermé ou si la forme fermée ne la lit pas', () => {
  const formes = Object.keys(ROUGES_CALCULES)
  assert.deepEqual(tableTotale(formes, (forme) => {
    const [pont, site, autres = {}] = ROUGES_CALCULES[forme]
    return rougeAuSite(forger({ ...SOCLE_CALCULE, ...autres, 'scripts/pont.mjs': pont }), 'noyau', site)
  }), tableTotale(formes, () => 'rouge au site'))
})

test('CLÔTURE : les acquisitions calculées résolues étendent la clôture jusqu’au paquet fermé, y compris au second ordre', () => {
  const formes = {
    '`resolve` depuis le cwd': ["import { resolve } from 'node:path';\nexport const x = () => import(resolve('scripts/transit/dep.ts'));\n"],
    '`pathToFileURL(texte)`': ["import { pathToFileURL } from 'node:url';\nexport const x = () => import(pathToFileURL('scripts/transit/dep.ts').href);\n"],
    'F2 descente de `scripts/transit/`': [DESCENTE_TRANSIT],
    'F7 second ordre': ["const b = './b.mjs';\nexport const x = () => import(b);\n", { 'scripts/b.mjs': "const s = './transit/dep.ts';\nexport const y = () => import(s);\n" }],
  }
  const noms = Object.keys(formes)
  assert.deepEqual(tableTotale(noms, (nom) => {
    const [pont, autres = {}] = formes[nom]
    return forger({ ...SOCLE_CALCULE, ...autres, 'scripts/pont.mjs': pont })
  }), tableTotale(noms, () => ['noyau : paquet three ← scripts/transit/dep.ts']))
})

test('CLÔTURE : une acquisition calculée partagée par deux groupes, ou atteinte d’un module de production, est rouge dans chacun', () => {
  const hote = { 'hotes/h.mjs': "import { x } from '../scripts/pont.mjs';\nexport const h = x;\n" }
  const relais = 'export const x = (p) => import(p);\n'
  const deux = forger({ ...SOCLE_CALCULE, ...hote, 'scripts/pont.mjs': relais })
  assert.deepEqual(['noyau', 'hotes'].map((zone) => rougeAuSite(deux, zone, 'scripts/pont.mjs:1')), ['rouge au site', 'rouge au site'], 'F9 : chaque groupe juge le module calculé relevé une fois')
  const { 'src/noyau/a.test.ts': _, ...sansSuite } = SOCLE_CALCULE
  assert.equal(rougeAuSite(forger({ ...sansSuite, ...hote, 'scripts/pont.mjs': relais }), 'hotes', 'scripts/pont.mjs:1'), 'rouge au site', 'racine de production')
})

test('CLÔTURE : une acquisition calculée que la forme fermée lit vers une zone qui survit passe : littéral (F6), registre gelé, descente', () => {
  const VERTS = {
    'F6 littéral lié': "const m = '../src/noyau/z.ts';\nexport const x = () => import(m);\n",
    'F6 littéral lié près d’un motif à trous': "const [, , a] = process.argv;\nconst m = '../src/noyau/z.ts';\nexport const x = () => import(m);\n",
    'registre gelé': "import path from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nconst G = Object.freeze([{ s: 'src/noyau/z.ts' }].map(Object.freeze));\nconst R = fileURLToPath(new URL('../', import.meta.url));\nexport const x = (g) => { const c = G.find((y) => y.s === g); return import(pathToFileURL(path.join(R, c.s)).href); };\n",
    'descente de `src/noyau/`': `${LISTER}import { join } from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nconst D = fileURLToPath(new URL('../src/noyau/', import.meta.url));\nexport const x = () => listerEntrees(D).entrees.filter((f) => f).map((f) => import(pathToFileURL(join(D, f.nom)).href));\n`,
  }
  const formes = Object.keys(VERTS)
  assert.deepEqual(tableTotale(formes, (forme) => forger({ ...SOCLE_CALCULE, 'scripts/pont.mjs': VERTS[forme] })), tableTotale(formes, () => []))
})

test('CLÔTURE : les sources ignorées atteintes sur disque entrent par un glob, une descente ou un chemin calculé exact', () => {
  const cible = 'scripts/transit/dep.generated.ts'
  const inerte = 'scripts/transit/valeur.generated.json'
  const dormant = 'src/noyau/dormant.generated.ts'
  const commun = {
    '.gitignore': '*.generated.ts\n*.generated.mts\n*.generated.json\n',
    'src/noyau/a.test.ts': SOCLE_CALCULE['src/noyau/a.test.ts'],
    'scripts/guards/lib/lister.mjs': SOCLE_CALCULE['scripts/guards/lib/lister.mjs'],
    'scripts/cible.generated.mts': "export const nom = './transit/dep.generated.ts';\n",
    [inerte]: '{}\n',
    [dormant]: "export * from 'three';\n",
  }
  const formes = {
    glob: "export const x = import.meta.glob('./transit/*.{ts,json}', { eager: true });\n",
    descente: DESCENTE_TRANSIT,
    'chemin exact': "import { nom } from './cible.generated.mts';\nexport const x = () => import(nom);\n",
  }
  const mesurer = (pont, code) => dansArbreForge({
    ...commun,
    'scripts/pont.mjs': pont,
    [cible]: code,
  }, (racine) => transitsDuTravail(forgerDepot(racine)))

  for (const [forme, pont] of Object.entries(formes)) {
    const rouge = mesurer(pont, "export * from 'three';\n")
    assert.deepEqual(rouge.transits, ["noyau : paquet three ← " + cible], forme)
    const vert = mesurer(pont, 'export const x = 1;\n')
    assert.deepEqual(vert.transits, [], forme)
    assert.ok(vert.cloture.has(cible), forme)
    assert.ok(!vert.cloture.has(dormant), forme)
    if (forme === 'glob') assert.ok(vert.cloture.has(inerte), forme)
  }
})
