## Le monde 3D d'une scène, que le plateau du jeu et l'éditeur de carte instancient tous deux : le volume du monde
## (`monde`, `CONTRAT.md`, section « Monde ») à l'échelle d'une unité par case, rendu et touché des deux côtés, sa lumière,
## et ses caméras (`regarder`) : celle des regards `tactique` et `plateau`, aux touches d'un jeu de rôle tactique (A/E
## d'un quart de tour, bouton du milieu tenu librement, molette pour zoomer, ZQSD pour la faire glisser, Origine pour
## revenir au lieu suivi), centrée sur lui puis sur le lieu qu'elle suit (`suivre`) ou qu'on lui pose (`cadrer`), de
## biais en tactique, à la verticale et sans perspective au plateau ; et l'œil du regard `immersion`, posé par qui
## l'instancie (`poser_l_oeil`), qui marche sur le sol touché sous lui (`sol_sous`). Le clavier ne mène rien pendant une saisie (`clavier_libre`). Il rend la caméra
## posée (`camera`), la case du triangle que le rayon du pointeur touche et le point de la carte touché, et le point de l'écran d'un lieu ; il pose les plaques de
## surbrillance et les noms que lui passe qui l'instancie, les arêtes de la scène, chacune la pièce du kit des arêtes
## (`KIT`) que l'arête nomme, l'arête choisie, les nappes de toit, chacune levée quand le groupe est dessous, les
## couronnes crénelées des murs, chacune cachée quand son mur tombe, la météo (`poser_la_meteo`), la mer de chaque
## navire bordée par sa coque (`border_la_mer`) et le calque de référence de l'éditeur ; tout autre
## chose posée sur le monde appartient à qui l'instancie.
class_name Monde
extends Node3D

## La caméra a pivoté ou zoomé : ce qui est sous le pointeur a pu changer.
signal cadrage_change

const DUREE_QUART_S := 0.25
## Netteté de la projection d'une texture de matière sur les trois axes (`texturer`).
const NETTETE_DU_MOTIF := 4.0
## Le tangage de la caméra au regard `tactique`, plongeante de biais.
const TANGAGE_TACTIQUE := -0.9
## Une hauteur sous tout monde, où finit le rayon qui cherche le sol sous un lieu.
const SOUS_LE_MONDE := -1000.0
## La vitesse (m/s) de la caméra qui glisse au clavier.
const VITESSE_DE_GLISSE_M_S := 16.0
## La distance (cases) en deçà de laquelle une particule de météo s'efface devant la caméra, et celle où elle est
## pleine : une goutte qui frôle l'œil de l'immersion n'est pas un pan de mur.
const PRES_DE_L_OEIL := 0.5
const LOIN_DE_L_OEIL := 1.5
const DISTANCE_MIN := 6.0
const DISTANCE_MAX := 40.0
## La hauteur (m) au-dessus du lieu que regarde la caméra d'où se cherche le sol sous lui (`camera`).
const AU_DESSUS_DU_LIEU_M := 1.0
## Les items de `surbrillances`.
const ITEM_ATTEIGNABLE := 0
const ITEM_CIBLE := 1
const ITEM_SURVOL := 2
## Le kit des arêtes (`CONTRAT.md`, section « Plateau ») : une pièce par nœud racine, `<famille>--<pièce>`.
const KIT := "res://kit/kit.glb"

## Les plaques des surbrillances, par item (`ITEM_*`), chacune posée sans ombre.
@export var surbrillances: MeshLibrary
## Ce qui se pose sur une arête dont le kit n'a pas la pièce, ou sans kit au projet : un mur, une porte fermée, le seuil
## d'une porte ouverte ou d'une brèche ; et la gaine de l'arête choisie.
@export var mesh_mur: BoxMesh
@export var mesh_porte: BoxMesh
@export var mesh_seuil: BoxMesh
@export var mesh_arete_choisie: BoxMesh
## La matière d'une surface sans texture : la couleur de ses sommets.
@export var couleur_des_sommets: StandardMaterial3D
## Le modèle de la matière d'une surface texturée, projetée sur ses trois axes (triplanaire) dans le repère du volume.
@export var matiere_texturee: StandardMaterial3D
## La matière du calque de référence, sans ombrage, transparente, vue des deux côtés.
@export var matiere_du_calque: StandardMaterial3D

