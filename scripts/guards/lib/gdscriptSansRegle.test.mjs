// PORTE DU GDSCRIPT SANS RÈGLE (#2928) : chaque famille mord sur sa forme nue, chaque calcul de règle de la sonde du juge
// du lot 6c rougit, la mise en scène sans calcul passe, le module de mise en page se reconnaît par sa seule structure, et
// ni un commentaire ni une chaîne ne comptent. Patron des voisins de `scripts/guards/lib/` : `node:test` +
// `node:assert/strict`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { calculsDeRegle, estMiseEnPage } from './gdscriptSansRegle.mjs'

const familles = (src) => calculsDeRegle(src).map(({ famille, ligne }) => `${famille}:${ligne}`)

test('hasard : toute l’API de hasard du moteur', () => {
  const src = 'var d := randi() % 100\nvar g := RandomNumberGenerator.new()\nseed(7)\nrandomize()\nvar c = cibles.pick_random()\ncibles.shuffle()\nvar r := rand_from_seed(3)\nvar p := hash(cible) & 1'
  assert.deepEqual(calculsDeRegle(src).filter((t) => t.famille === 'hasard').map((t) => t.ligne), [1, 2, 3, 4, 5, 6, 7, 8])
})

test('calcul : un calcul écrit en chaîne et évalué (`Expression`)', () => {
  assert.deepEqual(familles('var e := Expression.new()\ne.parse("jet <= cible")'), ['calcul:1'])
})

test('chemin : les classes de recherche de chemin du moteur', () => {
  assert.deepEqual(familles('var a := AStarGrid2D.new()\nvar n := NavigationServer3D.map_get_path(m, a, b, true)'), ['chemin:1', 'chemin:2'])
})

test('chaque calcul de règle de la sonde du juge rougit', () => {
  const sonde = {
    adjacence: 'var d := a - b\nif maxi(absi(d.x), absi(d.y)) <= 1:\n\tpass',
    distance: 'var n := (a - b).length()',
    voisines: 'for v in VOISINS:\n\tr.append(c + v)',
    'cible au hasard': 'var c = cibles.pick_random()',
    'mélange': 'cibles.shuffle()',
    DR: 'var dr := int(cible / 10) - int(jet / 10)',
    'portée': 'if abs(ax - bx) + abs(ay - by) <= 4:\n\tpass',
    'réussite': 'if jet <= cible:\n\tpass',
    'tri de cibles': 'cibles.sort_custom(func(p, q): return moi.distance_to(p) < moi.distance_to(q))',
  }
  for (const [calcul, src] of Object.entries(sonde)) assert.notDeepEqual(calculsDeRegle(src), [], calcul)
  assert.deepEqual(familles(sonde.adjacence), ['calcul:1', 'mesure:2', 'mesure:2', 'mesure:2', 'ordre:2'])
})

test('ordre : l’appartenance à une liste littérale de nombres ou à un `range`, hors de l’en-tête d’un `for`', () => {
  assert.deepEqual(familles('if n in [0, 1]:\n\tpass\nif n not in [-1, [2]]:\n\tpass\nvar ok := n in range(0, 3)'), ['ordre:1', 'ordre:3', 'ordre:5'])
  assert.deepEqual(familles('for i in range(3):\n\tpass\nfor i: int in [0, 1]:\n\tpass\nif x in [VIDE, "a"]:\n\tpass\nif e in p.elements:\n\tpass'), [])
})

test('la mise en scène sans calcul passe : moins unaire, chaîne mise en forme ou concaténée, égalité, chemin de nœud', () => {
  const src = [
    'var p := MiseEnPage.centre_de_case(case)',
    'cadre.offset_right = -LARGEUR',
    'var t := "%s : %d" % [nom, int(pb[0])]',
    'var u := "Round " + str(n)',
    'texte += "\\n"',
    'if Vector2i(int(c.pos[0]), int(c.pos[1])) == case and c.id != moi:',
    '\tpass',
    'var n := $Pivot/Inclinaison/Camera',
    'liste.select(-1)',
    'func f() -> void:',
    '\tpass',
  ].join('\n')
  assert.deepEqual(familles(src), [])
})

test('le nœud unique `%Nom` n’est pas un modulo ; le modulo de deux valeurs l’est', () => {
  const noeuds = [
    'func _ready() -> void:',
    '\tf(1)',
    '\t%Bouton.pressed.connect(f)',
    '%Titre.text = "x"',
    'g(%Bouton, h(%Liste))',
    'var l := [%Bouton,',
    '\t%Liste]',
  ].join('\n')
  assert.deepEqual(familles(noeuds), [])
  assert.deepEqual(familles('var r := a % b\nvar s := a %b\nvar t := (a\n\t% b)\nvar u := a \\\n\t% b'), ['calcul:1', 'calcul:2', 'calcul:4', 'calcul:6'])
  assert.deepEqual(familles('var t := "%d" % x'), [])
})

test('un commentaire ou une chaîne ne comptent pas', () => {
  assert.deepEqual(familles('# randi() et a.x - b.x <= 1\nvar t := "AStar2D, seed, a - b, abs(x)"'), [])
})

test('le module de mise en page : sa structure, et seuls le hasard et le chemin y rougissent', () => {
  const module = [
    '## La mise en page.',
    'class_name MiseEnPage',
    'extends RefCounted',
    '',
    'const DEMI := 0.5',
    'const QUART := PI / 2.0',
    '',
    'static func centre(case: Vector2i) -> Vector3:',
    '\treturn Vector3(case.x + DEMI, 0.0, case.y + DEMI)',
    '',
    'static func zoom(d: float, f: float, mini: float, maxi: float) -> float:',
    '\treturn clampf(d * f, mini, maxi)',
  ].join('\n')
  assert.equal(estMiseEnPage(module), true)
  assert.deepEqual(calculsDeRegle(module), [])
  assert.deepEqual(familles(`${module}\n\nstatic func de() -> float:\n\treturn randf()`), ['hasard:15'])
  const refus = {
    'un état': `${module}\nvar n := 0`,
    'une fonction non statique': `${module}\nfunc f() -> float:\n\treturn 1.0`,
    'un signal': `${module}\nsignal fini`,
    'un rendu non géométrique': `${module}\nstatic func ok(a: float) -> bool:\n\treturn a == 1.0`,
    'deux vecteurs': `${module}\nstatic func ecart(a: Vector2i, b: Vector2i) -> float:\n\treturn (a - b).length()`,
    'un paramètre non typé': `${module}\nstatic func f(a) -> float:\n\treturn a * 2.0`,
    'un dictionnaire de la vue': `${module}\nstatic func f(vue: Dictionary) -> float:\n\treturn vue.x * 2.0`,
    'aucune fonction': 'class_name Rien\nconst A := 1 + 2',
  }
  for (const [quoi, src] of Object.entries(refus)) {
    assert.equal(estMiseEnPage(src), false, quoi)
    assert.notDeepEqual(calculsDeRegle(src).filter((t) => t.famille !== 'hasard'), [], `${quoi} : hors du module, l’arithmétique rougit`)
  }
})
