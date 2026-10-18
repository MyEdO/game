// ISOLATION entre arbres et entre sessions (#1679 L1c), et lancement de Vitest par `lancerTests`
// (`scripts/test/run.mjs`) :
//   · refus d'un outillage NON LOCAL (`scripts/test/run.mjs`, `scripts/typecheck-fast.mjs`) — la
//     vérification juge le FICHIER que l'appelant va jouer, jamais une résolution de module (qui,
//     elle, remonte les arbres) ;
//   · verrou machine de `scripts/test/run.mjs` (`verrou.mjs`, #2603) — tout run le prend, filtré
//     ou non, sauf emprunt explicite ;
//   · Vitest lancé en processus enfant direct : son code rendu, un arrêt relayé, atelier et verrou
//     rendus après le `close` de chaque enfant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refusOutillageLocal } from '../outillage-local.mjs'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lancerTests } from './run.mjs'
import { prendreVerrou } from './verrou.mjs'
import { VARIABLE_PARTIE } from './partition.mjs'
import { estPidVivant } from '../guards/lib/pid.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'

/** Vitest de substitution : trace ses arguments dans `TRACE_DOSSIER` (`<côté>-<pid>.json`), puis sort sur
 *  `FAUX_VITEST_CODE`, ou attend indéfiniment sous `FAUX_VITEST_ATTENTE`. */
const FAUX_VITEST =
  "import fs from 'node:fs'\n" +
  "import path from 'node:path'\n" +
  "const cote = process.argv.some((a) => a.includes('vitest.jsdom.')) ? 'jsdom' : 'node'\n" +
  "if (process.env.TRACE_DOSSIER) fs.writeFileSync(path.join(process.env.TRACE_DOSSIER, cote + '-' + process.pid + '.json'), JSON.stringify(process.argv.slice(2)))\n" +
  "if (process.env.FAUX_VITEST_ATTENTE) setInterval(() => {}, 1000)\n" +
  "else process.exit(Number(process.env.FAUX_VITEST_CODE ?? 0))\n"

const fixtureRun = (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'run-lancement-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  mkdirSync(join(racine, 'node_modules/vitest'), { recursive: true })
  writeFileSync(join(racine, 'node_modules/vitest/vitest.mjs'), FAUX_VITEST)
  const traces = join(racine, 'traces')
  mkdirSync(traces)
  const env = { ...process.env, WFRP_TEST_COEURS: '4', WFRP_TEST_MEMOIRE_MO: '65536', TRACE_DOSSIER: traces }
  delete env[VARIABLE_PARTIE]
  return { racine, traces, verrou: { chemin: join(racine, 'geste.verrou'), libelle: 'fixture' }, env }
}

/** Fixture partagée node/jsdom : deux fichiers, un par côté, et l'inventaire qui les rend. */
const fixturePartagee = (t) => {
  const p = fixtureRun(t)
  const fichiers = ['moteur.test.ts', 'ecran.test.tsx'].map((n) => join(p.racine, n))
  fichiers.forEach((f, i) => writeFileSync(f, i ? '// @vitest-environment jsdom\n' : 'export {}'))
  const inventorier = (_exe, args) => {
    writeFileSync(args.find((a) => a.startsWith('--json=')).slice(7), JSON.stringify(fichiers.map((file) => ({ file }))))
    return { status: 0 }
  }
  return { ...p, inventorier }
}

/** Les lancements tracés par le faux Vitest, côté node d'abord : `[côté, pid, argv]`. */
const lancementsDe = (traces) => readdirSync(traces).sort((a, b) => (a.startsWith('node') ? 0 : 1) - (b.startsWith('node') ? 0 : 1))
  .map((n) => [n.split('-')[0], Number(n.split('-')[1].slice(0, -5)), JSON.parse(readFileSync(join(traces, n), 'utf8'))])

const relais = () => ['SIGINT', 'SIGTERM'].map((s) => process.listeners(s))

