// MUR DE CLÔTURE DES INSTRUMENTS QUI SURVIVENT (#3058) : la clôture d'imports (`clotureDImports`, arcs de valeur et de
// type, `import()` compris) des suites et bancs (`estFichierVitest`) de chaque zone qui survit (`survit`, `couches.mjs`)
// ne compte aucun module d'une zone que la table leur ferme (`fermeAuxInstruments`), par un module hors des zones
// compris, que `murs/tests-survivants` (`couchesLint.mjs`) ouvre. Mesuré sur l'arbre de travail, rouge sur un transit forgé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUCHES, RACINES_DES_ZONES, estZone, fermeAuxInstruments, zoneDe } from '../../guards/lib/couches.mjs'
import { estFichierVitest } from '../../guards/lib/fichierVitest.mjs'
import { TRAVAIL, depotDe, listerImage } from '../../guards/lib/gitPorte.mjs'
import { clotureDImports, grapheInverse } from '../../guards/lib/importGraph.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/**
 * Les TRANSITS des instruments de `fichiers` (chemins relatifs à `racine`) : par zone qui survit, la clôture de ses
 * instruments, et chaque membre dont la zone leur est fermée, avec ses importeurs de la clôture.
 * @param {string} racine @param {readonly string[]} fichiers
 * @returns {{ cloture: Set<string>, transits: string[] }}
 */
function transitsDesInstruments(racine, fichiers) {
  const parZone = Map.groupBy(fichiers.filter((rel) => estFichierVitest(rel) && estZone(zoneDe(rel)) && COUCHES[zoneDe(rel)].survit === true), zoneDe)
  const cache = new Map()
  const cloture = new Set()
  const transits = []
  for (const [de, racines] of parZone) {
    const membres = clotureDImports(racines, { racine, cache })
    for (const rel of membres) cloture.add(rel)
    const inverse = grapheInverse(cache)
    for (const rel of [...membres].filter((m) => fermeAuxInstruments(de, zoneDe(m))).sort()) {
      const importeurs = (inverse.get(join(racine, rel).split('\\').join('/')) ?? [])
        .map((a) => relative(racine, a.importeur).split('\\').join('/')).filter((i) => membres.has(i))
      transits.push(`${de} : ${rel} ← ${[...new Set(importeurs)].sort().join(', ')}`)
    }
  }
  return { cloture, transits }
}

test('CLÔTURE : aucun instrument d’une zone qui survit n’atteint, de proche en proche, une zone qui n’y survit pas', () => {
  const { cloture, transits } = transitsDesInstruments(RACINE, listerImage(depotDe(RACINE), TRAVAIL, ...RACINES_DES_ZONES))
  assert.deepEqual(transits, [], 'transit vers une zone fermée aux instruments (`fermeAuxInstruments`) : chaque ligne nomme la zone de l’instrument, le module atteint et ses importeurs')
  // Témoin de MESURE : la marche traverse un module hors des zones, ce que `murs/tests-survivants` ne suit pas.
  assert.ok([...cloture].some((rel) => zoneDe(rel) === null), 'la clôture ne traverse aucun module hors des zones : le mur ne mesure plus le transit')
})

test('CLÔTURE : un transit forgé par un module hors des zones, en valeur comme en type, est rouge ; un transit vers une zone qui survit passe', () => {
  const racine = mkdtempSync(join(tmpdir(), 'cloture-instruments-'))
  try {
    const fichiers = {
      'src/noyau/a.test.ts': "import { x } from '../../scripts/pont.mjs';\nexport const a = x;\n",
      'src/noyau/b.test.ts': "import { y } from '../../scripts/neutre.mjs';\nexport const b = y;\n",
      'hotes/c.bench.ts': "import type { T } from '../scripts/pont-type';\nexport type C = T;\n",
      'src/state/d.test.ts': "import { u } from '../ui/u';\nexport const d = u;\n",
      'scripts/pont.mjs': "export { useGame as x } from '../src/state/store.ts';\n",
      'scripts/pont-type.ts': "export type { U as T } from '../src/ui/u';\n",
      'scripts/neutre.mjs': "export { z as y } from '../src/noyau/z.ts';\n",
      'src/state/store.ts': 'export const useGame = 1;\n',
      'src/ui/u.ts': 'export const u = 1;\nexport type U = number;\n',
      'src/noyau/z.ts': 'export const z = 1;\n',
    }
    for (const [rel, code] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(racine, rel)), { recursive: true })
      writeFileSync(join(racine, rel), code)
    }
    assert.deepEqual(transitsDesInstruments(racine, Object.keys(fichiers)).transits, [
      'noyau : src/state/store.ts ← scripts/pont.mjs',
      'hotes : src/ui/u.ts ← scripts/pont-type.ts',
    ])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
