## Le volume d'une scène tel que le jeu le dessine, que le monde du plateau et de l'éditeur (`Monde`) et l'atelier
## instancient tous deux : le volume du monde (`monde`, `CONTRAT.md`, section « Monde ») mis à l'échelle d'une unité par
## case, une surface par matière, texturée ou colorée par sommet, rendue des deux côtés hors des surfaces d'un navire, la
## mer de chaque navire bordée par sa coque (`border_la_mer`), et l'ombre de ce que le regard en retire ; les nappes de
## toit et les couronnes crénelées des murs (`poser_les_nappes`) ; les arêtes de la scène, en unités de plateau, chacune
## la pièce du kit des arêtes (`KIT`) que l'arête nomme, sinon sa boîte ; et ce que qui l'instancie en cache à la caméra
## (`cacher`) ou en retire (`retirer_les_couronnes`).
class_name VolumeDeScene
extends Node3D

## Netteté de la projection d'une texture de matière sur les trois axes (`texturer`).
const NETTETE_DU_MOTIF := 4.0
## Le kit des arêtes (`CONTRAT.md`, méthode `aretes`) : une pièce par nœud racine, `<famille>--<pièce>`.
const KIT := "res://kit/kit.glb"

## Ce qui se pose sur une arête dont le kit n'a pas la pièce, ou sans kit au projet : un mur, une porte fermée, le seuil
## d'une porte ouverte ou d'une brèche.
@export var mesh_mur: BoxMesh
@export var mesh_porte: BoxMesh
@export var mesh_seuil: BoxMesh
## La matière d'une surface sans texture : la couleur de ses sommets.
@export var couleur_des_sommets: StandardMaterial3D
## Le modèle de la matière d'une surface texturée, projetée sur ses trois axes (triplanaire) dans le repère du volume.
@export var matiere_texturee: StandardMaterial3D

@onready var _volume: Node3D = $Volume
@onready var _maillage: MeshInstance3D = $Volume/Maillage
@onready var _ombre: MeshInstance3D = $Volume/Ombre
@onready var _toits: Node3D = $Volume/Toits
@onready var _couronnes: Node3D = $Volume/Couronnes
@onready var _aretes: Node3D = $Aretes

## Les mètres d'une case du dernier volume posé.
var metres_par_case := 1.0
## Le dernier volume posé (`poser`), `null` avant le premier.
var _monde_pose: Variant = null
## Le nombre de triangles peints du dernier volume posé (`_mailler`).
var _triangles := 0
## Par id de navire, le contour de sa coque à sa flottaison dans le plan du volume (`border_la_mer`).
var _coques := {}
## Par nom de matière, la matière de rendu de ses surfaces, d'un `poser` à l'autre.
var _matieres := {}
## Le kit des arêtes, hors de l'arbre, `null` sans kit au projet.
var _kit: Node3D
## Les clés des arêtes, des nappes de toit et des couronnes cachées à la caméra (`cacher`).
var _cachees := {aretes = [], toits = [], couronnes = []}
## Les clés des couronnes retirées (`retirer_les_couronnes`).
var _retirees: Array = []


func _ready() -> void:
	if ResourceLoader.exists(KIT):
		_kit = (load(KIT) as PackedScene).instantiate()


func _notification(quoi: int) -> void:
	if quoi == NOTIFICATION_PREDELETE and _kit != null:
		_kit.free()


## Le volume du monde (`monde`) à l'échelle d'une unité par case, sa case (0, 0) sur la case (0, 0) du plateau : son
## maillage, une surface par matière (sol, relief, décor), texturée ou colorée par sommet (`_matiere`), rendu des deux
## côtés hors des surfaces d'un navire, la mer de chacun bordée par sa coque, et l'ombre de ce que le regard en retire
## (`_mailler`).
func poser(monde: Dictionary) -> void:
	_monde_pose = monde
	metres_par_case = monde.metresParCase
	var echelle := MiseEnPage.echelle_metrique(monde.metresParCase)
	_volume.scale = Vector3(echelle, echelle, echelle)
	_volume.position = MiseEnPage.centre_de_case(Vector2i.ZERO, 0.0)
	_mailler()


## Rien de posé : ni volume, ni nappe, ni arête.
func vider() -> void:
	_monde_pose = null
	_maillage.mesh = null
	_ombre.mesh = null
	_triangles = 0
	poser_les_nappes([], [])
	poser_les_aretes([])