@onready var _volume: Node3D = $Volume
@onready var _maillage: MeshInstance3D = $Volume/Maillage
@onready var _forme: CollisionShape3D = $Volume/Corps/Forme
@onready var _toits: Node3D = $Volume/Toits
@onready var _couronnes: Node3D = $Volume/Couronnes
@onready var _meteo: Node3D = $Volume/Meteo
@onready var _pivot: Node3D = $Pivot
@onready var _inclinaison: Node3D = $Pivot/Inclinaison
@onready var _camera: Camera3D = $Pivot/Inclinaison/Camera
@onready var _oeil: Camera3D = $Oeil
@onready var _surbrillance: Node3D = $Surbrillance
@onready var _aretes: Node3D = $Aretes
@onready var _etiquettes: Node3D = $Etiquettes
@onready var _arete_choisie: MeshInstance3D = $AreteChoisie
@onready var _calque: MeshInstance3D = $Calque

## La case `[x, y, z]` de chaque triangle du maillage du monde, sa couche comprise, dans son ordre.
var _cases_des_triangles: Array = []
## Par couche `z`, le sol de chaque case, `[y][x]`.
var _sols: Dictionary = {}
var _lacet := 0.0
## Les arêtes posées (`poser_les_aretes`).
var _aretes_posees: Array = []
## Les clés des couronnes abattues, et les crans de caméra sous lesquels tombe chaque arête dégagée, par clé
## (`cacher_le_bati`).
var _couronnes_abattues: Array = []
var _aretes_degagees: Dictionary = {}
## Par nom de matière, la matière de rendu de ses surfaces, d'un `poser` à l'autre.
var _matieres := {}
## Le kit des arêtes, caché sous le monde, `null` sans kit au projet.
var _kit: Node3D
## Les noms posés (`etiqueter`), par case `x,y,z`.
var _noms := {}
## Les mètres d'une case du dernier monde posé.
var _metres_par_case := 1.0
var _pivotement: Tween
var _suivi: Tween
## Le dernier lieu que la caméra suit (`suivre`), `null` avant le premier.
var _suivi_lieu: Variant = null
## Le regard posé (`regarder`).
var _regard := "tactique"
## Le dernier volume posé (`poser`), `null` avant le premier.
var _monde_pose: Variant = null
## Par id de navire, le contour de sa coque à sa flottaison dans le plan du volume (`border_la_mer`).
var _coques := {}


func _ready() -> void:
	_lacet = _pivot.rotation.y
	if ResourceLoader.exists(KIT):
		_kit = (load(KIT) as PackedScene).instantiate()
		_kit.visible = false
		add_child(_kit)


## Le volume du monde de la scène (`monde`) à l'échelle d'une unité par case, sa case (0, 0) sur la case (0, 0) du
## monde : son maillage, une surface par matière (sol, relief, décor), texturée ou colorée par sommet (`_matiere`),
## rendu des deux côtés hors des surfaces d'un navire, la mer de chacun bordée par sa coque (`_maillage_de`), en forme
## hors de ces mers, que le rayon du pointeur touche des deux côtés, le sol de chaque case de chaque couche, et la caméra
## centrée sur lui. Godot tient pour face avant le sens horaire, le volume le sens trigonométrique : chaque tableau
## retourné en entier retourne chaque triangle, et l'ordre des triangles avec lui, que suivent leurs cases.
func poser(monde: Dictionary) -> void:
	_monde_pose = monde
	_metres_par_case = monde.metresParCase
	var echelle := MiseEnPage.echelle_metrique(monde.metresParCase)
	_volume.scale = Vector3(echelle, echelle, echelle)
	_volume.position = MiseEnPage.centre_de_case(Vector2i.ZERO, 0.0)
	_maillage.mesh = _maillage_de(monde)
	var tous := PackedFloat32Array(monde.positions).to_byte_array().to_vector3_array()
	var sommets := PackedVector3Array()
	_cases_des_triangles = []
	for surface: Dictionary in monde.surfaces:
		if surface.has("flottaison"):
			continue
		sommets.append_array(tous.slice(int(surface.debut), int(surface.fin)))
		_cases_des_triangles.append_array(monde.cases.slice(int(MiseEnPage.triangles(int(surface.debut))), int(MiseEnPage.triangles(int(surface.fin)))))
	sommets.reverse()
	_cases_des_triangles.reverse()
	var forme := ConcavePolygonShape3D.new()
	forme.set_faces(sommets)
	forme.backface_collision = true
	_forme.shape = forme
	_sols.clear()
	for couche in monde.hauteurs:
		_sols[int(couche.z)] = couche.rangees.map(func(rangee: Array) -> Array: return rangee.map(func(hauteur: float) -> float: return MiseEnPage.hauteur_au_plateau(hauteur, monde.metresParCase)))
	_pivot.position = MiseEnPage.centre_du_plateau(taille())


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
		_maillage.mesh = _maillage_de(_monde_pose)


