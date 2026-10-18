import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { jetonsDuVerrou, prendreVerrouAsync } from './verrou.mjs'
import { entree, lancerGate, reporterParDefaut, reportersDuLancement } from './node-tests.mjs'

const durees = (args) => args.filter((a) => a.startsWith('--test-reporter')).slice(-2)

/** Un dossier jetable, effacé après `t`, et le verrou de fixture qu'il porte. */
function banc(t, prefixe) {
  const temporaire = mkdtempSync(join(tmpdir(), prefixe))
  t.after(() => rmSync(temporaire, { recursive: true, force: true }))
  return { temporaire, verrou: { chemin: join(temporaire, 'geste.verrou'), libelle: 'fixture' } }
}

/** Un `enfant` qui joue `node -e <script>` à la place de `node --test`, sorties captées ; `vu` reçoit son lancement. */
const enfantQuiJoue = (script, vu = () => {}) => (cmd, args, options) => {
  vu({ args, options })
  return spawn(cmd, ['-e', script], { ...options, stdio: 'pipe' })
}

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
 *  durées ; seule la sortie de l'enfant est captée (`stdio: 'pipe'`), hors du contexte du test runner parent. */
test('lancerGate : imprime `[durees] node <gate>` en chemins RELATIFS POSIX, n’écrit rien sous la racine et efface son dossier temporaire', async (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'node-tests-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const { temporaire, verrou } = banc(t, 'node-tests-temporaire-')
  mkdirSync(join(racine, 'scripts', 'a'), { recursive: true })
  writeFileSync(join(racine, 'scripts', 'a', 'un.test.mjs'), "import { test } from 'node:test'\ntest('un', () => {})\n")
  const avant = readdirSync(racine, { recursive: true }).sort()
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  let destinations = []
  let stdout = ''
  const enfant = (cmd, args, options) => {
    destinations = args.filter((a) => a.startsWith('--test-reporter-destination='))
    const p = spawn(cmd, args, { ...options, stdio: 'pipe' })
    p.stdout.on('data', (d) => { stdout += d })
    return p
  }
  const imprimes = []
  const code = await lancerGate({ gate: 'test:essai', tests: ['scripts/a/un.test.mjs'], racine, temporaire, tty: false, enfant, env, verrou, imprimer: (l) => imprimes.push(l) })
  assert.equal(code, 0)
  assert.match(stdout, reporterParDefaut(process.versions.node, false) === 'tap' ? /^TAP version 13/ : /✔ un/, 'la sortie par défaut de la version qui tourne, hors terminal')
  assert.equal(imprimes.length, 1)
  const [, gate, json] = /^\[durees\] node (\S+) (\{.*\})$/.exec(imprimes[0])
  assert.equal(gate, 'test:essai')
  assert.deepEqual(Object.keys(JSON.parse(json)), ['scripts/a/un.test.mjs'])
  assert.ok(Number.isInteger(JSON.parse(json)['scripts/a/un.test.mjs']))
  assert.deepEqual(readdirSync(racine, { recursive: true }).sort(), avant, 'rien d’écrit sous la racine')
  assert.equal(destinations[1].startsWith(`--test-reporter-destination=${join(temporaire, 'durees-node-')}`), true, 'le rapport sous le dossier temporaire')
  assert.deepEqual(readdirSync(temporaire), [], 'le dossier temporaire et le verrou sont rendus')
})

test('lancerGate : le verrou est tenu pendant l’enfant, son jeton passé à l’enfant, puis rendu à sa sortie', async (t) => {
  const { temporaire, verrou } = banc(t, 'node-tests-verrou-')
  let pendant
  const code = await lancerGate({ gate: 'fixture', tests: ['un.test.mjs'], racine: temporaire, temporaire, verrou, imprimer: () => {},
    enfant: enfantQuiJoue('', ({ options }) => {
      pendant = { verrou: existsSync(verrou.chemin), jetons: jetonsDuVerrou(options.env, verrou.chemin).length }
    }) })
  assert.equal(code, 0)
  assert.deepEqual(pendant, { verrou: true, jetons: 1 })
  assert.equal(existsSync(verrou.chemin), false, 'verrou rendu à la sortie de l’enfant')
})

