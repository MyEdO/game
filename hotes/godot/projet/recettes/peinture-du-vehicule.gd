extends SceneTree

## La palette d'un véhicule et de ses pièces (#2987, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant »,
## `vehicules`) : chaque scène est peinte de sa propre palette, aux surfaces de son élément
## (`Combattant.peindre_l_element`), avant que la pièce ne monte à son poste (`Combattant.monter_au_poste`). Une pièce
## dont un matériau porte le même nom qu'un matériau du véhicule garde sa couleur ; une surface dont la palette ne
## colore pas l'emplacement garde l'albédo du GLB.

const RECETTE_AUTONOME := true
const BOIS := "bois"
const CUIR := "cuir"
const GRIS := Color(0.5, 0.5, 0.5)
const ROUGE := "#ff0000"
const VERT := "#00ff00"
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[peinture-du-vehicule] version=", Engine.get_version_info().string)
	MontageDeComposition.modeles = {surfaces = {
		coque = [{nom = BOIS, palette = BOIS}, {nom = CUIR, palette = CUIR}],
		canon = [{nom = BOIS, palette = BOIS}],
	}}
	var coque := _scene([BOIS, CUIR])
	var canon := _scene([BOIS])
	root.add_child(coque)
	Combattant.peindre_l_element(coque, "coque", {bois = ROUGE})
	Combattant.peindre_l_element(canon, "canon", {bois = VERT})
	Combattant.monter_au_poste(coque, canon, {position = [0.0, 1.0, 0.0], bord = "tribord"})
	_attendre(coque, 0, Color(ROUGE), "bois de la coque")
	_attendre(coque, 1, GRIS, "cuir de la coque, que la palette ne colore pas")
	_attendre(canon, 0, Color(VERT), "bois du canon monté sur la coque")
	for faute in _fautes:
		push_error("[peinture-du-vehicule] " + faute)
	print("[peinture-du-vehicule] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Une scène d'un mesh, une surface grise par nom de matériau de `noms`.
func _scene(noms: Array) -> Node3D:
	var scene := Node3D.new()
	var mesh := MeshInstance3D.new()
	var tableau := ArrayMesh.new()
	for nom: String in noms:
		var boite := BoxMesh.new().get_mesh_arrays()
		tableau.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, boite)
		var materiau := StandardMaterial3D.new()
		materiau.resource_name = nom
		materiau.albedo_color = GRIS
		tableau.surface_set_material(tableau.get_surface_count() - 1, materiau)
	mesh.mesh = tableau
	scene.add_child(mesh)
	return scene


## L'albédo actif de la surface `rang` du mesh de `scene` vaut `couleur`.
func _attendre(scene: Node3D, rang: int, couleur: Color, cas: String) -> void:
	var mesh: MeshInstance3D = scene.get_child(0)
	var albedo := (mesh.get_active_material(rang) as BaseMaterial3D).albedo_color
	if not albedo.is_equal_approx(couleur):
		_fautes.append("%s : %s, attendu %s" % [cas, albedo.to_html(false), couleur.to_html(false)])
