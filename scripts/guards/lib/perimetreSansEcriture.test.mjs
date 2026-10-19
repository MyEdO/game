import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { instanceDeDepot } from './depotGabarit.mjs'
import { envelopperSpawnSync } from './perimetreSansEcriture.mjs'
import { environnementDuControle, lancementControle, lancementsControles } from './controleEcritures.mjs'
import { listerDossier } from './lister.mjs'
import { profilsDuLancement } from '../../test/memoire.mjs'
import { basenameExecutable, pipelinesDeJetons } from './commandeShell.mjs'

const PRELOAD = new URL('./perimetreSansEcriture.mjs', import.meta.url).href
const REPORTER = new URL('../../test/dureesNodeTest.mjs', import.meta.url).href
const PERIMETRE = new URL('../../test/perimetre.mjs', import.meta.url).href
/** La paire du contrôle sur tout lancement `node --test`, hors précharge (`lancementControle`, #2586). */
const LANCEMENTS_NODE_TEST = lancementsControles(lancementControle)
const POLLUEUR = "import test from 'node:test'; import { writeFileSync } from 'node:fs'; test('pollution attrapée', () => { try { writeFileSync('interdit', 'x') } catch {} })\n"

test('transaction autonome : références hors sélection et projection pure sans mutation globale à l’import', () => {
  const args = ['--eval', '0'], options = { env: { TEMOIN: 'original' } }
  const transaction = LANCEMENTS_NODE_TEST.preparer(process.execPath, args, options, { ouvrir: () => assert.fail('hors sélection') })
  assert.strictEqual(transaction.args, args)
  assert.strictEqual(transaction.options, options)
  assert.equal(transaction.finaliser(7), 7)
  assert.equal(transaction.finaliser(0), 7)
  transaction.nettoyer(); transaction.nettoyer()
  assert.strictEqual(LANCEMENTS_NODE_TEST.projeter('autre', ['--test'], options).options, options)
  assert.strictEqual(LANCEMENTS_NODE_TEST.projeter(process.execPath, args, options).args, args)
  const selection = Object.freeze(['--test', '--test-reporter-destination=rapport'])
  const env = Object.freeze({ TEMOIN: 'original' }), opts = Object.freeze({ env })
  assert.deepEqual(LANCEMENTS_NODE_TEST.projeter(process.execPath, selection, opts).options.env, environnementDuControle(env))
  assert.deepEqual(selection, ['--test', '--test-reporter-destination=rapport'])
  assert.deepEqual(opts, { env: { TEMOIN: 'original' } })
  const module = new URL('./controleEcritures.mjs', import.meta.url).href
  const code = `import cp from 'node:child_process'; const avant = [cp.spawn, cp.spawnSync, JSON.stringify(process.execArgv), JSON.stringify(process.env)]; await import(${JSON.stringify(module)}); if (cp.spawn !== avant[0] || cp.spawnSync !== avant[1] || JSON.stringify(process.execArgv) !== avant[2] || JSON.stringify(process.env) !== avant[3]) process.exitCode = 1;`
  const enfant = spawnSync(process.execPath, ['--input-type=module', '--eval', code], { encoding: 'utf8' })
  assert.equal(enfant.status, 0, enfant.stderr)
})

