extends SceneTree

## La matière de la race (#4379, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : la base posée
## (`MontageDeComposition.habiller_la_base`) et un élément monté (`MontageDeComposition.choisir_l_embleme`, `_habiller`)
## s'habillent des `matieres` de leur composition. Une surface sans `matiere` au manifeste dont `matieres` nomme
## l'emplacement de palette garde son matériau (carte de normales, couleur de palette, aucun triplanaire) et reçoit la
## matière en couche de détail lue en UV2, les UV du mesh à l'échelle d'un motif tous les `MiseEnPage.METRES_PAR_MOTIF`
## mètres à la densité d'UV servie de la surface (`densiteUv`, `MiseEnPage.echelle_de_detail`), sous le masque
## `MiseEnPage.POIDS_DU_DETAIL`, sa profondeur divisée par ce poids (`MiseEnPage.relief_sous_le_detail`). Une surface d'un
## autre emplacement n'en reçoit rien, ni une surface sans densité, et sans `matieres` aucune. Un UV2 du GLB autre que
## ses UV est remplacé.

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const BASE := "humanoide"
const ELEMENT := "tete-de-test"
const LIGNE := "ligne/tete"
const MATIERE := "prop--peau-epaisse"
const PEAU := "#3a6a2a"
const RELIEF := 0.8
const FACTEUR := 0.75
## La densité d'UV servie de la surface de peau, en mètres par unité d'UV, autre que celle du triangle de `_mesh` (1) :
## un motif tous les `METRES_PAR_MOTIF` mètres demande une échelle UV2 de `DENSITE / METRES_PAR_MOTIF`.
const DENSITE := 3.0
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[matiere-de-la-race] version=", Engine.get_version_info().string)
	for chemin in [VolumeDeScene.relief_de(MATIERE), VolumeDeScene.texture_neutre_de(MATIERE)]:
		if not ResourceLoader.exists(chemin):
			_fautes.append("%s absente du projet" % chemin)
	if not _fautes.is_empty():
		return _finir()
	var surfaces := [{nom = "Peau", palette = "peau", densiteUv = DENSITE}, {nom = "Cheveux", palette = "cheveux"}]
	MontageDeComposition.modeles = {surfaces = {BASE: surfaces, ELEMENT: surfaces}, emblemes = []}
	var atlas := ImageTexture.create_from_image(Image.create(4, 4, false, Image.FORMAT_RGB8))
	var corps := _mesh("Corps", atlas, PackedVector2Array([Vector2.DOWN, Vector2.DOWN, Vector2.DOWN]))
	var scene := Node3D.new()
	scene.add_child(corps)
	var tete := _mesh("Tete", atlas, PackedVector2Array())
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	montage.composee = {palette = {peau = PEAU}, reliefs = {Peau = FACTEUR}, matieres = {peau = MATIERE}}
	montage.poser_le_modele({id = BASE}, scene)
	scene.add_child(tete)
	montage.montes[LIGNE] = ELEMENT
	montage.pieces[LIGNE] = [tete]
	montage.choisir_l_embleme(LIGNE, MontageDeComposition.VIDE)
	_attendre_le_detail(corps, atlas, RELIEF * FACTEUR / MiseEnPage.POIDS_DU_DETAIL)
	_attendre_le_detail(tete, atlas, RELIEF / MiseEnPage.POIDS_DU_DETAIL)

	montage.composee = {palette = {peau = PEAU}}
	montage.habiller_la_base()
	montage.choisir_l_embleme(LIGNE, MontageDeComposition.VIDE)
	_attendre_sans_detail([corps, tete], "sans `matieres`")

	var sans_densite := [{nom = "Peau", palette = "peau"}, {nom = "Cheveux", palette = "cheveux"}]
	MontageDeComposition.modeles = {surfaces = {BASE: sans_densite, ELEMENT: sans_densite}, emblemes = []}
	montage.composee = {palette = {peau = PEAU}, matieres = {peau = MATIERE}}
	montage.habiller_la_base()
	montage.choisir_l_embleme(LIGNE, MontageDeComposition.VIDE)
	_attendre_sans_detail([corps, tete], "sans densité d'UV")
	_finir()


## La surface de peau de chaque pièce de `pieces`, dans le cas `cas`, n'a aucune couche de détail et garde son relief.
func _attendre_sans_detail(pieces: Array, cas: String) -> void:
	for piece: MeshInstance3D in pieces:
		var local := piece.get_surface_override_material(0) as BaseMaterial3D
		if local == null or local.detail_enabled or not is_equal_approx(local.normal_scale, RELIEF):
			_fautes.append("%s : %s, la peau garde une couche de détail ou un relief changé" % [piece.name, cas])