## Les nappes de toit (`toits`) et les couronnes crénelées des murs (`couronnes`) de la scène (`CONTRAT.md`, section
## « Monde »), chacune son maillage sous le volume, à la place des précédentes ; le rayon du pointeur les traverse.
func poser_les_nappes(toits: Array, couronnes: Array) -> void:
	_poser_sous(_toits, toits)
	_poser_sous(_couronnes, couronnes)


## La météo du regard (`meteo`, `CONTRAT.md`, section « Monde ») dans le volume, à la place de la précédente : une
## averse de particules par boîte de `pluie.averses`, étirées dans le sens de leur chute et effacées près de la caméra,
## et chaque nappe de brume, plate et translucide ; rien sans météo.
func poser_la_meteo(meteo: Variant) -> void:
	for posee in _meteo.get_children():
		_meteo.remove_child(posee)
		posee.free()
	if meteo == null:
		return
	if meteo.pluie != null:
		for averse in meteo.pluie.averses:
			_meteo.add_child(_averse(meteo.pluie, averse))
	for nappe in meteo.nappes:
		_meteo.add_child(_nappe_de_brume(nappe))


func _averse(pluie: Dictionary, averse: Dictionary) -> CPUParticles3D:
	var particules := CPUParticles3D.new()
	particules.position = Vector3(averse.centre[0], averse.centre[1], averse.centre[2])
	particules.amount = int(averse.nombre)
	particules.lifetime = pluie.dureeS
	particules.preprocess = pluie.dureeS
	particules.local_coords = true
	particules.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	particules.emission_box_extents = Vector3(averse.demiEtendue[0], averse.demiEtendue[1], averse.demiEtendue[2])
	particules.direction = Vector3(pluie.sens.x, pluie.sens.y, pluie.sens.z)
	particules.spread = 0.0
	particules.gravity = Vector3.ZERO
	particules.initial_velocity_min = pluie.vitesseMs
	particules.initial_velocity_max = pluie.vitesseMs
	particules.particle_flag_align_y = true
	particules.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var goutte := BoxMesh.new()
	goutte.size = Vector3(pluie.largeurM, pluie.traineeM, pluie.largeurM)
	var matiere := _translucide(pluie.couleur, pluie.opacite)
	matiere.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_ALPHA
	matiere.distance_fade_min_distance = PRES_DE_L_OEIL
	matiere.distance_fade_max_distance = LOIN_DE_L_OEIL
	goutte.material = matiere
	particules.mesh = goutte
	return particules


func _nappe_de_brume(nappe: Dictionary) -> MeshInstance3D:
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = PackedFloat32Array(nappe.positions).to_byte_array().to_vector3_array()
	var maillage := ArrayMesh.new()
	maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	var instance := MeshInstance3D.new()
	instance.mesh = maillage
	instance.material_override = _translucide(nappe.couleur, nappe.alpha)
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return instance


## Une matière sans éclairage ni brume de profondeur, vue des deux côtés, de teinte `couleur` à l'opacité `opacite`.
func _translucide(couleur: String, opacite: float) -> StandardMaterial3D:
	var matiere := StandardMaterial3D.new()
	matiere.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	matiere.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	matiere.cull_mode = BaseMaterial3D.CULL_DISABLED
	matiere.disable_fog = true
	matiere.albedo_color = Color(couleur, opacite)
	return matiere


