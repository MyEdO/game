## Le plateau 3D : le volume du monde de la scène (`monde`, `CONTRAT.md`, section « Monde »), les murs et les portes
## fermées du plateau (`vue.plateau`), chaque combattant à sa case (`voisins`) ou, en exploration, le meneur du groupe à
## la case du groupe, chacun sous son corps (`vue.corps`, aucun sous son `refus`), et chaque entité de la scène nommée à
## sa case, les surbrillances des cases que la vue peint (`vue.cases`), des cibles, des entités nommées et de l'aperçu
## du premier clic, et la case sous le pointeur jusqu'au clic, chacun sur le sol de sa case ; caméra pivotante (Q/E, par
## quart de tour) et zoomable (molette). Il ne rend que la case cliquée : celle du triangle du monde que le rayon du
## pointeur touche.
class_name Plateau
extends Node3D

signal case_cliquee(case: Vector2i)
## Le corps d'un combattant dessiné a changé (`Combattant.habille`).
signal habille

const ITEM_ATTEIGNABLE := 0
const ITEM_CIBLE := 1
const ITEM_SURVOL := 2
const DUREE_QUART_S := 0.25
const DISTANCE_MIN := 6.0
const DISTANCE_MAX := 40.0

@export var scene_combattant: PackedScene
@export var mesh_mur: BoxMesh
@export var mesh_porte: BoxMesh
## Les plaques des surbrillances, par item (`ITEM_*`), chacune posée sans ombre.
@export var surbrillances: MeshLibrary

@onready var _monde: Node3D = $Monde
@onready var _maillage: MeshInstance3D = $Monde/Maillage
@onready var _forme: CollisionShape3D = $Monde/Corps/Forme
@onready var _surbrillance: Node3D = $Surbrillance
@onready var _combattants: Node3D = $Combattants
@onready var _aretes: Node3D = $Aretes
@onready var _pivot: Node3D = $Pivot
@onready var _camera: Camera3D = $Pivot/Inclinaison/Camera

var _bornes := Rect2i()
## La case `[x, y]` de chaque triangle du maillage du monde, dans son ordre.
var _cases_des_triangles: Array = []
## Le sol de chaque case de la couche 0 sur le plateau, `[y][x]`.
var _sols: Array = []
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
		_bornes = Rect2i(0, 0, int(vue.plateau.w), int(vue.plateau.h))
		_pivot.position = MiseEnPage.centre_du_plateau(_bornes.size)
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
		var lieu := _lieu(Vector2i(int(c.pos[0]), int(c.pos[1])))
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
		var case := Vector2i(int(e.pos[0]), int(e.pos[1]))
		nom.position = MiseEnPage.au_dessus_de_la_case(case, _sol(case))
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
	return _camera.unproject_position(_lieu(Vector2i(int(case[0]), int(case[1]))))


## Le point de l'écran de chaque case du plateau, par sa clé `x,y`.
func points() -> Dictionary:
	var points := {}
	for y in _bornes.size.y:
		for x in _bornes.size.x:
			var point := _camera.unproject_position(_lieu(Vector2i(x, y)))
			points["%d,%d" % [x, y]] = [point.x, point.y]
	return points


## Le volume du monde de la scène (`monde`) à l'échelle du plateau, sa case (0, 0) sur celle du plateau : son maillage
## coloré par sommet, rendu des deux côtés, le même en forme que le rayon du pointeur touche des deux côtés, et le sol
## de chaque case de la couche 0. Godot tient pour face avant le sens horaire, le volume le sens trigonométrique :
## chaque tableau retourné en entier retourne chaque triangle, et l'ordre des triangles avec lui, que suivent leurs
## cases.
func poser_le_monde(monde: Dictionary) -> void:
	var echelle := MiseEnPage.echelle_metrique(monde.metresParCase)
	_monde.scale = Vector3(echelle, echelle, echelle)
	_monde.position = MiseEnPage.centre_de_case(Vector2i.ZERO, 0.0)
	var sommets := PackedFloat32Array(monde.positions).to_byte_array().to_vector3_array()
	var normales := PackedFloat32Array(monde.normales).to_byte_array().to_vector3_array()
	var couleurs := PackedFloat32Array(monde.couleurs).to_byte_array().to_color_array()
	sommets.reverse()
	normales.reverse()
	couleurs.reverse()
	_cases_des_triangles = monde.cases.duplicate()
	_cases_des_triangles.reverse()
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = sommets
	tableaux[Mesh.ARRAY_NORMAL] = normales
	tableaux[Mesh.ARRAY_COLOR] = couleurs
	var maillage := ArrayMesh.new()
	maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	_maillage.mesh = maillage
	var forme := ConcavePolygonShape3D.new()
	forme.set_faces(sommets)
	forme.backface_collision = true
	_forme.shape = forme
	_sols.clear()
	for couche in monde.hauteurs:
		if couche.z == 0:
			for rangee in couche.rangees:
				_sols.append(rangee.map(func(hauteur: float) -> float: return MiseEnPage.hauteur_au_plateau(hauteur, monde.metresParCase)))


## Le sol de la case `case` sur le plateau.
func _sol(case: Vector2i) -> float:
	return _sols[case.y][case.x]


func _lieu(case: Vector2i) -> Vector3:
	return MiseEnPage.centre_de_case(case, _sol(case))


## Les cases peintes : celles de la vue, les cibles, l'aperçu, les entités nommées de l'exploration, puis la case sous le pointeur.
func _peindre() -> void:
	for plaque in _surbrillance.get_children():
		_surbrillance.remove_child(plaque)
		plaque.free()
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


## La plaque de l'item `item` sur le sol de la case `case`, à la place de celle qu'elle portait.
func _surligner(case: Vector2i, item: int) -> void:
	var nom := "%d,%d" % [case.x, case.y]
	var ancienne := _surbrillance.get_node_or_null(nom)
	if ancienne != null:
		_surbrillance.remove_child(ancienne)
		ancienne.free()
	var plaque := MeshInstance3D.new()
	plaque.name = nom
	plaque.mesh = surbrillances.get_item_mesh(item)
	plaque.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	plaque.transform = surbrillances.get_item_mesh_transform(item).translated(_lieu(case))
	_surbrillance.add_child(plaque)


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


## La case du triangle du monde que le rayon de la caméra par `point` touche le premier, `null` hors du monde.
func _case_sous(point: Vector2) -> Variant:
	var rayon := PhysicsRayQueryParameters3D.create(_camera.project_ray_origin(point), _camera.project_position(point, _camera.far))
	var touche := get_world_3d().direct_space_state.intersect_ray(rayon)
	if touche.is_empty():
		return null
	var case: Array = _cases_des_triangles[touche.face_index]
	return Vector2i(int(case[0]), int(case[1]))
