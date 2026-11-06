## Le monde 3D d'une scène, que le plateau du jeu et l'éditeur de carte instancient tous deux : le volume du monde
## (`monde`, `CONTRAT.md`, section « Monde ») à l'échelle d'une unité par case, rendu et touché des deux côtés, sa lumière,
## et la caméra pivotante (Q/E, par quart de tour) et zoomable (molette) centrée sur lui. Il rend la case du triangle que
## le rayon du pointeur touche et le point de la carte touché, et le point de l'écran d'un lieu ; il pose les plaques de
## surbrillance que lui passe qui l'instancie, à qui appartient tout autre chose posée sur le monde.
class_name Monde
extends Node3D

## La caméra a pivoté ou zoomé : ce qui est sous le pointeur a pu changer.
signal cadrage_change

const DUREE_QUART_S := 0.25
const DISTANCE_MIN := 6.0
const DISTANCE_MAX := 40.0
## Les items de `surbrillances`.
const ITEM_ATTEIGNABLE := 0
const ITEM_CIBLE := 1
const ITEM_SURVOL := 2

## Les plaques des surbrillances, par item (`ITEM_*`), chacune posée sans ombre.
@export var surbrillances: MeshLibrary

@onready var _volume: Node3D = $Volume
@onready var _maillage: MeshInstance3D = $Volume/Maillage
@onready var _forme: CollisionShape3D = $Volume/Corps/Forme
@onready var _pivot: Node3D = $Pivot
@onready var _camera: Camera3D = $Pivot/Inclinaison/Camera
@onready var _surbrillance: Node3D = $Surbrillance

## La case `[x, y]` de chaque triangle du maillage du monde, dans son ordre.
var _cases_des_triangles: Array = []
## Par couche `z`, le sol de chaque case, `[y][x]`.
var _sols: Dictionary = {}
var _lacet := 0.0
var _pivotement: Tween


func _ready() -> void:
	_lacet = _pivot.rotation.y


## Le volume du monde de la scène (`monde`) à l'échelle d'une unité par case, sa case (0, 0) sur la case (0, 0) du
## monde : son maillage coloré par sommet, rendu des deux côtés, le même en forme que le rayon du pointeur touche des
## deux côtés, le sol de chaque case de chaque couche, et la caméra centrée sur lui. Godot tient pour face avant le sens
## horaire, le volume le sens trigonométrique : chaque tableau retourné en entier retourne chaque triangle, et l'ordre
## des triangles avec lui, que suivent leurs cases.
func poser(monde: Dictionary) -> void:
	var echelle := MiseEnPage.echelle_metrique(monde.metresParCase)
	_volume.scale = Vector3(echelle, echelle, echelle)
	_volume.position = MiseEnPage.centre_de_case(Vector2i.ZERO, 0.0)
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
		_sols[int(couche.z)] = couche.rangees.map(func(rangee: Array) -> Array: return rangee.map(func(hauteur: float) -> float: return MiseEnPage.hauteur_au_plateau(hauteur, monde.metresParCase)))
	_pivot.position = MiseEnPage.centre_du_plateau(taille())


## La taille de la carte, en cases.
func taille() -> Vector2i:
	return Vector2i(_sols[0][0].size(), _sols[0].size())


## Le sol de la case `case` de la couche `z`.
func sol(case: Vector2i, z := 0) -> float:
	return _sols[z][case.y][case.x]


## Le centre du sol de la case `case` de la couche `z`.
func lieu(case: Vector2i, z := 0) -> Vector3:
	return MiseEnPage.centre_de_case(case, sol(case, z))


## Le point de l'écran du centre du sol de chaque case de la couche `z`, par sa clé `x,y`.
func points(z := 0) -> Dictionary:
	var points := {}
	var t := taille()
	for y in t.y:
		for x in t.x:
			var point := a_l_ecran(lieu(Vector2i(x, y), z))
			points["%d,%d" % [x, y]] = [point.x, point.y]
	return points


## Les plaques `plaques` (par case `Vector3i(x, y, z)`, l'item de `surbrillances`), chacune sur le sol de sa case, à la
## place des précédentes.
func peindre(plaques: Dictionary) -> void:
	for plaque in _surbrillance.get_children():
		_surbrillance.remove_child(plaque)
		plaque.free()
	for c: Vector3i in plaques:
		var item: int = plaques[c]
		var plaque := MeshInstance3D.new()
		plaque.mesh = surbrillances.get_item_mesh(item)
		plaque.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		plaque.transform = surbrillances.get_item_mesh_transform(item).translated(lieu(Vector2i(c.x, c.y), c.z))
		_surbrillance.add_child(plaque)


## Le point de l'écran du lieu `lieu` du monde.
func a_l_ecran(lieu: Vector3) -> Vector2:
	return _camera.unproject_position(lieu)


## Ce que le rayon de la caméra par `point` touche le premier : `{ case, f }`, la case de son triangle et le point de la
## carte touché (`MiseEnPage.point_de_carte_du_lieu`), `null` hors du monde.
func touche_sous(point: Vector2) -> Variant:
	var rayon := PhysicsRayQueryParameters3D.create(_camera.project_ray_origin(point), _camera.project_position(point, _camera.far))
	var touche := get_world_3d().direct_space_state.intersect_ray(rayon)
	if touche.is_empty():
		return null
	var case: Array = _cases_des_triangles[touche.face_index]
	return {case = Vector2i(int(case[0]), int(case[1])), f = MiseEnPage.point_de_carte_du_lieu(to_local(touche.position))}


## La case du triangle du monde que le rayon de la caméra par `point` touche le premier, `null` hors du monde.
func case_sous(point: Vector2) -> Variant:
	var touche: Variant = touche_sous(point)
	return null if touche == null else touche.case


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pivoter_gauche"):
		_pivoter(1.0)
	elif event.is_action_pressed("pivoter_droite"):
		_pivoter(-1.0)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
		_zoomer(-1.0)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		_zoomer(1.0)
	else:
		return
	get_viewport().set_input_as_handled()


func _pivoter(sens: float) -> void:
	_lacet = MiseEnPage.lacet_tourne(_lacet, sens)
	if _pivotement != null:
		_pivotement.kill()
	_pivotement = create_tween()
	_pivotement.tween_property(_pivot, "rotation:y", _lacet, DUREE_QUART_S)
	_pivotement.tween_callback(cadrage_change.emit)


func _zoomer(sens: float) -> void:
	_camera.position.z = MiseEnPage.distance_zoomee(_camera.position.z, sens, DISTANCE_MIN, DISTANCE_MAX)
	cadrage_change.emit()
