import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { projeterJournal } from './journauxCi.mjs'

const zip = (fichiers) => Buffer.from(zipSync(Object.fromEntries(Object.entries(fichiers).map(([nom, texte]) => [nom, strToU8(texte)]))))
const step = (number, name, conclusion = 'success') => ({ number, name, conclusion })
const job = (name, steps, conclusion = 'success', dates = {}) => ({ name, steps, conclusion, ...dates })
const options = { echecsSeuls: false, estRouge: (conclusion) => conclusion === 'failure', debutEssai: NaN }

test('journal complet : nom de job avec barre, texte groupé préféré aux étapes, retours Windows préservés en lignes', () => {
  const archive = zip({ '0_suite 1_3.txt': '\uFEFFpremière\r\n\r\nseconde\r\n', 'suite 1_3/1_tests.txt': 'doublon' })
  const jobs = [job('suite 1/3', [step(1, 'Tests')]), job('hôte absent', [], 'cancelled')]
  assert.equal(projeterJournal(archive, jobs, options), [
    'suite 1/3\tUNKNOWN STEP\t\uFEFFpremière', 'suite 1/3\tUNKNOWN STEP\t', 'suite 1/3\tUNKNOWN STEP\tseconde',
  ].join('\n'))
})

test('journal en échec : les étapes rouges par numéro ou le regroupement si une étape manque', () => {
  const jobs = [
    job('types', [step(1, 'Préparer'), step(3, 'Compiler', 'failure'), step(10, 'Contrôler', 'failure')], 'failure'),
    job('docs', [step(1, 'Construire')]),
  ]
  const rouge = { ...options, echecsSeuls: true }
  const archives = { '0_types.txt': 'texte regroupé', 'types/1_preparer.txt': 'préparé', 'types/3_compiler.txt': 'échec 1', '1_docs.txt': 'vert' }
  assert.equal(projeterJournal(zip({ ...archives, 'types/10_controle.txt': 'échec 2' }), jobs, rouge), [
    'types\tCompiler\téchec 1', 'types\tContrôler\téchec 2',
  ].join('\n'))
  assert.equal(projeterJournal(zip(archives), jobs, rouge), 'types\tUNKNOWN STEP\ttexte regroupé')
})

test('journal complet : les fichiers d’étape constituent le repli lorsque le journal groupé manque', () => {
  const jobs = [job('types', [step(1, 'Préparer'), step(2, 'Ignorer', 'skipped'), step(3, 'Compiler')])]
  const fichiers = { 'types/1_preparer.txt': 'préparé', 'types/3_compiler.txt': 'compilé' }
  assert.equal(projeterJournal(zip(fichiers), jobs, options), 'types\tPréparer\tpréparé\ntypes\tCompiler\tcompilé')
  assert.throws(() => projeterJournal(zip({ 'types/3_compiler.txt': 'compilé' }), jobs, options), /journal absent ou incomplet.*types/)
})

test('relance partielle : un job hérité a commencé et terminé avant le nouvel essai', () => {
  const debutEssai = Date.parse('2026-11-16T07:57:41Z')
  const herite = job('suite 1/3', [step(1, 'Tests')], 'success', {
    startedAt: '2026-11-16T07:42:48Z', completedAt: '2026-11-16T07:42:51Z',
  })
  const jobs = [herite, job('branche', [step(1, 'Branche')])]
  const archive = zip({ '0_branche.txt': 'relance' })
  assert.equal(projeterJournal(archive, jobs, { ...options, debutEssai }), 'branche\tUNKNOWN STEP\trelance')
  assert.throws(() => projeterJournal(archive, jobs, options), /journal absent ou incomplet.*suite 1\/3/)
  const encoreEnCours = { ...herite, completedAt: '2026-11-16T07:59:01Z' }
  assert.throws(() => projeterJournal(archive, [encoreEnCours, jobs[1]], { ...options, debutEssai }), /journal absent ou incomplet.*suite 1\/3/)
})

test('archives invalides, projections volumineuses et correspondances ambiguës sont refusées', () => {
  const jobs = [job('suite 1/3', [step(1, 'Tests')])]
  const archive = zip({ '0_suite 1_3.txt': 'texte' })
  assert.throws(() => projeterJournal(Buffer.from('HTTP 403'), jobs, options), /archive ZIP illisible/)
  assert.throws(() => projeterJournal(archive, [], options), /sans journal de job exploitable/)
  assert.throws(() => projeterJournal(archive, jobs, { ...options, borne: 4 }), /archive ZIP trop volumineuse/)
  assert.throws(() => projeterJournal(archive, jobs, { ...options, borne: 20 }), /journal projeté trop volumineux/)
  assert.throws(() => projeterJournal(archive, [...jobs, job('suite 1_3', [])], options), /journal ambigu/)
  const double = zip({ '0_suite 1_3.txt': 'premier', '1_suite 1_3.txt': 'second' })
  assert.throws(() => projeterJournal(double, jobs, options), /plusieurs fichiers du journal/)
  assert.equal(projeterJournal(archive, jobs, { ...options, echecsSeuls: true }), '')
})
