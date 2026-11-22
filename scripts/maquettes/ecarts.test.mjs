// Les écarts d'un rendu des maquettes à sa référence (`ecarts.mjs`, #4585).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confronter, ecartDeStyle, pngDe, relevesDeLaSortie, relevesNeufs } from './ecarts.mjs'

test('relevesDeLaSortie : chaque ligne JSON sous l’état de la ligne qui la précède', () => {
  const sortie = 'butin-ouvert erreurs 0 \n{"hors":[],"coupe":["titre"],"pieces":3}\nbutin-vide erreurs 1 requete x\n{"hors":["a"]}\n'
  assert.deepEqual(relevesDeLaSortie('butin', sortie), { 'butin/butin-ouvert': { hors: [], coupe: ['titre'], pieces: 3 }, 'butin/butin-vide': { hors: ['a'] } })
  assert.equal(pngDe('butin', 'butin-vide'), 'butin-butin-vide.png')
  assert.throws(() => relevesDeLaSortie('butin', '{"hors":[]}\n'), /relevé sans ligne d'état/)
})

test('relevesNeufs : les seules entrées absentes de la même liste du même état de la référence', () => {
  const reference = { 'e/a': { hors: ['x'], coupe: [], pieces: 2, defile: false }, 'e/b': { hors: [] } }
  const rendu = { 'e/a': { hors: ['x', 'y'], coupe: [], pieces: 9, defile: true }, 'e/b': { hors: [] }, 'e/c': { masque: ['m'] } }
  assert.deepEqual(relevesNeufs(reference, rendu), [{ etat: 'e/a', releve: 'hors', entrees: ['y'] }, { etat: 'e/c', releve: 'masque', entrees: ['m'] }])
  assert.deepEqual(relevesNeufs(reference, reference), [])
})

test('confronter : attendus inchangés et changés hors attendu, sur l’union des fichiers', () => {
  assert.deepEqual(confronter(['e/a', 'e/z', 'f/b'], [{ 'e/a': [] }, { 'f/b': ['titre'], 'f/c': [] }]), { inchanges: ['f/c'], hors: ['e/z'] })
})

test('ecartDeStyle : par signature, le nombre d’éléments et un exemple', () => {
  const t = (etat, chemin, texte, propres = {}) => ({ ecran: 'e', etat, chemin, texte, police: 'Fell', taille: 14, couleur: 'rgb(0, 0, 0)', rect: [0, 0, 10, 10], ...propres })
  const reference = [t('a', 'div.cadre > h2.titre > span', 'Butin'), t('b', 'div.cadre > h2.titre > span', 'Bourse'), t('b', 'div > p.note', 'Note'), t('b', 'div > p.note', 'Note'), t('b', 'div > i', 'vu')]
  const rendu = [t('a', 'div.cadre > h2.titre > span', 'Butin', { taille: 16 }), t('b', 'div.cadre > h2.titre > span', 'Bourse', { taille: 16 }), t('b', 'div > p.note', 'Note'), t('b', 'div > p.note', 'Note', { rect: [5, 5, 10, 10] }), t('b', 'div > b', 'neuf')]
  assert.deepEqual(ecartDeStyle(reference, rendu), [
    { signature: 'h2.titre > span : taille', n: 2, exemple: { ecran: 'e', etat: 'a', texte: 'Butin', avant: { taille: 14 }, apres: { taille: 16 } } },
    { signature: 'div > b : apparu', n: 1, exemple: { ecran: 'e', etat: 'b', texte: 'neuf' } },
    { signature: 'div > i : disparu', n: 1, exemple: { ecran: 'e', etat: 'b', texte: 'vu' } },
  ])
  assert.deepEqual(ecartDeStyle(reference, reference), [])
})
