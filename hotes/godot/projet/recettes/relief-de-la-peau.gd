extends SceneTree

## Le relief de la peau sous la corpulence (#4002, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : la base
## posée s'habille des `reliefs` de sa composition (`MontageDeComposition.habiller_la_base`). Chaque surface que
## `reliefs` nomme reçoit un matériau propre dont le `normal_scale` est celui de son matériau actif, remplaçant par sexe
## compris, multiplié par le facteur ; le matériau partagé du GLB ne change pas. Sans facteur, l'override est retiré.

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const BASE := "humanoide"
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[relief-de-la-peau] version=", Engine.get_version_info().string)
	MontageDeComposition.modeles = {surfaces = {BASE: [{nom = "Peau", palette = "peau"}, {nom = "Cheveux", palette = "cheveux"}]}}
	var peau := _materiau("Peau", 0.8)
	var cheveux := _materiau("Cheveux", 0.8)
	var peau_f := _materiau("Peau_F", 0.6)
	var scene := Node3D.new()
	scene.set_meta(MontageDeComposition.MATERIAUX, {Peau = peau, Peau_F = peau_f, Cheveux = cheveux})
	var tete := _mesh("Tete", peau, cheveux)
	var corps := _mesh("Corps", peau, cheveux)
	scene.add_child(tete)
	scene.add_child(corps)
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	montage.composee = {reliefs = {Peau = 0.5}}
	montage.poser_le_modele({id = BASE}, scene)
	for piece in [tete, corps]:
		_attendre(piece, 0, 0.4, "facteur 0,5 sur 0,8")
		if piece.get_surface_override_material(1) != null:
			_fautes.append("%s : la surface sans facteur reçoit un matériau propre" % piece.name)
	if tete.get_surface_override_material(0) == corps.get_surface_override_material(0):
		_fautes.append("les deux meshes partagent le matériau propre")

	montage.composee = {reliefs = {Peau = 0.5}, materiaux = {Peau = "Peau_F"}}
	montage.habiller_la_base()
	_attendre(tete, 0, 0.3, "facteur 0,5 sur le remplaçant à 0,6")

	montage.composee = {reliefs = {}}
	montage.habiller_la_base()
	for piece in [tete, corps]:
		if piece.get_surface_override_material(0) != null:
			_fautes.append("%s : l'override reste sans facteur" % piece.name)
	for materiau: StandardMaterial3D in [peau, cheveux]:
		if not is_equal_approx(materiau.normal_scale, 0.8):
			_fautes.append("matériau partagé %s écrit : normal_scale %f" % [materiau.resource_name, materiau.normal_scale])
	if not is_equal_approx(peau_f.normal_scale, 0.6):
		_fautes.append("remplaçant partagé écrit : normal_scale %f" % peau_f.normal_scale)
	for faute in _fautes:
		push_error("[relief-de-la-peau] " + faute)
	print("[relief-de-la-peau] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _attendre(piece: MeshInstance3D, surface: int, attendu: float, cas: String) -> void:
	var local := piece.get_surface_override_material(surface) as BaseMaterial3D
	if local == null:
		_fautes.append("%s (%s) : aucun matériau propre" % [piece.name, cas])
	elif absf(local.normal_scale - attendu) > EPSILON:
		_fautes.append("%s (%s) : normal_scale %f, attendu %f" % [piece.name, cas, local.normal_scale, attendu])


## Un matériau à normal map, nommé comme une surface du GLB.
func _materiau(nom: String, normal_scale: float) -> StandardMaterial3D:
	var materiau := StandardMaterial3D.new()
	materiau.resource_name = nom
	materiau.normal_enabled = true
	materiau.normal_texture = ImageTexture.create_from_image(Image.create(4, 4, false, Image.FORMAT_RGB8))
	materiau.normal_scale = normal_scale
	return materiau


## Un mesh à deux surfaces triangulaires, la première sous `premier`, la seconde sous `second`.
func _mesh(nom: String, premier: Material, second: Material) -> MeshInstance3D:
	var mesh := ArrayMesh.new()
	for materiau in [premier, second]:
		var tableaux := []
		tableaux.resize(Mesh.ARRAY_MAX)
		tableaux[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3.ZERO, Vector3.RIGHT, Vector3.UP])
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
		mesh.surface_set_material(mesh.get_surface_count() - 1, materiau)
	var piece := MeshInstance3D.new()
	piece.name = nom
	piece.mesh = mesh
	return piece
