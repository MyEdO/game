## Le plateau 3D : le sol du plateau de la scène (`vue.plateau`), chaque combattant à sa case (`voisins`), les
## surbrillances des cases que la vue peint (`vue.cases`), des cibles et de l'aperçu du premier clic, et la case sous le
## pointeur jusqu'au clic ; caméra pivotante (Q/E, par quart de tour) et zoomable (molette). Il ne rend que la case
## cliquée.
class_name Plateau
extends Node3D

signal case_cliquee(case: Vector2i)

const ITEM_SOL := 0
const ITEM_BLOQUANT := 1
const ITEM_ATTEIGNABLE := 2
const ITEM_CIBLE := 3
const ITEM_SURVOL := 4
const DUREE_QUART_S := 0.25
const DISTANCE_MIN := 6.0
const DISTANCE_MAX := 40.0

@export var scene_combattant: PackedScene

@onready var _sol: GridMap = $Sol
@onready var _surbrillance: GridMap = $Surbrillance
@onready var _combattants: Node3D = $Combattants
@onready var _pivot: Node3D = $Pivot
@onready var _camera: Camera3D = $Pivot/Inclinaison/Camera

var _bornes := Rect2i()
var _modeles: Dictionary = {}
var _vue: Dictionary = {}
var _survol: Variant = null
var _lacet := 0.0
var _pivotement: Tween


func _ready() -> void:
	_lacet = _pivot.rotation.y


## Montre la vue ; chaque ligne de `journal` qui nomme un acteur et sa cible tourne l'acteur vers elle et l'anime, et
## la cible accuse le coup.
func montrer(vue: Dictionary, journal: Array) -> void:
	_vue = vue
	if not _bornes.has_area() and vue.plateau != null:
		_poser_le_sol(vue.plateau)
	var combat: Variant = vue.projection.combat
	var actif: Variant = null if combat == null or combat.actif == null else combat.actif.id
	for c in ([] if combat == null else combat.voisins.liste):
		if c.pos == null:
			continue
		var lieu := _monde(Vector2i(int(c.pos[0]), int(c.pos[1])))
		if not _modeles.has(c.id):
			var modele: Combattant = scene_combattant.instantiate()
			_combattants.add_child(modele)
			modele.configurer(c, lieu)
			_modeles[c.id] = modele
		_modeles[c.id].montrer(c, lieu, c.id == actif)
	for ligne in journal:
		var e: Variant = ligne.get("evenement")
		if e != null and _modeles.has(e.get("actorId", "")) and _modeles.has(e.get("targetId", "")) and e.actorId != e.targetId:
			_modeles[e.actorId].agir_vers(_modeles[e.targetId].position)
			_modeles[e.targetId].subir()
	_peindre()


## Le point de l'écran de chaque case du plateau, par sa clé `x,y`.
func points() -> Dictionary:
	var points := {}
	for y in _bornes.size.y:
		for x in _bornes.size.x:
			var point := _camera.unproject_position(_monde(Vector2i(x, y)))
			points["%d,%d" % [x, y]] = [point.x, point.y]
	return points


func _poser_le_sol(plateau: Dictionary) -> void:
	_bornes = Rect2i(0, 0, int(plateau.w), int(plateau.h))
	for y in _bornes.size.y:
		for x in _bornes.size.x:
			_sol.set_cell_item(Vector3i(x, 0, y), ITEM_SOL)
	for case in plateau.infranchissables:
		_sol.set_cell_item(Vector3i(int(case.x), 0, int(case.y)), ITEM_BLOQUANT)
	_pivot.position = MiseEnPage.centre_du_plateau(_bornes.size)


func _monde(case: Vector2i) -> Vector3:
	return MiseEnPage.centre_de_case(case)


## Les cases peintes : celles de la vue, les cibles, l'aperçu, puis la case sous le pointeur.
func _peindre() -> void:
	_surbrillance.clear()
	for c in _vue.get("cases", []):
		_surligner(Vector2i(int(c.case.x), int(c.case.y)), ITEM_ATTEIGNABLE)
	var combat: Variant = _vue.get("projection", {}).get("combat")
	if combat != null:
		var vises: Array = combat.cibles.liste.duplicate()
		var apercu: Variant = combat.apercu
		if apercu != null and apercu.cible != null:
			vises.append(apercu.cible)
		for c in combat.voisins.liste:
			if c.pos != null and vises.has(c.id):
				_surligner(Vector2i(int(c.pos[0]), int(c.pos[1])), ITEM_SURVOL if apercu != null and apercu.cible == c.id else ITEM_CIBLE)
		if apercu != null and apercu.case != null:
			_surligner(Vector2i(int(apercu.case[0]), int(apercu.case[1])), ITEM_SURVOL)
	if _survol != null:
		_surligner(_survol, ITEM_SURVOL)


func _surligner(case: Vector2i, item: int) -> void:
	_surbrillance.set_cell_item(Vector3i(case.x, 0, case.y), item)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pivoter_gauche"):
		_pivoter(1.0)
	elif event.is_action_pressed("pivoter_droite"):
		_pivoter(-1.0)
	elif event is InputEventMouseMotion:
		_survoler(_case_sous(event.position))
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var case: Variant = _case_sous(event.position)
		_survol = null
		_peindre()
		if case != null:
			case_cliquee.emit(case)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
		_zoomer(-1.0)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		_zoomer(1.0)
	else:
		return
	get_viewport().set_input_as_handled()


func _survoler(case: Variant) -> void:
	if case != _survol:
		_survol = case
		_peindre()


func _pivoter(sens: float) -> void:
	_lacet = MiseEnPage.lacet_tourne(_lacet, sens)
	if _pivotement != null:
		_pivotement.kill()
	_pivotement = create_tween()
	_pivotement.tween_property(_pivot, "rotation:y", _lacet, DUREE_QUART_S)
	_pivotement.tween_callback(func() -> void: _survoler(_case_sous(get_viewport().get_mouse_position())))


func _zoomer(sens: float) -> void:
	_camera.position.z = MiseEnPage.distance_zoomee(_camera.position.z, sens, DISTANCE_MIN, DISTANCE_MAX)
	_survoler(_case_sous(get_viewport().get_mouse_position()))


## La case du sol sous `point` (le plan y = 0), `null` hors du plateau.
func _case_sous(point: Vector2) -> Variant:
	var sol: Variant = Plane(Vector3.UP, 0.0).intersects_ray(_camera.project_ray_origin(point), _camera.project_ray_normal(point))
	if sol == null:
		return null
	var case := MiseEnPage.case_du_point(sol)
	return case if _bornes.has_point(case) else null
