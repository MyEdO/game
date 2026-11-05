// MUR DE CLÔTURE DES ZONES QUI SURVIVENT (#3058, #3337) : la clôture d'imports (`clotureDImports`, arcs de valeur et de
// type, `import()`, `require` et ses liaisons `createRequire(…)`, chargeurs de Vitest, motifs d'`import.meta.glob`,
// spécificateurs relatifs, alias et `/…`) de chaque module, production, suites et bancs, d'une zone qui survit
// (`survit`, `couches.mjs`) ne compte aucun module d'une zone qui n'y survit pas (`fermeParLaSurvie`), par un module
// hors des zones compris : celui qu'ouvre `murs/tests-survivants` à un instrument, ou l'`outillage` déclaré
// (`horsZoneOuvert`) à la production, qui ouvre un module hors des zones, jamais une zone qui ne survit pas ; et aucun
// de ses membres ne charge un paquet de l'hôte web que la zone ferme (`paquetFerme`). Mesuré sur l'arbre de travail,
// rouge sur des transits forgés.
// Hors de la lecture : l'acquisition calculée d'un membre hors des zones (aujourd'hui `scripts/docs/build-all.mjs:216`
// et `scripts/guards/lib/structuresLocales.mts:249`), reste de #3058 ; le chargement par un appel qui n'est pas une
// forme d'import (`tsImport`, `new Worker(new URL(…))`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUCHES, PAQUETS_DE_L_HOTE_WEB, estZone, fermeParLaSurvie, paquetFerme, zoneDe } from '../../guards/lib/couches.mjs'
import { paquetDe } from '../../guards/lib/couchesLint.mjs'
import { cibleLexicale } from '../../guards/lib/interneLint.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { TRAVAIL, depotDe, listerImage } from '../../guards/lib/gitPorte.mjs'
import { arbreDuDisque, clotureDImports, estModule, grapheInverse } from '../../guards/lib/importGraph.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/**
 * Les TRANSITS des zones qui survivent dans `fichiers` (chemins relatifs à `racine`, l'ensemble que la marche lit) : par
 * zone qui survit, la clôture de ses modules, chaque membre dont la zone n'y survit pas, avec ses importeurs de la
 * clôture, chaque paquet de l'hôte web qu'un membre charge et que la zone ferme au module (`paquetFerme`, sous
 * l'outillage du module, `surSites`).
 * @param {string} racine @param {readonly string[]} fichiers
 * @returns {{ cloture: Set<string>, transits: string[] }}
 */
function transitsDesZonesQuiSurvivent(racine, fichiers) {
  const modules = fichiers.filter((rel) => estModule(rel) && estZone(zoneDe(rel)) && COUCHES[zoneDe(rel)].survit === true)
  // Par zone, et par paquets que l'outillage du module lui ouvre (`paquetsDOutillage`).
  const ouverts = (rel) => PAQUETS_DE_L_HOTE_WEB.filter((p) => !paquetFerme(zoneDe(rel), p, rel)).join(',')
  const parGroupe = Map.groupBy(modules, (rel) => `${zoneDe(rel)}|${ouverts(rel)}`)
  const arbre = arbreDuDisque(fichiers.map((rel) => join(racine, rel).split('\\').join('/')))
  const cache = new Map()
  const cloture = new Set()
  const transits = []
  const paquets = new Map()
  const surSites = (abs, sites) => {
    const rel = relative(racine, abs).split('\\').join('/')
    for (const { acquisition, spec } of sites)
      if (acquisition && spec !== null && cibleLexicale(abs, spec, racine) === null && paquetDe(spec) !== null) paquets.set(rel, [...(paquets.get(rel) ?? []), paquetDe(spec)])
  }
  for (const racines of parGroupe.values()) {
    const de = zoneDe(racines[0])
    const membres = clotureDImports(racines, { racine, cache, arbre, surSites })
    for (const rel of membres) cloture.add(rel)
    const inverse = grapheInverse(cache)
    for (const rel of [...membres].filter((m) => fermeParLaSurvie(de, zoneDe(m))).sort()) {
      const importeurs = (inverse.get(join(racine, rel).split('\\').join('/')) ?? [])
        .map((a) => relative(racine, a.importeur).split('\\').join('/')).filter((i) => membres.has(i))
      transits.push(`${de} : ${rel} ← ${[...new Set(importeurs)].sort().join(', ')}`)
    }
    for (const rel of [...membres].sort())
      for (const paquet of new Set(paquets.get(rel))) if (paquetFerme(de, paquet, racines[0])) transits.push(`${de} : paquet ${paquet} ← ${rel}`)
  }
  return { cloture, transits }
}

test('CLÔTURE : aucun module d’une zone qui survit, production comprise, n’atteint, de proche en proche, une zone qui n’y survit pas', () => {
  const { cloture, transits } = transitsDesZonesQuiSurvivent(RACINE, listerImage(depotDe(RACINE), TRAVAIL))
  assert.deepEqual(transits, [], 'transit vers une zone qui ne survit pas (`fermeParLaSurvie`) : chaque ligne nomme la zone du module racine, le module atteint et ses importeurs')
  // Témoin de MESURE : la marche traverse un module hors des zones, ce que `murs/tests-survivants` et `murs/purete-imports` ne suivent pas.
  assert.ok([...cloture].some((rel) => zoneDe(rel) === null), 'la clôture ne traverse aucun module hors des zones : le mur ne mesure plus le transit')
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
