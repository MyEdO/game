// La sonde de pid `estPidVivant` / `estPidDeProcessus` (#2516) : un pid hors de l'int32 positif n'est jamais
// sondé ; ESRCH, EPERM et toute autre erreur de `process.kill(pid, 0)` portés par une sonde injectée.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estPidDeProcessus, estPidVivant } from './pid.mjs'
import { constructionsReserveesDuCorpus, scanConstructionsReservees, SONDE_D_EXISTENCE } from './canonUnique.mjs'
import { corpusDesGardes } from './commentPoison.mjs'

/** Une erreur de sonde au `code` donné, telle que `process.kill` la lève. */
const erreurDeSonde = (code) => Object.assign(new Error(code), { code })

const INVALIDES = [0, -1, 1.5, Number.NaN, '123', String(process.pid), null, undefined, 2 ** 31, Number.MAX_SAFE_INTEGER]

// #2516
test('estPidVivant : seul un entier de l’int32 strictement positif désigne un processus, sans sonde sinon', () => {
  const sondes = []
  const sonder = (pid) => { sondes.push(pid) }
  for (const pid of INVALIDES) {
    assert.equal(estPidDeProcessus(pid), false, String(pid))
    assert.equal(estPidVivant(pid, { sonder }), false, String(pid))
    assert.equal(estPidVivant(pid), false, `${pid} : sonde réelle`)
  }
  assert.deepEqual(sondes, [], 'aucune sonde pour un pid invalide')
  assert.equal(estPidDeProcessus(2 ** 31 - 1), true)
  assert.equal(estPidVivant(2 ** 31 - 1, { sonder }), true)
  assert.deepEqual(sondes, [2 ** 31 - 1])
  assert.equal(estPidVivant(process.pid), true)
})

// #2516
test('estPidVivant : ESRCH = mort, EPERM = vivant, toute autre erreur remonte telle quelle', () => {
  assert.equal(estPidVivant(7, { sonder: () => { throw erreurDeSonde('ESRCH') } }), false)
  assert.equal(estPidVivant(7, { sonder: () => { throw erreurDeSonde('EPERM') } }), true)
  assert.throws(() => estPidVivant(7, { sonder: () => { throw erreurDeSonde('EINVAL') } }), (e) => e.code === 'EINVAL')
})

// ── La sonde d'existence a UN foyer ────────────────────────────────────────────────────────────────

const SONDE = { ...SONDE_D_EXISTENCE, foyer: 'scripts/guards/lib/pid.mjs' }

// #2516
test('SONDE_D_EXISTENCE : aucun `kill(<pid>, 0)` hors de `estPidVivant`', () => {
  assert.deepEqual(constructionsReserveesDuCorpus(corpusDesGardes(), [SONDE]), [])
})

// #2516
test('SONDE_D_EXISTENCE : une sonde neuve hors du foyer est un site, la même dans le foyer ne l’est pas ; un signal réel n’en est pas une', () => {
  const vu = (text, rel = 'scripts/fixture.mjs') => scanConstructionsReservees({ rel, text }, [SONDE]).map((t) => t.construction)
  assert.deepEqual(vu('process.kill(pid, 0)'), ['SONDE_D_EXISTENCE'])
  assert.deepEqual(vu("process.kill(pid, '0')"), ['SONDE_D_EXISTENCE'])
  assert.deepEqual(vu('const { kill } = process\nkill(pid, (0))'), ['SONDE_D_EXISTENCE'])
  assert.deepEqual(vu('process.kill(pid, 0)', 'scripts/guards/lib/pid.test.mjs'), ['SONDE_D_EXISTENCE'])
  assert.deepEqual(vu("process.kill(pid, 'SIGKILL')"), [])
  assert.deepEqual(vu('enfant.kill()'), [])
  assert.deepEqual(vu('process.kill(pid, 0)', 'scripts/guards/lib/pid.mjs'), [])
})