test('lancerGate : le code de l’enfant est propagé ; un enfant tué par signal ou impossible à lancer vaut 1', async (t) => {
  const { temporaire, verrou } = banc(t, 'node-tests-code-')
  const imprimes = []
  const lancer = (enfant) => lancerGate({ gate: 'fixture', tests: ['un.test.mjs'], racine: temporaire, temporaire, verrou, imprimer: (l) => imprimes.push(l), enfant })
  assert.equal(await lancer(enfantQuiJoue('process.exit(3)')), 3)
  assert.equal(await lancer(enfantQuiJoue("process.kill(process.pid, 'SIGKILL')")), 1)
  assert.equal(await lancer((cmd, args, options) => spawn(join(temporaire, 'absent.exe'), [], options)), 1)
  assert.match(imprimes.at(-1), /^\[node-tests\] lancement de node --test impossible : /)
  assert.deepEqual(readdirSync(temporaire), [], 'dossier et verrou rendus après chaque lancement')
})

test('lancerGate : verrou tenu par un autre, le refus s’imprime, rien n’est lancé, `CODE_DIFFERE` rendu', async (t) => {
  const { temporaire, verrou } = banc(t, 'node-tests-refus-')
  const tenant = await prendreVerrouAsync({ ...verrou, env: {}, cwd: temporaire, commande: 'tenant' })
  assert.equal(tenant.etat, 'pris')
  t.after(() => tenant.liberer())
  const imprimes = []
  let lance = false
  const code = await lancerGate({ gate: 'fixture', tests: ['un.test.mjs'], racine: temporaire, temporaire, verrou, env: {}, imprimer: (l) => imprimes.push(l),
    enfant: () => { lance = true; throw new Error('jamais lancé') } })
  assert.equal(code, CODE_DIFFERE)
  assert.equal(lance, false)
  assert.equal(imprimes.length, 1)
  assert.equal(existsSync(verrou.chemin), true, 'le verrou du tenant est intact')
})

test('lancerGate : rapport des durées ABSENT, code rendu ; ILLISIBLE, il lève en nommant le rapport, sa cause portée', async (t) => {
  const { temporaire, verrou } = banc(t, 'node-tests-durees-')
  const lancer = (script) => lancerGate({ gate: 'fixture', tests: ['un.test.mjs'], racine: temporaire, temporaire, verrou, imprimer: () => {},
    enfant: (cmd, args, options) => {
      const sortie = args.filter((a) => a.startsWith('--test-reporter-destination=')).at(-1).slice('--test-reporter-destination='.length)
      return enfantQuiJoue(script(sortie))(cmd, args, options)
    } })
  assert.equal(await lancer(() => 'process.exit(3)'), 3)
  await assert.rejects(lancer((sortie) => `require('node:fs').writeFileSync(${JSON.stringify(sortie)}, '{"durees":')`),
    (e) => /rapport des durées .*durees\.json illisible/.test(e.message) && e.cause instanceof SyntaxError)
  assert.deepEqual(readdirSync(temporaire), [], 'dossier et verrou rendus après la levée')
})

test('entree : une erreur levée sort préfixée `[node-tests]`, sa cause imprimée, code 2 ; les drapeaux vont tels quels au lancement', async () => {
  const lignes = []
  const code = await entree(['test:runner'], {
    lister: () => ['scripts/test/un.test.mjs'], journal: (l) => lignes.push(l),
    lancer: async () => { throw new Error('rapport des durées /d/durees.json illisible', { cause: new SyntaxError('JSON tronqué') }) },
  })
  assert.equal(code, 2)
  assert.deepEqual(lignes, ['[node-tests] rapport des durées /d/durees.json illisible', '[node-tests] cause : JSON tronqué'])
  const lances = []
  assert.equal(await entree(['test:runner', '--x', '--test-concurrency=2'], { lister: () => ['scripts/test/un.test.mjs'], journal: () => {}, lancer: async (p) => { lances.push(p); return 0 } }), 0)
  assert.deepEqual(lances, [{ gate: 'test:runner', tests: ['scripts/test/un.test.mjs'], drapeaux: ['--x', '--test-concurrency=2'] }])
})
