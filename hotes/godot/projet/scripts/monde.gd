## Le monde 3D d'une scène, que le plateau du jeu et l'éditeur de carte instancient tous deux : le volume du monde
## (`monde`, `CONTRAT.md`, section « Monde ») à l'échelle d'une unité par case, rendu et touché des deux côtés, sa lumière,
## et la caméra pivotante (Q/E, par quart de tour) et zoomable (molette) centrée sur lui. Il rend la case du triangle que
## le rayon du pointeur touche et le point de la carte touché, et le point de l'écran d'un lieu ; il pose les plaques de
## surbrillance que lui passe qui l'instancie, les arêtes de la scène (murs, portes, seuils des portes ouvertes) et l'arête
## choisie ; tout autre chose posée sur le monde appartient à qui l'instancie.
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
## Ce qui se pose sur une arête : un mur, une porte fermée, le seuil d'une porte ouverte, et la gaine de l'arête choisie.
@export var mesh_mur: BoxMesh
@export var mesh_porte: BoxMesh
@export var mesh_seuil: BoxMesh
@export var mesh_arete_choisie: BoxMesh
## La matière d'une surface sans texture : la couleur de ses sommets.
@export var couleur_des_sommets: StandardMaterial3D
## Le modèle de la matière d'une surface texturée, projetée sur ses trois axes (triplanaire) dans le repère du volume.
@export var matiere_texturee: StandardMaterial3D

@onready var _volume: Node3D = $Volume
@onready var _maillage: MeshInstance3D = $Volume/Maillage
@onready var _forme: CollisionShape3D = $Volume/Corps/Forme
@onready var _pivot: Node3D = $Pivot
@onready var _camera: Camera3D = $Pivot/Inclinaison/Camera
@onready var _surbrillance: Node3D = $Surbrillance
@onready var _aretes: Node3D = $Aretes
@onready var _arete_choisie: MeshInstance3D = $AreteChoisie

## La case `[x, y]` de chaque triangle du maillage du monde, dans son ordre.
var _cases_des_triangles: Array = []
## Par couche `z`, le sol de chaque case, `[y][x]`.
var _sols: Dictionary = {}
var _lacet := 0.0
## Les arêtes posées et leur couche (`poser_les_aretes`).
var _aretes_posees: Array = []
var _couche_des_aretes := 0
## Par nom de matière, la matière de rendu de ses surfaces, d'un `poser` à l'autre.
var _matieres := {}
var _pivotement: Tween


func _ready() -> void:
	_lacet = _pivot.rotation.y


## Le volume du monde de la scène (`monde`) à l'échelle d'une unité par case, sa case (0, 0) sur la case (0, 0) du
## monde : son maillage, une surface par matière (sol, relief, décor), texturée ou colorée par sommet (`_matiere`),
## rendu des deux côtés, le même en forme que le rayon du pointeur touche des deux côtés, le sol de chaque case de
## chaque couche, et la caméra centrée sur lui. Godot tient pour face avant le sens horaire, le volume le sens trigonométrique : chaque
## tableau retourné en entier retourne chaque triangle, et l'ordre des triangles avec lui, que suivent leurs cases.
func poser(monde: Dictionary) -> void:
	var echelle := MiseEnPage.echelle_metrique(monde.metresParCase)
	_volume.scale = Vector3(echelle, echelle, echelle)
	_volume.position = MiseEnPage.centre_de_case(Vector2i.ZERO, 0.0)
	var sommets := PackedFloat32Array(monde.positions).to_byte_array().to_vector3_array()
	var normales := PackedFloat32Array(monde.normales).to_byte_array().to_vector3_array()
	var couleurs := PackedFloat32Array(monde.couleurs).to_byte_array().to_color_array()
	var maillage := ArrayMesh.new()
	for indice in monde.surfaces.size():
		var surface: Dictionary = monde.surfaces[indice]
		var tableaux := []
		tableaux.resize(Mesh.ARRAY_MAX)
		tableaux[Mesh.ARRAY_VERTEX] = _retournes(sommets.slice(int(surface.debut), int(surface.fin)))
		tableaux[Mesh.ARRAY_NORMAL] = _retournes(normales.slice(int(surface.debut), int(surface.fin)))
		tableaux[Mesh.ARRAY_COLOR] = _retournes(couleurs.slice(int(surface.debut), int(surface.fin)))
		maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
		maillage.surface_set_material(indice, _matiere(surface.matiere))
	_maillage.mesh = maillage
	sommets.reverse()
	_cases_des_triangles = monde.cases.duplicate()
	_cases_des_triangles.reverse()
	var forme := ConcavePolygonShape3D.new()
	forme.set_faces(sommets)
	forme.backface_collision = true
	_forme.shape = forme
	_sols.clear()
	for couche in monde.hauteurs:
		_sols[int(couche.z)] = couche.rangees.map(func(rangee: Array) -> Array: return rangee.map(func(hauteur: float) -> float: return MiseEnPage.hauteur_au_plateau(hauteur, monde.metresParCase)))
	_pivot.position = MiseEnPage.centre_du_plateau(taille())


