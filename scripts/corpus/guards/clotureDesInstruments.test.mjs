// MUR DE CLÔTURE DES INSTRUMENTS QUI SURVIVENT (#3058) : la clôture d'imports (`clotureDImports`, arcs de valeur et de
// type, `import()`, `require` et ses liaisons `createRequire(…)`, chargeurs de Vitest, motifs d'`import.meta.glob`,
// spécificateurs relatifs, alias et `/…`) des suites et bancs (`estFichierVitest`) de chaque zone qui survit (`survit`,
// `couches.mjs`) ne compte aucun module d'une zone que la table leur ferme (`fermeAuxInstruments`), par un module hors
// des zones compris, que `murs/tests-survivants` (`couchesLint.mjs`) ouvre ; et aucun de ses membres ne charge un paquet
// de l'hôte web que la zone ferme (`paquetFerme`). Mesuré sur l'arbre de travail, rouge sur des transits forgés.
// Hors de la lecture : l'acquisition calculée d'un membre hors des zones (aujourd'hui `scripts/docs/build-all.mjs:216`
// et `scripts/guards/lib/structuresLocales.mts:249`), reste de #3058 ; le chargement par un appel qui n'est pas une
// forme d'import (`tsImport`, `new Worker(new URL(…))`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUCHES, PAQUETS_DE_L_HOTE_WEB, estZone, fermeAuxInstruments, paquetFerme, zoneDe } from '../../guards/lib/couches.mjs'
import { paquetDe } from '../../guards/lib/couchesLint.mjs'
import { cibleLexicale } from '../../guards/lib/interneLint.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { estFichierVitest } from '../../guards/lib/fichierVitest.mjs'
import { TRAVAIL, depotDe, listerImage } from '../../guards/lib/gitPorte.mjs'
import { arbreDuDisque, clotureDImports, grapheInverse } from '../../guards/lib/importGraph.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/**
 * Les TRANSITS des instruments de `fichiers` (chemins relatifs à `racine`, l'ensemble que la marche lit) : par zone
 * qui survit, la clôture de ses instruments, chaque membre dont la zone leur est fermée, avec ses importeurs de la
 * clôture, chaque paquet de l'hôte web qu'un membre charge et que la zone ferme à l'instrument (`paquetFerme`, sous
 * l'outillage de l'instrument, `surSites`).
 * @param {string} racine @param {readonly string[]} fichiers
 * @returns {{ cloture: Set<string>, transits: string[] }}
 */
function transitsDesInstruments(racine, fichiers) {
  const instruments = fichiers.filter((rel) => estFichierVitest(rel) && estZone(zoneDe(rel)) && COUCHES[zoneDe(rel)].survit === true)
  // Par zone, et par paquets que l'outillage de l'instrument lui ouvre (`paquetsDOutillage`).
  const ouverts = (rel) => PAQUETS_DE_L_HOTE_WEB.filter((p) => !paquetFerme(zoneDe(rel), p, rel)).join(',')
  const parGroupe = Map.groupBy(instruments, (rel) => `${zoneDe(rel)}|${ouverts(rel)}`)
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
    for (const rel of [...membres].filter((m) => fermeAuxInstruments(de, zoneDe(m))).sort()) {
      const importeurs = (inverse.get(join(racine, rel).split('\\').join('/')) ?? [])
        .map((a) => relative(racine, a.importeur).split('\\').join('/')).filter((i) => membres.has(i))
      transits.push(`${de} : ${rel} ← ${[...new Set(importeurs)].sort().join(', ')}`)
    }
    for (const rel of [...membres].sort())
      for (const paquet of new Set(paquets.get(rel))) if (paquetFerme(de, paquet, racines[0])) transits.push(`${de} : paquet ${paquet} ← ${rel}`)
  }
  return { cloture, transits }
}

test('CLÔTURE : aucun instrument d’une zone qui survit n’atteint, de proche en proche, une zone qui n’y survit pas', () => {
  const { cloture, transits } = transitsDesInstruments(RACINE, listerImage(depotDe(RACINE), TRAVAIL))
  assert.deepEqual(transits, [], 'transit vers une zone fermée aux instruments (`fermeAuxInstruments`) : chaque ligne nomme la zone de l’instrument, le module atteint et ses importeurs')
  // Témoin de MESURE : la marche traverse un module hors des zones, ce que `murs/tests-survivants` ne suit pas.
  assert.ok([...cloture].some((rel) => zoneDe(rel) === null), 'la clôture ne traverse aucun module hors des zones : le mur ne mesure plus le transit')
})

/** Les transits d'un arbre forgé (chemin → texte), jeté après. */
function forger(fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'cloture-instruments-'))
  try {
    for (const [rel, code] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(racine, rel)), { recursive: true })
      writeFileSync(join(racine, rel), code)
    }
    return transitsDesInstruments(racine, Object.keys(fichiers)).transits
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
