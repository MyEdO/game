// `npm run test:lies` (#2327 A7) : vitest `related` sur les chemins que l'index apporte, mono-worker,
// par le vitest de l'arbre ; aucun lancement sans chemin lié. Le CLI se joue dans un dépôt FORGÉ
// (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en finally), sans `node_modules` : un lancement
// tenté s'y voit au refus d'outillage NOMMÉ.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { PLAFOND_SUR_ARGV } from '../guards/lib/porteSpawn.mjs'
import { lancerGit } from './gitDeBanc.mjs'
import { lancementsDesLies } from './lies.mjs'

const SCRIPT = fileURLToPath(new URL('./lies.mjs', import.meta.url))

test('lancements : `related`, les chemins à extension liée, `--run --maxWorkers=1`', () => {
  assert.deepEqual(lancementsDesLies(['src/a.ts', 'docs/architecture.md', 'src/data/b.json', 'scripts\\c.mjs']),
    [['related', 'src/a.ts', 'src/data/b.json', 'scripts/c.mjs', '--run', '--maxWorkers=1']])
})

test('lancements : aucun chemin à extension liée, aucun lancement', () => {
  assert.deepEqual(lancementsDesLies([]), [])
  assert.deepEqual(lancementsDesLies(['docs/architecture.md', '.claude/memory/a.md']), [])
})

test('lancements : un diff au-delà du plafond d’argv part en plusieurs lancements, aucun chemin perdu', () => {
  const src = 'src'
  const chemins = Array.from({ length: 600 }, (_, i) => `${src}/engine/module-au-nom-de-chapitre-tres-tres-long-${i}.ts`)
  const lancements = lancementsDesLies(chemins)
  assert.ok(lancements.length > 1)
  for (const l of lancements) assert.ok(l.join(' ').length <= PLAFOND_SUR_ARGV + 40)
  assert.deepEqual(lancements.flatMap((l) => l.slice(1, -2)), chemins)
})

/** Le CLI joué dans un dépôt forgé où `stages` (chemin → texte) sont posés dans l'index. */
function jouerDansUnDepot(stages) {
  const env = envDeDepotForge()
  const { racine } = instanceDeDepot({ message: 'socle' })
  try {
    for (const [nom, texte] of Object.entries(stages)) {
      const blob = lancerGit(['hash-object', '-w', '--stdin'], { cwd: racine, env, input: texte, net: true })
      lancerGit(['update-index', '--add', '--cacheinfo', `100644,${blob},${nom}`], { cwd: racine, env })
    }
    return spawnSync(process.execPath, [SCRIPT], { cwd: racine, env, encoding: 'utf8', timeout: 60_000 })
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

test('CLI : un chemin lié stagé, le vitest de l’ARBRE est demandé (absent du dépôt forgé : refus nommé, exit 2)', () => {
  const r = jouerDansUnDepot({ 'src/a.ts': 'export const a = 1\n' })
  assert.equal(r.status, 2, r.stdout + r.stderr)
  assert.match(r.stderr, /vitest n'est pas installé dans cet arbre/)
})

test('CLI : rien de lié stagé, aucun lancement, exit 0', () => {
  const r = jouerDansUnDepot({ 'docs/architecture.md': '# x\n' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /aucun lancement/)
  assert.equal(r.stderr.includes('[outillage]'), false, r.stderr)
})