test('transaction autonome : reporters préservés, premier veto mémorisé et clôture unique', () => avecDepot((racine) => {
  const args = Object.freeze(['--test', '--test-reporter-destination=stdout', '--test-reporter-destination', 'stderr', '--test-reporter-destination=rapports/cible.json'])
  const env = Object.freeze({ TEMOIN: 'original' }), options = Object.freeze({ cwd: pathToFileURL(racine), env, stdio: 'pipe' })
  let fermetures = 0, ouvertures = 0
  const messages = []
  const transaction = LANCEMENTS_NODE_TEST.preparer(process.execPath, args, options, {
    ouvrir: (r, e) => { ouvertures++; assert.equal(r, racine); assert.strictEqual(e, env); return {
      env: { ...env, CONTROLE: 'actif' }, fermer: () => { fermetures++; return ['refus témoin'] },
    } }, journal: (message) => messages.push(message),
  })
  const temporaire = transaction.args.at(-1).slice('--test-reporter-destination='.length)
  assert.deepEqual(transaction.args.slice(0, -1), args.slice(0, -1))
  assert.strictEqual(transaction.options.cwd, options.cwd)
  assert.equal(transaction.options.stdio, 'pipe')
  assert.deepEqual(transaction.options.env, { TEMOIN: 'original', CONTROLE: 'actif' })
  writeFileSync(temporaire, 'rapport complet')
  assert.equal(transaction.finaliser(0), 1)
  assert.equal(transaction.finaliser(0), 1)
  assert.equal(transaction.finaliser(7), 1)
  transaction.nettoyer(); transaction.nettoyer()
  assert.equal(ouvertures, 1)
  assert.equal(fermetures, 1)
  assert.deepEqual(messages, ['refus témoin'])
  assert.equal(readFileSync(join(racine, 'rapports/cible.json'), 'utf8'), 'rapport complet')
  assert.equal(existsSync(dirname(temporaire)), false)
  assert.deepEqual(env, { TEMOIN: 'original' })
  assert.equal(args.at(-1), '--test-reporter-destination=rapports/cible.json')
}))

test('transaction autonome : erreurs de clôture et restitution conservent statut et signal cible', () => avecDepot((racine) => {
  for (const status of [0, 7, null]) {
    let fermetures = 0
    const transaction = LANCEMENTS_NODE_TEST.preparer(process.execPath, ['--test'], { cwd: racine }, {
      ouvrir: () => ({ env: {}, fermer: () => { fermetures++; throw new Error('clôture témoin') } }), journal: () => {},
    })
    assert.equal(transaction.finaliser(status), status === 0 ? 1 : status)
    assert.equal(transaction.finaliser(0), status === 0 ? 1 : status)
    transaction.nettoyer()
    assert.equal(fermetures, 1)
    const destination = join(racine, 'rapports/dossier')
    mkdirSync(destination, { recursive: true })
    const restitution = LANCEMENTS_NODE_TEST.preparer(process.execPath, ['--test', '--test-reporter-destination=' + destination], { cwd: racine }, {
      ouvrir: () => ({ env: {}, fermer: () => [] }), journal: () => {},
    })
    const temporaire = restitution.args.at(-1).slice('--test-reporter-destination='.length)
    writeFileSync(temporaire, '{}')
    assert.equal(restitution.finaliser(status), status === 0 ? 1 : status)
    assert.equal(restitution.finaliser(0), status === 0 ? 1 : status)
    assert.equal(existsSync(dirname(temporaire)), false)
  }
}))

test('transaction autonome : nettoyage sans reporter et erreur d’ouverture rendue telle quelle', () => avecDepot((racine) => {
  let fermetures = 0
  const transaction = LANCEMENTS_NODE_TEST.preparer(process.execPath, ['--test', '--test-reporter-destination=rapports/partiel'], { cwd: racine }, {
    ouvrir: () => ({ env: {}, fermer: () => { fermetures++; return [] } }),
  })
  const temporaire = transaction.args.at(-1).slice('--test-reporter-destination='.length)
  writeFileSync(temporaire, 'partiel')
  transaction.nettoyer(); transaction.nettoyer()
  assert.equal(fermetures, 1)
  assert.equal(existsSync(dirname(temporaire)), false)
  assert.equal(existsSync(join(racine, 'rapports/partiel')), false)
  const erreur = new TypeError('ouverture témoin')
  const avant = new Set(listerDossier(tmpdir()))
  let ouverts
  assert.throws(() => LANCEMENTS_NODE_TEST.preparer(process.execPath, ['--test'], { cwd: racine }, {
    ouvrir: () => {
      ouverts = listerDossier(tmpdir()).filter((nom) => nom.startsWith('perimetre-reporters-') && !avant.has(nom))
      throw erreur
    },
  }), (e) => e === erreur)
  assert.equal(ouverts.length, 1)
  assert.equal(existsSync(join(tmpdir(), ouverts[0])), false)
}))

