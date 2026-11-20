// Banc des durées de la CI (#2497) : extraits RÉELS de `gh run view <id> --log` sous `fixtures/`, gh injecté.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'
import { DUREES_CI, dureesDuJournal, memoCiDe, rapatrierDureesCi, referenceCi } from './dureesCi.mjs'

/** Course 37724465833 (file, verte, 2026-10-08) : les trois `[partie]`, une ligne de module ✓ avec « heap used », une
 *  ligne de TEST ✓ (indentée), l'appel d'une gate node. Course 37695241651 (rouge, 2026-10-07) : une ligne de module ❯
 *  en échec et une ligne de TEST × (indentée). Copiées telles quelles. */
const JOURNAL_VERT = readFileSync(new URL('./fixtures/journal-ci-37724465833.txt', import.meta.url), 'utf8').trimEnd()
const JOURNAL_ROUGE = readFileSync(new URL('./fixtures/journal-ci-37695241651.txt', import.meta.url), 'utf8').trimEnd()

/** La ligne `[durees] node` FABRIQUÉE à la forme qu'imprime `scripts/test/node-tests.mjs` (`ligneDeDurees`) : aucune
 *  course de CI ne la porte avant le premier run de file qui suit #2497. */
const LIGNE_NODE = 'docs-tests\tUNKNOWN STEP\t2026-10-08T03:49:03.0046616Z [durees] node test:docs {"scripts/docs/a.test.mjs":1234,"scripts/docs/b.test.mjs":56}'

const JOURNAL = [JOURNAL_VERT, JOURNAL_ROUGE, LIGNE_NODE].join('\n')

/** Un journal COMPLET de deux fichiers : la ligne `[partie]` FABRIQUÉE à la forme de `scripts/test/run.mjs` (1 partie,
 *  2 fichiers), les deux lignes de module réelles, la ligne node. */
const COMPLET = ['suite 1/1\tUNKNOWN STEP\t2026-10-08T03:49:44.2282517Z [partie] 1/1 : 2 fichier(s) sur 2 · empreinte 0 · liste 0',
  ...[JOURNAL_VERT, JOURNAL_ROUGE].join('\n').split('\n').filter((l) => !l.includes('[partie]')), LIGNE_NODE].join('\n')

test('dureesDuJournal : la ligne de MODULE ✓ ou ❯ (jamais celle d’un test), la `[durees] node` d’une gate, les `[partie]` attendues', () => {
  assert.deepEqual(dureesDuJournal(JOURNAL), {
    vitest: { 'src/noyau/combatFlow-los.test.ts': 2960, 'src/data/schemas/grammaire/op-defs.test.ts': 105 },
    node: { 'scripts/docs/a.test.mjs': 1234, 'scripts/docs/b.test.mjs': 56 },
    lus: 2,
    attendus: 645 + 638 + 615,
    parties: ['1/3', '2/3', '3/3'],
    manquantes: [],
    illisibles: [],
  })
  assert.deepEqual(dureesDuJournal(''), { vitest: {}, node: {}, lus: 0, attendus: 0, parties: [], manquantes: [], illisibles: [] })
})

test('memoCiDe : la forme `{ run, attempt, sha, date, vitest, node }`, durées finies ≥ 0 ; toute autre forme rend {}', () => {
  const memo = { run: 7, attempt: 1, sha: 'abc', date: '2026-10-08T03:48:31Z', vitest: { 'src/a.test.ts': 5, 'src/b.test.ts': -1 }, node: { 'scripts/n.test.mjs': 'lent' } }
  assert.deepEqual(memoCiDe(memo), { ...memo, vitest: { 'src/a.test.ts': 5 }, node: {} })
  for (const invalide of [null, [], 42, { ...memo, run: '7' }, { ...memo, attempt: 1.5 }, { ...memo, sha: null }, { ...memo, date: 3 }])
    assert.deepEqual(memoCiDe(invalide), {}, JSON.stringify(invalide))
})

