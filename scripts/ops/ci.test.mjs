// L'attente de la CI d'un sha (#2280, V1) : un processus qui SORT sur un verdict, un code par verdict,
// et un rouge qui nomme ses tests en échec.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BORNE_ABSENTE_MIN, BORNE_ATTENTE_MIN, CODES_DE_CI, CODE_PANNE, attendreLaCi, echecsDeLaCourse, ligneDeCi, lignesDuRouge, optionsDe, shaPousse, urlDeCourse,
} from './ci.mjs'
import { depotDe } from '../guards/lib/gitPorte.mjs'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { gitDe, lancerGit } from '../test/gitDeBanc.mjs'
import { CODE_BORNE_DEPASSEE } from './publier.mjs'
import { PERIODE_SONDE_MS } from './etapesDuTrain.mjs'
import { DELAI_DE_REPONSE_MINUTES } from './ruleset-main.mjs'

const SHA = 'a'.repeat(40)
const course = (status, conclusion = '', id = 41, attempt = 1) => ({ headSha: SHA, workflowName: 'CI', status, conclusion, databaseId: id, attempt })
const lu = (...courses) => ({ disponible: true, valeur: courses })

/** Une attente jouée sur une suite de lectures, horloge FACTICE : chaque sommeil avance le temps. */
function joue(lectures, opts = {}) {
  let t = 0
  let rang = 0
  const lignes = []
  const sommeils = []
  const verdict = attendreLaCi({
    sha: SHA,
    lire: () => lectures[Math.min(rang++, lectures.length - 1)],
    ecrire: (l) => lignes.push(l),
    maintenant: () => t,
    dormir: (ms) => { sommeils.push(ms); t += ms },
    ...opts,
  })
  return { verdict, lignes, sommeils, lectures: rang }
}

test('optionsDe : `--attendre [<sha complet>]` ou `--echecs <run>`, rien d’autre', () => {
  assert.deepEqual(optionsDe(['--attendre']), { attendre: true, sha: null })
  assert.deepEqual(optionsDe(['--attendre', SHA]), { attendre: true, sha: SHA })
  assert.deepEqual(optionsDe(['--echecs', '36344944731']), { echecs: 36344944731 })
  for (const argv of [[], ['--attendre', 'abc123'], ['--attendre', SHA, 'x'], ['--echecs'], ['--echecs', '0'], ['--echecs', '-1'], ['--veiller']])
    assert.equal(optionsDe(argv), null, argv.join(' '))
})

test('les bornes sont NOMMÉES : la période de la sonde du train, le délai de réponse de la file, 5 min d’absence', () => {
  assert.equal(BORNE_ATTENTE_MIN, DELAI_DE_REPONSE_MINUTES)
  assert.equal(BORNE_ABSENTE_MIN, 5)
  assert.equal(CODES_DE_CI.borne, CODE_BORNE_DEPASSEE)
  const codes = Object.values(CODES_DE_CI)
  assert.equal(new Set([...codes, CODE_PANNE]).size, codes.length + 1, 'un code par verdict, la panne à part')
  assert.equal(CODES_DE_CI.verte, 0)
})

test('attendreLaCi : en vol puis VERTE — une ligne par CHANGEMENT d’état, un sommeil d’une période entre deux lectures', () => {
  const { verdict, lignes, sommeils } = joue([lu(), lu(course('queued')), lu(course('in_progress')), lu(course('in_progress')), lu(course('completed', 'success'))])
  assert.equal(verdict.etat, 'verte')
  assert.deepEqual(lignes, [
    `[ci] ${SHA.slice(0, 9)} absente`,
    `[ci] ${SHA.slice(0, 9)} en-vol — ${urlDeCourse(41)} (essai 1)`,
    `[ci] ${SHA.slice(0, 9)} verte — ${urlDeCourse(41)} (essai 1)`,
  ])
  assert.deepEqual(sommeils, [PERIODE_SONDE_MS, PERIODE_SONDE_MS, PERIODE_SONDE_MS, PERIODE_SONDE_MS])
})

