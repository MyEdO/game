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
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lancerTests } from './run.mjs'
import { prendreVerrou } from './verrou.mjs'
import { VARIABLE_PARTIE } from './partition.mjs'
import { estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from './identiteMesuree.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { envDeDepotForge } from '../guards/lib/depotGabarit.mjs'
import { gitDe } from './gitDeBanc.mjs'

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

/** Fixture partagée node/jsdom : deux fichiers, un par côté, et l'énumération qui les rend. */
const fixturePartagee = (t) => {
  const p = fixtureRun(t)
  const suite = ['moteur.test.ts', 'ecran.test.tsx']
  suite.forEach((n, i) => writeFileSync(join(p.racine, n), i ? '// @vitest-environment jsdom\n' : 'export {}'))
  return { ...p, enumerer: () => suite }
}

/** Les lancements tracés par le faux Vitest, côté node d'abord : `[côté, pid, argv]`. */
const lancementsDe = (traces) => readdirSync(traces).sort((a, b) => (a.startsWith('node') ? 0 : 1) - (b.startsWith('node') ? 0 : 1))
  .map((n) => [n.split('-')[0], Number(n.split('-')[1].slice(0, -5)), JSON.parse(readFileSync(join(traces, n), 'utf8'))])

const relais = () => ['SIGINT', 'SIGTERM'].map((s) => process.listeners(s))

/** L'`enfant` de `lancerTests` : le vrai `spawn`, chaque lancement porté dans `vus` avec, à son `close`, l'état du
 *  verrou `chemin` (`verrouALaFermeture`). */
const espionDe = (vus, chemin) => (...a) => {
  const p = spawn(...a)
  const vu = { pid: p.pid, ferme: false, verrouALaFermeture: null }
  vus.push(vu)
  p.on('close', () => { vu.ferme = true; vu.verrouALaFermeture = existsSync(chemin) })
  return p
}

/** Dès que `attendus` Vitest sont tracés, `sig` passe aux seuls écouteurs que le lancement a posés depuis `avant`
 *  (`relais()`) ; au-delà de `echeanceMs` sans relais posé, les enfants de `vus` sont tués à la main et `etat.relaye`
 *  reste `false`. */
const signalerAuxRelais = ({ traces, attendus, sig, avant, vus, etat, echeanceMs = 10000 }) => {
  const debut = Date.now()
  const guet = setInterval(() => {
    if (readdirSync(traces).length !== attendus) return
    const poses = process.listeners(sig).filter((l) => !avant[sig === 'SIGINT' ? 0 : 1].includes(l))
    if (!poses.length && Date.now() - debut < echeanceMs) return
    clearInterval(guet)
    etat.nes = Date.now()
    if (!poses.length) { for (const { pid } of vus) process.kill(pid); return }
    etat.relaye = true
    for (const l of poses) l(sig)
  }, 10)
  return guet
}

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
  let nes
  const guet = setInterval(() => {
    if (readdirSync(p.traces).length !== 2) return
    nes = Date.now()
    controle.abort()
  }, 10)
  let code
  try {
    code = await lancerTests({ ...p, argv: [], signal: controle.signal,
      env: { ...p.env, WFRP_TEST_COEURS: '16', FAUX_VITEST_ATTENTE: '1' } })
  } finally { clearInterval(guet) }
  assert.equal(code, 1)
  const lancements = lancementsDe(p.traces)
  assert.deepEqual(lancements.map(([cote]) => cote), ['node', 'jsdom'])
  for (const [cote, pid] of lancements) assert.equal(estPidVivantDepuis(pid, nes, IDENTITE_MESUREE), false, cote)
  assert.deepEqual(readdirSync(join(p.racine, 'node_modules/.vitest-split')), [])
  assert.equal(existsSync(p.verrou.chemin), false)
  assert.deepEqual(relais(), avant)
})

