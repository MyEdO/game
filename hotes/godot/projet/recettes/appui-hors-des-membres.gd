extends SceneTree

## L'appui d'un objet rangé hors des membres (#4351, `MontageDeComposition._appuyer`). Au bassin : une manche dominée
## par l'avant-bras qui enveloppe l'emplacement ne porte pas l'objet, posé comme sans elle ; dominée par le haut du bras,
## elle le porte ; dans un même mesh, en deux surfaces comme en une, une coque dominée par l'avant-bras par-dessus une
## coque dominée par le bassin pose l'objet sur la coque intérieure, comme elle seule. Au poignet, une manche dominée par
## l'avant-bras ou par la main, du même membre, le porte. Les zones des os viennent des pièces de zone de la base
## (`extras.zone`) : la pièce du bassin porte un peu de poids sur l'avant-bras, qui reste de la zone qui y porte le plus
## (`MiseEnPage.cumul_des_poids`) ; l'os dominant d'une manche vient après l'autre dans ses liaisons. La visée qui passe
## une face reprend plus bas (`MiseEnPage.cote_au_dela`).

const RECETTE_AUTONOME := true
const MAIN := {id = "main", genre = "prise", attache = {os = "main", position = [-0.02, 0.09, 0.003], rotation = [1.32, -3.1, -0.03]}}
const CEINTURE := {id = "ceinture", genre = "emplacement", attache = {os = "bassin", position = [0.0, 0.0, 0.1], rotation = [0.0, 0.0, 0.0]}}
const POIGNET := {id = "poignet", genre = "emplacement", attache = {os = "avant_bras", position = [0.0, 0.0, 0.1], rotation = [0.0, 0.0, 0.0]}}
## Par os, son parent, son repos local, la zone de la pièce de la base qui lui revient et ses poids (`[os, poids]`).
const OS_DE_LA_BASE := [
	{nom = "bassin", parent = "", repos = Vector3(0.0, 1.0, 0.0), zone = "hanches", poids = [["bassin", 0.9], ["avant_bras", 0.1]]},
	{nom = "bras", parent = "bassin", repos = Vector3(0.3, 0.3, 0.0), zone = "bras_haut_g", poids = [["bras", 1.0]]},
	{nom = "avant_bras", parent = "bras", repos = Vector3(0.0, -0.3, 0.0), zone = "avant_bras_g", poids = [["avant_bras", 1.0]]},
	{nom = "main", parent = "avant_bras", repos = Vector3(0.0, -0.25, 0.0), zone = "main_g", poids = [["main", 1.0]]},
]
## Les liaisons d'une manche, et ses poids par coque (`[rang de liaison, poids]`) : dominée par l'avant-bras, par le haut
## du bras, par le bassin, par la main.
const LIAISONS := ["bras", "avant_bras", "bassin", "main"]
const SUR_L_AVANT_BRAS := [[0, 0.3], [1, 0.7]]
const SUR_LE_BRAS := [[1, 0.3], [0, 0.7]]
const SUR_LE_BASSIN := [[2, 1.0]]
const SUR_LA_MAIN := [[1, 0.3], [3, 0.7]]
## Le demi-côté d'une manche, et celui d'une coque intérieure, centrées sur l'emplacement.
const DEMI_MANCHE := 0.15
const DEMI_INTERIEUR := 0.06
const TAILLE := Vector3(0.03, 0.07, 0.03)
const EPSILON := 0.0001
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[appui-hors-des-membres] version=", Engine.get_version_info().string)
	var au_bassin := _range(CEINTURE, [], false).origin
	_attendre("manche de l'avant-bras sautée au bassin", _range(CEINTURE, [[SUR_L_AVANT_BRAS, DEMI_MANCHE]], false).origin.distance_to(au_bassin) < EPSILON)
	_attendre("manche du haut du bras gardée au bassin", _range(CEINTURE, [[SUR_LE_BRAS, DEMI_MANCHE]], false).origin.distance_to(au_bassin) > DEMI_INTERIEUR / 2.0)
	var interieur := _range(CEINTURE, [[SUR_LE_BASSIN, DEMI_INTERIEUR]], false).origin
	_attendre("coque intérieure seule gardée au bassin", interieur.distance_to(au_bassin) > DEMI_INTERIEUR / 2.0)
	for fusionner in [false, true]:
		var sous_la_manche := _range(CEINTURE, [[SUR_L_AVANT_BRAS, DEMI_MANCHE], [SUR_LE_BASSIN, DEMI_INTERIEUR]], fusionner).origin
		_attendre("coque intérieure portée sous la manche du même mesh (%s)" % ("une surface" if fusionner else "deux surfaces"), sous_la_manche.distance_to(interieur) < EPSILON)
	var au_poignet := _range(POIGNET, [], false).origin
	_attendre("manche de l'avant-bras gardée au poignet", _range(POIGNET, [[SUR_L_AVANT_BRAS, DEMI_MANCHE]], false).origin.distance_to(au_poignet) > DEMI_INTERIEUR / 2.0)
	_attendre("manche de la main gardée au poignet", _range(POIGNET, [[SUR_LA_MAIN, DEMI_MANCHE]], false).origin.distance_to(au_poignet) > DEMI_INTERIEUR / 2.0)
	_attendre("visée reprise plus bas que la face passée", MiseEnPage.cote_au_dela(DEMI_MANCHE) < DEMI_MANCHE)
	for faute in _fautes:
		push_error("[appui-hors-des-membres] " + faute)
	print("[appui-hors-des-membres] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _attendre(cas: String, tenu: bool) -> void:
	print("[appui-hors-des-membres] %s : %s" % [cas, "OK" if tenu else "KO"])
	if not tenu:
		_fautes.append(cas)


## La pose, dans l'os de l'emplacement `emplacement`, d'une fiole tenue en main rangée par `_ranger`, sur la base de
## pièces de zone `OS_DE_LA_BASE`, et, si `coques` n'est pas vide, une manche montée de ces coques (`_piece`).
func _range(emplacement: Dictionary, coques: Array, fusionner: bool) -> Transform3D:
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
		var liaisons := []
		var poids := []
		for liaison: Array in os.poids:
			poids.append([liaisons.size(), liaison[1]])
			liaisons.append(liaison[0])
		var piece := _piece(squelette, liaisons, [[poids, 0.02]], Vector3(5.0, 0.0, 0.0) + squelette.get_bone_global_rest(squelette.find_bone(os.nom)).origin, false)
		piece.set_meta("extras", {zone = os.zone})
		pieces.append(piece)
	montage._pieces_de_la_base.assign(pieces)
	if not coques.is_empty():
		var repere := squelette.get_bone_global_rest(squelette.find_bone(emplacement.attache.os)) * MontageDeComposition.repere(emplacement.attache)
		montage.montes = {robe = "robe"}
		montage.pieces = {robe = [_piece(squelette, LIAISONS, coques, repere.origin, fusionner)]}
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


## Un mesh skinné aux liaisons `liaisons` (noms d'os de `squelette`, qui le porte) : par coque `[poids, demi]` (poids
## `[[rang de liaison, poids]]`, les mêmes à chaque sommet), un cube de demi-côté `demi` centré en `centre` (repère du
## squelette), une surface par coque, ou toutes dans une seule si `fusionner`.
static func _piece(squelette: Skeleton3D, liaisons: Array, coques: Array, centre: Vector3, fusionner: bool) -> MeshInstance3D:
	var mesh := ArrayMesh.new()
	var fondue := SurfaceTool.new()
	for coque: Array in coques:
		var tableaux := BoxMesh.new().get_mesh_arrays()
		var sommets := PackedVector3Array()
		for coin: Vector3 in tableaux[Mesh.ARRAY_VERTEX]:
			sommets.append(centre + coin * coque[1] * 2.0)
		tableaux[Mesh.ARRAY_VERTEX] = sommets
		var os_du_sommet := [0, 0, 0, 0]
		var poids_du_sommet := [0.0, 0.0, 0.0, 0.0]
		for rang in (coque[0] as Array).size():
			os_du_sommet[rang] = coque[0][rang][0]
			poids_du_sommet[rang] = coque[0][rang][1]
		var os := PackedInt32Array()
		var poids := PackedFloat32Array()
		for _sommet in sommets:
			os.append_array(os_du_sommet)
			poids.append_array(poids_du_sommet)
		tableaux[Mesh.ARRAY_BONES] = os
		tableaux[Mesh.ARRAY_WEIGHTS] = poids
		if fusionner:
			var seule := ArrayMesh.new()
			seule.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
			fondue.append_from(seule, 0, Transform3D.IDENTITY)
		else:
			mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	if fusionner:
		mesh = fondue.commit()
	var skin := Skin.new()
	for nom: String in liaisons:
		skin.add_named_bind(nom, squelette.get_bone_global_rest(squelette.find_bone(nom)).affine_inverse())
	var piece := MeshInstance3D.new()
	piece.mesh = mesh
	piece.skin = skin
	squelette.add_child(piece)
	return piece
