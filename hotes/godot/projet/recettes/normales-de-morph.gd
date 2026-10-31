extends SceneTree

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const NORMALE_CIBLE := Vector3(0.36, 0.48, 0.8)
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[normales-de-morph] version=", Engine.get_version_info().string)
	_importer_et_verifier(true)
	_importer_et_verifier(false)
	for faute in _fautes:
		push_error("[normales-de-morph] " + faute)
	print("[normales-de-morph] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _gltf(avec_normales: bool) -> PackedByteArray:
	var positions := PackedVector3Array([Vector3.ZERO, Vector3.RIGHT, Vector3.UP])
	var normales := PackedVector3Array([Vector3.BACK, Vector3.BACK, Vector3.BACK])
	var deplacements := PackedVector3Array([Vector3.ZERO, Vector3(0, 0, 0.75), Vector3.ZERO])
	var deltas_normales := PackedVector3Array()
	for i in 3:
		deltas_normales.append(NORMALE_CIBLE - normales[i])
	var octets := PackedByteArray()
	var vues: Array = []
	var accesseurs: Array = []
	for valeurs in [positions, normales, deplacements, deltas_normales]:
		var debut := octets.size()
		for valeur in valeurs:
			octets.append_array(PackedFloat32Array([valeur.x, valeur.y, valeur.z]).to_byte_array())
		vues.append({"buffer": 0, "byteOffset": debut, "byteLength": octets.size() - debut})
		accesseurs.append({"bufferView": vues.size() - 1, "componentType": 5126, "count": 3, "type": "VEC3"})
	accesseurs[0]["min"] = [0, 0, 0]
	accesseurs[0]["max"] = [1, 1, 0]
	accesseurs[2]["min"] = [0, 0, 0]
	accesseurs[2]["max"] = [0, 0, 0.75]
	var cible := {"POSITION": 2}
	if avec_normales:
		cible["NORMAL"] = 3
	var gltf := {
		"asset": {"version": "2.0"},
		"buffers": [{"byteLength": octets.size(), "uri": "data:application/octet-stream;base64," + Marshalls.raw_to_base64(octets)}],
		"bufferViews": vues,
		"accessors": accesseurs,
		"meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "targets": [cible]}], "extras": {"targetNames": ["inclinaison"]}}],
		"nodes": [{"mesh": 0}],
		"scenes": [{"nodes": [0]}],
		"scene": 0,
	}
	return JSON.stringify(gltf).to_utf8_buffer()


func _importer_et_verifier(avec_normales: bool) -> void:
	var cas := "avec_NORMAL" if avec_normales else "sans_NORMAL"
	var document := GLTFDocument.new()
	var etat := GLTFState.new()
	var erreur := document.append_from_buffer(_gltf(avec_normales), "user://", etat)
	_verifier(erreur == OK, cas + " import glTF")
	if erreur != OK:
		return
	var scene := document.generate_scene(etat)
	_verifier(scene != null, cas + " scène générée")
	if scene == null:
		return
	var instances := scene.find_children("*", "MeshInstance3D", true, false)
	_verifier(instances.size() == 1, cas + " une instance de mesh")
	if instances.size() != 1:
		scene.free()
		return
	var mesh := (instances[0] as MeshInstance3D).mesh as ArrayMesh
	_verifier(mesh != null, cas + " ArrayMesh")
	if mesh == null:
		scene.free()
		return
	_verifier(mesh.get_blend_shape_mode() == Mesh.BLEND_SHAPE_MODE_NORMALIZED, cas + " mode NORMALIZED")
	_verifier(mesh.get_surface_count() == 1 and mesh.get_blend_shape_count() == 1, cas + " une surface et une morph")
	if mesh.get_surface_count() != 1 or mesh.get_blend_shape_count() != 1:
		scene.free()
		return
	var base := mesh.surface_get_arrays(0)
	var morphs := mesh.surface_get_blend_shape_arrays(0)
	_verifier(morphs.size() == 1, cas + " tableau de morph présent")
	if morphs.size() != 1:
		scene.free()
		return
	var positions: PackedVector3Array = base[Mesh.ARRAY_VERTEX]
	var normales: PackedVector3Array = base[Mesh.ARRAY_NORMAL]
	var positions_cibles: PackedVector3Array = morphs[0][Mesh.ARRAY_VERTEX]
	var normales_cibles: PackedVector3Array = morphs[0][Mesh.ARRAY_NORMAL]
	_verifier(positions.size() == 3 and normales.size() == 3 and positions_cibles.size() == 3 and normales_cibles.size() == 3, cas + " trois sommets et normales")
	if positions.size() != 3 or normales.size() != 3 or positions_cibles.size() != 3 or normales_cibles.size() != 3:
		scene.free()
		return
	var normale_geometrique := Vector3(-0.75, 0, 1).normalized()
	var attendue := NORMALE_CIBLE if avec_normales else Vector3.BACK
	_verifier(attendue.distance_to(normale_geometrique) > 0.1, cas + " attendu distinct du recalcul géométrique")
	_verifier(attendue.distance_to(Vector3.ZERO) > 0.1, cas + " attendu distinct de zéro")
	for i in 3:
		var position_attendue := positions[i]
		if positions[i].distance_to(Vector3.RIGHT) < EPSILON:
			position_attendue += Vector3(0, 0, 0.75)
		_verifier(positions_cibles[i].distance_to(position_attendue) < EPSILON, cas + " position absolue sommet %d" % i)
		_verifier(normales[i].distance_to(Vector3.BACK) < EPSILON, cas + " normale de base sommet %d" % i)
		_verifier(normales_cibles[i].distance_to(attendue) < EPSILON, cas + " normale absolue sommet %d" % i)
		print("[normales-de-morph] cas=", cas, " sommet=", i, " base=", normales[i], " lue=", normales_cibles[i], " attendue=", attendue, " recalcul_geometrique=", normale_geometrique)
	scene.free()


func _verifier(condition: bool, nom: String) -> void:
	print("[normales-de-morph] ", "OK " if condition else "ECHEC ", nom)
	if not condition:
		_fautes.append(nom)
