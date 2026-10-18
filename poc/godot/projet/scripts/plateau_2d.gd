## Plateau isométrique 2D du prototype #2793 : sol et surbrillances en `TileMapLayer`, jetons `Unite`.
class_name Plateau2D
extends Plateau

const SOURCE_SOL := 0
const SOURCE_BLOQUANT := 1
const SOURCE_ATTEIGNABLE := 2
const SOURCE_SURVOL := 3
const SOURCE_CIBLE := 4

@export var scene_unite: PackedScene

@onready var _sol: TileMapLayer = $Sol
@onready var _surbrillance: TileMapLayer = $Surbrillance
@onready var _unites: Node2D = $Unites

var _jetons: Dictionary = {}


func _ready() -> void:
	for case in cases():
		_sol.set_cell(case, SOURCE_BLOQUANT if est_bloquante(case) else SOURCE_SOL, Vector2i.ZERO)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		case_survolee.emit(_case_sous_souris())
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		case_cliquee.emit(_case_sous_souris())
	else:
		return
	get_viewport().set_input_as_handled()


func _case_sous_souris() -> Vector2i:
	return _sol.local_to_map(_sol.get_local_mouse_position())


func placer(combattant: Dictionary, case: Vector2i) -> void:
	var jeton: Unite = scene_unite.instantiate()
	jeton.position = _sol.map_to_local(case)
	_unites.add_child(jeton)
	jeton.configurer(combattant)
	_jetons[combattant.id] = jeton


func poser(id: String, case: Vector2i) -> void:
	_jetons[id].position = _sol.map_to_local(case)


func parcourir(id: String, chemin: Array[Vector2i]) -> void:
	var points: Array[Vector2] = []
	for case in chemin:
		points.append(_sol.map_to_local(case))
	await _jetons[id].parcourir(points)


## Le jeton 2D ne montre pas l'attaque : le jet s'affiche dans l'interface.
func attaquer(_attaquant: String, _cible: String) -> void:
	pass


func mettre_a_jour(combattant: Dictionary, actif: bool) -> void:
	_jetons[combattant.id].mettre_a_jour(combattant, actif)


func peindre(atteignables: Array[Vector2i], cibles: Array[Vector2i], survol: Vector2i) -> void:
	_surbrillance.clear()
	for case in atteignables:
		_surbrillance.set_cell(case, SOURCE_ATTEIGNABLE, Vector2i.ZERO)
	for case in cibles:
		_surbrillance.set_cell(case, SOURCE_CIBLE, Vector2i.ZERO)
	if carte.contient(survol):
		_surbrillance.set_cell(survol, SOURCE_SURVOL, Vector2i.ZERO)
