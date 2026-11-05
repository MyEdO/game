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
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUCHES, PAQUETS_DE_L_HOTE_WEB, estZone, fermeParLaSurvie, paquetFerme, zoneDe } from '../../guards/lib/couches.mjs'
import { paquetDe } from '../../guards/lib/couchesLint.mjs'
import { cibleLexicale } from '../../guards/lib/interneLint.mjs'
import { analyserTexte } from '../../guards/lib/dialecte.mjs'
import { valeursDAcquisition } from '../../guards/lib/racinesBalayees.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { TRAVAIL, depotDe, listerImage } from '../../guards/lib/gitPorte.mjs'
import { CHEMIN_TSCONFIG, aliasDe, arbreDuDisque, clotureDImports, estModule, grapheInverse, resolveImport } from '../../guards/lib/importGraph.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/**
 * Les TRANSITS des zones qui survivent dans `fichiers` (chemins relatifs à `racine`, l'ensemble que la marche lit) : par
 * zone qui survit, la clôture de ses modules, acquisitions calculées suivies jusqu'au point fixe, chaque membre dont la
 * zone n'y survit pas, avec ses importeurs de la clôture, chaque paquet de l'hôte web qu'un membre charge et que la zone
 * ferme au module (`paquetFerme`, sous l'outillage du module, `surSites`), et chaque acquisition calculée d'un membre
 * que la forme fermée ne résout pas. Les acquisitions calculées se relèvent une fois par module (`surSites`, sous le
 * cache de marche partagé) et se jugent par groupe.
 * @param {string} racine @param {readonly string[]} fichiers
 * @returns {{ cloture: Set<string>, transits: string[], suivis: number }}
 */
function transitsDesZonesQuiSurvivent(racine, fichiers) {
  const modules = fichiers.filter((rel) => estModule(rel) && estZone(zoneDe(rel)) && COUCHES[zoneDe(rel)].survit === true)
  // Par zone, et par paquets que l'outillage du module lui ouvre (`paquetsDOutillage`).
  const ouverts = (rel) => PAQUETS_DE_L_HOTE_WEB.filter((p) => !paquetFerme(zoneDe(rel), p, rel)).join(',')
  const parGroupe = Map.groupBy(modules, (rel) => `${zoneDe(rel)}|${ouverts(rel)}`)
  const abs = (rel) => join(racine, rel).split('\\').join('/')
  const relDe = (a) => relative(racine, a).split('\\').join('/')
  const arbre = arbreDuDisque(fichiers.map(abs))
  const image = new Set(fichiers)
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
  }
  let suivis = 0
  for (const racines of parGroupe.values()) {
    const de = zoneDe(racines[0])
    /** Les sites calculés qui atteignent chaque cible, et les rouges du groupe. */
    const calculesVers = new Map()
    const rouges = []
    let membres = new Set()
    for (let racinesDuTour = racines; ;) {
      membres = clotureDImports(racinesDuTour, { racine, cache, arbre, surSites })
      calculesVers.clear()
      rouges.length = 0
      for (const rel of [...membres].sort())
        for (const { site, valeurs } of calcules.get(rel) ?? []) {
          if (valeurs === null) { rouges.push(`${de} : chargeur non suivi — ${site}`); continue }
          if (!valeurs.length) rouges.push(`${de} : acquisition calculée sans valeur — ${site}`)
          for (const v of valeurs) {
            if ('non' in v) { rouges.push(`${de} : acquisition calculée non résolue — ${site} : ${v.non}`); continue }
            const nu = 'specificateur' in v && !/^[./]/.test(v.specificateur) && cibleDe(rel, v.specificateur) === null
            if (nu) {
              const paquet = paquetDe(v.specificateur)
              if (paquet !== null && paquetFerme(de, paquet, racines[0])) rouges.push(`${de} : paquet ${paquet} ← ${site} (acquisition calculée)`)
              continue
            }
            const cibles = 'fichier' in v ? [v.fichier].filter((f) => image.has(f))
              : 'dossier' in v ? fichiers.filter((f) => estModule(f) && (v.dossier === '' || f.startsWith(`${v.dossier}/`)))
                : [cibleDe(rel, v.specificateur)].filter((c) => c !== null && image.has(c))
            if (!cibles.length) rouges.push(`${de} : acquisition calculée introuvable — ${site} : ${JSON.stringify(v)}`)
            for (const c of cibles) calculesVers.set(c, [...(calculesVers.get(c) ?? []), `${site} (acquisition calculée)`])
          }
        }
      const neufs = [...calculesVers.keys()].filter((c) => !membres.has(c))
      if (!neufs.length) break
      racinesDuTour = [...racinesDuTour, ...neufs]
    }
    suivis += calculesVers.size
    for (const rel of membres) cloture.add(rel)
    const inverse = grapheInverse(cache)
    for (const rel of [...membres].filter((m) => fermeParLaSurvie(de, zoneDe(m))).sort()) {
      const importeurs = (inverse.get(abs(rel)) ?? []).map((a) => relDe(a.importeur)).filter((i) => membres.has(i))
      transits.push(`${de} : ${rel} ← ${[...new Set([...importeurs, ...(calculesVers.get(rel) ?? [])])].sort().join(', ')}`)
    }
    for (const rel of [...membres].sort())
      for (const paquet of new Set(paquets.get(rel))) if (paquetFerme(de, paquet, racines[0])) transits.push(`${de} : paquet ${paquet} ← ${rel}`)
    transits.push(...rouges)
  }
  return { cloture, transits, suivis }
}

test('CLÔTURE : aucun module d’une zone qui survit, production comprise, n’atteint, de proche en proche, une zone qui n’y survit pas', () => {
  const { cloture, transits, suivis } = transitsDesZonesQuiSurvivent(RACINE, listerImage(depotDe(RACINE), TRAVAIL))
  assert.deepEqual(transits, [], 'transit vers une zone qui ne survit pas (`fermeParLaSurvie`), ou acquisition calculée non résolue : chaque ligne nomme la zone du module racine, le module atteint et ses importeurs, ou le site')
  // Témoins de MESURE : la marche traverse un module hors des zones, ce que `murs/tests-survivants` et `murs/purete-imports`
  // ne suivent pas, et suit au moins une acquisition calculée.
  assert.ok([...cloture].some((rel) => zoneDe(rel) === null), 'la clôture ne traverse aucun module hors des zones : le mur ne mesure plus le transit')
  assert.ok(suivis > 0, 'aucune acquisition calculée suivie : le mur ne mesure plus les acquisitions calculées')
})

/** Les transits d'un arbre forgé (chemin → texte), jeté après. */
function forger(fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'cloture-zones-survivantes-'))
  try {
    for (const [rel, code] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(racine, rel)), { recursive: true })
      writeFileSync(join(racine, rel), code)
    }
    return transitsDesZonesQuiSurvivent(racine, Object.keys(fichiers)).transits
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