test('lancerTests : le code de Vitest est rendu tel quel, verrou rendu, relais retirés', async (t) => {
  const p = fixtureRun(t)
  const avant = relais()
  assert.equal(await lancerTests({ ...p, argv: ['src/un.test.ts'], env: { ...p.env, FAUX_VITEST_CODE: '3' } }), 3)
  assert.deepEqual(lancementsDe(p.traces).map(([, , argv]) => argv[0]), ['run'])
  assert.equal(existsSync(p.verrou.chemin), false)
  assert.deepEqual(relais(), avant)
})

test('lancerTests : lancement de Vitest impossible rend 1 et rend le verrou', async (t) => {
  const p = fixtureRun(t)
  const code = await lancerTests({ ...p, argv: ['src/un.test.ts'], env: { ...p.env, VARIABLE_INVALIDE: 'nul\0' } })
  assert.equal(code, 1)
  assert.deepEqual(readdirSync(p.traces), [])
  assert.equal(existsSync(p.verrou.chemin), false)
})

test('lancerTests : annulation en cours relayée aux deux Vitest, atelier et verrou rendus après leur close', { timeout: 30000 }, async (t) => {
  const p = fixturePartagee(t)
  const controle = new AbortController()
  const avant = relais()
  const guet = setInterval(() => { if (readdirSync(p.traces).length === 2) controle.abort() }, 10)
  let code
  try {
    code = await lancerTests({ ...p, argv: [], signal: controle.signal,
      env: { ...p.env, WFRP_TEST_COEURS: '16', FAUX_VITEST_ATTENTE: '1' } })
  } finally { clearInterval(guet) }
  assert.equal(code, 1)
  const lancements = lancementsDe(p.traces)
  assert.deepEqual(lancements.map(([cote]) => cote), ['node', 'jsdom'])
  for (const [cote, pid] of lancements) assert.equal(estPidVivant(pid), false, cote)
  assert.deepEqual(readdirSync(join(p.racine, 'node_modules/.vitest-split')), [])
  assert.equal(existsSync(p.verrou.chemin), false)
  assert.deepEqual(relais(), avant)
})

test('lancerTests : annulation avant principal interdit aussi inventaire PARTIE', async (t) => {
  const p = fixtureRun(t)
  const controle = new AbortController()
  const env = { ...p.env, WFRP_TEST_PARTIE: '1/2' }
  let lectures = 0
  Object.defineProperty(env, 'WFRP_TEST_COEURS', { enumerable: true, get() { if (++lectures === 2) controle.abort(); return '4' } })
  let inventaires = 0
  const code = await lancerTests({ ...p, env, signal: controle.signal, argv: [],
    inventorier: () => { inventaires++; return { status: 1, stdout: '', stderr: '' } } })
  assert.equal(code, 1)
  assert.equal(inventaires, 0)
  assert.deepEqual(readdirSync(p.traces), [])
  assert.equal(existsSync(p.verrou.chemin), false)
})