## La surface de peau de `piece` : son matériau propre garde la carte de normales `atlas`, la couleur `PEAU`, aucun
## triplanaire, a la profondeur `profondeur`, et porte `MATIERE` en détail UV2 à l'échelle `DENSITE / METRES_PAR_MOTIF` ;
## la surface des cheveux n'a aucun matériau propre ; le mesh porte ses UV en UV2.
func _attendre_le_detail(piece: MeshInstance3D, atlas: Texture2D, profondeur: float) -> void:
	var local := piece.get_surface_override_material(0) as BaseMaterial3D
	if local == null:
		_fautes.append("%s : la surface de peau ne reçoit aucun matériau propre" % piece.name)
		return
	if local.normal_texture != atlas or local.albedo_color != Color(PEAU) or local.uv1_triplanar:
		_fautes.append("%s : matériau de base changé (normales %s, couleur %s, triplanaire %s)" % [piece.name, local.normal_texture, local.albedo_color, local.uv1_triplanar])
	if absf(local.normal_scale - profondeur) > EPSILON:
		_fautes.append("%s : normal_scale %f, attendu %f" % [piece.name, local.normal_scale, profondeur])
	var echelle := DENSITE / MiseEnPage.METRES_PAR_MOTIF
	if not local.detail_enabled or local.detail_uv_layer != BaseMaterial3D.DETAIL_UV_2 \
			or local.detail_blend_mode != BaseMaterial3D.BLEND_MODE_MUL \
			or local.detail_normal != load(VolumeDeScene.relief_de(MATIERE)) \
			or local.detail_albedo != load(VolumeDeScene.texture_neutre_de(MATIERE)) \
			or local.detail_mask != MontageDeComposition.masque_du_detail() \
			or not local.uv2_scale.is_equal_approx(Vector3(echelle, echelle, 1.0)):
		_fautes.append("%s : détail %s, UV %d, mode %d, normale %s, albédo %s, masque %s, échelle %s (attendue %f)" % [piece.name,
				local.detail_enabled, local.detail_uv_layer, local.detail_blend_mode, local.detail_normal, local.detail_albedo,
				local.detail_mask, local.uv2_scale, echelle])
	if not is_equal_approx(MontageDeComposition.masque_du_detail().get_image().get_pixel(0, 0).r, MiseEnPage.POIDS_DU_DETAIL):
		_fautes.append("masque du détail : %s" % MontageDeComposition.masque_du_detail().get_image().get_pixel(0, 0))
	var tableaux := piece.mesh.surface_get_arrays(0)
	if tableaux[Mesh.ARRAY_TEX_UV2] != tableaux[Mesh.ARRAY_TEX_UV]:
		_fautes.append("%s : l'UV2 n'est pas l'UV du mesh" % piece.name)
	if piece.get_surface_override_material(1) != null:
		_fautes.append("%s : la surface des cheveux reçoit un matériau propre" % piece.name)


func _finir() -> void:
	for faute in _fautes:
		push_error("[matiere-de-la-race] " + faute)
	print("[matiere-de-la-race] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Un mesh à deux surfaces, un triangle rectangle de côté 1 dont les UV couvrent la moitié du carré unité, et l'UV2
## `uv2` s'il n'est pas vide (un UV2 dégénéré, comme celui du GLB de la base) : la première sous le matériau `Peau`, à la
## carte de normales `atlas` de force `RELIEF`, la seconde sous `Cheveux`.
func _mesh(nom: String, atlas: Texture2D, uv2: PackedVector2Array) -> MeshInstance3D:
	var mesh := ArrayMesh.new()
	for nom_du_materiau in ["Peau", "Cheveux"]:
		var tableaux := []
		tableaux.resize(Mesh.ARRAY_MAX)
		tableaux[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3.ZERO, Vector3.RIGHT, Vector3.UP])
		tableaux[Mesh.ARRAY_TEX_UV] = PackedVector2Array([Vector2.ZERO, Vector2.RIGHT, Vector2.DOWN])
		if not uv2.is_empty():
			tableaux[Mesh.ARRAY_TEX_UV2] = uv2
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
		var materiau := StandardMaterial3D.new()
		materiau.resource_name = nom_du_materiau
		materiau.normal_enabled = true
		materiau.normal_texture = atlas
		materiau.normal_scale = RELIEF
		mesh.surface_set_material(mesh.get_surface_count() - 1, materiau)
	var piece := MeshInstance3D.new()
	piece.name = nom
	piece.mesh = mesh
	return piece
