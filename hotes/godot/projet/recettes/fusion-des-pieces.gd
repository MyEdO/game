extends SceneTree

## Les pièces d'un corps composé fondues (#3868, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») :
## `MontageDeComposition.refondre` réunit chaque mesh visible du modèle en un mesh skinné sous le squelette, une surface
## par matériau équivalent. Sur une pose quelconque, chaque sommet d'une pièce fondue, skinné par le mesh fondu, tombe à
## 0,1 mm de sa place dessinée seule : une pièce skinnée par ses liaisons, une pièce rigide par son `BoneAttachment3D`,
## au repère de la pièce dans l'os. La pièce fondue n'est plus sur aucun calque ; restent seules, sur leur calque, la
## pièce cachée, la pièce portée par un nœud `top_level` et la pièce rigide à matériau projeté dans son repère. Une
## pièce démasquée se fond à la refonte suivante, et des liaisons égales ne s'ajoutent qu'une fois.

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[fusion-des-pieces] version=", Engine.get_version_info().string)
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	var modele := Node3D.new()
	montage.add_child(modele)
	var squelette := _squelette()
	modele.add_child(squelette)
	montage.modele = modele
	montage.squelette = squelette
	var cuir := StandardMaterial3D.new()
	cuir.albedo_color = Color("#6b4a2b")
	var cuir_bis := cuir.duplicate() as StandardMaterial3D
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color("#b8bcc4")
	metal.metallic = 1.0
	var projete := StandardMaterial3D.new()
	projete.uv1_triplanar = true
	var corps := _skinnee("Corps", squelette, cuir, {hanche = 0.6, torse = 0.4})
	var gant := _skinnee("Gant", squelette, cuir_bis, {main = 1.0})
	var cache := _skinnee("Cache", squelette, metal, {torse = 1.0})
	cache.visible = false
	var epee := _rigide("Epee", squelette, "main", metal, Transform3D(Basis.from_euler(Vector3(0.3, 0.0, 1.2)), Vector3(0.0, 0.1, 0.02)))
	var range_ := _rigide("Range", squelette, "hanche", metal, Transform3D.IDENTITY)
	range_.get_parent().top_level = true
	var baton := _rigide("Baton", squelette, "main", projete, Transform3D.IDENTITY)
	squelette.set_bone_pose_rotation(squelette.find_bone("torse"), Quaternion.from_euler(Vector3(0.4, -0.2, 0.1)))
	squelette.set_bone_pose_rotation(squelette.find_bone("main"), Quaternion.from_euler(Vector3(-0.7, 0.5, 0.3)))
	squelette.force_update_all_bone_transforms()

	montage.refondre()
	var fusion := montage.fusion
	if fusion == null:
		_fautes.append("aucune fusion")
		return _finir()
	if fusion.mesh.get_surface_count() != 2:
		_fautes.append("%d surfaces fondues, attendu 2 (cuir et son double, métal)" % fusion.mesh.get_surface_count())
	for fondue in [corps, gant, epee]:
		if fondue.layers != 0:
			_fautes.append("%s fondue reste sur le calque %d" % [fondue.name, fondue.layers])
	for seule in [cache, range_, baton]:
		if seule.layers != MontageDeComposition.CALQUE:
			_fautes.append("%s laissée seule hors de son calque (%d)" % [seule.name, seule.layers])
	var fondus := _sommets_fondus(fusion, squelette)
	for piece in [corps, gant, epee]:
		_comparer(piece, _sommets_seuls(piece, squelette), fondus)
	if fondus.size() != _compte([corps, gant, epee]):
		_fautes.append("%d sommets fondus, attendu %d" % [fondus.size(), _compte([corps, gant, epee])])

	var liaisons := fusion.skin.get_bind_count()
	cache.visible = true
	montage.refondre()
	if cache.layers != 0:
		_fautes.append("la pièce démasquée ne se fond pas")
	if montage.fusion.skin.get_bind_count() != liaisons:
		_fautes.append("liaisons %d après démasquage, attendu %d : une liaison égale s'ajoute deux fois" % [montage.fusion.skin.get_bind_count(), liaisons])
	_comparer(cache, _sommets_seuls(cache, squelette), _sommets_fondus(montage.fusion, squelette))
	_finir()


