// Contrat du verrou machine des gestes lourds (#2603) : identité mesurée, preneur `build-all`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { prendreVerrou } from './verrou.mjs'
import { estGesteLourd, lanceUnGesteLourd, verrouGestesLourds } from './verrouGestesLourds.mjs'
import { SOURCES_LUES } from '../docs/build-all.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'

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
