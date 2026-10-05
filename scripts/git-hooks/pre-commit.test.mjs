// Le pre-commit NOMME ce qu'il ne sait pas lire dans l'index (#1806) : jamais un scan sauté ; il
// n'arme `agents:check` que sur SES sources stagées et journalise son exécution (#2194).
//   node --test scripts/git-hooks/pre-commit.test.mjs   (chaîné dans `npm run test:hooks`)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { envDeDepotForge, envGitFeint, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { CHEMIN_DU_JOURNAL } from './journal.mjs'

const HOOK = fileURLToPath(new URL('./pre-commit.mjs', import.meta.url))
/** Le TÉMOIN que dépose l'`agents:check` du dépôt forgé quand le hook le lance. */
const TEMOIN_AGENTS_CHECK = 'agents-check-lance'

/** Un dépôt forgé où le hook tourne (`agents:check` = dépôt du témoin), `nom` stagé avec `texte` par
 *  l'INDEX seul (`update-index --cacheinfo`, sous `core.protectNTFS=false`, git help config) : un nom
 *  que NTFS refuse (tabulation) s'y stage aussi ; `jouer(env)` lance le HOOK réel dans ce dépôt. */
function depotDuHook(nom, texte) {
  const env = envDeDepotForge()
  const { racine } = instanceDeDepot({
    fichiers: { 'package.json': JSON.stringify({ scripts: { 'agents:check': `node -e "require('fs').writeFileSync('${TEMOIN_AGENTS_CHECK}', '')"` } }) },
    message: 'socle',
  })
  assert.equal(spawnSync('git', ['config', '--local', 'core.protectNTFS', 'false'], { cwd: racine, env }).status, 0)
  const blob = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: racine, env, input: texte, encoding: 'utf8' })
  assert.equal(blob.status, 0, blob.stderr)
  assert.equal(spawnSync('git', ['update-index', '--add', '--cacheinfo', `100644,${blob.stdout.trim()},${nom}`], { cwd: racine, env }).status, 0)
  const jouer = (envDuHook = env) => spawnSync(process.execPath, [HOOK], { cwd: racine, env: envDuHook, encoding: 'utf8', timeout: 120_000 })
  return { racine, env, jouer }
}

const lignes = (r) => r.stderr.split('\n').map((l) => l.trim())

test('un nom stagé que `lireEnLot` refuse (tabulation) est un fautif NOMMÉ, et le commit est refusé', () => {
  const nom = 'src/x\t.ts'
  const { racine, jouer } = depotDuHook(nom, 'export const x = 1\n')
  try {
    const r = jouer()
    assert.equal(r.status, 1, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith(`${nom} : illisible dans l'index — lireEnLot :`)), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une PANNE de git sur le diff de l’index est un fautif NOMMÉ, et le commit est refusé', () => {
  const { racine, env, jouer } = depotDuHook('notes.txt', 'n\n')
  try {
    const r = jouer({ ...env, ...envGitFeint([{ si: ['diff-index', '-p'], status: 128, stderr: 'fatal: panne simulée\n' }]) })
    assert.equal(r.status, 1, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith("diff de l'index illisible — ") && l.includes('panne simulée')), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('aucune source d’`agents:check` stagée : `agents:check` n’est pas lancé', () => {
  const { racine, jouer } = depotDuHook('notes.txt', 'n\n')
  try {
    const r = jouer()
    assert.equal(r.status, 0, r.stderr)
    assert.equal(existsSync(join(racine, TEMOIN_AGENTS_CHECK)), false, r.stdout + r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une source d’`agents:check` stagée (`.codex/hooks.json`) : `agents:check` est lancé', () => {
  const { racine, jouer } = depotDuHook('.codex/hooks.json', '{}\n')
  try {
    const r = jouer()
    assert.equal(r.status, 0, r.stderr)
    assert.equal(existsSync(join(racine, TEMOIN_AGENTS_CHECK)), true, r.stdout + r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('journal : une ligne par exécution, refus nommés compris', () => {
  const nom = 'src/x\t.ts'
  const { racine, jouer } = depotDuHook(nom, 'export const x = 1\n')
  try {
    assert.equal(jouer().status, 1)
    const lignes = readFileSync(join(racine, CHEMIN_DU_JOURNAL), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    assert.equal(lignes.length, 1)
    const [{ hook, code, verdict, refus }] = lignes
    assert.deepEqual({ hook, code, verdict }, { hook: 'pre-commit', code: 1, verdict: 'refusé' })
    assert.ok(refus.some((x) => x.startsWith(`${nom} : illisible dans l'index`)), refus.join('\n'))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