## `tableau` retourné en entier : chaque triangle change de sens (`poser`).
func _retournes(tableau: Variant) -> Variant:
	tableau.reverse()
	return tableau


## La matière de rendu des surfaces de la matière `nom` (`<domaine>--<id>`, `CONTRAT.md`, section « Monde ») : sa
## texture (`res://textures/<nom>.jpg`) et son relief (`<nom>.normale.jpg`) s'ils sont au projet, sinon la couleur de
## ses sommets.
func _matiere(nom: String) -> Material:
	if not _matieres.has(nom):
		var couleur := "res://textures/%s.jpg" % nom
		if ResourceLoader.exists(couleur):
			var matiere := matiere_texturee.duplicate() as StandardMaterial3D
			matiere.albedo_texture = load(couleur)
			matiere.uv1_scale = MiseEnPage.echelle_de_motif()
			var relief := "res://textures/%s.normale.jpg" % nom
			if ResourceLoader.exists(relief):
				matiere.normal_enabled = true
				matiere.normal_texture = load(relief)
			_matieres[nom] = matiere
		else:
			_matieres[nom] = couleur_des_sommets
	return _matieres[nom]


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


## Les arêtes `aretes` (`CONTRAT.md`, section « Plateau ») de la couche `z`, chacune sur le côté de sa case, posée sur
## le sol de sa case : un mur, une porte fermée, ou le seuil d'une porte ouverte ; à la place des précédentes.
func poser_les_aretes(aretes: Array, z := 0) -> void:
	if aretes == _aretes_posees and z == _couche_des_aretes:
		return
	_aretes_posees = aretes
	_couche_des_aretes = z
	for arete in _aretes.get_children():
		_aretes.remove_child(arete)
		arete.free()
	for a in aretes:
		var arete := MeshInstance3D.new()
		_poser_sur_l_arete(arete, mesh_seuil if a.ouverte else mesh_porte if a.porte else mesh_mur, a, z)
		_aretes.add_child(arete)


## Le nombre d'arêtes posées sur le monde.
func nombre_d_aretes() -> int:
	return _aretes.get_child_count()


## La gaine de l'arête choisie sur l'arête `arete` de la couche `z`, aucune si `arete` est `null`.
func choisir_l_arete(arete: Variant, z := 0) -> void:
	_arete_choisie.visible = arete != null
	if arete != null:
		_poser_sur_l_arete(_arete_choisie, mesh_arete_choisie, arete, z)


## Le maillage `mesh` posé par `instance` sur l'arête `a` de la couche `z`, debout sur le sol de sa case.
func _poser_sur_l_arete(instance: MeshInstance3D, mesh: BoxMesh, a: Dictionary, z: int) -> void:
	instance.mesh = mesh
	var sens := Vector2(a.sens.x, a.sens.y)
	instance.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), sol(Vector2i(int(a.case.x), int(a.case.y)), z), mesh.size.y)
	instance.rotation.y = MiseEnPage.lacet_d_arete(sens)
	instance.scale.x = MiseEnPage.longueur_d_arete(sens)


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