/** Les ponts hors des zones vers `src/state/store.ts` (`scripts/pont.mts`, que l'instrument lit en `.mjs`), sous chaque
 *  forme d'arc que la marche lit. */
const PONTS = {
  relatif: "export { useGame as x } from '../src/state/store.ts';\n",
  'chemin `/…`': "export { useGame as x } from '/src/state/store.ts';\n",
  'alias `@/`': "export { useGame as x } from '@/state/store';\n",
  'gabarit sans expression': 'export const x = () => import(`../src/state/store.ts`);\n',
  'import.meta.glob': "export const x = import.meta.glob('../src/state/*.ts', { eager: true });\n",
  'vi.importActual': "import { vi } from 'vitest';\nexport const x = () => vi.importActual('../src/state/store.ts');\n",
  'vi.mock': "import { vi } from 'vitest';\nvi.mock('../src/state/store.ts');\nexport const x = 1;\n",
  'liaison `createRequire(…)`': "import { createRequire } from 'node:module';\nconst r = createRequire(import.meta.url);\nexport const x = r('../src/state/store.ts');\n",
  'type seul': "export type { U as x } from '../src/state/store.ts';\n",
  'tsImport': "import { tsImport } from 'tsx/esm/api';\nexport const x = () => tsImport('../src/state/store.ts', import.meta.url);\n",
}