## Chaque nappe de toit cachée si `toits_leves` la nomme (`plateau.toitsLeves`), chaque couronne si `couronnes_abattues`
## la nomme (`plateau.couronnesAbattues`), et chaque arête que le groupe dégage (`aretes_degagees`,
## `plateau.aretesDegagees`) abattue avec sa couronne sous le regard de la caméra (`_abattre_les_aretes`) ; montrées sinon.
func cacher_le_bati(toits_leves: Array, couronnes_abattues: Array, aretes_degagees: Array) -> void:
	_cacher_sous(_toits, toits_leves)
	_couronnes_abattues = couronnes_abattues
	_aretes_degagees.clear()
	for a in aretes_degagees:
		_aretes_degagees[a.cle] = a.abattueSous
	_abattre_les_aretes()


## Les arêtes dégagées qui tombent sous le cran de la caméra (`MiseEnPage.rotation_iso`) cachées avec leur couronne, et
## les couronnes abattues ; le reste montré.
func _abattre_les_aretes() -> void:
	var cran := int(MiseEnPage.rotation_iso(_camera.global_basis.z))
	var abattues := _aretes_degagees.keys().filter(func(cle: String) -> bool: return _aretes_degagees[cle].has(cran))
	_cacher_sous(_aretes, abattues)
	var couronnes := _couronnes_abattues.duplicate()
	couronnes.append_array(abattues)
	_cacher_sous(_couronnes, couronnes)


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


## Chaque nappe sous `parent` cachée si `cles` la nomme, montrée sinon.
func _cacher_sous(parent: Node3D, cles: Array) -> void:
	for nappe in parent.get_children():
		nappe.visible = not cles.has(nappe.get_meta("cle"))


## Le maillage d'une géométrie du monde (`positions`, `normales`, `couleurs`, `surfaces`) : une surface par matière,
## texturée ou colorée par sommet (`_matiere`), chaque tableau retourné en entier (`_retournes`) ; sans les surfaces
## d'un navire (`navire`), que le rayon du pointeur touche et que le modèle du navire montre ; la mer d'un navire
## (`flottaison`) hors du contour de sa coque (`border_la_mer`, `_hors_du_contour`), entière tant qu'il n'est pas connu.
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


## Les couches du dernier monde posé.
func couches() -> Array:
	return _sols.keys()


## La taille de la carte, en cases.
func taille() -> Vector2i:
	return Vector2i(_sols[0][0].size(), _sols[0].size())


## Le sol de la case `case` de la couche `z`.
func sol(case: Vector2i, z := 0) -> float:
	return _sols[z][case.y][case.x]


## Le centre du sol de la case `case` de la couche `z`.
func lieu(case: Vector2i, z := 0) -> Vector3:
	return MiseEnPage.centre_de_case(case, sol(case, z))


## Le point de l'écran du centre du sol de chaque case de la couche `z` devant la caméra, par sa clé `x,y`.
func points(z := 0) -> Dictionary:
	var points := {}
	var t := taille()
	for y in t.y:
		for x in t.x:
			var point: Variant = a_l_ecran(lieu(Vector2i(x, y), z))
			if point != null:
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


## Les noms `noms` (par case `Vector3i(x, y, z)`, le texte), chacun au-dessus du sol de sa case, devant la scène hors de
## l'immersion, où les murs les cachent, à la place des précédents.
func etiqueter(noms: Dictionary) -> void:
	for etiquette in _etiquettes.get_children():
		_etiquettes.remove_child(etiquette)
		etiquette.free()
	_noms.clear()
	for c: Vector3i in noms:
		var nom := Label3D.new()
		nom.text = noms[c]
		nom.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		nom.no_depth_test = _regard != "immersion"
		nom.position = MiseEnPage.au_dessus_de_la_case(Vector2i(c.x, c.y), sol(Vector2i(c.x, c.y), c.z))
		_etiquettes.add_child(nom)
		_noms["%d,%d,%d" % [c.x, c.y, c.z]] = noms[c]


## Les noms posés sur le monde, par case `x,y,z`.
func noms() -> Dictionary:
	return _noms


