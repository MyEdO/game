extends SceneTree

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[skin-bind] version=", Engine.get_version_info().string)
	var mesh := ArrayMesh.new()
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3.ZERO, Vector3.RIGHT, Vector3(1, 1, 0), Vector3.UP])
	arrays[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2, 0, 2, 3])
	arrays[Mesh.ARRAY_BONES] = PackedInt32Array([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0])
	arrays[Mesh.ARRAY_WEIGHTS] = PackedFloat32Array([1, 0, 0, 0, 0, 1, 0, 0, 0.75, 0.25, 0, 0, 0.25, 0.75, 0, 0])
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var skin := Skin.new()
	skin.add_bind(0, Transform3D.IDENTITY)
	skin.add_named_bind("enfant", Transform3D(Basis.IDENTITY, Vector3.DOWN))
	skin.set_bind_bone(1, 0)
	_verifier(skin.get_bind_name(0).is_empty() and skin.get_bind_bone(0) == 0, "bind 0 par indice")
	_verifier(skin.get_bind_name(1) == &"enfant" and skin.get_bind_bone(1) == 0, "bind 1 nommé enfant, indice contradictoire racine")
	var a := _instance("A", mesh, skin)
	var b := _instance("B", mesh, skin)
	var avant_a := _positions(a)
	var avant_b := _positions(b)
	_verifier(a.mesh == b.mesh and a.skin == b.skin, "initialement même Mesh et même Skin")
	for i in 4:
		var p: Vector3 = arrays[Mesh.ARRAY_VERTEX][i]
		var w: float = arrays[Mesh.ARRAY_WEIGHTS][i * 4 + 1]
		var attendu := (p + Vector3.RIGHT) * (1.0 - w) + Vector3(2.0 - p.y, 1.0 + p.x, 0) * w
		_verifier(avant_a[i].distance_to(attendu) < EPSILON and avant_b[i].distance_to(attendu) < EPSILON, "repos animé analytique sommet %d" % i)
	var original_0 := skin.get_bind_pose(0)
	var original_1 := skin.get_bind_pose(1)
	a.skin = a.skin.duplicate()
	_verifier(a.skin.get_bind_count() == skin.get_bind_count(), "duplicate copie bind_count")
	for i in skin.get_bind_count():
		_verifier(a.skin.get_bind_pose(i) == skin.get_bind_pose(i) and a.skin.get_bind_bone(i) == skin.get_bind_bone(i) and a.skin.get_bind_name(i) == skin.get_bind_name(i), "duplicate copie bind %d" % i)
	a.skin.set_bind_pose(1, Transform3D(Basis.IDENTITY, Vector3(0, -1, 2)))
	var apres_a := _positions(a)
	var apres_b := _positions(b)
	_verifier(a.skin != b.skin, "Skin distinctes après duplicate")
	_verifier(a.mesh == b.mesh, "Mesh toujours partagé")
	_verifier(a.skin.get_bind_pose(0) == original_0, "bind non ciblé A intact")
	_verifier(b.skin.get_bind_pose(0) == original_0 and b.skin.get_bind_pose(1) == original_1, "(b) binds B intacts")
	for i in 4:
		var poids: float = arrays[Mesh.ARRAY_WEIGHTS][i * 4 + 1]
		var attendu: Vector3 = avant_a[i] + Vector3(0, 0, 2 * poids)
		_verifier(apres_a[i].distance_to(attendu) < EPSILON, "(a) sommet A %d selon nouveau bind" % i)
		_verifier(apres_b[i].distance_to(avant_b[i]) < EPSILON, "(b) sommet B %d inchangé" % i)
		print("[skin-bind] sommet=", i, " A_avant=", avant_a[i], " A_apres=", apres_a[i], " attendu=", attendu, " B_avant=", avant_b[i], " B_apres=", apres_b[i])
	print("[skin-bind] mesh_partage=", a.mesh == b.mesh, " skin_partagee=", a.skin == b.skin)
	print("[skin-bind] display_server=", DisplayServer.get_name(), " rendering_method=",  RenderingServer.get_current_rendering_method(), " skin_reference_A=", a.get_skin_reference() != null, " rendering_skeleton_RID_valide=", a.get_skin_reference().get_skeleton().is_valid())
	print("[skin-bind] mesure=CPU somme poids * pose_globale * bind via SkinReference.get_skin(); aucune lecture GPU ni validation visuelle/GLB")
	for faute in _fautes:
		push_error("[skin-bind] " + faute)
	print("[skin-bind] erreurs=", _fautes.size())
	a.get_parent().free()
	b.get_parent().free()
	quit(0 if _fautes.is_empty() else 1)


func _instance(nom: String, mesh: ArrayMesh, skin: Skin) -> MeshInstance3D:
	var squelette := Skeleton3D.new()
	squelette.name = nom
	squelette.add_bone("racine")
	squelette.add_bone("enfant")
	squelette.set_bone_parent(1, 0)
	squelette.set_bone_rest(1, Transform3D(Basis.IDENTITY, Vector3.UP))
	squelette.set_bone_pose_position(0, Vector3.RIGHT)
	squelette.set_bone_pose_position(1, Vector3.UP)
	squelette.set_bone_pose_rotation(1, Quaternion(Vector3.BACK, PI / 2))
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.skin = skin
	instance.skeleton = NodePath("..")
	squelette.add_child(instance)
	root.add_child(squelette)
	squelette.force_update_all_bone_transforms()
	return instance


func _positions(instance: MeshInstance3D) -> PackedVector3Array:
	var reference := instance.get_skin_reference()
	_verifier(reference != null, "SkinReference présente")
	if reference == null:
		return PackedVector3Array()
	var skin := reference.get_skin()
	_verifier(skin == instance.skin, "SkinReference porte la Skin de son instance")
	var squelette := instance.get_node(instance.skeleton) as Skeleton3D
	var arrays := instance.mesh.surface_get_arrays(0)
	var positions: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
	var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
	var resultat := PackedVector3Array()
	for i in positions.size():
		var position := Vector3.ZERO
		for j in 4:
			var index := i * 4 + j
			var bind := bones[index]
			var nom := skin.get_bind_name(bind)
			var os := squelette.find_bone(nom) if not nom.is_empty() else skin.get_bind_bone(bind)
			var pose := squelette.get_bone_global_pose(os)
			position += (pose * skin.get_bind_pose(bind) * positions[i]) * weights[index]
		resultat.append(position)
	return resultat


func _verifier(condition: bool, nom: String) -> void:
	print("[skin-bind] ", "OK " if condition else "ECHEC ", nom)
	if not condition:
		_fautes.append(nom)