test('CLÔTURE : un transit forgé par un module hors des zones est rouge sous chaque forme d’arc, et vers un paquet de l’hôte web ; un transit vers une zone qui survit passe', () => {
  const commun = {
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/noyau/a.test.ts': "import { x } from '../../scripts/pont.mjs';\nexport const a = x;\n",
    'src/state/store.ts': 'export const useGame = 1;\nexport type U = number;\n',
  }
  const formes = Object.keys(PONTS)
  assert.deepEqual(tableTotale(formes, (forme) => forger({ ...commun, 'scripts/pont.mts': PONTS[forme] })),
    tableTotale(formes, () => ['noyau : src/state/store.ts ← scripts/pont.mts']))
  const paquet = forger({ ...commun, 'scripts/pont.mts': "import type { FC } from 'react';\nexport type x = FC;\nexport { z } from 'zod';\n" })
  assert.deepEqual(paquet, ['noyau : paquet react ← scripts/pont.mts'], 'un paquet de l’hôte web atteint en transit, même pour un type ; un autre paquet passe')
  assert.deepEqual(forger({
    'hotes/c.bench.ts': "import { y } from '../scripts/neutre.mjs';\nexport const c = y;\n",
    'src/state/d.test.ts': "import { u } from '../ui/u';\nexport const d = u;\n",
    'scripts/neutre.mjs': "export { z as y } from '../src/noyau/z.ts';\n",
    'src/noyau/z.ts': 'export const z = 1;\n',
    'src/ui/u.ts': 'export const u = 1;\n',
  }), [])
})

test('CLÔTURE : un module de PRODUCTION d’une zone qui survit qui atteint une zone qui n’y survit pas par un pont hors des zones est rouge ; le même pont vers une zone qui survit passe', () => {
  const hote = { 'hotes/x.mjs': "import { y } from '../scripts/pont.mjs';\nexport const x = y;\n" }
  assert.deepEqual(forger({ ...hote,
    'scripts/pont.mjs': "export { e as y } from '../src/state/e.ts';\n",
    'src/state/e.ts': 'export const e = 1;\n',
  }), ['hotes : src/state/e.ts ← scripts/pont.mjs'])
  assert.deepEqual(forger({ ...hote,
    'scripts/pont.mjs': "export { e as y } from '../src/lib/e.ts';\n",
    'src/lib/e.ts': 'export const e = 1;\n',
  }), [])
})

/** Le socle des arbres forgés d'acquisition calculée : une suite du noyau qui importe `scripts/pont.mjs`, le store, un
 *  module du noyau, et les modules du dépôt que la forme fermée lit par leur chemin (`gelerLaConstante`, `listerEntrees`). */
const SOCLE_CALCULE = {
  'src/noyau/a.test.ts': "import { x } from '../../scripts/pont.mjs';\nexport const a = x;\n",
  'src/state/store.ts': 'export const useGame = 1;\n',
  'src/noyau/z.ts': 'export const z = 1;\n',
  'src/lib/gelerProfond.ts': 'export const gelerLaConstante = (x) => x;\n',
  'scripts/guards/lib/lister.mjs': 'export const listerEntrees = () => ({ entrees: [] });\n',
  'scripts/reg.mjs': "export const REG = ['../src/noyau/z.ts'];\nexport const CFG = { p: '../src/noyau/z.ts' };\n",
  'scripts/reg2.mjs': "export const P = '../src/noyau/z.ts'.replace('noyau', 'state');\n",
  'scripts/mut.mjs': "import { REG, CFG } from './reg.mjs';\nREG.push('../src/state/store.ts');\nCFG.p = '../src/state/store.ts';\n",
}

const LISTER = "import { listerEntrees } from './guards/lib/lister.mjs';\n"