for (const [mode, sig] of [['mono', 'SIGINT'], ['mono', 'SIGTERM'], ['partagé', 'SIGINT'], ['partagé', 'SIGTERM']]) {
  test(`lancerTests : ${sig} du processus relayé à chaque Vitest (${mode}), verrou rendu après leur close, atelier et relais retirés`, { timeout: 30000 }, async (t) => {
    const p = fixturePartagee(t)
    const partage = mode === 'partagé'
    const avant = relais()
    const vus = []
    const etat = { relaye: false, nes: 0 }
    const guet = signalerAuxRelais({ traces: p.traces, attendus: partage ? 2 : 1, sig, avant, vus, etat })
    let code
    try {
      code = await lancerTests({ ...p, argv: partage ? [] : ['src/un.test.ts'], enfant: espionDe(vus, p.verrou.chemin),
        env: { ...p.env, WFRP_TEST_COEURS: partage ? '16' : '4', FAUX_VITEST_ATTENTE: '1' } })
    } finally { clearInterval(guet) }
    assert.equal(etat.relaye, true, `${sig} relayé par un écouteur du lancement`)
    assert.equal(code, 1)
    assert.deepEqual(lancementsDe(p.traces).map(([cote]) => cote), partage ? ['node', 'jsdom'] : ['node'])
    for (const vu of vus) {
      assert.equal(estPidVivantDepuis(vu.pid, etat.nes, IDENTITE_MESUREE), false, `pid ${vu.pid}`)
      assert.deepEqual([vu.ferme, vu.verrouALaFermeture], [true, true], 'le verrou est encore tenu au close de chaque Vitest')
    }
    const ateliers = join(p.racine, 'node_modules/.vitest-split')
    assert.deepEqual(existsSync(ateliers) ? readdirSync(ateliers) : [], [])
    assert.equal(existsSync(p.verrou.chemin), false)
    assert.deepEqual(relais(), avant)
  })
}

test('lancerTests : une exception levée avec un Vitest vivant le ferme AVANT de rendre le verrou, atelier et relais retirés', { timeout: 30000 }, async (t) => {
  const p = fixturePartagee(t)
  const avant = relais()
  const vus = []
  let atelier
  await assert.rejects(lancerTests({ ...p, argv: [], enfant: espionDe(vus, p.verrou.chemin),
    env: { ...p.env, WFRP_TEST_COEURS: '16', FAUX_VITEST_ATTENTE: '1' },
    enumerer: (racine) => {
      const ateliers = join(racine, 'node_modules/.vitest-split')
      atelier = join(ateliers, readdirSync(ateliers)[0])
      mkdirSync(join(atelier, 'vitest.jsdom.config.ts'))
      return p.enumerer(racine)
    } }), (e) => e.code === 'EISDIR')
  assert.equal(vus.length, 1, 'le Vitest node lancé avant la levée')
  assert.deepEqual([vus[0].ferme, vus[0].verrouALaFermeture], [true, true], 'fermé verrou encore tenu')
  assert.equal(existsSync(atelier), false)
  assert.equal(existsSync(p.verrou.chemin), false)
  assert.deepEqual(relais(), avant)
})

test('lancerTests : une suite qu’on ne peut énumérer, VIDE comprise, est un REFUS (code 1) sans aucun Vitest lancé (#2651)', async (t) => {
  const p = fixtureRun(t)
  const git = gitDe(p.racine)
  git('init', '-q', '-b', 'main')
  writeFileSync(join(p.racine, 'moteur.ts'), 'export {}\n')
  git('add', '--', 'moteur.ts')
  git('-c', 'user.email=run@example.test', '-c', 'user.name=Run', 'commit', '-q', '-m', 'base')
  const vus = []
  const ecrits = []
  t.mock.method(process.stderr, 'write', (texte) => { ecrits.push(String(texte)); return true })
  const code = await lancerTests({ ...p, argv: [], enfant: espionDe(vus, p.verrou.chemin),
    env: { ...envDeDepotForge(), WFRP_TEST_COEURS: '16', WFRP_TEST_MEMOIRE_MO: '65536', TRACE_DOSSIER: p.traces } })
  t.mock.restoreAll()
  assert.equal(code, 1)
  assert.ok(ecrits.some((e) => e.startsWith('[test] REFUS — énumération de la suite impossible : suiteVitest : aucune suite Vitest sous ')), ecrits.join(''))
  assert.deepEqual(vus, [])
  assert.equal(existsSync(p.verrou.chemin), false)
})

test('lancerTests : annulation avant principal interdit aussi énumération PARTIE', async (t) => {
  const p = fixtureRun(t)
  const controle = new AbortController()
  const env = { ...p.env, WFRP_TEST_PARTIE: '1/2' }
  let lectures = 0
  Object.defineProperty(env, 'WFRP_TEST_COEURS', { enumerable: true, get() { if (++lectures === 2) controle.abort(); return '4' } })
  let enumerations = 0
  const code = await lancerTests({ ...p, env, signal: controle.signal, argv: [],
    enumerer: () => { enumerations++; return [] } })
  assert.equal(code, 1)
  assert.equal(enumerations, 0)
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
