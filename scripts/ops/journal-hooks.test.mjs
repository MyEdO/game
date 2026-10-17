// Lecteur du journal des hooks git (#2603) : appariement des veilles, chevauchement, runs, statistiques.
//   node --test scripts/ops/journal-hooks.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chevauchement, executer, fenetresDeVeille, runsDuJournal, statistiques } from './journal-hooks.mjs'

const T = (hh) => Date.parse(`2026-10-12T${hh}:00.000Z`)

test('veille : 506→507 apparié, 507 sans 506 depuis la fenêtre précédente, 506 sans 507 jusqu’à maintenant', () => {
  assert.deepEqual(fenetresDeVeille([{ id: 507, t: T('09:30') }, { id: 506, t: T('07:53') }], T('12:00')), [{ de: T('07:53'), a: T('09:30') }])
  assert.deepEqual(fenetresDeVeille([{ id: 507, t: T('01:00') }], T('12:00')), [{ de: -Infinity, a: T('01:00') }])
  assert.deepEqual(fenetresDeVeille([{ id: 506, t: T('01:00') }, { id: 507, t: T('02:00') }, { id: 507, t: T('03:00') }], T('12:00')),
    [{ de: T('01:00'), a: T('02:00') }, { de: T('02:00'), a: T('03:00') }])
  assert.deepEqual(fenetresDeVeille([{ id: 506, t: T('11:00') }, { id: 506, t: T('11:30') }], T('12:00')), [{ de: T('11:00'), a: T('12:00') }])
  assert.deepEqual(fenetresDeVeille([], T('12:00')), [])
})

test('chevauchement : la part du run dans chaque fenêtre, rien hors fenêtre', () => {
  const fenetres = [{ de: T('07:53'), a: T('09:30') }, { de: -Infinity, a: T('01:00') }]
  assert.equal(chevauchement({ de: T('07:00'), a: T('10:00') }, fenetres), T('09:30') - T('07:53'))
  assert.equal(chevauchement({ de: T('08:00'), a: T('08:10') }, fenetres), 10 * 60_000)
  assert.equal(chevauchement({ de: T('00:30'), a: T('02:00') }, fenetres), 30 * 60_000)
  assert.equal(chevauchement({ de: T('10:00'), a: T('11:00') }, fenetres), 0)
})

const debut = (hook, pid, hh) => ({ evenement: 'debut', hook, pid, debut: `2026-10-12T${hh}:00.000Z` })
const fin = (hook, pid, hh, ms) => ({ ...debut(hook, pid, hh), evenement: 'fin', fin: new Date(T(hh) + ms).toISOString(), ms, code: 0, verdict: 'franchi', refus: [] })

test('runs : un début sans fin est ouvert, les étapes et les lignes avant --depuis sont écartées', () => {
  const entrees = [
    debut('post-commit', 1, '06:00'), fin('post-commit', 1, '06:00', 5),
    debut('post-commit', 2, '07:00'), { evenement: 'etape', hook: 'post-commit', pid: 2, nom: 'x', debut: '2026-10-12T07:00:00.000Z', fin: 'f', ms: 1 },
    debut('pre-push', 3, '08:00'), fin('pre-push', 3, '08:00', 7),
  ]
  const { termines, ouverts } = runsDuJournal(entrees, T('06:30'))
  assert.deepEqual(termines.map((r) => r.pid), [3])
  assert.deepEqual(ouverts.map((r) => r.pid), [2])
})

test('statistiques : p50, p90, max du mur et hors veille par hook ; tués = ouverts dont le processus a disparu', () => {
  const entrees = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((s) => [debut('post-commit', s, `0${s - 1}:00`), fin('post-commit', s, `0${s - 1}:00`, s * 1000)]),
    debut('post-commit', 100, '10:00'),
    debut('post-commit', 101, '10:30'),
  ]
  const veille = [{ de: T('09:00') + 2000, a: T('09:00') + 6000 }]
  const [stats] = statistiques(runsDuJournal(entrees), veille, { estVivant: (pid) => pid === 101, identite: { lireCreation: () => null, toleranceMs: 0 } })
  assert.deepEqual(stats, {
    hook: 'post-commit', n: 10,
    mur: { p50: 6000, p90: 10000, max: 10000 },
    horsVeille: { p50: 6000, p90: 9000, max: 9000 },
    tues: 1,
  })
})

// #2603
test('statistiques : un run ouvert dont le pid vivant est né APRÈS son `debut` est tué ; sous la tolérance ou indéterminé, vivant', () => {
  const ouvert = debut('post-merge', 102, '10:00')
  const tues = (creation) => statistiques(runsDuJournal([ouvert]), [], {
    estVivant: (pid) => pid === 102, identite: { lireCreation: () => creation, toleranceMs: 1_000 },
  })[0]?.tues ?? 0
  assert.equal(tues(T('10:00') + 1_001), 1)
  assert.equal(tues(T('10:00') + 1_000), 0)
  assert.equal(tues(null), 0)
})

test('ligne de commande : veille lue UNE fois depuis le plus ancien début, --depuis appliqué, --json ; refus nommés', () => {
  const texte = [debut('pre-push', 1, '07:00'), fin('pre-push', 1, '07:00', 3000), debut('post-merge', 2, '08:00'), fin('post-merge', 2, '08:00', 9000)]
    .map((e) => JSON.stringify(e)).join('\n') + '\nillisible\n'
  const lectures = []
  const jouer = (argv, journal = () => 'J') => {
    const sorties = []
    const code = executer({
      argv, journal, lire: () => texte, ecrire: (t) => sorties.push(t), erreur: (t) => sorties.push(t),
      veille: (depuis) => { lectures.push(depuis); return [{ id: 506, t: T('08:00') + 1000 }, { id: 507, t: T('08:00') + 5000 }] },
      vivant: () => false, maintenant: () => T('12:00'),
    })
    return { code, sortie: sorties.join('') }
  }
  const { code, sortie } = jouer(['--json', '--depuis', '2026-10-12T07:30:00Z'])
  assert.equal(code, 0, sortie)
  assert.deepEqual(lectures, [T('08:00')])
  assert.deepEqual(JSON.parse(sortie), {
    journal: 'J',
    fenetres: [{ de: '2026-10-12T08:00:01.000Z', a: '2026-10-12T08:00:05.000Z' }],
    hooks: [{ hook: 'post-merge', n: 1, mur: { p50: 9000, p90: 9000, max: 9000 }, horsVeille: { p50: 5000, p90: 5000, max: 5000 }, tues: 0 }],
  })
  assert.match(jouer([]).sortie, /^journal J — fenêtres de veille : 1\nhook +n +mur p50 \/ p90 \/ max \(s\) +hors veille p50 \/ p90 \/ max \(s\) +tués\npost-merge +1 +9\.0 \/ 9\.0 \/ 9\.0 +5\.0 \/ 5\.0 \/ 5\.0 +0\npre-push +1 +3\.0/)
  assert.deepEqual(jouer(['--depuis', 'hier']), { code: 1, sortie: '--depuis illisible : hier\nusage : npm run ops:journal-hooks [-- --arbre <racine>] [--depuis <ISO>] [--json]\n' })
  assert.deepEqual(jouer(['--arbre', 'X'], () => null), { code: 1, sortie: 'X hors dépôt : aucun journal des hooks git\n' })
  assert.equal(jouer(['--inconnu']).code, 1)
})
