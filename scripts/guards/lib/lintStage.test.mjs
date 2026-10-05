// Contrat de la porte de lint du pre-commit (#2327 A5) : le texte jugé est celui de l'INDEX, par le VRAI
// eslint et la VRAIE `eslint.config.js` du dépôt (jamais un rapport forgé). L'index vient d'un dépôt
// FORGÉ (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en finally) : son disque et son index divergent à
// volonté ; l'outil et la config sont ceux de CET arbre, qui n'est jamais écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFIG_ESLINT, defautsDeRapport, lintDeLIndex } from './lintStage.mjs'
import { depotReel, envDeDepotForge, instanceDeDepot } from './depotGabarit.mjs'
import { lancerGit } from '../../test/gitDeBanc.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url)).replace(/[\\/]$/, '')
const NBSP = String.fromCharCode(0x00a0)
const PROPRE = 'export const a = 1\n'
/** Espace insécable dans le code : `no-irregular-whitespace` (eslint:recommended) le refuse. */
const CASSE = `export const a =${NBSP}1\n`
const FIXTURE = 'src/lint-index-fixture.ts'
/** La config de CET arbre, telle que son disque la porte. */
const CONFIG = readFileSync(join(RACINE, CONFIG_ESLINT), 'utf8')

/** Dépôt forgé : `index` (chemin → texte) posé dans l'INDEX seul — la config de CET arbre y est posée
 *  aussi, sauf `config: false` —, `disque` (chemin → texte) sur le disque seul. */
function forge({ index = {}, disque = {}, config = true }) {
  const env = envDeDepotForge()
  const { racine } = instanceDeDepot({ message: 'socle' })
  for (const [rel, texte] of Object.entries(config ? { [CONFIG_ESLINT]: CONFIG, ...index } : index)) {
    const blob = lancerGit(['hash-object', '-w', '--stdin'], { cwd: racine, env, input: texte, net: true })
    lancerGit(['update-index', '--add', '--cacheinfo', `100644,${blob},${rel}`], { cwd: racine, env })
  }
  for (const [rel, texte] of Object.entries(disque)) {
    mkdirSync(dirname(join(racine, rel)), { recursive: true })
    writeFileSync(join(racine, rel), texte)
  }
  return { racine, depot: depotReel(racine) }
}

/** `lintDeLIndex` de CET arbre sur l'index du dépôt forgé, qui est jeté après. */
async function lintForge(params, chemins) {
  const { racine, depot } = forge(params)
  try {
    return await lintDeLIndex(RACINE, depot, chemins)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

test('INDEX : stagé PROPRE, disque CASSÉ — aucun défaut', async () => {
  const vu = await lintForge({ index: { [FIXTURE]: PROPRE }, disque: { [FIXTURE]: CASSE } }, [FIXTURE])
  assert.deepEqual(vu, { defauts: [], saut: null })
})

test('INDEX : stagé CASSÉ, disque PROPRE — le défaut, au site du chemin stagé', async () => {
  const vu = await lintForge({ index: { [FIXTURE]: CASSE }, disque: { [FIXTURE]: PROPRE } }, [FIXTURE])
  assert.equal(vu.saut, null)
  assert.deepEqual(vu.defauts.map((d) => `${d.site} ${d.regle}`), [`${FIXTURE}:1:17 no-irregular-whitespace`])
})

test('un fichier que la config IGNORE (`*.config.*`) ne rend rien, même cassé', async () => {
  const ignore = 'lint-index-fixture.config.ts'
  assert.deepEqual(await lintForge({ index: { [ignore]: CASSE } }, [ignore]), { defauts: [], saut: null })
})

test('`eslint.config.js` STAGÉ qui diffère du disque : SAUT nommé, aucun verdict ; identique, le lot est jugé', async () => {
  const differe = await lintForge({ index: { [FIXTURE]: CASSE, [CONFIG_ESLINT]: `${CONFIG}\n` } }, [FIXTURE, CONFIG_ESLINT])
  assert.deepEqual(differe.defauts, [])
  assert.match(differe.saut ?? '', /eslint\.config\.js de l'index diffère du disque/)
  const identique = await lintForge({ index: { [FIXTURE]: CASSE } }, [FIXTURE, CONFIG_ESLINT])
  assert.equal(identique.saut, null)
  assert.deepEqual(identique.defauts.map((d) => d.regle), ['no-irregular-whitespace'])
})

test('`eslint.config.js` NON stagé dont le disque diffère de l’index : SAUT nommé, aucun verdict', async () => {
  const vu = await lintForge({ index: { [FIXTURE]: CASSE, [CONFIG_ESLINT]: `${CONFIG}\n` } }, [FIXTURE])
  assert.deepEqual(vu.defauts, [])
  assert.match(vu.saut ?? '', /eslint\.config\.js de l'index diffère du disque/)
})

test('aucun chemin à extension jugée : rien n’est lu ni lancé', async () => {
  assert.deepEqual(await lintDeLIndex(RACINE, null, ['docs/architecture.md', 'src/data/etats.json']), { defauts: [], saut: null })
})

test('FAIL-CLOSED — eslint ABSENT de l’arbre : défaut d’outillage NOMMÉ, jamais un lot vide', async () => {
  const { racine, depot } = forge({ index: { 'a.ts': PROPRE }, config: false })
  try {
    const { defauts } = await lintDeLIndex(racine, depot, ['a.ts'])
    assert.equal(defauts.length, 1)
    assert.equal(defauts[0].site, '(lint)')
    assert.match(defauts[0].message, /eslint n'est pas installé dans cet arbre/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('FAIL-CLOSED — un chemin que l’index ne rend pas (tabulation) : défaut d’outillage NOMMÉ', async () => {
  const { defauts } = await lintForge({}, ['src/x\t.ts'])
  assert.equal(defauts.length, 1)
  assert.equal(defauts[0].site, '(lint)')
  assert.match(defauts[0].message, /^index illisible — /)
})

test('rapport : chaque message devient un site `fichier:ligne:colonne` relatif à la racine', () => {
  const rapports = [
    { filePath: join(RACINE, 'src', 'ui', 'A.tsx'), messages: [{ line: 12, column: 3, severity: 2, ruleId: 'no-unused-vars', message: "'x' is defined but never used." }] },
    { filePath: join(RACINE, 'src', 'ui', 'B.tsx'), messages: [{ line: 1, column: 1, severity: 1, ruleId: null, message: 'Parsing error' }] },
    { filePath: join(RACINE, 'src', 'ui', 'C.tsx'), messages: [] },
  ]
  assert.deepEqual(defautsDeRapport(rapports, RACINE), [
    { site: 'src/ui/A.tsx:12:3', gravite: 'erreur', regle: 'no-unused-vars', message: "'x' is defined but never used." },
    { site: 'src/ui/B.tsx:1:1', gravite: 'avertissement', regle: '(parse)', message: 'Parsing error' },
  ])
})
