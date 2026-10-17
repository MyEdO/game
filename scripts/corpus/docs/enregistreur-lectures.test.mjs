// Contrat de la MESURE DES SOURCES (#1679 L1b) : ce qu'un générateur lit se MESURE, et part dans le
// dérivé local `docs/.sources-lues.json` (#2203).
//   node --test scripts/corpus/docs/enregistreur-lectures.test.mjs
//
// Chaque mesure de générateur ci-dessous est une MORSURE : elle rougit si l'une des trois mécaniques
// est débranchée — `module.syncBuiltinESMExports()` (les liaisons ESM figées rendent l'enveloppe de
// `fs` invisible), la propagation par `NODE_OPTIONS` (les dumpers lancés en sous-processus), et
// l'entrée `tsx/esm` (l'exécutable `tsx` re-spawne un processus qui perd le préchargeur).
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mesurerEnRendu } from '../../docs/build-all.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

const RACINE = path.resolve(ICI, '..', '..', '..')

const MESURES = mesurerEnRendu(['scripts/docs/build-index-moteur.mjs', 'scripts/docs/build-donnees.mjs', 'scripts/docs/build-structures.mts'], { cwd: RACINE })
/** Les lectures de `script` (un générateur de `GENERATORS`) par LA mesure rendue (`mesurerEnRendu`). */
const mesurer = (script) => MESURES.get(script).lues

test('témoin : build-index-moteur mesure plus de 100 sources (liaisons ESM synchronisées)', () => {
  const lues = mesurer('scripts/docs/build-index-moteur.mjs')
  assert.ok(lues.fichiers.length > 100, `sources mesurées : ${lues.fichiers.length}`)
  assert.ok(lues.fichiers.includes('src/engine/combat.ts'), 'src/engine/combat.ts absent du set')
  assert.ok(!lues.fichiers.includes('docs/index-moteur.md'), 'le doc CIBLE ne peut pas être sa propre source')
})

test('sous-processus : build-donnees mesure les schémas lus par son dumper tsx (NODE_OPTIONS)', () => {
  const lues = mesurer('scripts/docs/build-donnees.mjs')
  const schemas = lues.fichiers.filter((f) => f.startsWith('src/data/schemas/'))
  assert.ok(schemas.length > 100, `schémas mesurés : ${schemas.length} (le dumper est un sous-processus)`)
  assert.ok(lues.fichiers.includes('tsconfig.json'), 'tsconfig.json absent : le thread des hooks du dumper n\'est pas mesuré')
})

test('runner tsx : build-structures mesure src/data ET src/scenes (entrée tsx/esm)', () => {
  const lues = mesurer('scripts/docs/build-structures.mts')
  assert.ok(lues.fichiers.some((f) => f.startsWith('src/data/')), 'aucune source src/data')
  assert.ok(lues.fichiers.some((f) => f.startsWith('src/scenes/')), 'aucune source src/scenes')
})

// scripts/docs/lib/enregistreur-hooks.mjs (enveloppe de fs du thread des hooks)
test('thread des hooks : un générateur chargé par tsx mesure tsconfig.json (dérivé cross-OS)', () => {
  const lues = mesurer('scripts/docs/build-structures.mts')
  assert.ok(
    lues.fichiers.includes('tsconfig.json'),
    `tsconfig.json absent du set (${lues.fichiers.length} sources) : les lectures du thread des hooks ne sont pas enregistrées`,
  )
  assert.ok(lues.sondes.some((s) => s.chemin === 'tsconfig.json'), 'les sondes du thread tsx doivent voyager avec ses lectures')
  // Le hook `load` voit aussi des spécificateurs sans chemin sur le disque : un `node:child_process`
  // pris pour un chemin relatif fait échouer la lecture (ENOENT sur `<racine>/node:…`).
  assert.deepEqual(lues.fichiers.filter((f) => /^[a-z]+:/.test(f)), [], 'un spécificateur non-fichier est entré dans le set')
})
