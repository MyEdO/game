// Contrat du verrou machine des gestes lourds (#2603) : identité mesurée, preneur `build-all`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { prendreVerrou, prendreVerrouAsync, tenantDe } from './verrou.mjs'
import { estGesteLourd, lanceUnGesteLourd, verrouGestesLourds } from './verrouGestesLourds.mjs'
import { SOURCES_LUES, sousGestesLourds } from '../docs/build-all.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { estPidVivantDepuis, NAISSANCE_ABSENTE } from '../guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from './identiteMesuree.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'

const BUILD_ALL = new URL('../docs/build-all.mjs', import.meta.url)

test('#2603 — estGesteLourd : tout mode de build-all, hors `--code` et `--check --only`', () => {
  for (const argv of [[], ['--check'], ['--perimes'], ['--perimes', '--quiet'], ['--only', 'x']]) assert.equal(estGesteLourd(argv), true, argv.join(' '))
  for (const argv of [['--code'], ['--check', '--only', 'x']]) assert.equal(estGesteLourd(argv), false, argv.join(' '))
})

test('#2586 — lanceUnGesteLourd : un script qui lance un preneur, build-all jugé par estGesteLourd', () => {
  for (const script of ['node scripts/test/run.mjs', 'node ./scripts/test/perimetre.mjs --x', 'node scripts/gates/testsSansEcriture.mjs test:ops',
    'node scripts/test/node-tests.mjs test:docs', 'node scripts/docs/build-all.mjs', 'npm run gen && node scripts/docs/build-all.mjs --check']) assert.equal(lanceUnGesteLourd(script), true, script)
  for (const script of [undefined, 'node scripts/docs/build-all.mjs --code', 'node scripts/docs/build-all.mjs --check --only x && node lint.mjs',
    'node scripts/lancer-local.mjs oxlint -- oxlint .', 'node scripts/raw/check-refs.mjs']) assert.equal(lanceUnGesteLourd(script), false, String(script))
})

test('#2603 — `sousGestesLourds` RÉEL, verrou tenu jusqu’à l’échéance : DIFFÉRÉ, `CODE_DIFFERE`, le tenant nommé, rien ne tourne', (t) => {
  const { racine: depot } = instanceDeDepot({ commit: false })
  t.after(() => rmSync(depot, { recursive: true, force: true }))
  const verrou = verrouGestesLourds(depot)
  assert.equal(verrou.chemin, join(depot, '.git', 'gestes-lourds.verrou'))
  const prise = prendreVerrou({ chemin: verrou.chemin, libelle: verrou.libelle, identite: verrou.identite, cwd: depot, commande: 'tenant du test' })
  assert.equal(prise.etat, 'pris')
  try {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', [
      `import { sousGestesLourds } from ${JSON.stringify(BUILD_ALL.href)}`,
      `process.exitCode = await sousGestesLourds({ cwd: process.cwd(), argv: ['--perimes'], attente: { echeanceMs: 300, pasMs: 50 }, geste: () => { throw new Error('geste joué') } })`,
    ].join('\n')], { cwd: depot, encoding: 'utf8', timeout: 60_000 })
    assert.equal(r.status, CODE_DIFFERE, `${r.error?.message ?? ''} ${r.stderr}`)
    assert.match(r.stderr, new RegExp(`docs:build — DIFFÉRÉ à l'échéance : un geste lourd tient la machine : PID ${process.pid} · tenant du test`))
    assert.doesNotMatch(r.stderr, /geste joué/)
    assert.deepEqual([SOURCES_LUES, 'docs', 'src'].map((nom) => existsSync(join(depot, nom))), [false, false, false], 'aucune écriture dans l’arbre')
  } finally {
    prise.liberer()
  }
})

async function avecZombie(agir) {
  const enfant = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
  const fin = once(enfant, 'close')
  try {
    const echeance = performance.now() + 5_000
    let etat
    // La boucle Node ne récolte l'enfant qu'après cette observation et la tentative de prise.
    do {
      const stat = fs.readFileSync('/proc/' + enfant.pid + '/stat', 'utf8')
      etat = stat[stat.lastIndexOf(')') + 2]
      if (etat === 'Z') break
      attendreSync(5)
    } while (performance.now() < echeance)
    assert.equal(etat, 'Z')
    assert.equal(estPidVivantDepuis(enfant.pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), true)
    return await agir(enfant.pid)
  } finally {
    assert.deepEqual(await fin, [0, null])
  }
}

function verrouDeBanc(t) {
  const { racine: depot } = instanceDeDepot({ commit: false })
  t.after(() => rmSync(depot, { recursive: true, force: true }))
  return { depot, verrou: verrouGestesLourds(depot) }
}

