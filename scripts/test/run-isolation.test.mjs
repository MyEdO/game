// ISOLATION entre arbres et entre sessions (#1679 L1c), deux décisions prises avant tout
// lancement :
//   · refus d'un outillage NON LOCAL (`scripts/test/run.mjs`, `scripts/typecheck-fast.mjs`) — la
//     vérification juge le FICHIER que l'appelant va jouer, jamais une résolution de module (qui,
//     elle, remonte les arbres) ;
//   · verrou machine de `scripts/test/run.mjs` (`verrou.mjs`, #2603) — tout run le prend, filtré
//     ou non, sauf emprunt explicite.
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { PassThrough } from 'node:stream'
import assert from 'node:assert/strict'
import { refusOutillageLocal } from '../outillage-local.mjs'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lancerTests } from './run.mjs'
import { prendreVerrou } from './verrou.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'

const fixtureRun = (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'run-cloture-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  mkdirSync(join(racine, 'node_modules/vitest'), { recursive: true })
  writeFileSync(join(racine, 'node_modules/vitest/vitest.mjs'), '')
  return { racine, verrou: { chemin: join(racine, 'geste.verrou'), libelle: 'fixture' },
    env: { WFRP_TEST_COEURS: '4', WFRP_TEST_MEMOIRE_MO: '65536' } }
}

test('lancerTests : arrêt indéterminé rend échec, conserve atelier et verrou, retire les relais', async (t) => {
  const p = fixtureRun(t)
  const atelier = join(p.racine, 'node_modules/.vitest-split', String(process.pid))
  const avant = ['SIGINT', 'SIGTERM'].map((s) => process.listeners(s))
  const code = await lancerTests({ ...p, argv: ['src/un.test.ts'], superviser: async () => {
      mkdirSync(atelier, { recursive: true })
      const enfant = new EventEmitter()
      enfant.stdout = new PassThrough()
      enfant.stderr = new PassThrough()
      setImmediate(() => enfant.emit('close', 0))
      return { hote: enfant, controle: { pid: null, demanderArret() {}, fin: new Promise(ok => enfant.once('close', () => ok({ resultatCible: { status: 0, signal: null }, arret: { etat: 'indetermine', erreurs: [] } }))) } }
    } })
  assert.equal(code, 1)
  assert.equal(existsSync(atelier), true)
  assert.equal(existsSync(p.verrou.chemin), true)
  assert.deepEqual(['SIGINT', 'SIGTERM'].map((s) => process.listeners(s)), avant)
})

test('lancerTests : annulation avant principal interdit aussi inventaire PARTIE', async (t) => {
  const p = fixtureRun(t)
  const controle = new AbortController()
  const env = { ...p.env, WFRP_TEST_PARTIE: '1/2' }
  let lectures = 0
  Object.defineProperty(env, 'WFRP_TEST_COEURS', { enumerable: true, get() { if (++lectures === 2) controle.abort(); return '4' } })
  let inventaires = 0
  const code = await lancerTests({ ...p, env, signal: controle.signal, argv: [],
    inventorier: () => { inventaires++; return { status: 1, stdout: '', stderr: '' } },
    superviser: () => assert.fail('aucun enfant après annulation') })
  assert.equal(code, 1)
  assert.equal(inventaires, 0)
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
    const p = fixtureRun(t)
    const fichiers = ['moteur.test.ts', 'ecran.test.tsx'].map((n) => join(p.racine, n))
    fichiers.forEach((f, i) => writeFileSync(f, i ? '// @vitest-environment jsdom\n' : 'export {}'))
    const lancements = []
    const erreurs = []
    const error = console.error
    console.error = (...args) => erreurs.push(args.join(' '))
    let code
    try {
      code = await lancerTests({ ...p, argv, env: { ...p.env, WFRP_TEST_COEURS: '16', WFRP_TEST_MEMOIRE_MO: memoire },
        inventorier: (_exe, args) => {
          const liste = args.find((a) => a.startsWith('--json=')).slice(7)
          writeFileSync(liste, JSON.stringify(fichiers.map((file) => ({ file }))))
          return { status: 0 }
        },
        superviser: async (_exe, args) => {
          lancements.push(args)
          const enfant = new EventEmitter()
          enfant.stdout = new PassThrough()
          enfant.stderr = new PassThrough()
          setImmediate(() => enfant.emit('close', 0))
          return { hote: enfant, controle: { pid: null, demanderArret() {}, fin: new Promise(ok => enfant.once('close', () => ok({ resultatCible: { status: 0, signal: null }, arret: { etat: 'mort', erreurs: [] } }))) } }
        } })
    } finally { console.error = error }
    assert.equal(code, attendu, nom)
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

test('erreur split : une factory en attente rejoint la même demande d’arrêt, close réel avant libération', async (t) => {
  const p = fixtureRun(t)
  const fichiers = ['moteur.test.ts', 'ecran.test.tsx'].map((n) => join(p.racine, n))
  fichiers.forEach((f, i) => writeFileSync(f, i ? '// @vitest-environment jsdom\n' : 'export {}'))
  let appels = 0; let demandes = 0; let fermee = false
  const code = await lancerTests({ ...p, argv: [], env: { ...p.env, WFRP_TEST_COEURS: '16' },
    inventorier: (_exe, args) => { writeFileSync(args.find((a) => a.startsWith('--json=')).slice(7), JSON.stringify(fichiers.map((file) => ({ file })))); return { status: 0 } },
    superviser: async () => {
      if (++appels === 1) throw new Error('première factory refusée')
      await new Promise((ok) => setImmediate(ok))
      const hote = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: ['ignore', 'pipe', 'pipe'] })
      const fin = new Promise((ok) => hote.once('close', () => { fermee = true; ok({ resultatCible: { status: 0, signal: null }, arret: { etat: 'mort', erreurs: [] } }) }))
      return { hote, controle: { pid: hote.pid, fin, demanderArret() {
        demandes++; assert.equal(existsSync(p.verrou.chemin), true); hote.kill('SIGTERM')
      } } }
    },
  })
  assert.equal(code, 1); assert.equal(appels, 2); assert.equal(demandes, 1)
  assert.equal(fermee, true); assert.equal(existsSync(p.verrou.chemin), false)
})
