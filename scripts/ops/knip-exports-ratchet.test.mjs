// Logique PURE du cliquet des exports morts (le passage par knip sur le dépôt est mesuré par
// `npm run deps:exports`) : aplatissement du rapport, comparaison, abaissement ; et la config knip des bancs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { correspondGlob, listerArbre } from '../guards/lib/lister.mjs'
import { join } from 'node:path'
import { mesurerExports, compare, syncBaseline, REPO } from './knip-exports-ratchet.mjs'

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
    const mesurer = () => compare(mesurerExports(racine).counts, {})
    writeFileSync(source, 'export const vivant = 1')
    assert.deepEqual(mesurer().nouveaux, [])
    writeFileSync(source, 'export const vivant = 1; export const mort = 2')
    assert.deepEqual(mesurer().nouveaux, ['scripts/test/lib/banc.mjs : mort'])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('le graphe signale la lecture qui fait d’un module une entrée et accepte la commande déclarée', () => {
  const racine = mkdtempSync(join(tmpdir(), 'knip-lecture-'))
  try {
    mkdirSync(join(racine, 'src'))
    mkdirSync(join(racine, 'node_modules'))
    writeFileSync(join(racine, 'package.json'), JSON.stringify({ type: 'module' }))
    writeFileSync(join(racine, 'knip.json'), JSON.stringify({ entry: [...CONFIG.entry, 'src/commande.ts'], project: CONFIG.project }))
    writeFileSync(join(racine, 'src/module.ts'), 'export const vivant = 1; export const mort = 2; export type TypeMort = string')
    writeFileSync(join(racine, 'src/commande.ts'), 'console.log("commande")')
    const lecteur = join(racine, 'src/lecture.test.ts')
    const lire = (adresse) => [
      "import { readFileSync } from 'node:fs'",
      "import { resolve } from 'node:path'",
      "import { spawnSync } from 'node:child_process'",
      "import { vivant } from './module.ts'",
      "spawnSync(process.execPath, [new URL('./commande.ts', import.meta.url).pathname])",
      `console.log(vivant, readFileSync(${adresse}, 'utf8'))`,
    ].join('\n')

    writeFileSync(lecteur, lire("resolve(import.meta.dirname, 'module.ts')"))
    assert.deepEqual(mesurerExports(racine), {
      counts: { 'src/module.ts': ['TypeMort', 'mort'] },
      entreesImplicites: [],
    })

    writeFileSync(lecteur, lire("new URL('./module.ts', import.meta.url)"))
    assert.deepEqual(mesurerExports(racine), {
      counts: {},
      entreesImplicites: ['src/lecture.test.ts → src/module.ts'],
    })
    assert.equal(existsSync(join(racine, 'node_modules', '.cache', 'jiti')), false)
  } finally { rmSync(racine, { recursive: true, force: true }) }
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

test('knip.json ne recadre pas le graphe sur les anciens dossiers d’interface', () => {
  const knip = JSON.parse(readFileSync(join(REPO, 'knip.json'), 'utf8'))
  const motifs = [...(knip.ignore ?? []), ...(knip.entry ?? []), ...(knip.project ?? [])]
  for (const m of motifs) assert.ok(!m.includes('gameIso'), `knip.json cite gameIso (${m})`)
})
