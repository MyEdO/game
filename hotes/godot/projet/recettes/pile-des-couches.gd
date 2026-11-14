extends SceneTree

## La pile des couches posée sur la fusion (#3842, `hotes/godot/pont/CONTRAT.md`, section « Pile des couches ») : sans
## réponse du pont (`PontDuNoyau.resoudre_la_pile`, qu'un pont non ouvert, `PontDuNoyau.est_pret`, ne rend pas),
## `MontageDeComposition.refondre` fond les pièces telles que leurs auteurs les ont faites, et retient la demande
## de pile du corps et de la manche qui le couvre. La réponse reçue pour cette demande (`recevoir_la_pile`) se fond :
## le triangle masqué du corps ne se dessine plus, son triangle gardé est à ses sommets reculés, pour un quart sur son
## os et trois quarts sur celui qu'il gagne, lié au repère que la manche lui donne ; les pièces gardent leurs meshes. La réponse d'une autre demande est
## oubliée. La manche cachée, la tenue est d'une seule pièce : la fusion se refait sans pile.

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const RECUL := Vector3(0.0, 0.0, -0.003)
const BILAN := {couverts = 4, suiveurs = 0, recules = 4, flottants = 0, masques = 1}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[pile-des-couches] version=", Engine.get_version_info().string)
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	var modele := Node3D.new()
	montage.add_child(modele)
	var squelette := Skeleton3D.new()
	for declare in [{nom = "bras", parent = -1, repos = Vector3(0.0, 1.0, 0.0)}, {nom = "manche", parent = 0, repos = Vector3(0.0, 0.2, 0.0)}]:
		var indice := squelette.add_bone(declare.nom)
		squelette.set_bone_parent(indice, declare.parent)
		squelette.set_bone_rest(indice, Transform3D(Basis(), declare.repos))
		squelette.set_bone_pose(indice, Transform3D(Basis(), declare.repos))
	modele.add_child(squelette)
	montage.modele = modele
	montage.squelette = squelette
	montage.base = {osDeChaine = []}
	MontageDeComposition.modeles = {couches = {manche = {rang = 2, accessoire = false, couvre = [], masque = []}}}
	var corps := _carre("Corps", squelette, "bras", 0.0)
	var manche := _carre("Manche", squelette, "manche", 0.01)
	montage._pieces_de_la_base.assign([corps])
	montage.pieces = {"ligne/manche": [manche]}
	montage.montes = {"ligne/manche": "manche"}

	montage.refondre()
	if _triangles(montage.fusion) != 4:
		_fautes.append("sans pile, %d triangles fondus, attendu 4" % _triangles(montage.fusion))
	if not montage.pile_posee().is_empty():
		_fautes.append("une pile posée sans réponse du pont")
	var signature: String = montage.get("_pile_fondue")
	if signature == "":
		return _finir("aucune demande de pile pour un corps et sa manche")

	var sommets: PackedVector3Array = corps.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	var recules := PackedVector3Array()
	for sommet in sommets:
		recules.append(sommet + RECUL)
	var poids := PackedFloat32Array()
	var os := PackedInt32Array()
	for _sommet in sommets.size():
		poids.append_array([0.25, 0.75, 0.0, 0.0])
		os.append_array([0, 1, 0, 0])
	var reponse := {ok = true, bilan = BILAN, pieces = [
		{maillages = [{
			positions = Marshalls.raw_to_base64(recules.to_byte_array()),
			indices = Marshalls.raw_to_base64(PackedInt32Array([0, 1, 2]).to_byte_array()),
			os = Marshalls.raw_to_base64(os.to_byte_array()),
			poids = Marshalls.raw_to_base64(poids.to_byte_array()),
			noms = ["bras", "manche"],
		}]},
		{maillages = [montage._maillage(manche, 0)]},
	]}
	montage.recevoir_la_pile(reponse, "une autre demande")
	if not montage.pile_posee().is_empty():
		_fautes.append("la réponse d'une autre demande est posée")
	montage.recevoir_la_pile(reponse, signature)
	if montage.pile_posee() != BILAN:
		_fautes.append("bilan posé %s, attendu %s" % [montage.pile_posee(), BILAN])
	if _triangles(montage.fusion) != 3:
		_fautes.append("avec la pile, %d triangles fondus, attendu 3" % _triangles(montage.fusion))
	if corps.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX] != sommets or corps.mesh.surface_get_array_index_len(0) != 6:
		_fautes.append("le mesh du corps n'est plus celui de son auteur")
	squelette.set_bone_pose_rotation(squelette.find_bone("manche"), Quaternion.from_euler(Vector3(0.3, 0.0, 0.9)))
	squelette.force_update_all_bone_transforms()
	var fondus := _sommets_fondus(montage.fusion, squelette)
	var sur_la_manche := squelette.get_bone_global_pose(1) * squelette.get_bone_global_rest(1).affine_inverse()
	for rang in 3:
		var attendue := 0.25 * recules[rang] + 0.75 * (sur_la_manche * recules[rang])
		if not Array(fondus).any(func(fondu: Vector3) -> bool: return fondu.distance_to(attendue) < EPSILON):
			_fautes.append("le sommet %d du corps n'est pas fondu à %s, reculé, porté par son os et par la manche" % [rang, attendue])

	manche.visible = false
	montage.refondre()
	if _triangles(montage.fusion) != 2 or not montage.pile_posee().is_empty():
		_fautes.append("la manche cachée, %d triangles fondus et la pile %s, attendu 2 sans pile" % [_triangles(montage.fusion), montage.pile_posee()])
	_finir()


