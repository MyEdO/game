extends SceneTree

## La lumière sous chacun des deux rendus (#3951, #3811, `hotes/godot/pont/CONTRAT.md`, section « Lumière ») : cinq
## lampes posées par `Lumiere.eclairer` au-dessus d'un sol que pose `VolumeDeScene`, une sans écran, chacune des autres
## au-dessus d'un écran qui lui cache le sol, lu aux pixels de l'image rendue. Sous les deux rendus, l'écran d'un décor
## et celui d'un corps portent l'ombre d'une lampe posée ; l'écran du luminaire d'une lampe posée et celui d'un corps
## sous une lampe portée n'en portent pas. Sous Forward+ seul, l'environnement porte l'occlusion ambiante et le
## brouillard volumétrique, et chacun change l'image : le brouillard diffuse la lampe dans l'ombre de son écran,
## l'occlusion assombrit le sol au bord de l'écran. Sous le rendu de compatibilité, qui n'en porte aucun, le sol dans
## l'ombre d'un écran a le rouge d'un sol loin de toute lampe.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const RECETTE_RENDUE := true
const LARGEUR := 25
const HAUTEUR := 8
## Une lampe à un mètre du sol, de portée trois cases, au-dessus d'un écran de 80 cm de côté à mi-hauteur : son ombre
## couvre le sol jusqu'à 80 cm de l'aplomb, lu à 60 cm.
const HAUTEUR_DE_LAMPE := 1.0
const HAUTEUR_D_ECRAN := 0.5
const DEMI_ECRAN := 0.4
const LECTURE := 0.6
## Par lampe : sa clé, sa case, ce qui lui fait écran, et si le sol reste éclairé ; la première, sans écran, dit le
## rouge d'un sol éclairé.
const LAMPES := [
	{cle = "posee/libre", x = 22, ecran = "", eclaire = true},
	{cle = "posee/luminaire", x = 2, ecran = "luminaire", eclaire = true},
	{cle = "posee/decor", x = 7, ecran = "decor", eclaire = false},
	{cle = "portee/heros", x = 12, ecran = "corps", eclaire = true},
	{cle = "posee/corps", x = 17, ecran = "corps", eclaire = false},
]
const Y := 4
## L'écart de rouge (sur 255) le plus petit entre le sol sous la lampe sans écran et un sol loin de toute lampe.
const ECLAIRE := 40
## Le rang, parmi `LAMPES`, de celle dont l'écran porte ombre sur le sol : le sol où se lisent le brouillard et
## l'occlusion.
const A_L_OMBRE := 2
## L'écart de rouge le plus petit que le brouillard volumétrique ajoute à ce sol, et celui que l'occlusion ambiante lui
## retire, sans brouillard, sous l'ambiante `AMBIANTE_D_OCCLUSION`, qu'elle seule assombrit.
const HALO_LU := 12
const OCCLUSION_LUE := 4
const AMBIANTE_D_OCCLUSION := 0.5
## L'écart de rouge le plus grand entre deux sols que la même lumière éclaire.
const MEME_ROUGE := 3
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	var complet := RenderingServer.get_current_rendering_method() == "forward_plus"
	print("[lumiere-des-deux-rendus] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	var scene := Node3D.new()
	root.add_child(scene)
	var camera := Camera3D.new()
	scene.add_child(camera)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 14.0
	camera.look_at_from_position(Vector3(LARGEUR / 2.0, 30.0, HAUTEUR / 2.0), Vector3(LARGEUR / 2.0, 0.0, HAUTEUR / 2.0), Vector3.FORWARD)
	camera.current = true
	var hauteurs := []
	for y in HAUTEUR:
		var rangee := []
		rangee.resize(LARGEUR)
		rangee.fill(0.0)
		hauteurs.append(rangee)
	var morceau := _morceau()
	var volume: VolumeDeScene = load("res://scenes/VolumeDeScene.tscn").instantiate()
	scene.add_child(volume)
	volume.poser({monde = {metresParCase = 1.0, hauteurs = [{z = 0, rangees = hauteurs}], morceaux = [morceau]}, toits = [], couronnes = []}, {volume = [morceau], toits = [], couronnes = []})
	for lampe: Dictionary in LAMPES:
		if lampe.ecran == "corps":
			var corps := MeshInstance3D.new()
			var plaque := BoxMesh.new()
			plaque.size = Vector3(2.0 * DEMI_ECRAN, 0.02, 2.0 * DEMI_ECRAN)
			corps.mesh = plaque
			corps.layers = MontageDeComposition.CALQUE
			corps.position = MiseEnPage.point_de_la_carte(lampe.x, Y, HAUTEUR_D_ECRAN)
			scene.add_child(corps)
	var lumiere: Lumiere = load("res://scenes/Lumiere.tscn").instantiate()
	scene.add_child(lumiere)
	lumiere.eclairer({soleil = null, ambiante = {couleur = "#ffffff", energie = 0.05}, ciel = null,
		brume = {couleur = "#000000", debutCases = 100.0, finCases = 200.0, depuisLOeil = true},
		sources = LAMPES.map(func(lampe: Dictionary) -> Dictionary: return {cle = lampe.cle, x = lampe.x, y = Y, z = 0, hM = HAUTEUR_DE_LAMPE, rayonCases = 3, couleur = "#ffffff", energie = 1.0, scintillement = null, visuel = null, son = null})}, 1.0)
	var environnement := (lumiere.get_node("Environnement") as WorldEnvironment).environment
	if environnement.ssao_enabled != complet:
		_fautes.append("occlusion ambiante %s, attendu %s" % [environnement.ssao_enabled, complet])
	if environnement.volumetric_fog_enabled != complet:
		_fautes.append("brouillard volumétrique %s, attendu %s" % [environnement.volumetric_fog_enabled, complet])
	var image := await _image()
	var fond := _rouge(image, camera, Vector3(5.0, 0.0, 0.5))
	var lus := LAMPES.map(func(lampe: Dictionary) -> int: return _rouge(image, camera, _sol_lu(lampe)))
	print("[lumiere-des-deux-rendus] rouge au sol sous chaque lampe %s, loin de toute lampe %d" % [lus, fond])
	if lus[0] < fond + ECLAIRE:
		_fautes.append("la lampe sans écran n'éclaire pas son sol : rouge %d, %d loin de toute lampe" % [lus[0], fond])
	for rang in LAMPES.size():
		var eclaire: bool = lus[rang] > (fond + lus[0]) / 2
		if eclaire != LAMPES[rang].eclaire:
			_fautes.append("%s sur l'écran %s : sol %s (rouge %d), attendu %s" % [LAMPES[rang].cle, LAMPES[rang].ecran, "éclairé" if eclaire else "dans l'ombre", lus[rang], "éclairé" if LAMPES[rang].eclaire else "dans l'ombre"])
	if complet:
		var a_l_ombre := _sol_lu(LAMPES[A_L_OMBRE])
		environnement.volumetric_fog_enabled = false
		var sans_brouillard := _rouge(await _image(), camera, a_l_ombre)
		environnement.ambient_light_energy = AMBIANTE_D_OCCLUSION
		var occulte := _rouge(await _image(), camera, a_l_ombre)
		environnement.ssao_enabled = false
		var sans_occlusion := _rouge(await _image(), camera, a_l_ombre)
		print("[lumiere-des-deux-rendus] rouge du sol dans l'ombre : %d, %d sans brouillard ; sans lui sous l'ambiante forte %d, %d sans occlusion" % [lus[A_L_OMBRE], sans_brouillard, occulte, sans_occlusion])
		if lus[A_L_OMBRE] < sans_brouillard + HALO_LU:
			_fautes.append("le brouillard volumétrique ne diffuse pas la lampe dans l'ombre de son écran : rouge %d, %d sans lui" % [lus[A_L_OMBRE], sans_brouillard])
		if occulte > sans_occlusion - OCCLUSION_LUE:
			_fautes.append("l'occlusion ambiante n'assombrit pas le sol au bord de l'écran : rouge %d, %d sans elle" % [occulte, sans_occlusion])
	elif absi(lus[A_L_OMBRE] - fond) > MEME_ROUGE:
		_fautes.append("le sol dans l'ombre de son écran n'a pas le rouge d'un sol loin de toute lampe : %d, %d loin de toute lampe" % [lus[A_L_OMBRE], fond])
	for faute in _fautes:
		push_error("[lumiere-des-deux-rendus] " + faute)
	print("[lumiere-des-deux-rendus] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le morceau du sol (`MorceauDuMonde`) : `LARGEUR` × `HAUTEUR` cases plates, gris clair, et, à mi-hauteur sous chaque
## lampe dont l'écran est du volume, sa plaque : une surface `luminaire` sous la lampe du luminaire, une surface de
## décor sous celle du décor.
func _morceau() -> Dictionary:
	var positions := []
	var normales := []
	var couleurs := []
	var cases := []
	for y in HAUTEUR:
		for x in LARGEUR:
			_plaque(positions, normales, couleurs, cases, Vector3(x, 0.0, y), 0.5, Vector2i(x, y))
	var surfaces := [{debut = 0, fin = positions.size() / 3, matiere = "terrain--sol-d-essai"}]
	for lampe: Dictionary in LAMPES:
		if lampe.ecran != "luminaire" and lampe.ecran != "decor":
			continue
		var debut := positions.size() / 3
		_plaque(positions, normales, couleurs, cases, Vector3(lampe.x, HAUTEUR_D_ECRAN, Y), DEMI_ECRAN, Vector2i(lampe.x, Y))
		var surface := {debut = debut, fin = positions.size() / 3, matiere = "terrain--sol-d-essai"}
		if lampe.ecran == "luminaire":
			surface.luminaire = true
		surfaces.append(surface)
	return {cle = "sol/0/tout", empreinte = "sol/0/tout", rangee = 0, positions = positions, normales = normales, couleurs = couleurs, cases = cases, surfaces = surfaces}


## Une plaque horizontale de demi-côté `demi` centrée sur `centre` (repère du volume), tournée vers le haut, sur la
## case `case`.
func _plaque(positions: Array, normales: Array, couleurs: Array, cases: Array, centre: Vector3, demi: float, case: Vector2i) -> void:
	for coin: Array in [[-1.0, -1.0], [-1.0, 1.0], [1.0, 1.0], [-1.0, -1.0], [1.0, 1.0], [1.0, -1.0]]:
		positions.append_array([centre.x + coin[0] * demi, centre.y, centre.z + coin[1] * demi])
		normales.append_array([0.0, 1.0, 0.0])
		couleurs.append_array([0.8, 0.8, 0.8, 1.0])
	cases.append_array([case.x, case.y, 0, case.x, case.y, 0])


## Le sol lu près de l'aplomb de la lampe `lampe`.
func _sol_lu(lampe: Dictionary) -> Vector3:
	return MiseEnPage.point_de_la_carte(lampe.x, Y, 0.0) + Vector3(LECTURE, 0.0, 0.0)


## L'image rendue, une fois ce qui vient de changer rendu.
func _image() -> Image:
	for _image_rendue in 12:
		await process_frame
	await RenderingServer.frame_post_draw
	return root.get_texture().get_image()


## Le rouge (sur 255) du pixel de l'image `image` où la caméra `camera` montre le lieu `lieu`.
func _rouge(image: Image, camera: Camera3D, lieu: Vector3) -> int:
	return image.get_pixelv(Vector2i(camera.unproject_position(lieu) * Vector2(image.get_size()) / root.get_visible_rect().size)).r8