## La mer du navire `navire` (les surfaces `flottaison` du volume, `CONTRAT.md`, section « Monde ») bordée par sa coque,
## de contour `contour` dans le plan horizontal du repère global (`MontageDeVehicule.contour_sous`) : le maillage du
## volume la peint hors de lui seulement.
func border_la_mer(navire: String, contour: PackedVector2Array) -> void:
	var dans_le_volume := PackedVector2Array()
	for point in contour:
		var local := _volume.to_local(Vector3(point.x, 0.0, point.y))
		dans_le_volume.append(Vector2(local.x, local.z))
	_coques[navire] = dans_le_volume
	if _monde_pose != null:
		_mailler()


## Le maillage du dernier volume posé (`_maillage_de`), et celui de son ombre (`ombre`), que la caméra ne voit pas et
## qui projette son ombre (`SHADOWS_ONLY`, #3758) ; le nombre de ses triangles peints retenu.
func _mailler() -> void:
	_maillage.mesh = _maillage_de(_monde_pose)
	_ombre.mesh = _maillage_de(_monde_pose.ombre)
	_triangles = int(MiseEnPage.triangles(_maillage.mesh.get_faces().size()))


## Les nappes de toit (`toits`) et les couronnes crénelées des murs (`couronnes`) de la scène (`CONTRAT.md`, section
## « Monde »), chacune son maillage sous le volume, à la place des précédentes, cachée si `cacher` la nomme, retirée si
## `retirer_les_couronnes` la nomme.
func poser_les_nappes(toits: Array, couronnes: Array) -> void:
	_poser_sous(_toits, toits)
	_poser_sous(_couronnes, couronnes)
	_montrer_le_pose()


## Les arêtes `aretes` (`CONTRAT.md`, méthode `aretes`), chacune sur le côté de sa case, debout à son pied (`_piece`),
## cachée si `cacher` la nomme ; réconciliées par clé : une arête inchangée à la même échelle garde sa pièce, une arête
## changée (une porte ouverte) reçoit la sienne, une arête partie la quitte.
func poser_les_aretes(aretes: Array) -> void:
	var posees := {}
	for piece in _aretes.get_children():
		posees[piece.get_meta("cle")] = piece
	for a: Dictionary in aretes:
		var posee: Node3D = posees.get(a.cle)
		posees.erase(a.cle)
		var voulue := [a, metres_par_case]
		if posee != null and posee.get_meta("posee") == voulue:
			continue
		if posee != null:
			_aretes.remove_child(posee)
			posee.free()
		var piece := _piece(a)
		piece.set_meta("cle", a.cle)
		piece.set_meta("posee", voulue)
		_aretes.add_child(piece)
	for partie: Node3D in posees.values():
		_aretes.remove_child(partie)
		partie.free()
	_montrer_le_pose()


## Chaque arête cachée à la caméra si `aretes` la nomme, chaque nappe de toit si `toits` la nomme, chaque couronne si
## `couronnes` la nomme, par leur clé (`_cacher_sous`) ; montrées sinon, et de même pour celles qui se poseront.
func cacher(aretes: Array, toits: Array, couronnes: Array) -> void:
	_cachees = {aretes = aretes, toits = toits, couronnes = couronnes}
	_montrer_le_pose()


## Chaque couronne que `cles` nomme retirée, ni vue ni ombre ; montrée sinon, et de même pour celles qui se poseront.
func retirer_les_couronnes(cles: Array) -> void:
	_retirees = cles
	_montrer_le_pose()


func _montrer_le_pose() -> void:
	_cacher_sous(_aretes, _cachees.aretes)
	_cacher_sous(_toits, _cachees.toits)
	_cacher_sous(_couronnes, _cachees.couronnes)
	for couronne: Node3D in _couronnes.get_children():
		couronne.visible = not _retirees.has(couronne.get_meta("cle"))


## Ce qui est posé : le nombre de triangles peints du volume, d'arêtes et de nappes de toit posées, et de couronnes
## montrées.
func ce_qui_est_pose() -> Dictionary:
	return {
		triangles = _triangles,
		aretes = _aretes.get_child_count(),
		toits = _toits.get_child_count(),
		couronnes = _couronnes.get_children().filter(func(couronne: Node3D) -> bool: return couronne.visible).size(),
	}


## Les nappes `nappes` sous `parent`, chacune son maillage nommé par sa `cle`, à la place des précédentes.
func _poser_sous(parent: Node3D, nappes: Array) -> void:
	for nappe in parent.get_children():
		parent.remove_child(nappe)
		nappe.free()
	for nappe in nappes:
		var instance := MeshInstance3D.new()
		instance.mesh = _maillage_de(nappe)
		instance.set_meta("cle", nappe.cle)
		parent.add_child(instance)