test('un nettoyage refusé conserve le verdict et son veto, puis les causes de l’ouverture échouée', () => avecDepot((racine) => {
  const erreurNettoyage = new Error('suppression refusée témoin')
  for (const status of [0, 7, null]) {
    let temporaire, suppressions = 0, fermetures = 0
    const messages = []
    const transaction = LANCEMENTS_NODE_TEST.preparer(process.execPath, ['--test'], { cwd: racine }, {
      ouvrir: () => ({ env: {}, fermer: () => { fermetures++; return [] } }),
      supprimer: (chemin) => { temporaire = chemin; suppressions++; throw erreurNettoyage },
      journal: (message) => messages.push(message),
    })
    try {
      const verdict = status === 0 ? 1 : status
      assert.equal(transaction.finaliser(status), verdict)
      assert.equal(transaction.finaliser(0), verdict)
      transaction.nettoyer()
      assert.equal(fermetures, 1)
      assert.equal(suppressions, 1)
      assert.equal(existsSync(temporaire), true)
      assert.deepEqual(messages, ['[tests] nettoyage du contrôle impossible : ' + temporaire + ' : suppression refusée témoin'])
    } finally { if (temporaire) rmSync(temporaire, { recursive: true, force: true }) }
  }
  const ouverture = new TypeError('ouverture refusée témoin')
  let temporaire
  try {
    assert.throws(() => LANCEMENTS_NODE_TEST.preparer(process.execPath, ['--test'], { cwd: racine }, {
      ouvrir: () => { throw ouverture },
      supprimer: (chemin) => { temporaire = chemin; throw erreurNettoyage },
    }), (erreur) => {
      assert.equal(erreur.message, ouverture.message)
      assert.strictEqual(erreur.cause, erreurNettoyage)
      assert.deepEqual(erreur.errors, [ouverture, erreurNettoyage])
      return true
    })
    assert.equal(existsSync(temporaire), true)
  } finally { if (temporaire) rmSync(temporaire, { recursive: true, force: true }) }
}))

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
    'pollueur.test.mjs': POLLUEUR,
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

function supervise(cwd, precharge) {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const code = `
    const { superviserProcessus } = await import(${JSON.stringify(new URL('./superviserProcessus.mjs', import.meta.url).href)});
    const r = await superviserProcessus({ commande: process.execPath, args: ['--test', 'pollueur.test.mjs'], cwd: process.cwd(), delaiArretMs: 2000, timeout: 60000 });
    console.log(JSON.stringify({ status: r.status, erreur: r.error?.code ?? null }));
  `
  const r = spawnSync(process.execPath, [...(precharge ? ['--import', PRELOAD] : []), '--input-type=module', '--eval', code], {
    cwd, env, encoding: 'utf8', maxBuffer: 10485760, timeout: 120000,
  })
  assert.equal(r.status, 0, r.stderr)
  return { ...JSON.parse(r.stdout.trim().split('\n').pop()), stderr: r.stderr, interdit: existsSync(join(cwd, 'interdit')) }
}

test('précharge réelle : un enfant node --test SUPERVISÉ pollueur est refusé', () => avecDepot((racine) => {
  const lancement = supervise(racine, true)
  assert.equal(lancement.status, 1, lancement.stderr)
  assert.equal(lancement.erreur, null)
  assert.match(lancement.stderr, /REFUS écriture.*writeFileSync interdit/)
  assert.equal(lancement.interdit, false)
}))