/** Les acquisitions calculées qui chargent `src/state/store.ts` à l'exécution ou que la forme fermée ne lit pas, chacune
 *  avec le site que sa ligne rouge doit nommer (`<module>:<ligne>`) et les modules qu'elle ajoute au socle. */
const ROUGES_CALCULES = {
  'replace': ["export const x = () => import('../src/noyau/z.ts'.replace('noyau', 'state'));\n", 'scripts/pont.mjs:1'],
  'replaceAll': ["export const x = () => import('../src/noyau/z.ts'.replaceAll('noyau', 'state'));\n", 'scripts/pont.mjs:1'],
  'split/join': ["export const x = () => import('../src/noyau/z.ts'.split('noyau').join('state'));\n", 'scripts/pont.mjs:1'],
  'slice': ["const s = '../src/noyau/z.ts#../src/state/store.ts';\nexport const x = () => import(s.slice(19));\n", 'scripts/pont.mjs:2'],
  '`join` homonyme local': ["const join = () => '../src/state/store.ts';\nexport const x = () => import(join('../src/noyau', 'z.ts'));\n", 'scripts/pont.mjs:2'],
  '`replace` dans un autre module': ["import { P } from './reg2.mjs';\nexport const x = () => import(P);\n", 'scripts/pont.mjs:2'],
  '`resolve` depuis le cwd': ["import { resolve } from 'node:path';\nexport const x = () => import(resolve('src/state/store.ts'));\n", 'scripts/pont.mjs:2'],
  '`pathToFileURL(texte)`': ["import { pathToFileURL } from 'node:url';\nexport const x = () => import(pathToFileURL('src/state/store.ts').href);\n", 'scripts/pont.mjs:2'],
  '`push` local': ["const L = ['../src/noyau/z.ts'];\nL.push('../src/state/store.ts');\nexport const x = () => Promise.all(L.map((m) => import(m)));\n", 'scripts/pont.mjs:3'],
  '`Object.assign`': ["const C = { p: '../src/noyau/z.ts' };\nObject.assign(C, { p: '../src/state/store.ts' });\nexport const x = () => import(C.p);\n", 'scripts/pont.mjs:3'],
  'registre muté ailleurs': ["import './mut.mjs';\nimport { REG } from './reg.mjs';\nexport const x = () => import(REG.find((m) => m));\n", 'scripts/pont.mjs:3'],
  'objet muté ailleurs': ["import './mut.mjs';\nimport { CFG } from './reg.mjs';\nexport const x = () => import(CFG.p);\n", 'scripts/pont.mjs:3'],
  '`createRequire` renommé': ["import { createRequire as cr } from 'node:module';\nconst r = cr(import.meta.url);\nexport const x = r('../src/state/store.ts');\n", 'scripts/pont.mjs:1'],
  'liaison `createRequire` recopiée': ["import { createRequire } from 'node:module';\nconst q = createRequire(import.meta.url);\nconst r = q;\nexport const x = r('../src/state/store.ts');\n", 'scripts/pont.mjs:3'],
  'espace de Vitest': ["import * as V from 'vitest';\nexport const x = () => V.vi.importActual('../src/state/store.ts');\n", 'scripts/pont.mjs:2'],
  '`vi` déstructuré': ["import { vi } from 'vitest';\nconst { importActual } = vi;\nexport const x = () => importActual('../src/state/store.ts');\n", 'scripts/pont.mjs:2'],
  'descente sous deux `dirname` et un suffixe': [`${LISTER}import { dirname, join } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst D = fileURLToPath(new URL('../src/noyau/', import.meta.url));\nexport const x = () => listerEntrees(D).entrees.map((f) => import(join(dirname(dirname(join(D, f.nom))), 'state/store.ts')));\n`, 'scripts/pont.mjs:5'],
  'descente sur un espace': [`${LISTER}import { join } from 'node:path';\nimport { tmpdir } from 'node:os';\nimport { pathToFileURL } from 'node:url';\nconst D = join(tmpdir(), 'x');\nexport const x = () => listerEntrees(D).entrees.map((f) => import(pathToFileURL(join(D, f.nom)).href));\n`, 'scripts/pont.mjs:6'],
  'F1 boucle sur un littéral': ["for (const m of ['../src/state/store.ts']) await import(m);\nexport const x = 1;\n", 'scripts/pont.mjs:1'],
  'F2 descente de `src/state/`': [`${LISTER}import { join } from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nconst D = fileURLToPath(new URL('../src/state/', import.meta.url));\nexport const x = () => listerEntrees(D).entrees.map((f) => import(pathToFileURL(join(D, f.nom)).href));\n`, 'scripts/pont.mjs:5'],
  'F3 segment inconnu': ["import { join } from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nconst D = fileURLToPath(new URL('../src/', import.meta.url));\nexport const x = () => import(pathToFileURL(join(D, process.env.X)).href);\n", 'scripts/pont.mjs:4'],
  'F4 relais': ['export const x = (p) => import(p);\n', 'scripts/pont.mjs:1'],
  'F5 paquet de l’hôte web': ["const nom = 'react';\nexport const x = () => import(nom);\n", 'scripts/pont.mjs:2'],
  'F7 second ordre': ["const b = './b.mjs';\nexport const x = () => import(b);\n", 'scripts/b.mjs:2', { 'scripts/b.mjs': "const s = '../src/state/store.ts';\nexport const y = () => import(s);\n" }],
  'F8 `require` lié et `vi.importActual` calculés dans un kit': ["import { k } from './kit.testkit.mjs';\nexport const x = k;\n", 'scripts/kit.testkit.mjs:5', { 'scripts/kit.testkit.mjs': "import { createRequire } from 'node:module';\nimport { vi } from 'vitest';\nconst r = createRequire(import.meta.url);\nconst s = '../src/state/store.ts';\nexport const k = () => [r(s), vi.importActual(s), vi.importActual(process.env.X)];\n" }],
  'valeur vide': ["import { gelerLaConstante } from '../src/lib/gelerProfond.ts';\nconst V = gelerLaConstante([]);\nexport const x = () => import(V.find((v) => v).s);\n", 'scripts/pont.mjs:3'],
}