test('#4614 — build-all reprend un verrou tenu par un vrai zombie Linux dès le premier essai', { skip: process.platform !== 'linux' }, async (t) => {
  const { depot, verrou } = verrouDeBanc(t)
  const alertes = t.mock.method(console, 'error', () => {})
  await avecZombie(async (pid) => {
    const ancien = prendreVerrou({ ...verrou, pid, commande: 'tenant zombie du banc' })
    assert.equal(ancien.etat, 'pris')
    assert.ok(Number.isFinite(tenantDe(verrou.chemin).creation), 'le verrou porte la naissance mesurée')
    const debut = performance.now()
    const code = await sousGestesLourds({
      cwd: depot,
      env: {},
      argv: ['--perimes'],
      attente: { echeanceMs: 250, pasMs: 250 },
      geste: () => {
        assert.equal(estPidVivantDepuis(pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), true, 'le PID du zombie existe encore lors de la reprise')
        const courant = tenantDe(verrou.chemin)
        assert.equal(courant.pid, process.pid)
        assert.notEqual(courant.generation, ancien.generation)
        return 0
      },
    })
    const signaux = alertes.mock.calls.map(({ arguments: args }) => args[0])
    t.diagnostic(JSON.stringify({ pid, etat: 'Z', presence: true, code, ms: Math.round(performance.now() - debut), signaux }))
    assert.equal(code, 0)
    assert.deepEqual(signaux, [])
    assert.equal(existsSync(verrou.chemin), false)
  })
})

test('#4614 — une génération concurrente vivante reste intacte pendant la reprise du zombie', { skip: process.platform !== 'linux' }, async (t) => {
  const { verrou } = verrouDeBanc(t)
  await avecZombie((pid) => {
    const ancien = prendreVerrou({ ...verrou, pid })
    assert.equal(ancien.etat, 'pris')
    const concurrent = { pid: process.pid, creation: performance.timeOrigin, generation: 'concurrente' }
    const brut = JSON.stringify(concurrent)
    const provisoire = verrou.chemin + '.concurrent'
    fs.writeFileSync(provisoire, brut)
    let reprises = 0
    const debut = performance.now()
    const vu = prendreVerrou({
      ...verrou,
      attente: undefined,
      fs: { ...fs, linkSync(source, cible) {
        if (cible === verrou.chemin + '.reprise') {
          reprises += 1
          fs.renameSync(provisoire, verrou.chemin)
        }
        return fs.linkSync(source, cible)
      } },
    })
    t.diagnostic(JSON.stringify({ reprises, etat: vu.etat, generation: vu.tenant?.generation, ms: Math.round(performance.now() - debut) }))
    assert.equal(reprises, 1)
    assert.equal(vu.etat, 'refus')
    assert.equal(vu.tenant.generation, concurrent.generation)
    assert.equal(fs.readFileSync(verrou.chemin, 'utf8'), brut)
  })
})

test('#4614 — la prise asynchrone distingue un tenant vivant d’une ancienne naissance du même PID', { skip: process.platform !== 'linux' }, async (t) => {
  const { verrou } = verrouDeBanc(t)
  const creation = verrou.identite.lireCreation(process.pid)
  assert.ok(Number.isFinite(creation))
  const tenant = { pid: process.pid, creation, generation: 'ancienne' }
  const options = { ...verrou, attente: undefined }
  fs.writeFileSync(verrou.chemin, JSON.stringify(tenant))
  const debut = performance.now()
  const vivant = await prendreVerrouAsync(options)
  const vivantMs = Math.round(performance.now() - debut)
  assert.equal(vivant.etat, 'refus')
  assert.deepEqual(tenantDe(verrou.chemin), tenant)
  fs.writeFileSync(verrou.chemin, JSON.stringify({ ...tenant, creation: creation - 3_600_000 }))
  const debutReprise = performance.now()
  const reprise = await prendreVerrouAsync(options)
  t.diagnostic(JSON.stringify({ vivant: vivant.etat, vivantMs, reutilise: reprise.etat, reutiliseMs: Math.round(performance.now() - debutReprise) }))
  assert.equal(reprise.etat, 'pris')
  assert.notEqual(reprise.generation, tenant.generation)
  assert.equal(tenantDe(verrou.chemin).generation, reprise.generation)
  reprise.liberer()
})

test('#4614 — preuve Linux indéterminée, identité illisible et accès refusé conservent le tenant présent', (t) => {
  const { depot, verrou } = verrouDeBanc(t)
  const brut = JSON.stringify({ pid: process.pid, generation: 'presente' })
  fs.writeFileSync(verrou.chemin, brut)
  const refuse = t.mock.method(process, 'kill', () => {
    throw Object.assign(new Error('signal zéro refusé'), { code: 'EPERM' })
  })
  const zombie = { pid: process.pid, etat: 'Z', erreurs: [] }
  const lectures = [
    ['mesure indéterminée', () => ({ indeterminee: 'échéance', processus: [zombie] })],
    ['identité illisible', () => ({ processus: [{ ...zombie, erreurs: ['identite illisible : [instable] identité modifiée'] }] })],
    ['accès refusé', () => { throw Object.assign(new Error('lecture refusée'), { code: 'EACCES' }) }],
    ['autre plateforme', () => ({ processus: [zombie] })],
  ]
  for (const [cas, lire] of lectures) {
    const plateforme = cas === 'autre plateforme' ? 'darwin' : 'linux'
    const mesurer = t.mock.fn(lire)
    const options = verrouGestesLourds(depot, { plateforme, mesurer })
    const vu = prendreVerrou({ ...options, attente: undefined })
    assert.equal(vu.etat, 'refus', cas)
    assert.equal(fs.readFileSync(verrou.chemin, 'utf8'), brut, cas)
    assert.equal(mesurer.mock.callCount(), plateforme === 'linux' ? 1 : 0, cas)
  }
  assert.deepEqual(refuse.mock.calls.map(({ arguments: args }) => args), lectures.map(() => [process.pid, 0]))
})
