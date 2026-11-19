extends SceneTree

## La palette d'un véhicule et de ses pièces (#2987, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant »,
## `vehicules`) : chaque scène est peinte de sa propre palette, aux surfaces de son élément
## (`MontageDeVehicule.peindre_l_element`), avant que la pièce ne monte à son poste (`MontageDeVehicule.monter_au_poste`). Une pièce
## dont un matériau porte le même nom qu'un matériau du véhicule garde sa couleur ; une surface dont la palette ne
## colore pas l'emplacement garde l'albédo du GLB. Une surface dont la texture de la `matiere` est au projet s'en habille
## comme le monde, que la couleur de sa palette teint ; sans palette, son albédo est blanc. L'emblème du véhicule se pose sur ses seules surfaces `blason`
## (voiles, pavillon), en couche de détail aux UV du GLB : en UV2 sur une surface à matière texturée, dont l'UV1 est
## projeté sur les trois axes ; une pièce peinte sans emblème n'en reçoit aucun.

const RECETTE_AUTONOME := true
const BOIS := "bois"
const CUIR := "cuir"
const TOILE := "toile"
const PAVILLON := "pavillon"
const GRIS := Color(0.5, 0.5, 0.5)
## Une matière dont le projet porte la texture, épinglée sous `textures/`.
const PLANCHES := "terrain--planches"
const ROUGE := "#ff0000"
const VERT := "#00ff00"
var _fautes: Array[String] = []
## Les matières locales de ses scènes (`MontageDeComposition.materiau_local`).
var _locaux: Dictionary = {}


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[peinture-du-vehicule] version=", Engine.get_version_info().string)
	MontageDeComposition.modeles = {surfaces = {
		coque = [{nom = BOIS, palette = BOIS, matiere = PLANCHES}, {nom = CUIR, palette = CUIR}, {nom = TOILE, palette = "vet1", blason = true, matiere = PLANCHES}, {nom = PAVILLON, palette = "vet1", blason = true}],
		canon = [{nom = BOIS, palette = BOIS, matiere = "prop--sans-texture"}, {nom = CUIR, palette = CUIR, matiere = PLANCHES}],
	}}
	var coque := _scene([BOIS, CUIR, TOILE, PAVILLON])
	var canon := _scene([BOIS, CUIR])
	root.add_child(coque)
	var embleme := ImageTexture.create_from_image(Image.create(2, 2, false, Image.FORMAT_RGBA8))
	if not MontageDeVehicule.peindre_l_element(coque, "coque", {bois = ROUGE}, embleme, _locaux):
		_fautes.append("l'emblème du véhicule n'est posé sur aucune surface")
	if MontageDeVehicule.peindre_l_element(canon, "canon", {bois = VERT}, null, _locaux):
		_fautes.append("une pièce peinte sans emblème en porte un")
	MontageDeVehicule.monter_au_poste(coque, canon, {position = [0.0, 1.0, 0.0], bord = "tribord"})
	_attendre(coque, 0, Color(ROUGE), "bois de la coque")
	_attendre(coque, 1, GRIS, "cuir de la coque, que la palette ne colore pas")
	_attendre(canon, 0, Color(VERT), "bois du canon monté sur la coque, sa matière sans texture")
	_attendre(canon, 1, Color.WHITE, "cuir du canon, sa matière texturée, que la palette ne colore pas")
	var planches: Texture2D = load(VolumeDeScene.texture_de(PLANCHES))
	_attendre_la_matiere(coque, 0, planches, "bois de la coque, sa matière texturée teinte de la palette")
	_attendre_la_matiere(canon, 1, planches, "cuir du canon, sa matière texturée")
	_attendre_la_matiere(canon, 0, null, "bois du canon, sa matière sans texture")
	_attendre_l_embleme(coque, 2, embleme, "toile de la coque, surface blason")
	_attendre_les_uv_de_l_embleme(coque, 2, BaseMaterial3D.DETAIL_UV_2, "toile de la coque, blason à matière texturée")
	_attendre_les_uv_de_l_embleme(coque, 3, BaseMaterial3D.DETAIL_UV_1, "pavillon de la coque, blason sans matière")
	_attendre_l_embleme(coque, 0, null, "bois de la coque, sans blason")
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


## La surface `rang` du mesh de `scene` porte `texture` en albédo, projetée sur les trois axes comme le monde (`null` :
## aucune texture).
func _attendre_la_matiere(scene: Node3D, rang: int, texture: Texture2D, quoi: String) -> void:
	var materiau := (scene.get_child(0) as MeshInstance3D).get_active_material(rang) as BaseMaterial3D
	if materiau.albedo_texture != texture or materiau.uv1_triplanar != (texture != null):
		_fautes.append("%s : texture %s (triplanaire %s), %s attendue" % [quoi, materiau.albedo_texture, materiau.uv1_triplanar, texture])


## L'albédo actif de la surface `rang` du mesh de `scene` vaut `couleur`.
func _attendre(scene: Node3D, rang: int, couleur: Color, cas: String) -> void:
	var mesh: MeshInstance3D = scene.get_child(0)
	var albedo := (mesh.get_active_material(rang) as BaseMaterial3D).albedo_color
	if not albedo.is_equal_approx(couleur):
		_fautes.append("%s : %s, attendu %s" % [cas, albedo.to_html(false), couleur.to_html(false)])


## La couche de détail de la surface `rang` du mesh de `scene` porte `texture` (`null` : aucune couche).
func _attendre_l_embleme(scene: Node3D, rang: int, texture: ImageTexture, quoi: String) -> void:
	var materiau := (scene.get_child(0) as MeshInstance3D).get_active_material(rang) as BaseMaterial3D
	var pose: Texture2D = materiau.detail_albedo if materiau.detail_enabled else null
	if pose != texture:
		_fautes.append("%s : emblème %s, %s attendu" % [quoi, pose, texture])


## La couche de détail de la surface `rang` du mesh de `scene` lit le jeu d'UV `couche`, et l'UV2 d'une couche en UV2
## reprend les UV du mesh.
func _attendre_les_uv_de_l_embleme(scene: Node3D, rang: int, couche: BaseMaterial3D.DetailUV, quoi: String) -> void:
	var mesh := scene.get_child(0) as MeshInstance3D
	var materiau := mesh.get_active_material(rang) as BaseMaterial3D
	if materiau.detail_uv_layer != couche:
		_fautes.append("%s : emblème en UV%d, UV%d attendu" % [quoi, materiau.detail_uv_layer + 1, couche + 1])
	var tableaux := mesh.mesh.surface_get_arrays(rang)
	if couche == BaseMaterial3D.DETAIL_UV_2 and tableaux[Mesh.ARRAY_TEX_UV2] != tableaux[Mesh.ARRAY_TEX_UV]:
		_fautes.append("%s : l'UV2 ne reprend pas les UV du mesh" % quoi)
