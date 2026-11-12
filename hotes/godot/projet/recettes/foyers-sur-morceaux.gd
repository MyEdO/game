extends SceneTree

## Plus de huit foyers sur le monde en morceaux (#3948) : un sol de 32 × 24 cases posé par `VolumeDeScene` en morceaux de
## 8 × 8 cases sous onze lampes, chacune au-dessus d'un morceau ; chaque lampe éclaire le sol sous elle, lu aux pixels de
## l'image rendue. Témoin : sous le rendu de compatibilité, le même sol en un seul morceau n'est éclairé que par huit
## d'entre elles, sa borne par objet (`rendering/limits/opengl/max_lights_per_object`) ; sous Forward+, qui n'a pas
## cette borne, par toutes.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const RECETTE_RENDUE := true
const LARGEUR := 32
const HAUTEUR := 24
const CASES_PAR_MORCEAU := 8
## Les lampes : une au-dessus du centre de chacun des onze premiers morceaux, à une case du sol, de portée 3 cases.
const LAMPES := 11
const HAUTEUR_DE_LAMPE := 1.0
const PORTEE_DE_LAMPE := 3.0
## L'écart de rouge (sur 255) au-delà duquel le sol sous une lampe est éclairé, contre un sol loin de toute lampe.
const ECLAIRE := 20
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[foyers-sur-morceaux] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	var scene := Node3D.new()
	root.add_child(scene)
	var camera := Camera3D.new()
	scene.add_child(camera)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 26.0
	camera.look_at_from_position(Vector3(LARGEUR / 2.0, 30.0, HAUTEUR / 2.0), Vector3(LARGEUR / 2.0, 0.0, HAUTEUR / 2.0), Vector3.FORWARD)
	camera.current = true
	var monde := WorldEnvironment.new()
	monde.environment = Environment.new()
	monde.environment.background_mode = Environment.BG_COLOR
	monde.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	monde.environment.ambient_light_color = Color.WHITE
	monde.environment.ambient_light_energy = 0.05
	scene.add_child(monde)
	var morceaux := []
	for by in HAUTEUR / CASES_PAR_MORCEAU:
		for bx in LARGEUR / CASES_PAR_MORCEAU:
			morceaux.append(_morceau("sol/0/%d/%d" % [bx, by], bx * CASES_PAR_MORCEAU, by * CASES_PAR_MORCEAU, CASES_PAR_MORCEAU, CASES_PAR_MORCEAU))
	var foyers: Array[Vector3] = []
	for rang in LAMPES:
		var lampe := OmniLight3D.new()
		lampe.position = Vector3(morceaux[rang].centre.x, HAUTEUR_DE_LAMPE, morceaux[rang].centre.y)
		lampe.omni_range = PORTEE_DE_LAMPE
		lampe.light_energy = 2.0
		scene.add_child(lampe)
		foyers.append(lampe.position)
	var hauteurs := []
	for y in HAUTEUR:
		var rangee := []
		rangee.resize(LARGEUR)
		rangee.fill(0.0)
		hauteurs.append(rangee)
	var eclaires := {}
	for essai: Array in [["en morceaux", morceaux], ["en un morceau", [_morceau("sol/0/tout", 0, 0, LARGEUR, HAUTEUR)]]]:
		var volume: VolumeDeScene = load("res://scenes/VolumeDeScene.tscn").instantiate()
		scene.add_child(volume)
		var poses: Array = essai[1]
		volume.poser({monde = {metresParCase = 1.0, hauteurs = [{z = 0, rangees = hauteurs}], morceaux = poses}, toits = [], couronnes = []}, {volume = poses, toits = [], couronnes = []})
		volume.position = Vector3.ZERO
		var image := await _image()
		var fond := image.get_pixelv(_pixel(image, camera, Vector3(LARGEUR - 2.0, 0.0, HAUTEUR - 2.0))).r8
		var lus := []
		var compte := 0
		for foyer in foyers:
			var lu := image.get_pixelv(_pixel(image, camera, Vector3(foyer.x, 0.0, foyer.z))).r8
			lus.append(lu)
			if lu > fond + ECLAIRE:
				compte += 1
		eclaires[essai[0]] = compte
		print("[foyers-sur-morceaux] %s (%d morceaux) : %d lampes sur %d éclairent le sol sous elles ; rouge sous chacune %s, loin de toutes %d" % [essai[0], poses.size(), compte, LAMPES, lus, fond])
		volume.free()
	if eclaires["en morceaux"] != LAMPES:
		_fautes.append("en morceaux : %d lampes éclairent leur sol, attendu %d" % [eclaires["en morceaux"], LAMPES])
	var borne := 8 if RenderingServer.get_current_rendering_method() == "gl_compatibility" else LAMPES
	if eclaires["en un morceau"] != borne:
		_fautes.append("témoin en un morceau : %d lampes éclairent leur sol, attendu %d (la borne par objet du rendu)" % [eclaires["en un morceau"], borne])
	for faute in _fautes:
		push_error("[foyers-sur-morceaux] " + faute)
	print("[foyers-sur-morceaux] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le morceau `cle` (`MorceauDuMonde`) : le sol plat des `largeur` × `hauteur` cases depuis la case (`x0`, `y0`), gris
## clair, et le centre de son bloc.
func _morceau(cle: String, x0: int, y0: int, largeur: int, hauteur: int) -> Dictionary:
	var positions := []
	var normales := []
	var couleurs := []
	var cases := []
	for y in range(y0, y0 + hauteur):
		for x in range(x0, x0 + largeur):
			for coin: Array in [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [0.5, -0.5]]:
				positions.append_array([x + coin[0], 0.0, y + coin[1]])
				normales.append_array([0.0, 1.0, 0.0])
				couleurs.append_array([0.8, 0.8, 0.8, 1.0])
			cases.append_array([x, y, 0, x, y, 0])
	return {cle = cle, empreinte = cle, rangee = 0, positions = positions, normales = normales, couleurs = couleurs, cases = cases,
		surfaces = [{debut = 0, fin = positions.size() / 3, matiere = "terrain--sol-d-essai"}], centre = Vector2(x0 + largeur / 2.0 - 0.5, y0 + hauteur / 2.0 - 0.5)}


func _image() -> Image:
	for _image_rendue in 12:
		await process_frame
	await RenderingServer.frame_post_draw
	return root.get_texture().get_image()


## Le pixel de l'image `image` où la caméra `camera` montre le lieu `lieu`.
func _pixel(image: Image, camera: Camera3D, lieu: Vector3) -> Vector2i:
	return Vector2i(camera.unproject_position(lieu) * Vector2(image.get_size()) / root.get_visible_rect().size)