## Les arêtes `aretes` (`CONTRAT.md`, section « Plateau »), chacune sur le côté de sa case, debout à son pied
## (`_piece`) ; à la place des précédentes.
func poser_les_aretes(aretes: Array) -> void:
	if aretes == _aretes_posees:
		return
	_aretes_posees = aretes
	for arete in _aretes.get_children():
		_aretes.remove_child(arete)
		arete.free()
	for a in aretes:
		var piece := _piece(a)
		piece.set_meta("cle", a.cle)
		_aretes.add_child(piece)
	_abattre_les_aretes()


## La pièce de l'arête `a`, debout à son pied (`a.pied`) : celle du kit, `<famille>--<pièce>`, étirée à la longueur de
## l'arête et à la hauteur de son mur (`MiseEnPage.echelle_de_piece`) ; sinon sa boîte (`_boite`).
func _piece(a: Dictionary) -> Node3D:
	var nom := "%s--%s" % [a.famille, a.piece]
	if _kit == null or a.famille == null or not _kit.has_node(nom):
		var boite := MeshInstance3D.new()
		_poser_sur_l_arete(boite, _boite(a.piece), a)
		return boite
	var sens := Vector2(a.sens.x, a.sens.y)
	var piece := Node3D.new()
	piece.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), a.pied, _metres_par_case, 0.0)
	piece.rotation.y = MiseEnPage.lacet_d_arete(sens)
	piece.scale = MiseEnPage.echelle_de_piece(sens, a.hauteurM, _metres_par_case)
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


## Le nombre d'arêtes posées sur le monde.
func nombre_d_aretes() -> int:
	return _aretes.get_child_count()


## La gaine de l'arête choisie sur l'arête `arete`, aucune si `arete` est `null`.
func choisir_l_arete(arete: Variant) -> void:
	_arete_choisie.visible = arete != null
	if arete != null:
		_poser_sur_l_arete(_arete_choisie, mesh_arete_choisie, arete)


## Le maillage `mesh` posé par `instance` sur l'arête `a`, debout à son pied (`a.pied`).
func _poser_sur_l_arete(instance: MeshInstance3D, mesh: BoxMesh, a: Dictionary) -> void:
	instance.mesh = mesh
	var sens := Vector2(a.sens.x, a.sens.y)
	instance.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), a.pied, _metres_par_case, mesh.size.y)
	instance.rotation.y = MiseEnPage.lacet_d_arete(sens)
	instance.scale.x = MiseEnPage.longueur_d_arete(sens)


## Le calque de référence `calque` (`CONTRAT.md`, section « Éditeur ») sous la texture `planche`, ses quatre coins sur
## son plan : juste au-dessus du sol et par-dessus toute la scène s'il passe dessus, sinon juste dessous, à son opacité ;
## aucun si `calque` est `null` ou sa planche absente.
func poser_le_calque(calque: Variant, planche: Texture2D) -> void:
	_calque.visible = calque != null and planche != null
	if not _calque.visible:
		return
	var hauteur := MiseEnPage.hauteur_du_calque(calque.plan, _metres_par_case, MiseEnPage.DECALAGE_DU_CALQUE if calque.dessus else -MiseEnPage.DECALAGE_DU_CALQUE)
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = PackedVector3Array(calque.coins.map(func(c: Dictionary) -> Vector3: return MiseEnPage.point_de_la_carte(c.x, c.y, hauteur)))
	tableaux[Mesh.ARRAY_TEX_UV] = PackedVector2Array([Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)])
	tableaux[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2, 0, 2, 3])
	var maillage := ArrayMesh.new()
	maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	_calque.mesh = maillage
	var matiere := matiere_du_calque.duplicate() as StandardMaterial3D
	matiere.albedo_texture = planche
	matiere.albedo_color = Color(1, 1, 1, calque.opacite)
	matiere.no_depth_test = calque.dessus
	_calque.material_override = matiere


## Si le calque de référence est posé sur le monde.
func calque_pose() -> bool:
	return _calque.visible


## Le point de l'écran du lieu `lieu` du monde, sous la caméra du regard ; `null` derrière elle.
func a_l_ecran(lieu: Vector3) -> Variant:
	var camera := get_viewport().get_camera_3d()
	return null if camera.is_position_behind(lieu) else camera.unproject_position(lieu)


