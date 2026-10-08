import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { instanceDeDepot } from './depotGabarit.mjs'
import { envelopperSpawnSync } from './perimetreSansEcriture.mjs'
import { basenameExecutable, pipelinesDeJetons } from './commandeShell.mjs'

const PRELOAD = new URL('./perimetreSansEcriture.mjs', import.meta.url).href
const REPORTER = new URL('../../test/dureesNodeTest.mjs', import.meta.url).href
const PERIMETRE = new URL('../../test/perimetre.mjs', import.meta.url).href

test('test:perimetre précharge la garde avant le sélecteur réel', () => {
  const manifeste = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
  const segments = pipelinesDeJetons(manifeste.scripts['test:perimetre']).flat()
  assert.equal(segments.length, 1)
  const jetons = segments[0].jetons.map((jeton) => jeton.text)
  assert.equal(basenameExecutable(jetons[0]), 'node')
  const base = new URL('../../../', import.meta.url)
  const selecteur = jetons.findIndex((jeton) => new URL(jeton, base).href === PERIMETRE)
  assert.ok(selecteur > 0, 'la commande doit lancer le sélecteur du périmètre')
  const imports = jetons.slice(1, selecteur).flatMap((jeton, index, avant) =>
    jeton.startsWith('--import=') ? [jeton.slice('--import='.length)]
      : jeton === '--import' && avant[index + 1] ? [avant[index + 1]] : [])
  assert.ok(imports.some((chemin) => new URL(chemin, base).href === PRELOAD), 'la commande réelle doit précharger la garde avant le sélecteur')
})

function avecDepot(fn) {
  const { racine } = instanceDeDepot({ fichiers: {
    '.gitignore': 'rapports/\n',
    'propre.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; test('propre', () => { assert.equal(process.env.TEMOIN, 'preserve'); console.log('sortie-preservee') })\n",
    'pollueur.test.mjs': "import test from 'node:test'; import { writeFileSync } from 'node:fs'; test('pollution attrapée', () => { try { writeFileSync('interdit', 'x') } catch {} })\n",
    'rouge.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; test('rouge', () => assert.fail('échec prévu'))\n",
  } })
  try { return fn(racine) } finally { rmSync(racine, { recursive: true, force: true }) }
}

function parent(racine, args, suite = '') {
  const env = { ...process.env, TEMOIN: 'preserve' }
  delete env.NODE_TEST_CONTEXT
  const code = `
    import { spawnSync } from 'node:child_process';
    const r = spawnSync(process.execPath, ${JSON.stringify(args)}, { cwd: ${JSON.stringify(racine)}, env: process.env, encoding: 'utf8', maxBuffer: 10485760 });
    console.log(JSON.stringify({ status: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr }));
    ${suite}
  `
  return spawnSync(process.execPath, ['--import', PRELOAD, '--input-type=module', '--eval', code], {
    cwd: racine, env, encoding: 'utf8', maxBuffer: 10485760,
  })
}

test('le preload protège le spawnSync nommé sans intercepter les écritures du parent', () => avecDepot((racine) => {
  const destination = join(racine, 'cache-parent')
  const lancement = parent(racine, ['--test', 'propre.test.mjs'], `
    const { writeFileSync } = await import('node:fs'); writeFileSync(${JSON.stringify(destination)}, 'cache légitime');
  `)
  assert.equal(lancement.status, 0, lancement.stderr)
  const resultat = JSON.parse(lancement.stdout.trim())
  assert.equal(resultat.status, 0, lancement.stderr)
  assert.match(resultat.stdout, /sortie-preservee/)
  assert.equal(readFileSync(destination, 'utf8'), 'cache légitime')
}))

test('un vrai enfant node --test pollueur reste refusé quand son test attrape l’erreur', () => avecDepot((racine) => {
  const lancement = parent(racine, ['--test', 'pollueur.test.mjs'])
  assert.equal(lancement.status, 0, lancement.stderr)
  assert.equal(JSON.parse(lancement.stdout.trim()).status, 1)
  assert.match(lancement.stderr, /REFUS écriture.*writeFileSync interdit/)
  assert.equal(existsSync(join(racine, 'interdit')), false)
}))

test('deux reporters fichier et stdout sont relayés, puis apprendre lit le chemin prévu', () => avecDepot((racine) => {
  const un = join(racine, 'rapports', 'un.json')
  const deux = join(racine, 'rapports', 'deux.json')
  const lancement = parent(racine, [
    '--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
    `--test-reporter=${REPORTER}`, `--test-reporter-destination=${un}`,
    `--test-reporter=${REPORTER}`, '--test-reporter-destination', deux,
    'propre.test.mjs',
  ], `
    const { apprendre, mesuresDe } = await import(${JSON.stringify(PERIMETRE)});
    const mesures = mesuresDe(${JSON.stringify(join(racine, 'rapports', 'mesures'))});
    const { appris, workers } = apprendre(${JSON.stringify(racine)}, ${JSON.stringify(un)}, mesures, 'node', 1);
    console.log(JSON.stringify({ appris, workers, memo: mesures.lire('durees.json')['propre.test.mjs'] }));
  `)
  assert.equal(lancement.status, 0, lancement.stderr)
  const [resultat, mesure] = lancement.stdout.trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(resultat.status, 0, lancement.stderr)
  assert.match(resultat.stdout, /propre/)
  assert.equal(existsSync(un), false, 'apprendre consomme le rapport relocalisé')
  assert.equal(typeof JSON.parse(readFileSync(deux, 'utf8'))[join(racine, 'propre.test.mjs')], 'number')
  assert.equal(typeof mesure.appris['propre.test.mjs'], 'number')
  assert.equal(mesure.memo, mesure.appris['propre.test.mjs'])
  assert.equal(mesure.workers, 1)
}))

