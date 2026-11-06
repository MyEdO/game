## Le plateau 3D : le sol du plateau de la scène (`vue.plateau`), ses murs et ses portes fermées, chaque combattant à
## sa case (`voisins`) ou, en exploration, le meneur du groupe à la case du groupe, chacun sous son corps (`vue.corps`,
## aucun sous son `refus`), et chaque entité de la scène nommée à sa case, les surbrillances des cases que la vue peint
## (`vue.cases`), des cibles, des entités nommées et de l'aperçu du premier clic, et la case sous le pointeur jusqu'au
## clic ; caméra pivotante (Q/E, par quart de tour) et zoomable (molette). Il ne rend que la case cliquée.
class_name Plateau
extends Node3D

signal case_cliquee(case: Vector2i)
## Le corps d'un combattant dessiné a changé (`Combattant.habille`).
signal habille

const ITEM_SOL := 0
const ITEM_BLOQUANT := 1
const ITEM_ATTEIGNABLE := 2
const ITEM_CIBLE := 3
const ITEM_SURVOL := 4
const DUREE_QUART_S := 0.25
const DISTANCE_MIN := 6.0
const DISTANCE_MAX := 40.0

@export var scene_combattant: PackedScene
@export var mesh_mur: BoxMesh
@export var mesh_porte: BoxMesh

@onready var _sol: GridMap = $Sol
@onready var _surbrillance: GridMap = $Surbrillance
@onready var _combattants: Node3D = $Combattants
@onready var _aretes: Node3D = $Aretes
@onready var _pivot: Node3D = $Pivot
@onready var _camera: Camera3D = $Pivot/Inclinaison/Camera

var _bornes := Rect2i()
var _modeles: Dictionary = {}
var _entites: Dictionary = {}
var _aretes_posees: Array = []
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
	if vue.plateau != null:
		_poser_les_aretes(vue.plateau.aretes)
	var combat: Variant = vue.projection.combat
	var exploration: Variant = vue.projection.exploration
	var actif: Variant = null if combat == null or combat.actif == null else combat.actif.id
	var dessines: Array = []
	if combat != null:
		dessines = combat.voisins.liste
	elif exploration != null:
		dessines = exploration.heros.slice(0, 1)
		_nommer_les_entites(exploration.entites.liste)
	for c in dessines:
		if c.pos == null:
			continue
		var lieu := _monde(Vector2i(int(c.pos[0]), int(c.pos[1])))
		if not _modeles.has(c.id):
			var modele: Combattant = scene_combattant.instantiate()
			modele.position = lieu
			_combattants.add_child(modele)
			modele.habille.connect(habille.emit)
			_modeles[c.id] = modele
		_modeles[c.id].montrer(c, lieu, c.id == actif, null if vue.corps.refus != null else vue.corps.combattants.get(c.id), vue.plateau.metresParCase)
	for ligne in journal:
		var e: Variant = ligne.get("evenement")
		if e != null and _modeles.has(e.get("actorId", "")) and _modeles.has(e.get("targetId", "")) and e.actorId != e.targetId:
			_modeles[e.actorId].agir_vers(_modeles[e.targetId].position)
			_modeles[e.targetId].subir()
	_peindre()


## Chaque mur et chaque porte fermée sur le côté de sa case ; une porte ouverte laisse le passage vide.
func _poser_les_aretes(aretes: Array) -> void:
	if aretes == _aretes_posees:
		return
	_aretes_posees = aretes
	for n in _aretes.get_children():
		n.queue_free()
	for a in aretes:
		if a.ouverte:
			continue
		var arete := MeshInstance3D.new()
		arete.mesh = mesh_porte if a.porte else mesh_mur
		var sens := Vector2(a.sens.x, a.sens.y)
		arete.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), arete.mesh.size.y)
		arete.rotation.y = MiseEnPage.lacet_d_arete(sens)
		arete.scale.x = MiseEnPage.longueur_d_arete(sens)
		_aretes.add_child(arete)


## Chaque entité de la scène nommée au-dessus de sa case.
func _nommer_les_entites(entites: Array) -> void:
	for e in entites:
		if _entites.has(e.id) or e.nom == null:
			continue
		var nom := Label3D.new()
		nom.text = e.nom
		nom.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		nom.no_depth_test = true
		nom.position = MiseEnPage.au_dessus_de_la_case(Vector2i(int(e.pos[0]), int(e.pos[1])))
		_entites[e.id] = nom
		add_child(nom)


## Par id de combattant dessiné, ce que porte son corps (`Combattant.corps`).
func corps() -> Dictionary:
	var portes := {}
	for id in _modeles:
		portes[id] = _modeles[id].corps()
	return portes


## Le point de l'écran de la case de l'aperçu du premier clic (sa case, ou celle du combattant qu'il vise), `null` sans
## aperçu.
func point_de_l_apercu() -> Variant:
	var combat: Variant = _vue.get("projection", {}).get("combat")
	var apercu: Variant = null if combat == null else combat.apercu
	if apercu == null:
		return null
	var case: Variant = apercu.case
	for c in combat.voisins.liste:
		if c.id == apercu.cible:
			case = c.pos
	if case == null:
		return null
	return _camera.unproject_position(_monde(Vector2i(int(case[0]), int(case[1]))))


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


## Les cases peintes : celles de la vue, les cibles, l'aperçu, les entités nommées de l'exploration, puis la case sous le pointeur.
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
	var exploration: Variant = _vue.get("projection", {}).get("exploration")
	if exploration != null:
		for e in exploration.entites.liste:
			if e.nom != null:
				_surligner(Vector2i(int(e.pos[0]), int(e.pos[1])), ITEM_CIBLE)
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
