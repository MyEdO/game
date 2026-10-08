// Banc du lanceur des gates node (#2497) : la ligne `[durees]` et le reporter de sortie gardé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lancerGate, reporterParDefaut, reportersDuLancement } from './node-tests.mjs'

const durees = (args) => args.filter((a) => a.startsWith('--test-reporter')).slice(-2)

test('reporterParDefaut : celui de la version de node qui tourne — node 22 : spec sous terminal, tap hors terminal ; dès node 23 : spec', () => {
  assert.deepEqual([reporterParDefaut('22.23.2', false), reporterParDefaut('22.23.2', true)], ['tap', 'spec'])
  assert.deepEqual([reporterParDefaut('23.0.0', false), reporterParDefaut('24.15.0', false), reporterParDefaut('26.1.0', true)], ['spec', 'spec', 'spec'])
})

test('reportersDuLancement : la sortie par défaut de `node --test` gardée, puis les durées', () => {
  const [tap, spec] = [false, true].map((tty) => reportersDuLancement([], { tty, sortie: '/t/d.json', versionNode: '22.23.2' }))
  assert.equal(reportersDuLancement([], { tty: false, sortie: 's' })[0], `--test-reporter=${reporterParDefaut(process.versions.node, false)}`, 'la version qui tourne par défaut')
  assert.deepEqual(tap.slice(0, 2), ['--test-reporter=tap', '--test-reporter-destination=stdout'])
  assert.deepEqual(spec.slice(0, 2), ['--test-reporter=spec', '--test-reporter-destination=stdout'])
  assert.match(durees(tap)[0], /^--test-reporter=file:.*\/scripts\/test\/dureesNodeTest\.mjs$/)
  assert.equal(durees(tap)[1], '--test-reporter-destination=/t/d.json')
})

test('reportersDuLancement : le `--test-reporter` de l’appelant n’est pas doublé ; seul et sans destination, il va à stdout', () => {
  assert.deepEqual(reportersDuLancement(['--test-reporter=dot'], { tty: false, sortie: 's' }).slice(0, 1), ['--test-reporter-destination=stdout'])
  assert.equal(reportersDuLancement(['--test-reporter', 'dot'], { tty: false, sortie: 's' }).length, 3)
  assert.equal(reportersDuLancement(['--test-reporter=dot', '--test-reporter-destination=f.txt'], { tty: false, sortie: 's' }).length, 2)
})

/** BOUT EN BOUT par la couture `lancerGate` sur un dépôt jetable : le vrai `node --test` et le vrai reporter des
 *  durées ; seule la sortie du processus est captée (`stdio: 'pipe'`), hors du contexte du test runner parent. */
test('lancerGate : imprime `[durees] node <gate>` en chemins RELATIFS POSIX, n’écrit rien sous la racine et efface son dossier temporaire', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'node-tests-'))
  const temporaire = mkdtempSync(join(tmpdir(), 'node-tests-temporaire-'))
  t.after(() => [racine, temporaire].forEach((d) => rmSync(d, { recursive: true, force: true })))
  mkdirSync(join(racine, 'scripts', 'a'), { recursive: true })
  writeFileSync(join(racine, 'scripts', 'a', 'un.test.mjs'), "import { test } from 'node:test'\ntest('un', () => {})\n")
  const avant = readdirSync(racine, { recursive: true }).sort()
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  let destinations = []
  let stdout = ''
  const spawn = (cmd, args, options) => {
    destinations = args.filter((a) => a.startsWith('--test-reporter-destination='))
    const r = spawnSync(cmd, args, { ...options, env, stdio: 'pipe', encoding: 'utf8' })
    stdout = r.stdout
    return r
  }
  const imprimes = []
  const code = lancerGate({ gate: 'test:essai', tests: ['scripts/a/un.test.mjs'], racine, temporaire, tty: false, spawn, imprimer: (l) => imprimes.push(l) })
  assert.equal(code, 0)
  assert.match(stdout, reporterParDefaut(process.versions.node, false) === 'tap' ? /^TAP version 13/ : /✔ un/, 'la sortie par défaut de la version qui tourne, hors terminal')
  assert.equal(imprimes.length, 1)
  const [, gate, json] = /^\[durees\] node (\S+) (\{.*\})$/.exec(imprimes[0])
  assert.equal(gate, 'test:essai')
  assert.deepEqual(Object.keys(JSON.parse(json)), ['scripts/a/un.test.mjs'])
  assert.ok(Number.isInteger(JSON.parse(json)['scripts/a/un.test.mjs']))
  assert.deepEqual(readdirSync(racine, { recursive: true }).sort(), avant, 'rien d’écrit sous la racine')
  assert.equal(destinations[1].startsWith(`--test-reporter-destination=${join(temporaire, 'durees-node-')}`), true, 'le rapport sous le dossier temporaire')
  assert.deepEqual(readdirSync(temporaire), [], 'le dossier temporaire est effacé')
})