test('sans précharge, la supervision n’ouvre aucun contrôle, dans un dépôt comme hors dépôt', () => {
  avecDepot((racine) => {
    const lancement = supervise(racine, false)
    assert.equal(lancement.status, 0, lancement.stderr)
    assert.doesNotMatch(lancement.stderr, /REFUS/)
    assert.equal(lancement.interdit, true)
  })
  const horsDepot = mkdtempSync(join(tmpdir(), 'perimetre-hors-depot-'))
  try {
    writeFileSync(join(horsDepot, 'pollueur.test.mjs'), POLLUEUR)
    const lancement = supervise(horsDepot, false)
    assert.equal(lancement.erreur, null, lancement.stderr)
    assert.equal(lancement.status, 0, lancement.stderr)
  } finally { rmSync(horsDepot, { recursive: true, force: true }) }
})

test('deux reporters fichier et stdout sont relayés, puis apprendre lit le chemin prévu', () => avecDepot((racine) => {
  const un = join(racine, 'rapports', 'un.json')
  const deux = join(racine, 'rapports', 'deux.json')
  const lancement = parent(racine, [
    '--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
    `--test-reporter=${REPORTER}`, `--test-reporter-destination=${un}`,
    `--test-reporter=${REPORTER}`, '--test-reporter-destination', deux,
    'propre.test.mjs',
  ], `
    const { apprendre } = await import(${JSON.stringify(PERIMETRE)});
    const { mesuresDe } = await import(${JSON.stringify(new URL('../../test/mesures.mjs', import.meta.url).href)});
    const mesures = mesuresDe(${JSON.stringify(join(racine, 'rapports', 'mesures'))});
    const { appris, workers } = apprendre(${JSON.stringify(racine)}, ${JSON.stringify(un)}, mesures, 'node', 1);
    console.log(JSON.stringify({ appris, workers, memo: mesures.lire('durees.json')['propre.test.mjs'] }));
  `)
  assert.equal(lancement.status, 0, lancement.stderr)
  const [resultat, mesure] = lancement.stdout.trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(resultat.status, 0, lancement.stderr)
  assert.match(resultat.stdout, /propre/)
  assert.equal(existsSync(un), false, 'apprendre consomme le rapport relocalisé')
  assert.equal(typeof JSON.parse(readFileSync(deux, 'utf8')).durees[join(racine, 'propre.test.mjs')], 'number')
  assert.equal(typeof mesure.appris['propre.test.mjs'], 'number')
  assert.equal(mesure.memo, mesure.appris['propre.test.mjs'])
  assert.equal(mesure.workers, 1)
}))