test('attendreLaCi : ROUGE et ANNULÉE terminent ; une RELANCE (`attempt`) se dit', () => {
  assert.equal(joue([lu(course('completed', 'failure'))]).verdict.etat, 'rouge')
  assert.equal(joue([lu(course('completed', 'cancelled'))]).verdict.etat, 'annulee')
  const relance = joue([lu(course('completed', 'failure', 41, 1)), lu(course('in_progress', '', 41, 2)), lu(course('completed', 'success', 41, 2))])
  assert.equal(relance.verdict.etat, 'rouge', 'le premier verdict final termine l’attente')
})

test('attendreLaCi : sans course, `absente` à BORNE_ABSENTE_MIN ; en vol sans fin, `borne` à BORNE_ATTENTE_MIN', () => {
  const absente = joue([lu()])
  assert.equal(absente.verdict.etat, 'absente')
  assert.equal(absente.sommeils.reduce((a, b) => a + b, 0), BORNE_ABSENTE_MIN * 60_000)
  const borne = joue([lu(course('in_progress'))])
  assert.equal(borne.verdict.etat, 'borne')
  assert.equal(borne.sommeils.reduce((a, b) => a + b, 0), BORNE_ATTENTE_MIN * 60_000, 'le dernier sommeil s’arrête à la borne')
})

test('attendreLaCi : une lecture INDISPONIBLE se dit et l’attente continue — jamais un verdict sur rien', () => {
  const { verdict, lignes } = joue([{ disponible: false, raison: 'gh: jeton expiré' }, lu(course('completed', 'success'))])
  assert.equal(verdict.etat, 'verte')
  assert.equal(lignes[0], `[ci] ${SHA.slice(0, 9)} courses illisibles : gh: jeton expiré`)
})

test('lignesDuRouge : par job ROUGE, son étape, ses lignes d’échec, le compte des tus ; un job absent du journal se dit tel', () => {
  assert.deepEqual(lignesDuRouge({
    jobs: ['suite', 'docs', 'types'],
    echecs: [
      { job: 'suite', etape: null, lignes: ['not ok 3 - x', '##[error]AssertionError: y'], tues: 4 },
      { job: 'docs', etape: 'Run npm run docs:build', lignes: ['docs:build — scripts/docs/check-doc-refs.mjs — sortie 1'], tues: 0 },
    ],
  }), [
    '  suite :',
    '    not ok 3 - x',
    '    ##[error]AssertionError: y',
    '    (+4 autres tests en échec)',
    '  docs — Run npm run docs:build :',
    '    docs:build — scripts/docs/check-doc-refs.mjs — sortie 1',
    '  types : absent du journal en échec (`gh run view --log-failed`)',
  ])
})

test('shaPousse : le sha poussé ; refus NOMMÉS pour une branche hors `push.branches`, non poussée, ou une origine illisible', () => {
  const amont = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'un' })
  const aval = mkdtempSync(join(tmpdir(), 'ci-pousse-'))
  try {
    lancerGit(['clone', '-q', '--no-local', amont.racine, aval])
    const g = gitDe(aval, { net: true })
    const depot = depotDe(aval, { env: envDeDepotForge() })
    const filtres = ['chantier/**', 'feat/**']
    g('switch', '-q', '-c', 'autre')
    assert.match(shaPousse({ depot, filtres }).refus, /la branche autre ne déclenche pas `ci\.yml`/, 'refusée d’emblée, sans attendre')
    g('switch', '-q', '-c', 'chantier/9')
    assert.deepEqual(shaPousse({ depot, filtres }), { refus: 'chantier/9 n’est pas poussée sur origin — rien à attendre' })
    g('push', '-q', 'origin', 'chantier/9')
    assert.deepEqual(shaPousse({ depot, filtres }), { sha: amont.sha })
    const muet = depotDe(aval, { env: envDeDepotForge(), spawn: (cmd, args, o) => (args.includes('ls-remote') ? { status: 2, stdout: '', stderr: '' } : spawnSync(cmd, args, o)) })
    assert.match(shaPousse({ depot: muet, filtres }).refus, /^origine illisible : /)
  } finally {
    rmSync(amont.racine, { recursive: true, force: true })
    rmSync(aval, { recursive: true, force: true })
  }
})