## Chaque pièce sous `parent` que `cles` nomme cachée à la caméra, chacun de ses maillages en ombre seule
## (`SHADOWS_ONLY`, #3758), montrée sinon.
func _cacher_sous(parent: Node3D, cles: Array) -> void:
	for piece: Node3D in parent.get_children():
		var ombre := GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY if cles.has(piece.get_meta("cle")) else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		var maillages := piece.find_children("*", "GeometryInstance3D", true, false)
		if piece is GeometryInstance3D:
			maillages.append(piece)
		for maillage: GeometryInstance3D in maillages:
			maillage.cast_shadow = ombre


## Le maillage d'une géométrie du monde (`positions`, `normales`, `couleurs`, `surfaces`) : une surface par matière,
## texturée ou colorée par sommet (`_matiere`), chaque tableau retourné en entier (`_retournes`) ; sans les surfaces
## d'un navire (`navire`), que le rayon du pointeur touche et que le modèle du navire montre ; la mer d'un navire
## (`flottaison`) hors du contour de sa coque (`border_la_mer`, `_hors_du_contour`), entière tant qu'il n'est pas connu.
## Godot tient pour face avant le sens horaire, le volume le sens trigonométrique : chaque tableau retourné en entier
## retourne chaque triangle.
func _maillage_de(geometrie: Dictionary) -> ArrayMesh:
	var sommets := PackedFloat32Array(geometrie.positions).to_byte_array().to_vector3_array()
	var normales := PackedFloat32Array(geometrie.normales).to_byte_array().to_vector3_array()
	var couleurs := PackedFloat32Array(geometrie.couleurs).to_byte_array().to_color_array()
	var maillage := ArrayMesh.new()
	for surface: Dictionary in geometrie.surfaces:
		if surface.has("navire"):
			continue
		var tableaux := []
		tableaux.resize(Mesh.ARRAY_MAX)
		tableaux[Mesh.ARRAY_VERTEX] = sommets.slice(int(surface.debut), int(surface.fin))
		tableaux[Mesh.ARRAY_NORMAL] = normales.slice(int(surface.debut), int(surface.fin))
		tableaux[Mesh.ARRAY_COLOR] = couleurs.slice(int(surface.debut), int(surface.fin))
		if surface.has("flottaison") and _coques.has(surface.flottaison):
			tableaux = _hors_du_contour(tableaux, _coques[surface.flottaison])
		if tableaux[Mesh.ARRAY_VERTEX].is_empty():
			continue
		for rang in [Mesh.ARRAY_VERTEX, Mesh.ARRAY_NORMAL, Mesh.ARRAY_COLOR]:
			tableaux[rang] = _retournes(tableaux[rang])
		var indice := maillage.get_surface_count()
		maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
		maillage.surface_set_material(indice, _matiere(surface.matiere))
	return maillage


## Les triangles horizontaux de `tableaux` (sommets, normales, couleurs) hors du contour convexe `contour` du plan
## horizontal (`Geometry2D.clip_polygons`), triangulés (`Geometry2D.triangulate_polygon`, dans le sens trigonométrique),
## chaque morceau dans le sens, à la hauteur, de la normale et de la couleur de son triangle.
func _hors_du_contour(tableaux: Array, contour: PackedVector2Array) -> Array:
	var sommets: PackedVector3Array = tableaux[Mesh.ARRAY_VERTEX]
	var hors := []
	hors.resize(Mesh.ARRAY_MAX)
	hors[Mesh.ARRAY_VERTEX] = PackedVector3Array()
	hors[Mesh.ARRAY_NORMAL] = PackedVector3Array()
	hors[Mesh.ARRAY_COLOR] = PackedColorArray()
	for triangle: Array in rangs_des_triangles(sommets.size()):
		var premier: Vector3 = sommets[triangle[0]]
		var plan := PackedVector2Array(triangle.map(func(rang: int) -> Vector2: return Vector2(sommets[rang].x, sommets[rang].z)))
		for morceau in Geometry2D.clip_polygons(plan, contour):
			var rangs := Geometry2D.triangulate_polygon(morceau)
			if Geometry2D.is_polygon_clockwise(plan):
				rangs.reverse()
			for rang in rangs:
				hors[Mesh.ARRAY_VERTEX].append(Vector3(morceau[rang].x, premier.y, morceau[rang].y))
				hors[Mesh.ARRAY_NORMAL].append(tableaux[Mesh.ARRAY_NORMAL][triangle[0]])
				hors[Mesh.ARRAY_COLOR].append(tableaux[Mesh.ARRAY_COLOR][triangle[0]])
	return hors