/** Les courses REST, les jobs et l’archive d’un essai, avec les appels `gh` observables. */
const ghDe = ({ courses, journal = JOURNAL, statut = 0, statutJournal = 0 }) => {
  const appels = []
  const journaux = new Map()
  for (const ligne of journal.split('\n')) {
    const [job, , ...texte] = ligne.split('\t')
    if (!journaux.has(job)) journaux.set(job, [])
    journaux.get(job).push(texte.join('\t'))
  }
  const jobs = [...journaux.keys()].map((name) => ({ name, conclusion: 'success', steps: [{ number: 1, name: 'Tests', conclusion: 'success' }] }))
  const fichiers = Object.fromEntries([...journaux].map(([nom, lignes], i) => [`${i}_${nom.replaceAll('/', '_')}.txt`, strToU8(lignes.join('\n'))]))
  const archive = Buffer.from(zipSync(fichiers))
  const spawn = (cmd, args) => {
    appels.push(args.join(' '))
    if (args[1].includes('/actions/workflows/')) {
      if (statut !== 0) return { status: statut, stdout: '', stderr: 'gh: réseau indisponible' }
      return { status: 0, stdout: JSON.stringify({ total_count: courses.length, workflow_runs: courses }), stderr: '' }
    }
    if (args[0] === 'run') return { status: 0, stdout: JSON.stringify({ status: 'completed', jobs }), stderr: '' }
    if (statutJournal !== 0) return { status: statutJournal, stdout: '', stderr: 'gh: jeton expiré (HTTP 403)' }
    return { status: 0, stdout: archive, stderr: '' }
  }
  return { spawn, appels }
}

/** Des mesures en mémoire, de la forme de `mesuresDe` (`lire(nom, valider)`, `remplacer`). */
const mesuresEnMemoire = (memo) => {
  const etat = { [DUREES_CI]: memo, remplacements: 0 }
  return { etat, lire: (nom, valider) => valider(etat[nom]), remplacer: (nom, valeur) => { etat[nom] = valeur; etat.remplacements += 1 } }
}

const COURSES = [
  { id: 9, run_attempt: 1, status: 'in_progress', conclusion: null, created_at: '2026-10-08T05:00:00Z', head_sha: 'enVol' },
  { id: 8, run_attempt: 2, status: 'completed', conclusion: 'success', created_at: '2026-10-08T04:00:00Z', head_sha: 'vert' },
  { id: 7, run_attempt: 1, status: 'completed', conclusion: 'failure', created_at: '2026-10-08T03:00:00Z', head_sha: 'rouge' },
].map((course) => ({ name: 'CI', head_branch: 'gh-readonly-queue/main/pr-7-x', ...course }))
const ANCIEN = { run: 3, attempt: 1, sha: 'ancien', date: '2026-10-01T00:00:00Z', vitest: { 'src/disparu.test.ts': 10 }, node: {} }

test('referenceCi : la course merge_group RÉUSSIE la plus récente ; aucune : indisponible, nommée', () => {
  const { spawn, appels } = ghDe({ courses: COURSES })
  assert.equal(referenceCi({ spawn }).valeur.databaseId, 8)
  assert.match(appels[0], /^api repos\/MyEdO\/game\/actions\/workflows\/ci\.yml\/runs\?event=merge_group&/)
  assert.deepEqual(referenceCi({ spawn: ghDe({ courses: COURSES.slice(2) }).spawn }), { disponible: false, raison: 'aucune course merge_group réussie parmi les 1 dernières', issue: 'mesure' })
})

test('rapatrierDureesCi : le mémo est REMPLACÉ — une entrée disparue de la CI sort du mémo — par l’essai jugé de la course de référence', () => {
  const { spawn, appels } = ghDe({ courses: COURSES, journal: COMPLET })
  const mesures = mesuresEnMemoire({ ...ANCIEN, run: 8, attempt: 1 })
  const rendu = rapatrierDureesCi({ mesures, spawn })
  const memo = { run: 8, attempt: 2, sha: 'vert', date: '2026-10-08T04:00:00Z', vitest: { 'src/noyau/combatFlow-los.test.ts': 2960, 'src/data/schemas/grammaire/op-defs.test.ts': 105 }, node: { 'scripts/docs/a.test.mjs': 1234, 'scripts/docs/b.test.mjs': 56 } }
  assert.deepEqual(rendu, { disponible: true, valeur: { etat: 'rapatrie', memo } })
  assert.deepEqual(mesures.etat[DUREES_CI], memo)
  assert.deepEqual(appels.slice(1), [
    'run view 8 --attempt 2 --json jobs,startedAt,status',
    'api repos/MyEdO/game/actions/runs/8/attempts/2/logs',
  ])
})