/** La ligne rouge d'un arbre forgé qui nomme `site` sous la zone `zone`, sinon tous ses transits. */
const rougeAuSite = (transits, zone, site) => transits.find((t) => t.startsWith(`${zone} : `) && t.includes(`${site} «`)) ? 'rouge au site' : transits

test('CLÔTURE : une acquisition calculée d’un membre est rouge, au site, si elle atteint une zone qui ne survit pas, un paquet de l’hôte web, ou si la forme fermée ne la lit pas', () => {
  const formes = Object.keys(ROUGES_CALCULES)
  assert.deepEqual(tableTotale(formes, (forme) => {
    const [pont, site, autres = {}] = ROUGES_CALCULES[forme]
    return rougeAuSite(forger({ ...SOCLE_CALCULE, ...autres, 'scripts/pont.mjs': pont }), 'noyau', site)
  }), tableTotale(formes, () => 'rouge au site'))
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
    'registre gelé': "import { gelerLaConstante } from '../src/lib/gelerProfond.ts';\nimport path from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nconst G = gelerLaConstante([{ s: 'src/noyau/z.ts' }]);\nconst R = fileURLToPath(new URL('../', import.meta.url));\nexport const x = (g) => { const c = G.find((y) => y.s === g); return import(pathToFileURL(path.join(R, c.s)).href); };\n",
    'descente de `src/noyau/`': `${LISTER}import { join } from 'node:path';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nconst D = fileURLToPath(new URL('../src/noyau/', import.meta.url));\nexport const x = () => listerEntrees(D).entrees.filter((f) => f).map((f) => import(pathToFileURL(join(D, f.nom)).href));\n`,
  }
  const formes = Object.keys(VERTS)
  assert.deepEqual(tableTotale(formes, (forme) => forger({ ...SOCLE_CALCULE, 'scripts/pont.mjs': VERTS[forme] })), tableTotale(formes, () => []))
})