func _finir(faute := "") -> void:
	if faute != "":
		_fautes.append(faute)
	for dite in _fautes:
		push_error("[pile-des-couches] " + dite)
	print("[pile-des-couches] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Un carré skinné de deux triangles sous `squelette`, à la hauteur `z`, tout entier sur l'os `os`, lié au repère inverse
## de son repos.
func _carre(nom: String, squelette: Skeleton3D, os: String, z: float) -> MeshInstance3D:
	var skin := Skin.new()
	skin.add_named_bind(os, squelette.get_bone_global_rest(squelette.find_bone(os)).affine_inverse())
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(0.0, 1.0, z), Vector3(0.1, 1.0, z), Vector3(0.0, 1.1, z), Vector3(0.1, 1.1, z)])
	tableaux[Mesh.ARRAY_NORMAL] = PackedVector3Array([Vector3.BACK, Vector3.BACK, Vector3.BACK, Vector3.BACK])
	tableaux[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2, 1, 3, 2])
	tableaux[Mesh.ARRAY_BONES] = PackedInt32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
	tableaux[Mesh.ARRAY_WEIGHTS] = PackedFloat32Array([1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0])
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	mesh.surface_set_material(0, StandardMaterial3D.new())
	var piece := MeshInstance3D.new()
	piece.name = nom
	piece.mesh = mesh
	piece.skin = skin
	squelette.add_child(piece)
	piece.skeleton = piece.get_path_to(squelette)
	return piece


func _triangles(fusion: MeshInstance3D) -> int:
	var total := 0
	for surface in fusion.mesh.get_surface_count():
		total += fusion.mesh.surface_get_array_index_len(surface) / 3
	return total


## La place, dans le repère de `squelette`, de chaque sommet du mesh fondu `fusion` skinné sur sa pose.
func _sommets_fondus(fusion: MeshInstance3D, squelette: Skeleton3D) -> PackedVector3Array:
	var places := PackedVector3Array()
	for surface in fusion.mesh.get_surface_count():
		var tableaux := fusion.mesh.surface_get_arrays(surface)
		var sommets: PackedVector3Array = tableaux[Mesh.ARRAY_VERTEX]
		var os: PackedInt32Array = tableaux[Mesh.ARRAY_BONES]
		var poids: PackedFloat32Array = tableaux[Mesh.ARRAY_WEIGHTS]
		for rang in sommets.size():
			var place := Vector3.ZERO
			for k in 4:
				var liaison := os[rang * 4 + k]
				var pose := squelette.get_bone_global_pose(squelette.find_bone(fusion.skin.get_bind_name(liaison)))
				place += poids[rang * 4 + k] * (pose * fusion.skin.get_bind_pose(liaison) * sommets[rang])
			places.append(place)
	return places
