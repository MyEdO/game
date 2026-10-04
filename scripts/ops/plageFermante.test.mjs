// CLIQUET du vocabulaire de PLAGE FERMANTE (node --test, sans réseau) : ses décisions sont PURES, et
// la lecture de la plage se joue sur un dépôt JETABLE sous `os.tmpdir()`.
// Il vit sous `scripts/ops/` — donc joué par `npm run test:ops`, comme le geste qu'il alimente et les
// trois autres lecteurs de la grammaire de fermeture qu'il confronte.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  fermeturesDeLaPlage, decisionPour, marqueDe, commitsDeLaPlage, soldeDuCommit,
  avertissementRapportee, motifDePlageIllisible, posteUnSolde,
} from '../guards/lib/plageFermante.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'
import { extractClosedIssues } from '../hooks/solde-ticket-guard.mjs'
import { fermeturesDesCommits } from './faits-de-palier.mjs'
import { numerosFermes } from '../guards/lib/fermetures.mjs'

test('un ticket cité par plusieurs commits est rattaché au PREMIER qui le cite', () => {
  const r = fermeturesDeLaPlage([
    { sha: 'aaa', message: 'feat: corrige #10 et ferme #11' },
    { sha: 'bbb', message: 'fix: corrige #10 encore' },
  ])
  assert.deepEqual(r, [{ numero: '10', sha: 'aaa' }, { numero: '11', sha: 'aaa' }])
})

test('les quatre verbes de fermeture sont reconnus, et rien d’autre', () => {
  const r = fermeturesDeLaPlage([{ sha: 'a', message: 'fixes #1 closes #2 corrige #3 ferme #4 refs #5 voir #6' }])
  assert.deepEqual(r.map((x) => x.numero), ['1', '2', '3', '4'])
})

// Les QUATRE lecteurs de la grammaire de fermeture, sur la même table : porte de commit, closer de
// publication, objet de faits de palier, primitive. L'attendu est ÉCRIT par message — quatre lecteurs
// tous d'accord sur un ensemble FAUX resteraient verts si le test ne comparait qu'eux entre eux.
const TABLE_DE_FERMETURE = [
  ['corrige #1709 #1708', ['1709']],
  ['corrige #12, #13 et #14', ['12']],
  ['refs #5', []],
  ['CORRIGE #7', ['7']],
  ['fix #8', ['8']],
  ['fixes #8', ['8']],
  ['fixed #8', []],
  ['close #9', ['9']],
  ['closed #9', []],
  ['ferme #4', ['4']],
  ['de fixe #939', []],
  ['resolves #11', []],
  ['corrige #0012', ['12']],
]

test('les QUATRE lecteurs de la grammaire rendent le MÊME ensemble, et celui qui est attendu', () => {
  for (const [message, attendu] of TABLE_DE_FERMETURE) {
    const lectures = {
      porte: extractClosedIssues(`git commit -m ${JSON.stringify(message)}`).map(String),
      closer: fermeturesDeLaPlage([{ sha: 'a', message }]).map((f) => f.numero),
      palier: fermeturesDesCommits([{ sha: 'a', sujet: message, corps: '' }], []).map((f) => f.numero),
      primitive: numerosFermes(message),
    }
    for (const [nom, lu] of Object.entries(lectures)) {
      assert.deepEqual(
        [...lu].sort(), [...attendu].sort(),
        `« ${message} » : ${nom} ferme ${JSON.stringify(lu)} au lieu de ${JSON.stringify(attendu)} — ` +
        'un solde exigé au commit doit fermer son ticket à la publication, et pas un autre.',
      )
    }
  }
})

test('issue OUVERTE → on ferme', () => {
  assert.equal(decisionPour({ etat: 'open', commentaires: [], sha: 'aaa' }), 'fermer')
})

test('issue OUVERTE qui porte DÉJÀ la marque du sha → `patcher` : le PATCH seul est rejoué', () => {
  // Le geste est en DEUX temps : solde POSTÉ, puis état PATCHÉ. Un PATCH raté laisse le ticket
  // OUVERT avec son solde au fil — juger sur le seul `etat === 'open'` posterait un SECOND solde
  // identique au rejeu du job.
  assert.equal(decisionPour({ etat: 'open', commentaires: [`solde\n${marqueDe('aaa')}`], sha: 'aaa' }), 'patcher')
  // La marque d'un AUTRE sha ne vaut pas la sienne : ce solde-là reste à poser.
  assert.equal(decisionPour({ etat: 'open', commentaires: [marqueDe('bbb')], sha: 'aaa' }), 'fermer')
})

