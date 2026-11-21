extends SceneTree

## L'appui d'un objet rangé hors des membres (#4351, `MontageDeComposition._appuyer`) : à un emplacement du bassin, une
## manche skinnée sur l'avant-bras qui enveloppe l'emplacement ne le porte pas, l'objet se pose comme sans elle ; la même
## pièce skinnée sur le haut du bras le porte ; à un emplacement de l'avant-bras, la manche de cet avant-bras le porte.
## Les zones des os viennent des pièces de zone de la base (`extras.zone`), skinnées à leur os.

const RECETTE_AUTONOME := true
const MAIN := {id = "main", genre = "prise", attache = {os = "main", position = [-0.02, 0.09, 0.003], rotation = [1.32, -3.1, -0.03]}}
const CEINTURE := {id = "ceinture", genre = "emplacement", attache = {os = "bassin", position = [0.0, 0.0, 0.1], rotation = [0.0, 0.0, 0.0]}}
const POIGNET := {id = "poignet", genre = "emplacement", attache = {os = "avant_bras", position = [0.0, 0.0, 0.1], rotation = [0.0, 0.0, 0.0]}}
## Par os, son parent, son repos local et la zone de la pièce de la base skinnée sur lui.
const OS_DE_LA_BASE := [
	{nom = "bassin", parent = "", repos = Vector3(0.0, 1.0, 0.0), zone = "hanches"},
	{nom = "bras", parent = "bassin", repos = Vector3(0.3, 0.3, 0.0), zone = "bras_haut_g"},
	{nom = "avant_bras", parent = "bras", repos = Vector3(0.0, -0.3, 0.0), zone = "avant_bras_g"},
	{nom = "main", parent = "avant_bras", repos = Vector3(0.0, -0.25, 0.0), zone = "main_g"},
]
## Le demi-côté de la manche, centrée sur l'emplacement : sa face avant à 15 cm devant lui.
const DEMI_MANCHE := 0.15
const TAILLE := Vector3(0.03, 0.07, 0.03)
const EPSILON := 0.0001
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[appui-hors-des-membres] version=", Engine.get_version_info().string)
	var au_bassin := _range(CEINTURE, "")
	_attendre("manche de l'avant-bras sautée au bassin", _range(CEINTURE, "avant_bras").origin.distance_to(au_bassin.origin) < EPSILON)
	_attendre("manche du haut du bras gardée au bassin", _range(CEINTURE, "bras").origin.distance_to(au_bassin.origin) > DEMI_MANCHE / 2.0)
	_attendre("manche de l'avant-bras gardée au poignet", _range(POIGNET, "avant_bras").origin.distance_to(_range(POIGNET, "").origin) > DEMI_MANCHE / 2.0)
	for faute in _fautes:
		push_error("[appui-hors-des-membres] " + faute)
	print("[appui-hors-des-membres] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _attendre(cas: String, tenu: bool) -> void:
	print("[appui-hors-des-membres] %s : %s" % [cas, "OK" if tenu else "KO"])
	if not tenu:
		_fautes.append(cas)


## La pose, dans l'os de l'emplacement `emplacement`, d'une fiole tenue en main rangée par `_ranger`, sur la base de
## pièces de zone `OS_DE_LA_BASE`, et, si `os_de_la_manche` n'est pas vide, une manche montée skinnée sur cet os.
func _range(emplacement: Dictionary, os_de_la_manche: String) -> Transform3D:
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	var squelette := Skeleton3D.new()
	montage.add_child(squelette)
	for os: Dictionary in OS_DE_LA_BASE:
		var indice := squelette.add_bone(os.nom)
		if os.parent != "":
			squelette.set_bone_parent(indice, squelette.find_bone(os.parent))
		squelette.set_bone_rest(indice, Transform3D(Basis.IDENTITY, os.repos))
		squelette.set_bone_pose(indice, Transform3D(Basis.IDENTITY, os.repos))
	montage.base = {points = [emplacement, MAIN]}
	montage.squelette = squelette
	var pieces: Array[MeshInstance3D] = []
	for os: Dictionary in OS_DE_LA_BASE:
		var piece := _coque(squelette, os.nom, Vector3(5.0, 0.0, 0.0) + squelette.get_bone_global_rest(squelette.find_bone(os.nom)).origin, 0.02)
		piece.set_meta("extras", {zone = os.zone})
		pieces.append(piece)
	montage._pieces_de_la_base.assign(pieces)
	if os_de_la_manche != "":
		var repere := squelette.get_bone_global_rest(squelette.find_bone(emplacement.attache.os)) * MontageDeComposition.repere(emplacement.attache)
		montage.montes = {robe = "robe"}
		montage.pieces = {robe = [_coque(squelette, os_de_la_manche, repere.origin, DEMI_MANCHE)]}
	var import := BoneAttachment3D.new()
	import.bone_name = "main"
	squelette.add_child(import)
	var fiole := MeshInstance3D.new()
	var boite := BoxMesh.new()
	boite.size = TAILLE
	fiole.mesh = boite
	fiole.transform = MontageDeComposition.repere(MAIN.attache) * Transform3D(Basis.IDENTITY, Vector3(0.0, TAILLE.y / 2.0 + 0.015, TAILLE.z / 2.0))
	import.add_child(fiole)
	montage.call("_poser_la_piece", fiole, ["main"] as Array[String], squelette, emplacement.id)
	montage.call("_ranger")
	var pose: Transform3D = montage._rangements[emplacement.id][0].noeud.transform
	montage.free()
	return pose


## Une coque cubique de demi-côté `demi` centrée en `centre` (repère du squelette), skinnée tout entière sur l'os `os`
## de `squelette`, qui la porte.
static func _coque(squelette: Skeleton3D, os: String, centre: Vector3, demi: float) -> MeshInstance3D:
	var sommets := PackedVector3Array()
	for coin in BoxMesh.new().get_mesh_arrays()[Mesh.ARRAY_VERTEX]:
		sommets.append(centre + (coin as Vector3) * demi * 2.0)
	var tableaux := BoxMesh.new().get_mesh_arrays()
	tableaux[Mesh.ARRAY_VERTEX] = sommets
	var liaisons := PackedInt32Array()
	var poids := PackedFloat32Array()
	for _sommet in sommets:
		liaisons.append_array([0, 0, 0, 0])
		poids.append_array([1.0, 0.0, 0.0, 0.0])
	tableaux[Mesh.ARRAY_BONES] = liaisons
	tableaux[Mesh.ARRAY_WEIGHTS] = poids
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	var skin := Skin.new()
	skin.add_named_bind(os, squelette.get_bone_global_rest(squelette.find_bone(os)).affine_inverse())
	var piece := MeshInstance3D.new()
	piece.mesh = mesh
	piece.skin = skin
	squelette.add_child(piece)
	return piece
