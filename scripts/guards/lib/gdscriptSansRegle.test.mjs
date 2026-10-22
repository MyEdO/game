// PORTE DU GDSCRIPT SANS RÈGLE (#2928) : chaque famille mord sur sa forme nue, la mise en scène voisine passe, et ni un
// commentaire ni une chaîne ne comptent. Patron des voisins de `scripts/guards/lib/` : `node:test` + `node:assert/strict`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { calculsDeRegle, lexemesGdscript } from './gdscriptSansRegle.mjs'

const familles = (src) => calculsDeRegle(src).map(({ famille, ligne }) => `${famille}:${ligne}`)

test('lexemesGdscript : commentaires et chaînes blanchis, lignes et colonnes gardées, chaînes rendues', () => {
  const src = 'var a := "x # y" # randi()\nvar b := &"nom"\nvar c := """un\ndeux"""\nvar d := r"\\d"'
  const { code, chaines } = lexemesGdscript(src)
  assert.equal(code.length, src.length)
  assert.equal(code.split('\n').length, src.split('\n').length)
  assert.doesNotMatch(code, /randi|nom|deux/)
  assert.deepEqual(chaines, [{ texte: 'x # y', ligne: 1 }, { texte: 'nom', ligne: 2 }, { texte: 'un\ndeux', ligne: 3 }, { texte: '\\d', ligne: 5 }])
})

test('hasard : l’API de hasard du moteur', () => {
  assert.deepEqual(familles('var d := randi() % 100\nvar g := RandomNumberGenerator.new()\nseed(7)\nrandomize()'), ['hasard:1', 'hasard:2', 'hasard:3', 'hasard:4'])
})

test('chemin : les classes de recherche de chemin du moteur', () => {
  assert.deepEqual(familles('var a := AStarGrid2D.new()\nvar n := NavigationServer3D.map_get_path(m, a, b, true)'), ['chemin:1', 'chemin:2'])
})

test('mesure : distance, différence de coordonnées, case voisine', () => {
  assert.deepEqual(familles('var d := a.distance_to(b)\nvar dx := abs(a.x - b.x)\nvar dy := c.pos[1] - cible.pos[1]\nvar v := Vector2i(case.x + 1, case.y)'), ['mesure:1', 'mesure:2', 'mesure:3', 'mesure:4'])
})

test('la mise en scène passe : centre de case, échelle, lecture, comparaison', () => {
  assert.deepEqual(familles('var p := Vector3(case.x + 0.5, 0.0, case.y + 0.5)\nvar z := camera.position.z * facteur\nvar m := plateau.w / 2.0\nif Vector2i(int(c.pos[0]), int(c.pos[1])) == case:\n\tpass'), [])
})

test('un commentaire ou une chaîne ne comptent pas', () => {
  assert.deepEqual(familles('# randi() et a.x - b.x\nvar t := "AStar2D, seed"'), [])
})
