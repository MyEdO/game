// Logique PURE du cliquet des exports morts (le passage par knip sur le dépôt est mesuré par
// `npm run deps:exports`) : aplatissement du rapport, comparaison, abaissement ; et la config knip des bancs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { correspondGlob, listerArbre } from '../guards/lib/lister.mjs'
import { join } from 'node:path'
import { flatten, compare, syncBaseline, REPO, HORS_GEL } from './knip-exports-ratchet.mjs'

const CONFIG = JSON.parse(readFileSync(join(REPO, 'knip.json'), 'utf8'))
const retenu = (file, motifs) => motifs.some((m) => !m.startsWith('!') && correspondGlob(file, m)) && !motifs.some((m) => m.startsWith('!') && correspondGlob(file, m.slice(1)))
test('bibliothèques de banc : toutes project/non-entry, CLI banc-pre-commit entry', () => {
  const bibliotheques = listerArbre(join(REPO, 'scripts/test/lib'), { filtre: (rel) => rel.endsWith('.mjs') })
  assert.ok(bibliotheques.length > 0)
  for (const rel of [...bibliotheques, 'bibliotheque-suivante.mjs']) {
    const file = `scripts/test/lib/${rel}`
    assert.equal(retenu(file, CONFIG.project), true, file)
    assert.equal(retenu(file, CONFIG.entry), false, file)
  }
  const cli = 'scripts/test/banc-pre-commit.mjs'
  assert.ok(existsSync(join(REPO, cli)), cli)
  assert.equal(retenu(cli, CONFIG.entry), true)
})
test('bibliothèque hors entry : export consommé vert, export mort rouge au cliquet deps:exports', () => {
  const racine = mkdtempSync(join(tmpdir(), 'knip-banc-'))
  try {
    mkdirSync(join(racine, 'scripts/test/lib'), { recursive: true })
    writeFileSync(join(racine, 'package.json'), JSON.stringify({ type: 'module' }))
    writeFileSync(join(racine, 'knip.json'), JSON.stringify({ entry: CONFIG.entry, project: CONFIG.project, ignoreExportsUsedInFile: true }))
    writeFileSync(join(racine, 'scripts/consommateur.mjs'), "import { vivant } from './test/lib/banc.mjs'; console.log(vivant)")
    const source = join(racine, 'scripts/test/lib/banc.mjs')
    const mesurer = () => {
      const vu = spawnSync(process.execPath, [join(REPO, 'node_modules/knip/bin/knip.js'), '--include', 'exports,types,nsExports,nsTypes', '--no-progress', '--reporter', 'json'], { cwd: racine, encoding: 'utf8', timeout: 15_000 })
      assert.ok(vu.stdout.includes('{'), vu.stderr)
      return compare(flatten(JSON.parse(vu.stdout.slice(vu.stdout.indexOf('{')).trim()).issues), {})
    }
    writeFileSync(source, 'export const vivant = 1')
    assert.deepEqual(mesurer().nouveaux, [])
    writeFileSync(source, 'export const vivant = 1; export const mort = 2')
    assert.deepEqual(mesurer().nouveaux, ['scripts/test/lib/banc.mjs : mort'])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

const issue = (file, exports = [], types = []) => ({
  file,
  exports: exports.map((name) => ({ name })),
  types: types.map((name) => ({ name })),
  nsExports: [],
  nsTypes: [],
})

test('flatten : exports et types fusionnés, triés, gameIso hors gel', () => {
  const per = flatten([
    issue('src/state/a.ts', ['b', 'a'], ['T']),
    issue('src/gameIso/rig/x.ts', ['mort']),
    issue('src/ui/vide.ts', []),
  ])
  assert.deepEqual(per, { 'src/state/a.ts': ['T', 'a', 'b'] })
})

test('compare : un export mort NOUVEAU est une régression', () => {
  const { nouveaux, assainis } = compare({ 'a.ts': ['x', 'y'] }, { 'a.ts': ['x'] })
  assert.deepEqual(nouveaux, ['a.ts : y'])
  assert.deepEqual(assainis, [])
})

test('compare : un fichier NEUF entièrement mort est une régression', () => {
  const { nouveaux } = compare({ 'neuf.ts': ['z'] }, {})
  assert.deepEqual(nouveaux, ['neuf.ts : z'])
})

test('compare : une entrée assainie rend la baseline périmée', () => {
  const { nouveaux, assainis } = compare({ 'a.ts': ['x'] }, { 'a.ts': ['x', 'y'], 'b.ts': ['w'] })
  assert.deepEqual(nouveaux, [])
  assert.deepEqual(assainis, ['a.ts : y', 'b.ts : w'])
})

test('compare : stock inchangé = vert', () => {
  const { nouveaux, assainis } = compare({ 'a.ts': ['x'] }, { 'a.ts': ['x'] })
  assert.deepEqual([...nouveaux, ...assainis], [])
})

test('syncBaseline ne sait que RETIRER — jamais ajouter un export mort neuf', () => {
  const next = syncBaseline({ 'a.ts': ['x'], 'neuf.ts': ['z'] }, { 'a.ts': ['x', 'y'], 'b.ts': ['w'] })
  assert.deepEqual(next, { 'a.ts': ['x'] })
})

// ── Contrat du filtre gameIso : il vit dans le CLIQUET (après mesure), JAMAIS dans la config knip.
//    L'y mettre couperait le graphe — un export consommé par le seul `src/gameIso` passerait pour
//    mort et se ferait geler comme dette. Deux tests verrouillent le contrat : la config ne coupe rien
//    (ci-dessous), et aucune entrée gelée n'est en réalité importée par gameIso
//    (`scripts/corpus/ops/knip-exports-ratchet.test.mjs`).
test('le filtre gameIso n’est PAS dans knip.json (sinon le graphe est coupé)', () => {
  const knip = JSON.parse(readFileSync(join(REPO, 'knip.json'), 'utf8'))
  const motifs = [...(knip.ignore ?? []), ...(knip.entry ?? []), ...(knip.project ?? [])]
  for (const m of motifs) assert.ok(!m.includes('gameIso'), `knip.json cite gameIso (${m}) : graphe coupé`)
  assert.deepEqual(HORS_GEL, ['src/gameIso/'], 'le hors-gel est le seul endroit où gameIso se filtre')
})