## Les rangs des sommets de chaque triangle d'une liste de `sommets` sommets, trois par triangle, dans leur ordre.
static func rangs_des_triangles(sommets: int) -> Array:
	var premiers := range(0, sommets, 3)
	var seconds := range(1, sommets, 3)
	var troisiemes := range(2, sommets, 3)
	var rangs := []
	for triangle in premiers.size():
		rangs.append([premiers[triangle], seconds[triangle], troisiemes[triangle]])
	return rangs


## `tableau` retourné en entier : chaque triangle change de sens (`_maillage_de`).
func _retournes(tableau: Variant) -> Variant:
	tableau.reverse()
	return tableau


## La matière de rendu des surfaces de la matière `nom` (`<domaine>--<id>`, `CONTRAT.md`, section « Monde ») : texturée
## (`texturer`) si sa texture est au projet, sinon la couleur de ses sommets.
func _matiere(nom: String) -> Material:
	if not _matieres.has(nom):
		var matiere := matiere_texturee.duplicate() as StandardMaterial3D
		_matieres[nom] = matiere if texturer(matiere, nom) else couleur_des_sommets
	return _matieres[nom]


## Le chemin de la texture de la matière `nom` au projet.
static func texture_de(nom: String) -> String:
	return "res://textures/%s.jpg" % nom


## `materiau` habillé de la matière `nom` si sa texture (`res://textures/<nom>.jpg`) est au projet : la texture et son
## relief (`<nom>.normale.jpg`) s'il y est, projetés sur les trois axes du repère du mesh, un motif tous les
## `MiseEnPage.METRES_PAR_MOTIF` ; rend si la texture y est.
static func texturer(materiau: BaseMaterial3D, nom: String) -> bool:
	var couleur := texture_de(nom)
	if not ResourceLoader.exists(couleur):
		return false
	materiau.albedo_texture = load(couleur)
	materiau.uv1_triplanar = true
	materiau.uv1_triplanar_sharpness = NETTETE_DU_MOTIF
	materiau.uv1_scale = MiseEnPage.echelle_de_motif()
	var relief := "res://textures/%s.normale.jpg" % nom
	if ResourceLoader.exists(relief):
		materiau.normal_enabled = true
		materiau.normal_texture = load(relief)
	return true


## La pièce de l'arête `a`, debout à son pied (`a.pied`) : celle du kit, `<famille>--<pièce>`, étirée à la longueur de
## l'arête et à la hauteur de son mur (`MiseEnPage.echelle_de_piece`) ; sinon sa boîte (`_boite`).
func _piece(a: Dictionary) -> Node3D:
	var nom := "%s--%s" % [a.famille, a.piece]
	if _kit == null or a.famille == null or not _kit.has_node(nom):
		var boite := MeshInstance3D.new()
		poser_sur_l_arete(boite, _boite(a.piece), a)
		return boite
	var sens := Vector2(a.sens.x, a.sens.y)
	var piece := Node3D.new()
	piece.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), a.pied, metres_par_case, 0.0)
	piece.rotation.y = MiseEnPage.lacet_d_arete(sens)
	piece.scale = MiseEnPage.echelle_de_piece(sens, a.hauteurM, metres_par_case)
	piece.add_child(_kit.get_node(nom).duplicate())
	return piece


## La boîte de la pièce `piece` d'une arête : le seuil d'une porte ouverte ou d'une brèche, une porte fermée, sinon un
## mur.
func _boite(piece: String) -> BoxMesh:
	match piece:
		"porte-ouverte", "breche":
			return mesh_seuil
		"porte-fermee":
			return mesh_porte
	return mesh_mur


## Le maillage `mesh` posé par `instance` sur l'arête `a`, debout à son pied (`a.pied`).
func poser_sur_l_arete(instance: MeshInstance3D, mesh: BoxMesh, a: Dictionary) -> void:
	instance.mesh = mesh
	var sens := Vector2(a.sens.x, a.sens.y)
	instance.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), a.pied, metres_par_case, mesh.size.y)
	instance.rotation.y = MiseEnPage.lacet_d_arete(sens)
	instance.scale.x = MiseEnPage.longueur_d_arete(sens)
