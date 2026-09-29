// Le pre-commit NOMME ce qu'il ne sait pas lire dans l'index (#1806) : jamais un scan sauté.
//   node --test scripts/git-hooks/pre-commit.test.mjs   (chaîné dans `npm run test:hooks`)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const HOOK = fileURLToPath(new URL('./pre-commit.mjs', import.meta.url))

/** Un dépôt forgé où le hook tourne (`agents:check` inerte), `nom` stagé dans son dossier
 *  avec `texte` ; `jouer(env)` lance le HOOK réel dans ce dépôt. */
function depotDuHook(nom, texte) {
  const env = envDeDepotForge()
  const { racine } = instanceDeDepot({
    fichiers: { 'package.json': JSON.stringify({ scripts: { 'agents:check': 'node -e 0' } }) },
    message: 'socle',
  })
  mkdirSync(dirname(join(racine, nom)), { recursive: true })
  writeFileSync(join(racine, nom), texte)
  assert.equal(spawnSync('git', ['add', '--', nom], { cwd: racine, env }).status, 0)
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
  const cale = mkdtempSync(join(tmpdir(), 'git-en-panne-'))
  try {
    const vrai = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim()
    writeFileSync(join(cale, 'git'), `#!/bin/sh\ncase " $* " in *" diff-index "*) case " $* " in *" -p "*) echo 'fatal: panne simulée' >&2; exit 128;; esac;; esac\nexec '${vrai}' "$@"\n`, { mode: 0o755 })
    const r = jouer({ ...env, PATH: `${cale}${delimiter}${env.PATH}` })
    assert.equal(r.status, 1, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith("diff de l'index illisible — ") && l.includes('panne simulée')), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(cale, { recursive: true, force: true })
  }
})