test('un enfant rouge restitue aussi ses durées et garde son verdict', () => avecDepot((racine) => {
  const destination = join(racine, 'rapports', 'rouge.json')
  const lancement = parent(racine, ['--test', `--test-reporter=${REPORTER}`, `--test-reporter-destination=${destination}`, 'rouge.test.mjs'])
  assert.equal(JSON.parse(lancement.stdout.trim()).status, 1)
  assert.equal(typeof JSON.parse(readFileSync(destination, 'utf8'))[join(racine, 'rouge.test.mjs')], 'number')
}))

test('une restitution impossible refuse un enfant vert et conserve un enfant déjà rouge', () => avecDepot((racine) => {
  const destination = join(racine, 'rapports', 'dossier')
  mkdirSync(destination, { recursive: true })
  const lancement = parent(racine, ['--test', `--test-reporter=${REPORTER}`, `--test-reporter-destination=${destination}`, 'propre.test.mjs'])
  assert.equal(JSON.parse(lancement.stdout.trim()).status, 1)
  assert.match(lancement.stderr, /restitution du reporter impossible/)
  const rouge = { status: 7, signal: null, stdout: Buffer.from('stdout'), stderr: Buffer.from('stderr') }
  let reporterTemporaire
  const original = (_commande, args) => {
    const temporaire = args.find((a) => a.startsWith('--test-reporter-destination=')).split('=').slice(1).join('=')
    reporterTemporaire = temporaire
    writeFileSync(temporaire, '{}')
    return rouge
  }
  const enveloppe = envelopperSpawnSync(original, { journal: () => {}, lancer: ({ args, spawn }) => spawn(process.execPath, args, { cwd: racine, env: {} }).status })
  assert.strictEqual(enveloppe(process.execPath, ['--test', `--test-reporter-destination=${destination}`], { cwd: racine }), rouge)
  assert.equal(rouge.status, 7)
  assert.equal(existsSync(reporterTemporaire), false)
}))

test('options, buffers, signal et appels hors node --test gardent leurs valeurs', () => {
  const resultat = { status: null, signal: 'SIGTERM', error: new Error('interrompu'), stdout: Buffer.from('sortie'), stderr: Buffer.from('erreur') }
  const env = { TEMOIN: 'original' }
  let vu
  const original = (...args) => { vu = args; return resultat }
  const enveloppe = envelopperSpawnSync(original, { lancer: ({ racine, args, spawn }) => {
    spawn(process.execPath, args, { cwd: racine, env: { ...env, GARDE: 'active' } })
    return 1
  } })
  assert.strictEqual(enveloppe(process.execPath, ['--test'], { env, stdio: 'pipe', input: 'entrée', encoding: 'buffer', timeout: 100, maxBuffer: 123 }), resultat)
  assert.equal(resultat.status, null)
  assert.equal(resultat.signal, 'SIGTERM')
  assert.equal(vu[2].input, 'entrée')
  assert.equal(vu[2].encoding, 'buffer')
  assert.equal(vu[2].timeout, 100)
  assert.equal(vu[2].maxBuffer, 123)
  assert.equal(vu[2].stdio, 'pipe')
  assert.deepEqual(vu[2].env, { ...env, GARDE: 'active' })
  assert.deepEqual(env, { TEMOIN: 'original' })
  const options = { env }
  assert.strictEqual(enveloppe(process.execPath, ['--eval', '0'], options), resultat)
  assert.strictEqual(vu[2], options)
})

test('cwd URL et exception originale de spawn sont conservés, les relais sont nettoyés', () => avecDepot((racine) => {
  const erreur = new TypeError('option invalide')
  let temporaire
  const original = (_commande, args, options) => {
    assert.equal(options.cwd, racine)
    temporaire = args.find((a) => a.startsWith('--test-reporter-destination=')).split('=').slice(1).join('=')
    throw erreur
  }
  const enveloppe = envelopperSpawnSync(original, { journal: () => {} })
  assert.throws(() => enveloppe(process.execPath, ['--test', '--test-reporter-destination=rapport.json'], { cwd: pathToFileURL(racine) }), (e) => e === erreur)
  assert.equal(existsSync(temporaire), false)
  assert.equal(existsSync(join(racine, 'rapport.json')), false)
}))