test('rapatrierDureesCi : la course déjà mémorisée ne relit AUCUN journal', () => {
  const { spawn, appels } = ghDe({ courses: COURSES })
  const deja = { ...ANCIEN, run: 8, attempt: 2 }
  const mesures = mesuresEnMemoire(deja)
  assert.deepEqual(rapatrierDureesCi({ mesures, spawn }), { disponible: true, valeur: { etat: 'deja', memo: deja } })
  assert.deepEqual([appels.length, mesures.etat.remplacements], [1, 0])
})

test('rapatrierDureesCi : moins de durées Vitest lues que de fichiers annoncés, ou aucune : REFUS nommé, mémo inchangé', () => {
  const mesures = mesuresEnMemoire(ANCIEN)
  assert.deepEqual(rapatrierDureesCi({ mesures, spawn: ghDe({ courses: COURSES }).spawn }),
    { disponible: true, valeur: { etat: 'refus', raison: 'course 8 : 2 durée(s) Vitest lue(s) pour 1898 fichier(s) annoncé(s)' } })
  assert.deepEqual(rapatrierDureesCi({ mesures, spawn: ghDe({ courses: COURSES, journal: [COMPLET.split('\n')[0], LIGNE_NODE].join('\n') }).spawn }),
    { disponible: true, valeur: { etat: 'refus', raison: 'course 8 : aucune durée Vitest au journal' } })
  assert.deepEqual([mesures.etat[DUREES_CI], mesures.etat.remplacements], [ANCIEN, 0])
})

test('rapatrierDureesCi : gh indisponible, ou mémo non écrit : `{ disponible: false, raison }`, mémo inchangé', () => {
  const mesures = mesuresEnMemoire(ANCIEN)
  const horsLigne = rapatrierDureesCi({ mesures, spawn: ghDe({ courses: COURSES, statut: 1 }).spawn })
  assert.deepEqual([horsLigne.disponible, horsLigne.raison], [false, 'gh: réseau indisponible'])
  const journalRefuse = rapatrierDureesCi({ mesures, spawn: ghDe({ courses: COURSES, statutJournal: 1 }).spawn })
  assert.deepEqual([journalRefuse.disponible, journalRefuse.raison], [false, 'gh: jeton expiré (HTTP 403)'])
  assert.deepEqual([mesures.etat[DUREES_CI], mesures.etat.remplacements], [ANCIEN, 0])
  const verrouille = { ...mesuresEnMemoire(ANCIEN), remplacer: () => { throw new Error('verrou tenu') } }
  const journal = COMPLET
  assert.deepEqual(rapatrierDureesCi({ mesures: verrouille, spawn: ghDe({ courses: COURSES, journal }).spawn }),
    { disponible: false, raison: `mémo ${DUREES_CI} non écrit — verrou tenu`, issue: 'mesure' })
})

test('rapatrierDureesCi : un journal INCOMPLET est refusé, nommé — job de suite absent en entier (sonde du juge de diff), aucune [partie], ligne node illisible', () => {
  const mesures = mesuresEnMemoire(ANCIEN)
  const refus = (journal) => rapatrierDureesCi({ mesures, spawn: ghDe({ courses: COURSES, journal }).spawn }).valeur
  const sansSuite1 = JOURNAL.split('\n').filter((l) => !l.startsWith('suite 1/3\t')).join('\n')
  assert.deepEqual(refus(sansSuite1), { etat: 'refus', raison: 'course 8 : partie(s) absente(s) du journal : 1/3' })
  assert.deepEqual(refus(COMPLET.split('\n').filter((l) => !l.includes('[partie]')).join('\n')), { etat: 'refus', raison: 'course 8 : aucune ligne [partie] au journal' })
  assert.deepEqual(refus(`${COMPLET}\ntypes\tUNKNOWN STEP\t2026-10-08T03:51:00.0000000Z [durees] node test:ops {"scripts/ops/a.test.mjs":}`),
    { etat: 'refus', raison: 'course 8 : ligne [durees] node illisible : test:ops' })
  assert.deepEqual([mesures.etat[DUREES_CI], mesures.etat.remplacements], [ANCIEN, 0])
})
