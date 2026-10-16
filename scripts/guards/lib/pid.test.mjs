// La sonde de pid `estPidVivant` / `estPidDeProcessus` (#2516) : un pid hors de l'int32 positif n'est jamais
// sondé ; ESRCH, EPERM et toute autre erreur de `process.kill(pid, 0)` portés par une sonde injectée.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creationMemorisee, estPidDeProcessus, estPidVivant, estPidVivantDepuis } from './pid.mjs'
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

// #2603
test('estPidVivantDepuis : pid invalide ou ESRCH mort sans mesure ; mesure indéterminée vivante ; création au-delà de naissance + tolérance = pid réutilisé, mort', () => {
  const mesures = []
  const identite = (creation) => ({ toleranceMs: 1_000, lireCreation: (pid) => { mesures.push(pid); return creation } })
  for (const pid of INVALIDES) assert.equal(estPidVivantDepuis(pid, 5_000, identite(5_000)), false, String(pid))
  const esrch = (pid) => estPidVivant(pid, { sonder: () => { throw erreurDeSonde('ESRCH') } })
  assert.equal(estPidVivantDepuis(7, 5_000, identite(5_000), { estVivant: esrch }), false)
  assert.deepEqual(mesures, [], 'un mort ne se mesure pas')
  const vivant = () => true
  assert.equal(estPidVivantDepuis(7, 5_000, identite(null), { estVivant: vivant }), true)
  assert.equal(estPidVivantDepuis(7, 5_000, identite(6_000), { estVivant: vivant }), true)
  assert.equal(estPidVivantDepuis(7, 5_000, identite(6_001), { estVivant: vivant }), false)
  assert.deepEqual(mesures, [7, 7, 7])
})

// #2603
test('creationMemorisee : un pid réutilisé à t = 1 s est vu mort à t = `pasMs`, pas avant', () => {
  let t = 0
  let creation = 5_000
  let lectures = 0
  const lireCreation = creationMemorisee(() => { lectures += 1; return creation }, { pasMs: 60_000, horloge: () => t })
  const juge = () => `${t}:${estPidVivantDepuis(7, 5_000, { lireCreation, toleranceMs: 0 }, { estVivant: () => true })}`
  const vu = [juge()]
  creation = 30_000
  for (t of [1_000, 59_999, 60_000]) vu.push(juge())
  assert.deepEqual(vu, ['0:true', '1000:true', '59999:true', '60000:false'])
  assert.equal(lectures, 2)
})

// #2603
test('creationMemorisee : la mesure est gardée par `cle`, le pid par défaut', () => {
  let lectures = 0
  const lireCreation = creationMemorisee(() => { lectures += 1; return 1 }, { pasMs: 60_000, horloge: () => 0 })
  lireCreation(7, 'a')
  lireCreation(7, 'a')
  lireCreation(7, 'b')
  lireCreation(7)
  assert.equal(lectures, 3)
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