test('un enfant rouge restitue aussi ses durées et garde son verdict', () => avecDepot((racine) => {
  const destination = join(racine, 'rapports', 'rouge.json')
  const lancement = parent(racine, ['--test', `--test-reporter=${REPORTER}`, `--test-reporter-destination=${destination}`, 'rouge.test.mjs'])
  assert.equal(JSON.parse(lancement.stdout.trim()).status, 1)
  const rapport = JSON.parse(readFileSync(destination, 'utf8'))
  assert.equal(typeof rapport.durees[join(racine, 'rouge.test.mjs')], 'number')
  assert.deepEqual(rapport.echecs, [join(racine, 'rouge.test.mjs')])
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


test('profils : historique complet utilisable, clé sans nonce ni destination de reporter', () => avecDepot((racine) => {
  const execArgv = [...process.execArgv]
  const p = { racine, fichiers: ['propre.test.mjs'], argv: ['--test'], env: {}, mesures: { lire: (_nom, valider) => valider({}) } }
  const vierge = profilsDuLancement(p)
  assert.equal(vierge.entrees[0].utilisable, false)
  const historiques = (profils) => ({ lire: (_nom, valider) => valider(Object.fromEntries(profils.entrees.map((e) => [e.cle,
    { blob: e.blob, picOctets: 1, parentOctets: 1, descendantsInclus: true, metrique: 'temoin' }]))) })
  assert.equal(profilsDuLancement({ ...p, mesures: historiques(vierge) }).entrees[0].utilisable, true)
  assert.deepEqual(process.execArgv, execArgv)
  const premier = profilsDuLancement({ ...p, argv: ['--test', '--test-reporter=spec', '--test-reporter-destination=un'], env: { WFRP_TESTS_REFUS: 'nonce-un' } })
  const suivant = profilsDuLancement({ ...p, fichiers: [...p.fichiers, 'rouge.test.mjs'],
    argv: ['--test', '--test-reporter=spec', '--test-reporter-destination=deux'], env: { WFRP_TESTS_REFUS: 'nonce-deux' } })
  assert.equal(premier.entrees[0].cle, suivant.entrees[0].cle)
}))

/** Les profils de `propre.test.mjs` dans le dépôt `racine`, calculés dans un processus node lancé avec ou sans la
 *  `precharge` : la toolchain, l'interception de la projection supervisée et la stabilité de `execArgv`. */
function profilsSupervises(racine, precharge) {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const code = `
    import { LANCEMENTS_SUPERVISES } from ${JSON.stringify(new URL('./controleEcritures.mjs', import.meta.url).href)};
    const avant = JSON.stringify(process.execArgv);
    const { profilsDuLancement } = await import(${JSON.stringify(new URL('../../test/memoire.mjs', import.meta.url).href)});
    const p = { racine: process.cwd(), fichiers: ['propre.test.mjs'], argv: ['--test'], env: {}, mesures: { lire: (_nom, valider) => valider({}) } };
    const options = { env: {} };
    const projection = LANCEMENTS_SUPERVISES.projeter(process.execPath, ['--test', 'propre.test.mjs'], options);
    const profils = profilsDuLancement(p);
    console.log(JSON.stringify({ toolchain: profils.toolchain, utilisable: profils.entrees.some((e) => e.utilisable),
      identite: projection.options === options, intercepte: (projection.options.env.NODE_OPTIONS ?? '').includes('intercepterEcritures.mjs'),
      stable: avant === JSON.stringify(process.execArgv) }));
  `
  const r = spawnSync(process.execPath, [...(precharge ? ['--import', PRELOAD] : []), '--input-type=module', '--eval', code], { cwd: racine, env, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}

test('précharge réelle : la projection supervisée porte l’interception jusqu’à la toolchain des profils ; processus nu, identité', () => avecDepot((racine) => {
  const { toolchain: precharge, ...supervise } = profilsSupervises(racine, true)
  const { toolchain: nu, ...natif } = profilsSupervises(racine, false)
  assert.deepEqual(supervise, { utilisable: false, identite: false, intercepte: true, stable: true })
  assert.deepEqual(natif, { utilisable: false, identite: true, intercepte: false, stable: true })
  assert.notEqual(precharge, nu)
}))

test('paire de lancements : la préparation consomme la projection, identité hors sélection', () => avecDepot((racine) => {
  const options = { cwd: racine, env: { TEMOIN: 'preserve' }, timeout: 7 }
  let ouvertures = 0
  const ouvrir = (_racine, env) => { ouvertures++; return { env: { ...environnementDuControle(env), CONTROLE: 'actif' }, fermer: () => [] } }
  const refusee = lancementsControles(() => false)
  assert.strictEqual(refusee.projeter(process.execPath, ['--test'], options).options, options)
  const identite = refusee.preparer(process.execPath, ['--test'], options, { ouvrir })
  assert.strictEqual(identite.options, options)
  assert.equal(identite.finaliser(0), 0)
  assert.equal(ouvertures, 0)
  const retenue = lancementsControles(() => true)
  const vue = retenue.projeter('autre', ['--eval', '0'], options)
  const transaction = retenue.preparer('autre', ['--eval', '0'], options, { ouvrir })
  assert.equal(ouvertures, 1)
  assert.equal(transaction.options.env.NODE_OPTIONS, vue.options.env.NODE_OPTIONS)
  assert.match(transaction.options.env.NODE_OPTIONS, /intercepterEcritures\.mjs/)
  assert.equal(transaction.options.timeout, 7)
  assert.equal(transaction.options.env.CONTROLE, 'actif')
  assert.deepEqual(options.env, { TEMOIN: 'preserve' })
  assert.equal(transaction.finaliser(0), 0)
}))
