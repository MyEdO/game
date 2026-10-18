import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lancerProcessusSupervise } from '../guards/lib/superviserProcessus.mjs'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { entree, lancerGate, reporterParDefaut, reportersDuLancement } from './node-tests.mjs'

test('lancerGate : arrêt indéterminé conserve durées et verrou', async (t) => {
  const temporaire = mkdtempSync(join(tmpdir(), 'node-tests-retention-'))
  t.after(() => rmSync(temporaire, { recursive: true, force: true }))
  const verrou = { chemin: join(temporaire, 'geste.verrou'), libelle: 'fixture' }
  const code = await lancerGate({ gate: 'fixture', tests: ['un.test.mjs'], racine: temporaire, temporaire, verrou,
    imprimer: () => {}, executer: async () => ({ code: 1, arret: { etat: 'indetermine' } }) })
  assert.equal(code, 1)
  assert.equal(readdirSync(temporaire).some((n) => n.startsWith('durees-node-')), true)
  assert.equal(readdirSync(temporaire).includes('geste.verrou'), true)
})

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

test('lancerGate : imprime `[durees] node <gate>` en chemins RELATIFS POSIX, n’écrit rien sous la racine et efface son dossier temporaire', async (t) => {
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
  const superviser = async (cmd, args, options) => {
    destinations = args.filter((a) => a.startsWith('--test-reporter-destination='))
    const lancement = await lancerProcessusSupervise(cmd, args, { ...options, env: { ...env, ...options.env }, stdio: 'pipe' })
    lancement.hote.stdout.on('data', (d) => { stdout += d })
    return lancement
  }
  const imprimes = []
  const code = await lancerGate({ gate: 'test:essai', tests: ['scripts/a/un.test.mjs'], racine, temporaire, tty: false, superviser, env, verrou: { chemin: join(temporaire, 'geste.verrou'), libelle: 'fixture' }, mesures: { lire: () => ({}), ecrire() {} }, imprimer: (l) => imprimes.push(l) })
  assert.equal(code, 0)
  assert.match(stdout, reporterParDefaut(process.versions.node, false) === 'tap' ? /^TAP version 13/ : /✔ un/, 'la sortie par défaut de la version qui tourne, hors terminal')
  const lignesDurees = imprimes.filter((l) => l.startsWith('[durees]'))
  assert.equal(lignesDurees.length, 1)
  const [, gate, json] = /^\[durees\] node (\S+) (\{.*\})$/.exec(lignesDurees[0])
  assert.equal(gate, 'test:essai')
  assert.deepEqual(Object.keys(JSON.parse(json)), ['scripts/a/un.test.mjs'])
  assert.ok(Number.isInteger(JSON.parse(json)['scripts/a/un.test.mjs']))
  assert.deepEqual(readdirSync(racine, { recursive: true }).sort(), avant, 'rien d’écrit sous la racine')
  assert.equal(destinations[1].startsWith(`--test-reporter-destination=${join(temporaire, 'durees-node-')}`), true, 'le rapport sous le dossier temporaire')
  assert.deepEqual(readdirSync(temporaire), [], 'le dossier temporaire est effacé')
})

test('lancerGate : rapport des durées ABSENT, code rendu ; ILLISIBLE, il lève en nommant le rapport, sa cause portée', async (t) => {
  const temporaire = mkdtempSync(join(tmpdir(), 'node-tests-durees-'))
  t.after(() => rmSync(temporaire, { recursive: true, force: true }))
  const lancer = (ecrire) => lancerGate({ gate: 'fixture', tests: ['un.test.mjs'], racine: temporaire, temporaire, imprimer: () => {},
    verrou: { chemin: join(temporaire, 'geste.verrou'), libelle: 'fixture' },
    executer: async ({ argv }) => {
      const sortie = argv.filter((a) => a.startsWith('--test-reporter-destination=')).at(-1).slice('--test-reporter-destination='.length)
      ecrire(sortie)
      return { code: 3, arret: { etat: 'mort' } }
    } })
  assert.equal(await lancer(() => {}), 3)
  await assert.rejects(lancer((sortie) => writeFileSync(sortie, '{"durees":')), (e) => /rapport des durées .*durees\.json illisible/.test(e.message) && e.cause instanceof SyntaxError)
  assert.deepEqual(readdirSync(temporaire), [], 'dossier et verrou rendus après la levée')
})

test('entree : une erreur levée (mémo corrompu) sort préfixée `[node-tests]`, sa cause imprimée, code 2', async () => {
  const lignes = []
  const code = await entree(['test:runner'], {
    lister: () => ['scripts/test/un.test.mjs'], journal: (l) => lignes.push(l),
    lancer: async () => { throw new Error('mémo /m/profils.json illisible', { cause: new SyntaxError('JSON tronqué') }) },
  })
  assert.equal(code, 2)
  assert.deepEqual(lignes, ['[node-tests] mémo /m/profils.json illisible', '[node-tests] cause : JSON tronqué'])
  const lances = []
  assert.equal(await entree(['test:runner', '--x', '--reacquerir-memoire'], { lister: () => ['scripts/test/un.test.mjs'], journal: () => {}, lancer: async (p) => { lances.push(p); return 0 } }), 0)
  assert.deepEqual(lances, [{ gate: 'test:runner', tests: ['scripts/test/un.test.mjs'], drapeaux: ['--x'], forcer: true }])
})