test('INVARIANT : marque du sha présente ⇒ AUCUN post de solde, quel que soit l’état', () => {
  for (const etat of ['open', 'closed', 'OPEN', 'autre']) {
    for (const [dit, commentaires] of [
      ['marque du sha', [`solde\n${marqueDe('aaa')}`]],
      ['marque noyée dans d’autres commentaires', ['bla', marqueDe('bbb'), `x${marqueDe('aaa')}y`]],
    ]) {
      const decision = decisionPour({ etat, commentaires, sha: 'aaa' })
      assert.equal(
        posteUnSolde(decision), false,
        `état « ${etat} » + ${dit} : décision « ${decision} » reposterait un solde déjà au fil`,
      )
    }
  }
  // Et sans la marque, sur un ticket ouvert, le solde DOIT partir — sinon l'invariant serait tenu
  // par une fonction qui ne poste jamais rien.
  assert.equal(posteUnSolde(decisionPour({ etat: 'open', commentaires: [], sha: 'aaa' })), true)
})

test('issue déjà fermée PAR CE SHA (rejeu du job) → rien à faire : la fermeture est IDEMPOTENTE', () => {
  assert.equal(decisionPour({ etat: 'closed', commentaires: [`solde\n${marqueDe('aaa')}`], sha: 'aaa' }), 'rien')
})

test('issue fermée par un AUTRE geste → RAPPORTÉE, jamais refermée en silence', () => {
  assert.equal(decisionPour({ etat: 'closed', commentaires: ['fermée à la main'], sha: 'aaa' }), 'rapporter')
  assert.equal(decisionPour({ etat: 'closed', commentaires: [marqueDe('bbb')], sha: 'aaa' }), 'rapporter')
})

test('une issue déjà fermée ailleurs s’AVERTIT : le job ne rougit pas sur un commit qui a fait son travail', () => {
  const ligne = avertissementRapportee('42', 'aaa')
  assert.match(ligne, /^::warning::/, 'GitHub Actions ne remonte l’annotation que sous cette forme')
  assert.match(ligne, /#42 déjà FERMÉE par un autre geste que aaa/)
})

test('plage dont la BASE est hors de l’histoire, ou dont une BORNE est INCONNUE du dépôt : des motifs NOMMÉS, jamais une exception brute de git', () => {
  const { racine: depot, sha: base } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'base' })
  try {
    const git = gitDe(depot)
    git('checkout', '-q', '-b', 'divergente')
    writeFileSync(join(depot, 'a.txt'), 'c')
    git('commit', '-q', '-am', 'divergente')
    const divergente = git('rev-parse', 'HEAD').trim()
    git('checkout', '-q', '-')
    writeFileSync(join(depot, 'a.txt'), 'b')
    git('commit', '-q', '-am', 'suite')
    const tete = git('rev-parse', 'HEAD').trim()

    assert.equal(motifDePlageIllisible(`${base}..${tete}`, depot), null, 'une plage fast-forward est lisible')
    assert.equal(
      motifDePlageIllisible(`${divergente}..${tete}`, depot),
      `base ${divergente} inatteignable depuis ${tete} : push non fast-forward sur main, interdit par le pre-push`,
    )
    const inconnue = 'f'.repeat(40)
    assert.equal(
      motifDePlageIllisible(`${inconnue}..${tete}`, depot),
      `base ${inconnue} inconnue de ce dépôt (non fetchée, ou dépôt corrompu) — aucune fermeture n'est jugée`,
    )
    const teteInconnue = 'e'.repeat(40)
    assert.equal(
      motifDePlageIllisible(`${base}..${teteInconnue}`, depot),
      `tête ${teteInconnue} inconnue de ce dépôt (non fetchée, ou dépôt corrompu) — aucune fermeture n'est jugée`,
    )
    assert.equal(
      motifDePlageIllisible(`${inconnue}..${teteInconnue}`, depot),
      `base ${inconnue} et tête ${teteInconnue} inconnues de ce dépôt (non fetchées, ou dépôt corrompu) — aucune fermeture n'est jugée`,
    )
  } finally { rmSync(depot, { recursive: true, force: true }) }
})

test('la plage se lit dans l’histoire, et le solde est celui que le COMMIT emporte', () => {
  const { racine: depot, sha: base } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'base' })
  try {
    const git = gitDe(depot)
    mkdirSync(join(depot, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(depot, '.claude', 'soldes', '42.md'), 'VERIFIE: le solde emporté\n')
    writeFileSync(join(depot, 'a.txt'), 'b')
    git('add', '-A'); git('commit', '-q', '-m', 'feat: corrige #42')
    const tete = git('rev-parse', 'HEAD').trim()

    const commits = commitsDeLaPlage(`${base}..${tete}`, depot)
    assert.equal(commits.length, 1)
    assert.match(commits[0].message, /corrige #42/)
    assert.deepEqual(fermeturesDeLaPlage(commits), [{ numero: '42', sha: tete }])
    assert.match(soldeDuCommit(tete, 42, depot), /VERIFIE: le solde emporté/)
    assert.equal(soldeDuCommit(base, 42, depot), null, 'le solde n’existait pas au commit de base')
  } finally { rmSync(depot, { recursive: true, force: true }) }
})