test('echecsDeLaCourse : les jobs rouges (`gh run view --json jobs`) croisés avec le journal en échec (`--log-failed`)', () => {
  const vus = []
  const spawn = (cmd, args) => {
    vus.push([cmd, ...args].join(' '))
    if (args.includes('--json')) return { status: 0, stderr: '', stdout: JSON.stringify({ jobs: [{ name: 'suite', conclusion: 'failure' }, { name: 'types', conclusion: 'success' }] }) }
    return { status: 0, stderr: '', stdout: 'suite\tUNKNOWN STEP\t2026-09-27T19:36:55.3049126Z not ok 1170 - un nom CITÉ À PLAT\n' }
  }
  assert.deepEqual(echecsDeLaCourse({ cwd: tmpdir(), id: 9, spawn }), { disponible: true, valeur: ['  suite :', '    not ok 1170 - un nom CITÉ À PLAT'] })
  assert.deepEqual(vus, ['gh run view 9 --json jobs', 'gh run view 9 --log-failed'])
  assert.equal(echecsDeLaCourse({ cwd: tmpdir(), id: 9, spawn: () => ({ status: 1, stdout: '', stderr: 'x' }) }).disponible, false)
})

test('ligneDeCi : la ligne finale `CI:` de chaque verdict', () => {
  assert.equal(ligneDeCi({ etat: 'verte', course: { databaseId: 41 } }, SHA), `CI: verte ${SHA} ${urlDeCourse(41)}`)
  assert.equal(ligneDeCi({ etat: 'absente' }, SHA), `CI: absente ${SHA} — aucune course en ${BORNE_ABSENTE_MIN} min`)
  assert.equal(ligneDeCi({ etat: 'borne' }, SHA), `CI: borne de ${BORNE_ATTENTE_MIN} min dépassée sans verdict pour ${SHA}`)
})

test('câblage : `ci.mjs --attendre <sha>` lit les courses par `coursesCi` et SORT sur le code du verdict', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'ci-attendre-'))
  try {
    for (const [conclusion, etat] of [['success', 'verte'], ['cancelled', 'annulee']]) {
      const stub = join(dossier, `${etat}.json`)
      writeFileSync(stub, JSON.stringify([course('completed', conclusion)]))
      const vu = spawnSync(process.execPath, [fileURLToPath(new URL('./ci.mjs', import.meta.url)), '--attendre', SHA], { encoding: 'utf8', env: { ...process.env, WFRP_GH_STUB: stub } })
      assert.equal(vu.status, CODES_DE_CI[etat], vu.stderr)
      assert.equal(vu.stdout.trim().split('\n').at(-1), `CI: ${etat} ${SHA} ${urlDeCourse(41)}`)
    }
    const refus = spawnSync(process.execPath, [fileURLToPath(new URL('./ci.mjs', import.meta.url)), '--attendre', 'court'], { encoding: 'utf8' })
    assert.equal(refus.status, CODE_PANNE)
    assert.match(refus.stderr, /usage/)
    const casse = join(dossier, 'casse.json')
    writeFileSync(casse, JSON.stringify([null, null]))
    const panne = spawnSync(process.execPath, [fileURLToPath(new URL('./ci.mjs', import.meta.url)), '--attendre', SHA], { encoding: 'utf8', env: { ...process.env, WFRP_GH_STUB: casse } })
    assert.equal(panne.status, CODE_PANNE, 'une exception non nommée est une PANNE, jamais le code du rouge')
    assert.match(panne.stderr, /^\[ci\] ARRÊT INATTENDU : TypeError/)
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})