test('lancerTests : bornes validées sur le mode réel et une seule option par enfant', async (t) => {
  for (const [nom, argv, memoire, attendu, bornes] of [
    ['camel séparé', ['--maxWorkers', '4'], '17000', 0, [4, 2]],
    ['camel égal', ['--maxWorkers=4'], '17000', 0, [4, 2]],
    ['tirets séparés', ['--max-workers', '4'], '17000', 0, [4, 2]],
    ['tirets égal', ['--max-workers=4'], '17000', 0, [4, 2]],
    ['inférieur', ['--maxWorkers=1'], '17000', 0, [1, 1]],
    ['partagé supérieur à mono', ['--maxWorkers=8'], '65536', 0, [8, 5]],
    ['trop grand partagé', ['--maxWorkers=5'], '17000', 2, []],
    ['trop grand reporter', ['--reporter=json', '--maxWorkers=8'], '65536', 2, []],
    ['trop grand config', ['--config=autre.ts', '--maxWorkers=8'], '65536', 2, []],
    ['trop grand filtre', ['moteur.test.ts', '--maxWorkers=8'], '65536', 2, []],
    ['doublon camel', ['--maxWorkers', '4', '--maxWorkers=4'], '17000', 2, []],
    ['doublon mixte', ['--maxWorkers=4', '--max-workers=2'], '17000', 2, []],
    ['valeur absente', ['--maxWorkers'], '17000', 2, []],
    ['valeur invalide', ['--max-workers=0'], '17000', 2, []],
  ]) {
    const p = fixturePartagee(t)
    const erreurs = []
    const error = console.error
    console.error = (...args) => erreurs.push(args.join(' '))
    let code
    try {
      code = await lancerTests({ ...p, argv, env: { ...p.env, WFRP_TEST_COEURS: '16', WFRP_TEST_MEMOIRE_MO: memoire } })
    } finally { console.error = error }
    assert.equal(code, attendu, nom)
    const lancements = lancementsDe(p.traces).map(([, , args]) => args)
    assert.deepEqual(lancements.map((a) => Number(a[a.indexOf('--maxWorkers') + 1])), bornes, nom)
    for (const args of lancements) assert.equal(args.filter((a) => /^--max-?workers/i.test(a)).length, 1, nom)
    if (attendu === 2) assert.match(erreurs.join('\n'), /CONCURRENCE_SUPERIEURE_CAPACITE|MAX_WORKERS_DUPLIQUE|MAX_WORKERS_INVALIDE/, nom)
    assert.equal(existsSync(p.verrou.chemin), false, nom)
  }
})

test('entrée absente de l’arbre : refus qui NOMME l’arbre, l’outil et la cause', () => {
  const refus = refusOutillageLocal('/arbres/.wt-42', 'vitest', '/arbres/.wt-42/node_modules/vitest/vitest.mjs', () => false)
  assert.ok(refus, 'une entrée absente doit être refusée')
  assert.match(refus, /vitest/)
  assert.match(refus, /\/arbres\/\.wt-42/)
  assert.match(refus, /AUTRE arbre/)
})

test('entrée présente : aucun refus, et la présence se juge sur CE fichier', () => {
  const entree = '/arbres/.wt-42/node_modules/typescript/bin/tsc'
  const vus = []
  const refus = refusOutillageLocal('/arbres/.wt-42', 'tsc', entree, (p) => {
    vus.push(p)
    return true
  })
  assert.equal(refus, null)
  assert.deepEqual(vus, [entree])
})

test('une entrée présente AILLEURS ne vaut pas présence dans l’arbre', () => {
  const entree = '/arbres/.wt-42/node_modules/vitest/vitest.mjs'
  const refus = refusOutillageLocal('/arbres/.wt-42', 'vitest', entree, (p) => p !== entree)
  assert.ok(refus, 'seul le fichier attendu compte')
})

test('lancerTests : tout filtre prend la même instance, refus sans spawn et emprunt explicite', async (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'run-isolation-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  mkdirSync(join(racine, 'node_modules/vitest'), { recursive: true })
  writeFileSync(join(racine, 'node_modules/vitest/vitest.mjs'), "process.stdout.write(' Test Files 1 passed (1)\\n')")
  const verrou = { chemin: join(racine, 'geste.verrou'), libelle: 'fixture', attente: { echeanceMs: 0, pasMs: 1 } }
  const owner = prendreVerrou(verrou)
  t.after(() => owner.liberer())
  const env = { WFRP_TEST_COEURS: '4', WFRP_TEST_MEMOIRE_MO: '65536' }
  assert.equal(await lancerTests({ racine, verrou, env, argv: ['src/un.test.ts'] }), CODE_DIFFERE)
  assert.equal(existsSync(join(racine, 'node_modules/.cache')), false)
  assert.equal(await lancerTests({ racine, verrou, env: { ...process.env, ...env, ...owner.env }, argv: ['src/un.test.ts'] }), 0)
  assert.equal(existsSync(verrou.chemin), true)
})
