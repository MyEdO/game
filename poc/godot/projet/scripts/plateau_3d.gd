## Plateau 3D du prototype #2809 : cases et obstacles en `GridMap`, combattants `Combattant3D`, caméra
## en perspective pivotante (Q/E par quart de tour) et zoomable (molette), case pointée par lancer de rayon.
class_name Plateau3D
extends Plateau

const ITEM_SOL := 0
const ITEM_BLOQUANT := 1
const ITEM_ATTEIGNABLE := 2
const ITEM_CIBLE := 3
const ITEM_SURVOL := 4
const ITEM_SOL_SOMBRE := 5
const DUREE_QUART_S := 0.25
const PAS_DE_ZOOM := 1.15
const DISTANCE_MIN := 6.0
const DISTANCE_MAX := 30.0
## Cylindre de sélection d'un combattant debout, en mètres de monde (une case = 1).
const RAYON_COMBATTANT := 0.3
const HAUTEUR_COMBATTANT := 1.5
const HORS_CARTE := Vector2i(-1, -1)

@export var scene_combattant: PackedScene

@onready var _sol: GridMap = $Sol
@onready var _surbrillance: GridMap = $Surbrillance
@onready var _combattants: Node3D = $Combattants
@onready var _pivot: Node3D = $Pivot
@onready var _camera: Camera3D = $Pivot/Inclinaison/Camera

var _modeles: Dictionary = {}
var _cases: Dictionary = {}
var _lacet := 0.0
var _pivotement: Tween


func _ready() -> void:
	for case in cases():
		var item := ITEM_BLOQUANT if est_bloquante(case) else (ITEM_SOL if (case.x + case.y) % 2 == 0 else ITEM_SOL_SOMBRE)
		_sol.set_cell_item(Vector3i(case.x, 0, case.y), item)
	_pivot.position = Vector3(carte.taille.x / 2.0, 0.0, carte.taille.y / 2.0)
	_lacet = _pivot.rotation.y


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pivoter_gauche"):
		_pivoter(1.0)
	elif event.is_action_pressed("pivoter_droite"):
		_pivoter(-1.0)
	elif event is InputEventMouseMotion:
		case_survolee.emit(_case_sous(event.position))
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		case_cliquee.emit(_case_sous(event.position))
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
		_zoomer(1.0 / PAS_DE_ZOOM)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		_zoomer(PAS_DE_ZOOM)
	else:
		return
	get_viewport().set_input_as_handled()


func _pivoter(sens: float) -> void:
	_lacet += sens * PI / 2.0
	if _pivotement != null:
		_pivotement.kill()
	_pivotement = create_tween()
	_pivotement.tween_property(_pivot, "rotation:y", _lacet, DUREE_QUART_S)
	_pivotement.tween_callback(func() -> void: case_survolee.emit(_case_sous(get_viewport().get_mouse_position())))


func _zoomer(facteur: float) -> void:
	_camera.position.z = clampf(_camera.position.z * facteur, DISTANCE_MIN, DISTANCE_MAX)
	case_survolee.emit(_case_sous(get_viewport().get_mouse_position()))


## Combattant debout traversé le premier par le rayon, sinon la case du sol (plan y = 0) sous le pointeur.
func _case_sous(point: Vector2) -> Vector2i:
	var origine := _camera.project_ray_origin(point)
	var direction := _camera.project_ray_normal(point)
	var plus_proche := INF
	var case := HORS_CARTE
	for id in _modeles:
		var modele: Combattant3D = _modeles[id]
		if modele.hors_de_combat:
			continue
		var t := _rencontre_cylindre(origine, direction, modele.position)
		if t < plus_proche:
			plus_proche = t
			case = _cases[id]
	if case != HORS_CARTE or is_zero_approx(direction.y):
		return case
	var sol := origine + direction * (-origine.y / direction.y)
	return Vector2i(floori(sol.x), floori(sol.z))


func _rencontre_cylindre(origine: Vector3, direction: Vector3, base: Vector3) -> float:
	var ox := origine.x - base.x
	var oz := origine.z - base.z
	var a := direction.x * direction.x + direction.z * direction.z
	if is_zero_approx(a):
		return INF
	var b := 2.0 * (ox * direction.x + oz * direction.z)
	var c := ox * ox + oz * oz - RAYON_COMBATTANT * RAYON_COMBATTANT
	var discriminant := b * b - 4.0 * a * c
	if discriminant < 0.0:
		return INF
	var t := (-b - sqrt(discriminant)) / (2.0 * a)
	var hauteur := origine.y + direction.y * t - base.y
	return t if t > 0.0 and hauteur >= 0.0 and hauteur <= HAUTEUR_COMBATTANT else INF


func _monde(case: Vector2i) -> Vector3:
	return Vector3(case.x + 0.5, 0.0, case.y + 0.5)


func placer(combattant: Dictionary, case: Vector2i) -> void:
	var modele: Combattant3D = scene_combattant.instantiate()
	modele.position = _monde(case)
	_combattants.add_child(modele)
	modele.configurer(combattant)
	modele.regarder(_pivot.position)
	_modeles[combattant.id] = modele
	_cases[combattant.id] = case


func poser(id: String, case: Vector2i) -> void:
	_modeles[id].position = _monde(case)
	_cases[id] = case


func parcourir(id: String, chemin: Array[Vector2i]) -> void:
	var points: Array[Vector3] = []
	for case in chemin:
		points.append(_monde(case))
	await _modeles[id].parcourir(points)
	_cases[id] = chemin[-1]


func attaquer(attaquant: String, cible: String) -> void:
	_modeles[attaquant].attaquer(_modeles[cible].position)


func mettre_a_jour(combattant: Dictionary, actif: bool) -> void:
	_modeles[combattant.id].mettre_a_jour(combattant, actif)


func peindre(atteignables: Array[Vector2i], cibles: Array[Vector2i], survol: Vector2i) -> void:
	_surbrillance.clear()
	for case in atteignables:
		_surbrillance.set_cell_item(Vector3i(case.x, 0, case.y), ITEM_ATTEIGNABLE)
	for case in cibles:
		_surbrillance.set_cell_item(Vector3i(case.x, 0, case.y), ITEM_CIBLE)
	if carte.contient(survol):
		_surbrillance.set_cell_item(Vector3i(survol.x, 0, survol.y), ITEM_SURVOL)