## Ce que le rayon de la caméra du regard par `point` touche le premier (`_toucher`), `null` hors du monde.
func touche_sous(point: Vector2) -> Variant:
	var camera := get_viewport().get_camera_3d()
	return _toucher(camera.project_ray_origin(point), camera.project_position(point, camera.far))


## Le sol que touche le premier un rayon tombé à la verticale de `lieu` (`_toucher`), `null` hors du monde.
func sol_sous(lieu: Vector3) -> Variant:
	return _toucher(lieu, Vector3(lieu.x, SOUS_LE_MONDE, lieu.z))


## Ce que le rayon de `origine` à `fin` touche le premier : `{ case, f, lieu }`, la case de son triangle et sa couche
## (`Vector3i(x, y, z)`), le point de la carte touché (`MiseEnPage.point_de_carte_du_lieu`) et le lieu touché, `null`
## hors du monde.
func _toucher(origine: Vector3, fin: Vector3) -> Variant:
	var touche := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(origine, fin))
	if touche.is_empty():
		return null
	var case: Array = _cases_des_triangles[touche.face_index]
	return {case = Vector3i(int(case[0]), int(case[1]), int(case[2])), f = MiseEnPage.point_de_carte_du_lieu(to_local(touche.position)), lieu = touche.position}


## La case du triangle du monde et sa couche (`Vector3i(x, y, z)`) que le rayon de la caméra par `point` touche le premier,
## `null` hors du monde.
func case_sous(point: Vector2) -> Variant:
	var touche: Variant = touche_sous(point)
	return null if touche == null else touche.case


## Le regard `regard` (`plateau.regard`, `CONTRAT.md`, section « Vue ») : en tactique, la caméra de biais et en
## perspective ; au plateau, à la verticale, sans perspective, les bords du plateau droits à l'écran ; en immersion,
## l'œil, et les noms cachés par les murs. Les arêtes dégagées suivent le cran de la caméra.
func regarder(regard: String) -> void:
	if regard == _regard:
		return
	_regard = regard
	_oeil.current = regard == "immersion"
	_camera.current = regard != "immersion"
	var plateau := regard == "plateau"
	_inclinaison.rotation.x = MiseEnPage.TANGAGE_DU_PLATEAU if plateau else TANGAGE_TACTIQUE
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL if plateau else Camera3D.PROJECTION_PERSPECTIVE
	_camera.size = _camera.position.z
	_orienter()
	for nom: Label3D in _etiquettes.get_children():
		nom.no_depth_test = regard != "immersion"
	_abattre_les_aretes()
	cadrage_change.emit()


## La caméra des regards `tactique` et `plateau` glisse jusqu'au lieu `lieu`, qu'elle suit, dès qu'il change : une caméra
## qu'on a fait glisser reste où elle est tant qu'il ne bouge pas.
func suivre(lieu: Vector3) -> void:
	if _suivi_lieu != null and lieu.is_equal_approx(_suivi_lieu):
		return
	_suivi_lieu = lieu
	_rejoindre(lieu)


func _rejoindre(lieu: Vector3) -> void:
	if _suivi != null:
		_suivi.kill()
	_suivi = create_tween()
	_suivi.tween_property(_pivot, "position", lieu, DUREE_QUART_S)
	_suivi.tween_callback(cadrage_change.emit)


## L'œil du regard `immersion` au lieu `lieu`, tourné du lacet `lacet` et du tangage `tangage`.
func poser_l_oeil(lieu: Vector3, lacet: float, tangage: float) -> void:
	_oeil.global_position = lieu
	_oeil.rotation = Vector3(tangage, lacet, 0.0)
	cadrage_change.emit()


## Le regard posé (`regarder`).
func regard() -> String:
	return _regard


## La caméra des regards `tactique` et `plateau` posée sans glisser sur le lieu `lieu`, qu'elle regarde au lacet `lacet`
## sous tout regard (au plateau, `MiseEnPage.lacet_sous_le_plateau`), à la distance `distance` ; elle y reste tant que
## le lieu suivi ne bouge pas (`suivre`). Rend si `distance` tient dans le zoom (`DISTANCE_MIN`, `DISTANCE_MAX`), sans
## rien poser sinon.
func cadrer(lieu: Vector3, lacet: float, distance: float) -> bool:
	if MiseEnPage.distance_zoomee(distance, 0.0, DISTANCE_MIN, DISTANCE_MAX) != distance:
		return false
	for tween: Tween in [_suivi, _pivotement]:
		if tween != null:
			tween.kill()
	_pivot.position = lieu
	_lacet = MiseEnPage.lacet_sous_le_plateau(lacet) if _regard == "plateau" else lacet
	_orienter()
	_camera.position.z = distance
	_camera.size = distance
	_abattre_les_aretes()
	cadrage_change.emit()
	return true


