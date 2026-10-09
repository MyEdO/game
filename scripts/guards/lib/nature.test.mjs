// La NATURE d'une fermeture (`nature.mjs`) : la ligne `NATURE:` du solde, et le `state_reason` qu'elle fait.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NATURES, natureDuSolde, raisonDeFermeture } from './nature.mjs'

const solde = (...lignes) => ['VERIFIE: une vérification', ...lignes, '## Restes', 'RAS'].join('\n')

test('NATURES : la table fermée, chaque nature vers un `state_reason` de l’enum REST', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(NATURES).map(([n, d]) => [n, d.raison])), {
    corrigé: 'completed', doublon: 'duplicate', caduc: 'not_planned', décidé: 'not_planned',
  })
})

test('natureDuSolde : chaque nature se lit, `doublon` avec sa cible', () => {
  assert.deepEqual(natureDuSolde(solde('NATURE: corrigé'), 10), { nature: 'corrigé' })
  assert.deepEqual(natureDuSolde(solde('NATURE: doublon #12'), 10), { nature: 'doublon', cible: 12 })
  assert.deepEqual(natureDuSolde(solde('NATURE: caduc'), 10), { nature: 'caduc' })
  assert.deepEqual(natureDuSolde(solde('NATURE: décidé'), 10), { nature: 'décidé' })
  assert.deepEqual(natureDuSolde(solde('NATURE: décidé\r'), 10), { nature: 'décidé' }, 'NFD et CRLF se lisent')
})

test('natureDuSolde : sans ligne `NATURE:` en TÊTE de ligne, le solde est `corrigé`', () => {
  assert.deepEqual(natureDuSolde(solde(), 10), { nature: 'corrigé' })
  assert.deepEqual(natureDuSolde(null), { nature: 'corrigé' })
  assert.deepEqual(natureDuSolde(solde('VERIFIE: la NATURE: caduc citée en prose'), 10), { nature: 'corrigé' })
})

test('natureDuSolde : nature INCONNUE refusée', () => {
  assert.match(natureDuSolde(solde('NATURE: abandonné'), 10).erreur, /inconnue — attendu corrigé \| doublon #M \| caduc \| décidé/)
  assert.match(natureDuSolde(solde('NATURE:'), 10).erreur, /inconnue/)
})

test('natureDuSolde : ligne `NATURE:` DUPLIQUÉE refusée', () => {
  assert.match(natureDuSolde(solde('NATURE: corrigé', 'NATURE: caduc'), 10).erreur, /2 lignes "NATURE:"/)
})

test('natureDuSolde : `#M` manquant, égal au ticket fermé, ou porté par une nature sans cible — refusé', () => {
  assert.match(natureDuSolde(solde('NATURE: doublon'), 10).erreur, /sans "#M"/)
  assert.match(natureDuSolde(solde('NATURE: doublon #10'), 10).erreur, /nomme le ticket fermé lui-même/)
  assert.match(natureDuSolde(solde('NATURE: caduc #12'), 10).erreur, /ne porte pas de "#M"/)
})

test('raisonDeFermeture : le `state_reason` de la nature ; une nature hors table JETTE', () => {
  assert.equal(raisonDeFermeture('corrigé'), 'completed')
  assert.equal(raisonDeFermeture('doublon'), 'duplicate')
  assert.equal(raisonDeFermeture('caduc'), 'not_planned')
  assert.equal(raisonDeFermeture('décidé'), 'not_planned')
  assert.throws(() => raisonDeFermeture('toString'), /inconnue/)
})
