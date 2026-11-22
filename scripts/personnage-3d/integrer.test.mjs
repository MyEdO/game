// L'intégration d'un lot d'éléments 3D (#4338) : ordre, commandes et triangles, sur fixtures nommées.
import test from 'node:test'
import assert from 'node:assert/strict'
import { commandeDImport, construction, ordreDuLot, trianglesParEmpreinte } from './integrer.mjs'

const BURE = 'humanoide/vetement--bure'
const CORDELIERE = 'humanoide/accessoire--cordeliere'
const SCEAU = 'humanoide/accessoire--sceau-de-cire'
const CARAQUE = 'vehicule/caraque'
const LUS = {
  [BURE]: [],
  [CORDELIERE]: ['humanoide--vetement--bure'],
  [SCEAU]: ['humanoide--vetement--bure', 'humanoide--accessoire--cordeliere'],
  [CARAQUE]: [],
}

test('ordreDuLot construit chaque élément après ceux du lot qu’il contourne, l’ordre donné gardé sinon', () => {
  assert.deepEqual(ordreDuLot([SCEAU, CARAQUE, CORDELIERE, BURE], LUS), [BURE, CORDELIERE, SCEAU, CARAQUE])
  assert.deepEqual(ordreDuLot([CARAQUE, BURE, CORDELIERE], LUS), [CARAQUE, BURE, CORDELIERE])
  assert.deepEqual(ordreDuLot([SCEAU], LUS), [SCEAU], 'un id contourné hors du lot se lit au cache épinglé')
})

test('ordreDuLot refuse un cycle de contournement', () => {
  assert.throws(() => ordreDuLot([BURE, CORDELIERE], { [BURE]: ['humanoide--accessoire--cordeliere'], [CORDELIERE]: ['humanoide--vetement--bure'] }), /cycle de contournement/)
})

test('construction choisit le constructeur de la base et nomme le donnees.py de l’élément', () => {
  assert.deepEqual(construction(BURE, '/tmp/x'), {
    commande: ['scripts/personnage-3d/environnement.mjs', 'scripts/personnage-3d/element/construire.py', 'humanoide/vetement--bure', '--sortie', '/tmp/x'],
    donnees: 'scripts/personnage-3d/element/humanoide/vetement--bure/donnees.py',
  })
  assert.deepEqual(construction(CARAQUE, '/tmp/x'), {
    commande: ['scripts/personnage-3d/environnement.mjs', 'scripts/personnage-3d/construire.py', 'vehicule/caraque', '--sortie', '/tmp/x'],
    donnees: 'scripts/personnage-3d/vehicule/caraque/donnees.py',
  })
  assert.deepEqual(construction('decor/arbre', '/tmp/x'), {
    commande: ['scripts/personnage-3d/environnement.mjs', 'scripts/personnage-3d/construire.py', 'decor/arbre', '--sortie', '/tmp/x'],
    donnees: 'scripts/personnage-3d/decor/arbre/donnees.py',
  })
  for (const inconnu of ['meuble/tonneau', 'humanoide', 'humanoide/a/b', 'toString/x']) assert.equal(construction(inconnu, '/tmp/x'), null, inconnu)
})

test('commandeDImport importe sans publier, et remplace un id déjà importé', () => {
  assert.deepEqual(commandeDImport('/tmp/x/id', 'id', false), ['hotes/godot/importer.mjs', '/tmp/x/id', 'id', '--sans-publier'])
  assert.deepEqual(commandeDImport('/tmp/x/id', 'id', true), ['hotes/godot/importer.mjs', '/tmp/x/id', 'id', '--sans-publier', '--remplacer'])
})

test('trianglesParEmpreinte lit les lignes GLB d’un élément sur base comme d’un véhicule', () => {
  const [a, b] = ['a'.repeat(64), 'b'.repeat(64)]
  const journal = `INFO export\nGLB humanoide--vetement--bure 81234 ${a} TRIANGLES 2311\nGLB caraque 912 ${b} TRIANGLES 14 -> vehicule--caraque\n  NOEUD coque (0, 0, 0) 12 []\n`
  assert.deepEqual([...trianglesParEmpreinte(journal)], [[a, 2311], [b, 14]])
})