## La caméra du regard telle qu'elle est posée (`CONTRAT.md`, section « Écran publié », `wfrpCadrer`) : le regard, la
## case et la couche (`[x, y, z]`) du sol touché sous l'œil, ou sous le lieu que regarde la caméra des regards
## `tactique` et `plateau` (`null` hors du monde), l'azimut où elle regarde et son tangage, en degrés
## (`MiseEnPage.azimut_du_lacet`), et sa distance, `null` en immersion.
func camera() -> Dictionary:
	var immersion := _regard == "immersion"
	var sol: Variant = sol_sous(_oeil.global_position if immersion else MiseEnPage.oeil_sur(_pivot.position, AU_DESSUS_DU_LIEU_M, _metres_par_case))
	return {
		regard = _regard,
		case = null if sol == null else [sol.case.x, sol.case.y, sol.case.z],
		lacet = MiseEnPage.azimut_du_lacet(_oeil.rotation.y if immersion else _pivot.rotation.y),
		tangage = rad_to_deg(_oeil.rotation.x if immersion else _inclinaison.rotation.x),
		zoom = null if immersion else _camera.position.z,
	}


## Le clavier mène la caméra ou l'œil : aucun champ de saisie n'a le focus.
func clavier_libre() -> bool:
	var focus := get_viewport().gui_get_focus_owner()
	return not (focus is LineEdit or focus is TextEdit)


## La caméra des regards `tactique` et `plateau` glisse au clavier (ZQSD), dans le sens où elle regarde.
func _process(delta: float) -> void:
	if _regard == "immersion" or not clavier_libre():
		return
	var forces := [Input.get_action_strength(&"gauche"), Input.get_action_strength(&"droite"), Input.get_action_strength(&"avant"), Input.get_action_strength(&"arriere")]
	if forces.all(func(f: float) -> bool: return f == 0.0):
		return
	if _suivi != null:
		_suivi.kill()
	_pivot.position = MiseEnPage.lieu_apres_la_marche(_pivot.position, forces[0], forces[1], forces[2], forces[3], _pivot.rotation.y, MiseEnPage.metres_de_marche(VITESSE_DE_GLISSE_M_S, delta), _metres_par_case)
	cadrage_change.emit()


## Le lacet de la caméra posé sur le pivot : décalé d'un demi-quart de tour au plateau (`MiseEnPage.lacet_du_plateau`).
func _orienter() -> void:
	_pivot.rotation.y = MiseEnPage.lacet_du_plateau(_lacet) if _regard == "plateau" else _lacet


func _unhandled_input(event: InputEvent) -> void:
	if _regard == "immersion":
		return
	if event.is_action_pressed("pivoter_gauche"):
		_pivoter(1.0)
	elif event.is_action_pressed("pivoter_droite"):
		_pivoter(-1.0)
	elif event.is_action_pressed("recentrer") and _suivi_lieu != null:
		_rejoindre(_suivi_lieu)
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
		if _pivotement != null:
			_pivotement.kill()
		_lacet = MiseEnPage.lacet_glisse(_lacet, event.relative.x)
		_orienter()
		_abattre_les_aretes()
		cadrage_change.emit()
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
	_pivotement.tween_property(_pivot, "rotation:y", MiseEnPage.lacet_du_plateau(_lacet) if _regard == "plateau" else _lacet, DUREE_QUART_S)
	_pivotement.tween_callback(_abattre_les_aretes)
	_pivotement.tween_callback(cadrage_change.emit)


func _zoomer(sens: float) -> void:
	_camera.position.z = MiseEnPage.distance_zoomee(_camera.position.z, sens, DISTANCE_MIN, DISTANCE_MAX)
	_camera.size = _camera.position.z
	cadrage_change.emit()
