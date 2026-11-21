// La sonde de pid `estPidVivant` / `estPidDeProcessus` (#2516) : un pid hors de l'int32 positif n'est jamais
// sondé ; ESRCH, EPERM et toute autre erreur de `process.kill(pid, 0)` portés par une sonde injectée.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NAISSANCE_ABSENTE, creationMemorisee, estPidDeProcessus, estPidVivant, estPidVivantDepuis } from './pid.mjs'
import { constructionsReserveesDuCorpus, scanConstructionsReservees, SONDE_D_EXISTENCE, VIE_SUR_PID_LU } from './canonUnique.mjs'
import { corpusTypeScriptDesGardes } from './commentPoison.mjs'

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
test('estPidVivantDepuis : `NAISSANCE_ABSENTE` juge l’existence seule, sans mesure ; toute autre naissance non finie LÈVE, même pour un pid mort', () => {
  const mesures = []
  const identite = { toleranceMs: 0, lireCreation: (pid) => { mesures.push(pid); return 9_999_999 } }
  assert.equal(estPidVivantDepuis(7, NAISSANCE_ABSENTE, identite, { estVivant: () => true }), true)
  assert.equal(estPidVivantDepuis(7, NAISSANCE_ABSENTE, identite, { estVivant: () => false }), false)
  assert.deepEqual(mesures, [], 'sans naissance, aucune mesure')
  for (const naissance of [undefined, null, Number.NaN, Infinity, '5000', Symbol('NAISSANCE_ABSENTE')]) {
    for (const estVivant of [() => true, () => false]) {
      assert.throws(() => estPidVivantDepuis(7, /** @type {any} */ (naissance), identite, { estVivant }), (e) => e instanceof TypeError && /NAISSANCE_ABSENTE/.test(e.message), String(naissance))
    }
  }
  assert.deepEqual(mesures, [])
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
  assert.deepEqual(constructionsReserveesDuCorpus(corpusTypeScriptDesGardes(), [SONDE]), [])
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

// ── Une vie jugée porte sa naissance ───────────────────────────────────────────────────────────────

/** Le foyer : la primitive et son test, qui sonde des pids forgés. */
const VIE = { ...VIE_SUR_PID_LU, foyer: ['scripts/guards/lib/pid.mjs', 'scripts/guards/lib/pid.test.mjs'] }

// #2603 #2586
test('VIE_SUR_PID_LU : aucun `estPidVivant` jugé sans naissance hors de `pid.mjs`', () => {
  assert.deepEqual(constructionsReserveesDuCorpus(corpusTypeScriptDesGardes(), [VIE]), [])
})

// #2603 #2586
test('VIE_SUR_PID_LU : un pid lu jugé nu hors du foyer est un site ; la sonde injectée à `estPidVivantDepuis` et un homonyme local n’en sont pas', () => {
  const imp = "import { estPidVivant, estPidVivantDepuis } from './guards/lib/pid.mjs'\n"
  const vu = (text, rel = 'scripts/fixture.mjs') => scanConstructionsReservees({ rel, text: imp + text }, [VIE]).map((t) => t.construction)
  assert.deepEqual(vu('estPidVivant(lu.pid)'), ['VIE_SUR_PID_LU'])
  assert.deepEqual(vu('pids.filter(estPidVivant)'), ['VIE_SUR_PID_LU'])
  assert.deepEqual(vu('export function f(lu, { estVivant = estPidVivant } = {}) { return estVivant(lu.pid) }'), ['VIE_SUR_PID_LU'])
  assert.deepEqual(vu('export function f(lu, { vivant: juge = estPidVivant } = {}) { return juge(lu.pid) }'), ['VIE_SUR_PID_LU'])
  assert.deepEqual(vu('export function f(lu, vivant = estPidVivant) { return vivant(lu.pid) }'), ['VIE_SUR_PID_LU'])
  const voisin = (rel) => scanConstructionsReservees({ rel, text: "import { estPidVivant } from './pid.mjs'\nestPidVivant(lu.pid)" }, [VIE]).map((t) => t.construction)
  assert.deepEqual(voisin('scripts/guards/lib/pid.mjs'), [])
  assert.deepEqual(voisin('scripts/guards/lib/pid.test.mjs'), [])
  assert.deepEqual(voisin('scripts/guards/lib/pidBis.test.mjs'), ['VIE_SUR_PID_LU'])
  assert.deepEqual(vu('export function f(lu, identite, { estVivant = estPidVivant } = {}) { return estPidVivantDepuis(lu.pid, Date.parse(lu.date), identite, { estVivant }) }'), [])
  assert.deepEqual(vu('export function f(lu, identite, { estVivant = estPidVivant } = {}) { return g(lu, identite, estVivant) }'), [])
  assert.deepEqual(vu('const estVivant = (x) => x !== null\nestVivant(lu.pid)'), [])
  assert.deepEqual(scanConstructionsReservees({ rel: 'scripts/fixture.mjs', text: 'const estPidVivant = () => true\nestPidVivant(lu.pid)' }, [VIE]), [])
})

const IMPORT_DE_SONDE = "import { estPidVivant as sonde, estPidVivantDepuis } from './guards/lib/pid.mjs'\n"

const sitesVie = (text) => scanConstructionsReservees({ rel: 'scripts/fixture.ts', text }, [VIE]).map(({ line }) => line)

test('VIE_SUR_PID_LU : objet littéral, alias, rappel et déstructuration gardent la provenance de la sonde', () => {
  const cas = [
    'const g = { estVivant: sonde }; const gestes = g; gestes.estVivant(lu.pid)',
    "const g = { sonde }; g['sonde'](lu.pid)",
    'const { vivre } = { vivre: sonde }; vivre(lu.pid)',
    'const g = { vivre: sonde }; pids.filter(g.vivre)',
  ]
  for (const usage of cas) assert.deepEqual(sitesVie(IMPORT_DE_SONDE + usage), [2], usage)
  assert.deepEqual(sitesVie(IMPORT_DE_SONDE + 'const g = { estVivant: (pid) => false }; g.estVivant(lu.pid)'), [])
  assert.deepEqual(sitesVie(IMPORT_DE_SONDE + 'const g = { estVivant: sonde, estVivant: () => false }; g.estVivant(lu.pid)'), [])
  assert.deepEqual(sitesVie(IMPORT_DE_SONDE + 'const g = { estVivant: sonde }; runEnVol(lu, identite, { estVivant: g.estVivant })'), [])
})

test('VIE_SUR_PID_LU : la dernière affectation de la liaison avant chaque appel fait foi', () => {
  const texte = `let juge = () => false
juge(lu.pid)
juge = sonde
juge(lu.pid)
{ const juge = () => false; juge(lu.pid) }
juge = () => false
juge(lu.pid)`
  assert.deepEqual(sitesVie(IMPORT_DE_SONDE + texte), [5])
})

test('VIE_SUR_PID_LU : une affectation d’un membre nommé change la provenance de l’appel', () => {
  const cas = [
    ['const g = { estVivant: () => false }; g.estVivant = sonde; g.estVivant(lu.pid)', [2]],
    ["const g = { estVivant: sonde }; g['estVivant'] = () => false; g.estVivant(lu.pid)", []],
    ['const g = { autres: {}, estVivant: sonde }; g.autres.estVivant = () => false; g.estVivant(lu.pid)', [2]],
    ['const g = { estVivant: sonde }; function ailleurs() { g.estVivant = () => false } g.estVivant(lu.pid)', [2]],
  ]
  for (const [usage, attendu] of cas) assert.deepEqual(sitesVie(IMPORT_DE_SONDE + usage), attendu, usage)
})

test('VIE_SUR_PID_LU : les blocs de suite appliquent l’écriture, les branches conservent les deux possibilités', () => {
  const cas = [
    ['let juge = () => false; { juge = sonde } juge(lu.pid)', [2]],
    ['let juge = sonde; { juge = () => false } juge(lu.pid)', []],
    ['let juge = sonde; if (cond) juge = () => false; juge(lu.pid)', [2]],
    ['let juge = () => false; if (cond) { juge = sonde } juge(lu.pid)', [2]],
    ['let juge = sonde; if (cond) { juge = () => false; juge(lu.pid) }', []],
    ['let juge = () => false; function ailleurs() { juge = sonde } juge(lu.pid)', []],
  ]
  for (const [usage, attendu] of cas) assert.deepEqual(sitesVie(IMPORT_DE_SONDE + usage), attendu, usage)
})

test('VIE_SUR_PID_LU : le défaut déstructuré ne remplace qu’un membre absent ou inconnu', () => {
  const cas = [
    ['const g = { estVivant: () => false }; const { estVivant = sonde } = g; estVivant(lu.pid)', []],
    ['const g = {}; const { estVivant = sonde } = g; estVivant(lu.pid)', [2]],
    ['const g = source(); const { estVivant = sonde } = g; estVivant(lu.pid)', [2]],
    ['const g = { estVivant: sonde }; const { estVivant = () => false } = g; estVivant(lu.pid)', [2]],
    ['const g = { estVivant: sonde }; g.estVivant = () => false; const { estVivant = sonde } = g; estVivant(lu.pid)', []],
  ]
  for (const [usage, attendu] of cas) assert.deepEqual(sitesVie(IMPORT_DE_SONDE + usage), attendu, usage)
})

test('VIE_SUR_PID_LU : les réexports ESM de la sonde sont détectés même sans son nom dans le texte', () => {
  const cas = [
    IMPORT_DE_SONDE + 'export { sonde }',
    IMPORT_DE_SONDE + 'const juge = sonde; export { juge as public }',
    IMPORT_DE_SONDE + 'export const juge = sonde',
    IMPORT_DE_SONDE + 'export default sonde',
    "export { estPidVivant as public } from './guards/lib/pid.mjs'",
    "export * from './guards/lib/pid.mjs'",
    "export * as public from './guards/lib/pid.mjs'",
    "import * as ns from './guards/lib/pid.mjs'\nexport { ns }",
  ]
  for (const texte of cas) assert.deepEqual(sitesVie(texte), [texte.split('\n').length], texte)
  const sains = [
    "export type { estPidVivant } from './guards/lib/pid.mjs'",
    "export { type estPidVivant, estPidVivantDepuis } from './guards/lib/pid.mjs'",
    "export type * as public from './guards/lib/pid.mjs'",
    "import type { estPidVivant as sonde } from './guards/lib/pid.mjs'\nexport type { sonde }",
    "import type { estPidVivant as sonde } from './guards/lib/pid.mjs'\nexport { sonde }",
    IMPORT_DE_SONDE + 'export { estPidVivantDepuis }; export function autre(sonde) { sonde(lu.pid) }',
  ]
  for (const texte of sains) assert.deepEqual(sitesVie(texte), [], texte)
})
