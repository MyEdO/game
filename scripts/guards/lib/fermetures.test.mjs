// Contrat de la GRAMMAIRE UNIQUE des `#N` portés par un texte.
//   node --test scripts/guards/lib/fermetures.test.mjs   (chaîné dans `npm run test:hooks`)
//
// Deux ensembles, un seul hôte : ce que le texte FERME (`numerosFermes`) et ce qu'il CITE
// (`numerosCites` = rattachés ∪ fermés). Le second sert au pilotage de publication et à la porte de
// commit ; sans lui, un `refs #N` vu par l'une restait invisible à l'autre.
import test from 'node:test'
import assert from 'node:assert/strict'
import { motifRattachement, numerosCites, numerosFermes, numerosNusEnumeres } from './fermetures.mjs'

test('motifRattachement rend une instance NEUVE (aucun lastIndex partagé)', () => {
  const a = motifRattachement()
  const b = motifRattachement()
  assert.notEqual(a, b)
  a.exec('refs #12')
  assert.equal(a.lastIndex > 0, true)
  assert.equal(b.lastIndex, 0)
})

test('numerosCites : des `refs` SEULS', () => {
  assert.deepEqual(numerosCites('chore(ops): refs #1736 — le train'), ['1736'])
  assert.deepEqual(numerosCites('fix: ref #42 puis refs #43'), ['42', '43'])
})

test('numerosCites : des fermetures SEULES', () => {
  assert.deepEqual(numerosCites('feat: corrige #1736'), ['1736'])
  assert.deepEqual(numerosCites('feat: closes #7 et ferme #8'), ['7', '8'])
})

test('numerosCites : MIXTE, dans l’ordre d’APPARITION, avec doublons absorbés', () => {
  assert.deepEqual(numerosCites('feat(ops): corrige #1736, refs #1388 #999 — et encore refs #1736'), ['1736', '1388', '999'])
  assert.deepEqual(numerosCites('refs #1388 — corrige #1736'), ['1388', '1736'])
})

test('numerosCites : la CHAÎNE `refs #A #B #C` rend A, B et C — la graphie dominante du dépôt', () => {
  assert.deepEqual(numerosCites('fix(guards): refs #1699 #1388 — le banc'), ['1699', '1388'])
  assert.deepEqual(numerosCites('chore(source)!: corrige #1699, refs #1388 #42 — Lot G'), ['1699', '1388', '42'])
  // La chaîne s’ARRÊTE à ce qui n’est pas un `#N` : un verbe de fermeture qui suit reste lu comme tel.
  assert.deepEqual(numerosCites('refs #1 #2 — corrige #3'), ['1', '2', '3'])
})

test('numerosCites : la chaîne tolère la VIRGULE (`refs #A, #B`)', () => {
  assert.deepEqual(numerosCites('feat: refs #12, #13'), ['12', '13'])
  assert.deepEqual(numerosCites('feat: refs #0012,#0013'), ['12', '13'])
})

test('numerosCites : les zéros de tête sont absorbés, comme chez numerosFermes', () => {
  assert.deepEqual(numerosCites('refs #0042'), ['42'])
  assert.deepEqual(numerosCites('refs #0042 #0007'), ['42', '7'])
  assert.deepEqual(numerosCites('corrige #0042 refs #42'), ['42'])
  assert.deepEqual(numerosFermes('corrige #0042'), ['42'])
})

test('numerosCites : rien à citer', () => {
  assert.deepEqual(numerosCites('chore: ménage'), [])
  assert.deepEqual(numerosCites(''), [])
  assert.deepEqual(numerosCites(undefined), [])
  // Un `#N` NU n'est pas cité : un mot-clef PAR ticket, comme pour la fermeture.
  assert.deepEqual(numerosCites('voir #1736 dans le ticket'), [])
})

test('numerosCites CONTIENT toujours ce que numerosFermes rend', () => {
  for (const texte of [
    'corrige #1',
    'refs #2 — corrige #3',
    'fixes #4 closes #5 ferme #6 refs #7',
    'aucun',
  ]) {
    const cites = new Set(numerosCites(texte))
    for (const n of numerosFermes(texte)) assert.equal(cites.has(n), true, `${texte} : #${n} fermé doit être cité`)
  }
})

test('numerosNusEnumeres : les formes relevées à l’historique (92f57ea33, ea3d42569, `fixes #A/#B`)', () => {
  assert.deepEqual(numerosNusEnumeres('fix(tests): corrige #2225 #2114 #2151 #2191 — …'), ['2114', '2151', '2191'])
  assert.deepEqual(numerosNusEnumeres('feat(mer): corrige #132 + #116 — prêtre'), ['116'])
  assert.deepEqual(numerosNusEnumeres('fixes #127/#115 dormants'), ['115'])
  assert.deepEqual(numerosNusEnumeres('corrige #12, #13'), ['13'])
  assert.deepEqual(numerosNusEnumeres('ferme #1 et #2'), ['2'])
  assert.deepEqual(numerosNusEnumeres('Corrige #0001 #0002'), ['2'])
})

test('numerosNusEnumeres : ni rattachement, ni prose, ni ticket fermé ailleurs', () => {
  assert.deepEqual(numerosNusEnumeres('refs #1 #2'), [])
  assert.deepEqual(numerosNusEnumeres('corrige #1, refs #2 #3'), [])
  assert.deepEqual(numerosNusEnumeres('corrige #1 (voir #2)'), [])
  assert.deepEqual(numerosNusEnumeres('ferme #1 et ouvre #2'), [])
  assert.deepEqual(numerosNusEnumeres('corrige #1 — lot B de #2'), [])
  assert.deepEqual(numerosNusEnumeres('corrige #1, corrige #2'), [])
  assert.deepEqual(numerosNusEnumeres('corrige #1 #2, corrige #2'), [])
  assert.deepEqual(numerosNusEnumeres(undefined), [])
})

test('numerosFermes : le verbe est BORNÉ à gauche, y compris par une lettre accentuée', () => {
  assert.deepEqual(numerosFermes('prefix #12'), [])
  assert.deepEqual(numerosFermes('referme #12'), [])
  assert.deepEqual(numerosFermes('encloses #3'), [])
  assert.deepEqual(numerosFermes('éferme #4'), [])
  assert.deepEqual(numerosFermes('_corrige #6'), [])
  assert.deepEqual(numerosFermes('x(corrige #5)'), ['5'])
  assert.deepEqual(numerosFermes('titre\ncorrige #7'), ['7'])
  assert.deepEqual(numerosFermes('lot —corrige #8 — ferme #9'), ['8', '9'])
  assert.deepEqual(numerosNusEnumeres('prefix #12 #13'), [])
  assert.deepEqual(numerosNusEnumeres('(corrige #5 #6)'), ['6'])
})