func _finir() -> void:
	for faute in _fautes:
		push_error("[fusion-des-pieces] " + faute)
	print("[fusion-des-pieces] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Un squelette hanche → torse → main, hors de l'origine.
func _squelette() -> Skeleton3D:
	var squelette := Skeleton3D.new()
	squelette.transform = Transform3D(Basis.from_euler(Vector3(0.0, 0.5, 0.0)), Vector3(1.0, 0.0, -2.0))
	for os in [{nom = "hanche", parent = "", repos = Transform3D(Basis(), Vector3(0.0, 1.0, 0.0))},
			{nom = "torse", parent = "hanche", repos = Transform3D(Basis.from_euler(Vector3(0.1, 0.0, 0.0)), Vector3(0.0, 0.3, 0.0))},
			{nom = "main", parent = "torse", repos = Transform3D(Basis.from_euler(Vector3(0.0, 0.0, -1.1)), Vector3(0.25, 0.3, 0.0))}]:
		var indice := squelette.add_bone(os.nom)
		if os.parent != "":
			squelette.set_bone_parent(indice, squelette.find_bone(os.parent))
		squelette.set_bone_rest(indice, os.repos)
		squelette.set_bone_pose(indice, os.repos)
	return squelette


## Un mesh skinné sous `squelette`, son skin lié par nom à chaque os de `poids` au repère inverse de son repos, chaque
## sommet de son triangle sur ces os à ces poids.
func _skinnee(nom: String, squelette: Skeleton3D, materiau: Material, poids: Dictionary) -> MeshInstance3D:
	var skin := Skin.new()
	var os := PackedInt32Array()
	var valeurs := PackedFloat32Array()
	for nom_de_l_os: String in poids:
		skin.add_named_bind(nom_de_l_os, squelette.get_bone_global_rest(squelette.find_bone(nom_de_l_os)).affine_inverse())
		os.append(skin.get_bind_count() - 1)
		valeurs.append(poids[nom_de_l_os])
	while os.size() < 4:
		os.append(0)
		valeurs.append(0.0)
	var piece := MeshInstance3D.new()
	piece.name = nom
	piece.mesh = _triangle(materiau, os, valeurs)
	piece.skin = skin
	squelette.add_child(piece)
	piece.skeleton = piece.get_path_to(squelette)
	return piece


## Un mesh rigide sous un `BoneAttachment3D` de l'os `os`, au repère `repere_` dans un portage intermédiaire.
func _rigide(nom: String, squelette: Skeleton3D, os: String, materiau: Material, repere_: Transform3D) -> MeshInstance3D:
	var attache := BoneAttachment3D.new()
	attache.bone_name = os
	squelette.add_child(attache)
	var portage := Node3D.new()
	portage.transform = Transform3D(Basis(), Vector3(0.0, 0.05, 0.0))
	attache.add_child(portage)
	var piece := MeshInstance3D.new()
	piece.name = nom
	piece.mesh = _triangle(materiau, PackedInt32Array(), PackedFloat32Array())
	piece.transform = repere_
	portage.add_child(piece)
	return piece


## Un triangle d'un mesh, au matériau `materiau`, chaque sommet sur les os `os` aux poids `poids` s'ils sont donnés.
func _triangle(materiau: Material, os: PackedInt32Array, poids: PackedFloat32Array) -> ArrayMesh:
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(0.0, 1.0, 0.0), Vector3(0.2, 1.4, 0.1), Vector3(-0.1, 1.6, -0.2)])
	tableaux[Mesh.ARRAY_NORMAL] = PackedVector3Array([Vector3.FORWARD, Vector3.FORWARD, Vector3.FORWARD])
	tableaux[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2])
	if not os.is_empty():
		tableaux[Mesh.ARRAY_BONES] = os + os + os
		tableaux[Mesh.ARRAY_WEIGHTS] = poids + poids + poids
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	mesh.surface_set_material(0, materiau)
	return mesh


## La place monde de chaque sommet de `piece` dessinée seule sur la pose de `squelette` : skinnée, ou rigide sous son os,
## par son portage.
func _sommets_seuls(piece: MeshInstance3D, squelette: Skeleton3D) -> PackedVector3Array:
	if piece.skin == null:
		var portage := piece.get_parent() as Node3D
		var os := squelette.find_bone((portage.get_parent() as BoneAttachment3D).bone_name)
		var place_de_la_piece := squelette.global_transform * squelette.get_bone_global_pose(os) * portage.transform * piece.transform
		var places := PackedVector3Array()
		for sommet in piece.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]:
			places.append(place_de_la_piece * sommet)
		return places
	return _skinner(piece.mesh, piece.skin, squelette)


## La place monde de chaque sommet du mesh fondu `fusion`, skinné sur la pose de `squelette`.
func _sommets_fondus(fusion: MeshInstance3D, squelette: Skeleton3D) -> PackedVector3Array:
	return _skinner(fusion.mesh, fusion.skin, squelette)


func _skinner(mesh: Mesh, skin: Skin, squelette: Skeleton3D) -> PackedVector3Array:
	var places := PackedVector3Array()
	for surface in mesh.get_surface_count():
		var tableaux := mesh.surface_get_arrays(surface)
		var sommets: PackedVector3Array = tableaux[Mesh.ARRAY_VERTEX]
		var os: PackedInt32Array = tableaux[Mesh.ARRAY_BONES]
		var poids: PackedFloat32Array = tableaux[Mesh.ARRAY_WEIGHTS]
		for rang in sommets.size():
			var place := Vector3.ZERO
			for k in 4:
				var liaison := os[rang * 4 + k]
				var pose := squelette.get_bone_global_pose(squelette.find_bone(skin.get_bind_name(liaison)))
				place += poids[rang * 4 + k] * (squelette.global_transform * pose * skin.get_bind_pose(liaison) * sommets[rang])
			places.append(place)
	return places


func _comparer(piece: MeshInstance3D, seuls: PackedVector3Array, fondus: PackedVector3Array) -> void:
	for place in seuls:
		if not Array(fondus).any(func(fondu: Vector3) -> bool: return fondu.distance_to(place) < EPSILON):
			_fautes.append("%s : le sommet %s n'a pas de place fondue à %s m" % [piece.name, place, EPSILON])


func _compte(pieces: Array) -> int:
	var total := 0
	for piece: MeshInstance3D in pieces:
		total += piece.mesh.surface_get_array_len(0)
	return total
