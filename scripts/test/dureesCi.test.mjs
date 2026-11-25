// Banc des durées de la CI (#2497) : extraits RÉELS de `gh run view <id> --log` sous `fixtures/`, gh injecté.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'
import { DUREES_CI, dureesDuJournal, memoCiDe, rapatrierDureesCi } from './dureesCi.mjs'

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

test('dureesDuJournal : les `[durees] node` des parties d’une gate (job matrice `types-hooks i/K`, #5037) se FUSIONNENT ; leur `[partie]` n’est pas celle de la suite', () => {
  const partie = (i, fichiers) => [
    `types-hooks ${i}/2\tUNKNOWN STEP\t2026-11-25T08:00:00.0000000Z [partie] ${i}/2 : 1 fichier(s) sur 2 · empreinte 0 · liste 0`,
    `types-hooks ${i}/2\tUNKNOWN STEP\t2026-11-25T08:09:00.0000000Z [durees] node test:hooks ${JSON.stringify(fichiers)}`,
  ]
  const lu = dureesDuJournal([...partie(1, { 'scripts/hooks/a.test.mjs': 7 }), ...partie(2, { 'scripts/guards/b.test.mjs': 9 })].join('\n'))
  assert.deepEqual(lu.node, { 'scripts/hooks/a.test.mjs': 7, 'scripts/guards/b.test.mjs': 9 })
  assert.deepEqual([lu.parties, lu.manquantes, lu.attendus], [[], [], 0])
})

test('memoCiDe : la forme `{ run, attempt, sha, date, vitest, node }`, durées finies ≥ 0 ; toute autre forme rend {}', () => {
  const memo = { run: 7, attempt: 1, sha: 'abc', date: '2026-10-08T03:48:31Z', vitest: { 'src/a.test.ts': 5, 'src/b.test.ts': -1 }, node: { 'scripts/n.test.mjs': 'lent' } }
  assert.deepEqual(memoCiDe(memo), { ...memo, vitest: { 'src/a.test.ts': 5 }, node: {} })
  for (const invalide of [null, [], 42, { ...memo, run: '7' }, { ...memo, attempt: 1.5 }, { ...memo, sha: null }, { ...memo, date: 3 }])
    assert.deepEqual(memoCiDe(invalide), {}, JSON.stringify(invalide))
})

/** Les courses REST, les jobs et l’archive d’un essai, avec les appels `gh` observables. */
const vueDuJournal = (journal) => {
  const journaux = new Map()
  for (const ligne of journal.split('\n')) {
    const [job, , ...texte] = ligne.split('\t')
    if (!journaux.has(job)) journaux.set(job, [])
    journaux.get(job).push(texte.join('\t'))
  }
  const jobs = [...journaux.keys()].map((name) => ({ name, conclusion: 'success', steps: [{ number: 1, name: 'Run npm test', conclusion: 'success' }] }))
  const fichiers = Object.fromEntries([...journaux].map(([nom, lignes], i) => [`${i}_${nom.replaceAll('/', '_')}.txt`, strToU8(lignes.join('\n'))]))
  return { jobs, archive: Buffer.from(zipSync(fichiers)) }
}

const ghDe = ({ courses, journal = JOURNAL, statut = 0, statutJournal = 0, vues = {} }) => {
  const appels = []
  const vueParDefaut = vueDuJournal(journal)
  const spawn = (cmd, args) => {
    appels.push(args.join(' '))
    if (args[1].includes('/actions/workflows/')) {
      if (statut !== 0) return { status: statut, stdout: '', stderr: 'gh: réseau indisponible' }
      return { status: 0, stdout: JSON.stringify({ total_count: courses.length, workflow_runs: courses }), stderr: '' }
    }
    if (args[0] === 'run') {
      const { jobs = vueParDefaut.jobs, statutJobs = 0 } = vues[args[2]] ?? {}
      if (statutJobs !== 0) return { status: statutJobs, stdout: '', stderr: 'gh: jobs inaccessibles (HTTP 403)' }
      return { status: 0, stdout: JSON.stringify({ status: 'completed', jobs }), stderr: '' }
    }
    const vue = vues[args[1].split('/')[5]]
    const statutArchive = vue?.statutJournal ?? statutJournal
    if (statutArchive !== 0) return { status: statutArchive, stdout: '', stderr: 'gh: jeton expiré (HTTP 403)' }
    return { status: 0, stdout: vue?.journal ? vueDuJournal(vue.journal).archive : vueParDefaut.archive, stderr: '' }
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

test('rapatrierDureesCi : aucune course merge_group réussie, indisponibilité nommée sans écriture', () => {
  const mesures = mesuresEnMemoire(ANCIEN)
  const { spawn, appels } = ghDe({ courses: COURSES.slice(2) })
  assert.deepEqual(rapatrierDureesCi({ mesures, spawn }), {
    disponible: false, raison: 'aucune course merge_group réussie parmi les 1 dernières', issue: 'mesure',
  })
  assert.equal(appels.length, 1)
  assert.deepEqual([mesures.etat[DUREES_CI], mesures.etat.remplacements], [ANCIEN, 0])
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

const COURSE_MESUREE = { ...COURSES[1], id: 44854319204, run_attempt: 1 }
const DOCUMENTAIRES = [44857392193, 44855152676].map((id, i) => ({
  ...COURSE_MESUREE, id, created_at: `2026-10-08T0${6 - i}:00:00Z`,
}))

const SUITES_SAUTEES = Array.from({ length: 3 }, (_, i) => ({
  name: `suite ${i + 1}/3`, conclusion: 'success', steps: [{ number: 1, name: 'Run npm test', conclusion: 'skipped' }],
}))
const JOURNAL_DOCUMENTAIRE = SUITES_SAUTEES.map(({ name }) => `${name}\tUNKNOWN STEP\t2026-10-08T05:02:00Z Prologue`).join('\n')
const JOURNAL_MESURE = SUITES_SAUTEES.flatMap(({ name }, i) => [
  `${name}\tUNKNOWN STEP\t2026-10-08T04:02:00Z [partie] ${i + 1}/3 : 1 fichier(s) sur 3`,
  `${name}\tUNKNOWN STEP\t2026-10-08T04:02:01Z  ✓ src/suite-${i + 1}.test.ts (1 test) 105ms`,
]).join('\n')
const VUES_DOCUMENTAIRES = Object.fromEntries(DOCUMENTAIRES.map(({ id }) => [id, { jobs: SUITES_SAUTEES, journal: JOURNAL_DOCUMENTAIRE }]))
const HISTORIQUE = [COURSE_MESUREE, ...DOCUMENTAIRES]
const APPELS_DOCUMENTAIRES = DOCUMENTAIRES.map(({ id }) => `run view ${id} --attempt 1 --json jobs,startedAt,status`)
const APPEL_MESUREE = `run view ${COURSE_MESUREE.id} --attempt 1 --json jobs,startedAt,status`
const ARCHIVE_MESUREE = `api repos/MyEdO/game/actions/runs/${COURSE_MESUREE.id}/attempts/1/logs`

test('rapatrierDureesCi : deux vertes documentaires, une seule archive à froid et aucune à chaud', () => {
  const mesures = mesuresEnMemoire(undefined)
  const froid = ghDe({ courses: HISTORIQUE, journal: JOURNAL_MESURE, vues: VUES_DOCUMENTAIRES })
  const rendu = rapatrierDureesCi({ mesures, spawn: froid.spawn })
  assert.equal(rendu.valeur?.etat, 'rapatrie', JSON.stringify(rendu))
  const { memo } = rendu.valeur
  assert.deepEqual([memo.run, memo.attempt, Object.keys(memo.vitest).length], [COURSE_MESUREE.id, 1, 3])
  assert.deepEqual([mesures.etat[DUREES_CI], mesures.etat.remplacements], [memo, 1])
  assert.match(froid.appels[0], /^api repos\/MyEdO\/game\/actions\/workflows\/ci\.yml\/runs\?event=merge_group&/)
  assert.deepEqual(froid.appels.slice(1), [...APPELS_DOCUMENTAIRES, APPEL_MESUREE, ARCHIVE_MESUREE])

  const chaud = ghDe({ courses: HISTORIQUE, vues: VUES_DOCUMENTAIRES })
  assert.deepEqual(rapatrierDureesCi({ mesures, spawn: chaud.spawn }), { disponible: true, valeur: { etat: 'deja', memo } })
  assert.deepEqual([chaud.appels, mesures.etat.remplacements], [[froid.appels[0], ...APPELS_DOCUMENTAIRES], 1])
})

test('rapatrierDureesCi : toutes les vertes sans mesure dans la fenêtre bornée, aucune archive ni écriture', () => {
  const mesures = mesuresEnMemoire(ANCIEN)
  const { spawn, appels } = ghDe({ courses: DOCUMENTAIRES, vues: VUES_DOCUMENTAIRES })
  assert.deepEqual(rapatrierDureesCi({ mesures, spawn }), { disponible: true, valeur: {
    etat: 'refus', raison: 'aucune référence CI mesurée parmi les 2 courses merge_group réussies : tranches Vitest toutes explicitement sautées',
  } })
  assert.match(appels[0], /[?&]per_page=30(?:&|$)/)
  assert.deepEqual([appels.slice(1), mesures.etat[DUREES_CI], mesures.etat.remplacements], [APPELS_DOCUMENTAIRES, ANCIEN, 0])
})

test('rapatrierDureesCi : accès aux jobs ou à l’archive indisponible, arrêt sans détour ni écriture', () => {
  const mesures = mesuresEnMemoire(ANCIEN)
  const jobsInaccessibles = ghDe({ courses: HISTORIQUE, vues: { [DOCUMENTAIRES[0].id]: { statutJobs: 1 } } })
  const jobs = rapatrierDureesCi({ mesures, spawn: jobsInaccessibles.spawn })
  assert.deepEqual([jobs.disponible, jobs.raison, jobsInaccessibles.appels.slice(1)], [
    false, 'gh: jobs inaccessibles (HTTP 403)', APPELS_DOCUMENTAIRES.slice(0, 1),
  ])

  const archiveInaccessible = ghDe({ courses: HISTORIQUE, statutJournal: 1, vues: VUES_DOCUMENTAIRES })
  const archive = rapatrierDureesCi({ mesures, spawn: archiveInaccessible.spawn })
  assert.deepEqual([archive.disponible, archive.raison, archiveInaccessible.appels.slice(1)], [
    false, 'gh: jeton expiré (HTTP 403)', [...APPELS_DOCUMENTAIRES, APPEL_MESUREE, ARCHIVE_MESUREE],
  ])
  assert.deepEqual([mesures.etat[DUREES_CI], mesures.etat.remplacements], [ANCIEN, 0])
})

test('rapatrierDureesCi : journal tronqué après les documentaires, refus avant la verte suivante', () => {
  const mesures = mesuresEnMemoire(ANCIEN)
  const plusAncienne = { ...COURSE_MESUREE, id: 8, created_at: '2026-10-08T03:30:00Z' }
  const journal = JOURNAL_MESURE.split('\n').filter((ligne) => !ligne.includes('src/suite-2.test.ts')).join('\n')
  const vues = { ...VUES_DOCUMENTAIRES, [COURSE_MESUREE.id]: { journal } }
  const { spawn, appels } = ghDe({ courses: [...HISTORIQUE, plusAncienne], journal: JOURNAL_MESURE, vues })
  assert.deepEqual(rapatrierDureesCi({ mesures, spawn }), { disponible: true, valeur: {
    etat: 'refus', raison: `course ${COURSE_MESUREE.id} : 2 durée(s) Vitest lue(s) pour 3 fichier(s) annoncé(s)`,
  } })
  assert.deepEqual(appels.slice(1), [...APPELS_DOCUMENTAIRES, APPEL_MESUREE, ARCHIVE_MESUREE])
  assert.deepEqual([mesures.etat[DUREES_CI], mesures.etat.remplacements], [ANCIEN, 0])
})

test('rapatrierDureesCi : seules des métadonnées de tranches complètes et explicites permettent un saut', () => {
  const [premiere, deuxieme, troisieme] = SUITES_SAUTEES
  const cas = [
    ['pas de tranches', []],
    ['tranche manquante', [premiere, deuxieme]],
    ['tranche répétée', [premiere, deuxieme, deuxieme]],
    ['totaux différents', [premiere, deuxieme, { ...troisieme, name: 'suite 3/4' }]],
    ['étape manquante', [premiere, deuxieme, { ...troisieme, steps: [] }]],
    ['étape répétée', [premiere, deuxieme, { ...troisieme, steps: [...troisieme.steps, ...troisieme.steps] }]],
    ['étape exécutée', [premiere, deuxieme, { ...troisieme, steps: [{ ...troisieme.steps[0], conclusion: 'success' }] }]],
  ]
  const mesures = mesuresEnMemoire(ANCIEN)
  const { id } = DOCUMENTAIRES[0]
  for (const [nom, jobs] of cas) {
    const { spawn, appels } = ghDe({ courses: HISTORIQUE, statutJournal: 1, vues: { [id]: { jobs } } })
    const rendu = rapatrierDureesCi({ mesures, spawn })
    assert.deepEqual([rendu.disponible, rendu.raison, appels.slice(1)], [
      false, 'gh: jeton expiré (HTTP 403)', [APPELS_DOCUMENTAIRES[0], `api repos/MyEdO/game/actions/runs/${id}/attempts/1/logs`],
    ], nom)
  }
  assert.deepEqual([mesures.etat[DUREES_CI], mesures.etat.remplacements], [ANCIEN, 0])
})
