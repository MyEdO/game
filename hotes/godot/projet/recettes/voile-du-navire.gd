extends SceneTree

## Le voile de la vision sur un navire (#3950, `MontageDesNavires.voir`, `MontageDeVehicule.voiler`) : la caraque posée
## par `MontageDesNavires` sur le monde (`Monde`) d'un sol, une Amélioration montée (le nid-de-pie), peinte de sa palette,
## sous l'éclairage d'un extérieur du jeu, en tonemap linéaire (la part se lit en lumière linéaire, comme
## `voile-du-bati.gd`), brouillard volumétrique coupé : le jeu le laisse bruiter d'une image à l'autre, et la recette
## compare des images au pixel. Sous deux caméras, la tactique et l'œil de l'immersion au ras de l'eau, contre le témoin
## sans vision (`voir(null)`) : (a) le navire en vue rend le témoin au pixel ; (b) exploré, puis inconnu, la coque, le
## pont, la toile peinte de la palette et la pièce montée prennent chacun la part de lumière de son état
## (`_borne_du_pilote`) ; (d) à mi-fondu de la vue vers l'inconnu, chacun à la part qu'il prend exploré ; (e) hors du
## navire, son ombre portée comprise, chaque pixel est celui du témoin ; (f) `voir(null)` rend le témoin. (c) Coupé sous
## le pont supérieur, ce que la coupe découvre hors du navire est, voilé, ce qu'il est à la part 1. Une surface se lit
## à ses pixels intérieurs (`LecturePixels.interieur`) : son bord se mêle à ce qui l'entoure, la ligne de flottaison
## au sol qu'elle traverse, et une pièce large d'un ou deux pixels (le beaupré, le cordage au ras de l'eau) n'en a
## aucun ; une surface d'au moins `INTERIEUR_LISIBLE` pixels intérieurs se mesure. Le coût : les appels de dessin d'une
## image en vue sont ceux du témoin.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const RECETTE_RENDUE := true
const PIXELS := preload("res://recettes/lecture_des_pixels.gd")
const BATI := preload("res://recettes/voile-du-bati.gd")
const CARAQUE := "vehicule--caraque"
const NID := "amelioration--nid-de-pie"
const ID := "navire"
const METRES_PAR_CASE := 2.0
const COTE := 24
const CENTRE := {x = 12.0, y = 12.0}
## Le sol du pont supérieur de la caraque, en mètres (`coupe-du-navire.gd`).
const PONT_SUPERIEUR := 1.95
## Les teintes de `src/data/ambiance.json` (`fogTint`).
const TEINTES := {visible = 1.0, explored = 0.42, unknown = 0.15}
const VUE := 255
const EXPLOREE := 128
const INCONNUE := 0
## L'écart toléré entre la part de lumière lue et l'attendue, sous l'éclairage du jeu.
const TOLERANCE := 0.04
## Le moins de pixels intérieurs d'une surface mesurée.
const INTERIEUR_LISIBLE := 40
## Le moins de pixels hors du navire que la coupe découvre.
const DECOUVERTS_LISIBLES := 200
var _fautes: Array[String] = []
var _monde: Monde
var _navires: MontageDesNavires


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[voile-du-navire] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	await _poser()
	var mesurees := {}
	for camera in ["tactique", "au ras de l'eau"]:
		_cadrer(camera)
		for nom: String in await _par_camera(camera):
			mesurees[nom] = true
	for nom in ["coque", "pont", "toile peinte", "pièce montée"]:
		if not mesurees.has(nom):
			_fautes.append("%s : aucune caméra n'en voit %d pixels intérieurs" % [nom, INTERIEUR_LISIBLE])
	_cadrer("tactique")
	await _coupe()
	for faute in _fautes:
		push_error("[voile-du-navire] " + faute)
	print("[voile-du-navire] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le monde d'un sol de `COTE` cases sous l'éclairage du jeu, et la caraque posée par `MontageDesNavires` en son centre,
## sur le pont figé de ses deux modèles (`PontFige`), le fondu avancé par la recette seule.
func _poser() -> void:
	var manifeste := func(id: String) -> Dictionary: return JSON.parse_string(FileAccess.get_file_as_string("res://modeles/%s.manifeste.json" % id))
	var modeles := {fichiers = {CARAQUE: {glb = CARAQUE + ".glb"}, NID: {glb = NID + ".glb"}}, surfaces = {CARAQUE: manifeste.call(CARAQUE).surfaces, NID: manifeste.call(NID).surfaces}}
	PontFige.poser(self, {modeles = modeles, listage = {forme = "glb"}})
	MontageDeComposition.retenir_les_modeles(modeles, {forme = "glb"})
	_monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(_monde)
	var sol := BATI._dalles("sol/0/0/0", Rect2i(0, 0, COTE, COTE), 0, 0.0, "terrain--sol-d-essai", 0.5).merged({rangee = 0})
	var plat := []
	for y in COTE:
		var rangee := []
		rangee.resize(COTE)
		rangee.fill(0.0)
		plat.append(rangee)
	_monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [{z = 0, rangees = plat}], morceaux = [sol]}, toits = [], couronnes = []},
		{volume = [sol], toits = [], couronnes = []})
	(_monde.get_node("Lumiere") as Lumiere).eclairer(PIXELS.LUMIERE_DU_JEU, METRES_PAR_CASE)
	var environnement := (_monde.get_node("Lumiere/Environnement") as WorldEnvironment).environment
	environnement.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	environnement.volumetric_fog_enabled = false
	_navires = MontageDesNavires.new()
	var chargeur := MontageDeComposition.new()
	chargeur.name = "Chargeur"
	_navires.add_child(chargeur)
	_navires.monde = _monde
	root.add_child(_navires)
	_navires.set_process(false)
	_poser_le_navire({})
	for _image_attendue in 600:
		if ID in _navires.poses():
			break
		await process_frame
	if not ID in _navires.poses() or not chargeur.erreurs.is_empty():
		_fautes.append("la caraque se monte avec des erreurs : %s" % [chargeur.erreurs])


## La caraque servie à `MontageDesNavires`, coupée selon `coupes`.
func _poser_le_navire(coupes: Dictionary) -> void:
	var corps := {element = CARAQUE, palette = {bois = "#8a5a2b", vet1 = "#3f6fb0"}, postes = [], caches = [], clips = {}, cap = "N",
		ameliorations = [{element = NID, position = [0.0, 23.2, -1.0]}]}
	_navires.poser({ID: {corps = corps, centre = CENTRE}}, coupes, METRES_PAR_CASE)


func _cadrer(camera: String) -> void:
	var centre := MiseEnPage.point_de_la_carte(CENTRE.x, CENTRE.y, 0.0)
	if camera == "tactique":
		_monde.regarder("tactique")
		_monde.cadrer(centre, MiseEnPage.lacet_de_l_azimut(30.0), 30.0)
	else:
		_monde.regarder("immersion")
		_monde.poser_l_oeil(centre + Vector3(-14.0, 4.0, 14.0), -0.8, -0.15)


## La vision de la recette : la caraque à l'état `etat`.
func _vision(etat: int) -> Dictionary:
	return {navires = {ID: etat}, teintes = TEINTES}


## Sous la caméra `camera`, les affirmations (a), (b), (d), (e), (f) ; rend les noms des surfaces mesurées.
func _par_camera(camera: String) -> Array:
	_navires.voir(null)
	var temoin := await PIXELS.image(self)
	var appels_du_temoin := _appels()
	var hors := PIXELS.interieur(_hors_du_navire(temoin, await _sans_le_navire()))
	var ombre := _ombre(await _sans_le_navire(), await _navire_cache())
	print("[voile-du-navire] %s : %d pixels hors du navire, dont %d de son ombre" % [camera, hors.size(), ombre.size()])
	if ombre.size() < INTERIEUR_LISIBLE:
		_fautes.append("%s : l'ombre du navire n'a que %d pixels à l'écran" % [camera, ombre.size()])
	var surfaces := await _surfaces(temoin)
	_navires.voir(_vision(VUE))
	var vue := await PIXELS.image(self)
	var appels_en_vue := _appels()
	if vue.get_data() != temoin.get_data():
		_fautes.append("%s : (a) le navire en vue n'est pas le témoin" % camera)
	if appels_en_vue != appels_du_temoin:
		_fautes.append("%s : en vue, %d appels de dessin, le témoin %d" % [camera, appels_en_vue, appels_du_temoin])
	var explorees := {}
	for etat: Array in [[EXPLOREE, TEINTES.explored, "exploré"], [INCONNUE, TEINTES.unknown, "inconnu"]]:
		_navires.voir(null)
		_navires.voir(_vision(etat[0]))
		var voilee := await PIXELS.image(self)
		print("[voile-du-navire] %s, %s : %d appels de dessin (témoin %d)" % [camera, etat[2], _appels(), appels_du_temoin])
		for nom: String in surfaces:
			var lue := PIXELS.part(temoin, voilee, surfaces[nom])
			var x := _luminance_mediane(temoin, surfaces[nom])
			var haute := maxf(etat[1], _borne_du_pilote(x, etat[1]))
			if etat[0] == EXPLOREE:
				explorees[nom] = lue
			print("[voile-du-navire] %s, %s : %s %.3f, attendue de %.3f à %.3f (luminance %.3f, %d pixels)" % [camera, etat[2], nom, lue, etat[1] - TOLERANCE, haute + TOLERANCE, x, surfaces[nom].size()])
			if lue < etat[1] - TOLERANCE or lue > haute + TOLERANCE:
				_fautes.append("%s, %s : (b) %s à la part %.3f, attendue de %.3f à %.3f" % [camera, etat[2], nom, lue, etat[1] - TOLERANCE, haute + TOLERANCE])
		var autres := hors.filter(func(pixel: Vector2i) -> bool: return voilee.get_pixelv(pixel) != temoin.get_pixelv(pixel)).size()
		if autres > 0:
			_fautes.append("%s, %s : (e) %d pixels hors du navire, son ombre comprise, autres que le témoin" % [camera, etat[2], autres])
	_navires.voir(null)
	_navires.voir(_vision(VUE))
	_navires.voir(_vision(INCONNUE))
	_navires.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S / 2.0)
	var fondue := await PIXELS.image(self)
	for nom: String in surfaces:
		var lue := PIXELS.part(temoin, fondue, surfaces[nom])
		print("[voile-du-navire] %s, mi-fondu : %s %.3f, exploré %.3f" % [camera, nom, lue, explorees[nom]])
		if absf(lue - explorees[nom]) > TOLERANCE / 2.0:
			_fautes.append("%s, mi-fondu : (d) %s à la part %.3f, exploré %.3f" % [camera, nom, lue, explorees[nom]])
	_navires.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S)
	_navires.voir(null)
	if (await PIXELS.image(self)).get_data() != temoin.get_data():
		_fautes.append("%s : (f) sans vision, l'image n'est pas le témoin" % camera)
	return surfaces.keys()


## La borne haute de la part lue d'un pixel de luminance linéaire `x` voilé à la part `part` : le pilote de
## compatibilité mélange après l'encodage sRGB (`OUTPUT_IS_SRGB`, `art/voile.gdshader`), le voile y multiplie srgb(x)
## par srgb(part), qui rend lin(srgb(x)·srgb(part)) / x de la lumière ; sous Forward+, la part est exacte.
static func _borne_du_pilote(x: float, part: float) -> float:
	var melange := Color(x, x, x).linear_to_srgb().r * Color(part, part, part).linear_to_srgb().r
	return Color(melange, melange, melange).srgb_to_linear().r / x


## La médiane de la luminance linéaire de `image` aux pixels `pixels`.
static func _luminance_mediane(image: Image, pixels: Array[Vector2i]) -> float:
	var luminances := PackedFloat32Array()
	for pixel in pixels:
		luminances.append(PIXELS.luminance(image.get_pixelv(pixel)))
	luminances.sort()
	return luminances[luminances.size() / 2]


## Les appels de dessin de la dernière image rendue.
static func _appels() -> int:
	return RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)


## Les meshes que montre la scène du navire, hors de leurs doubles d'ombre.
func _pieces() -> Array:
	var scene: Node3D = _navires.get("_montes")[ID].scene
	return scene.find_children("*", "MeshInstance3D", true, false).filter(func(piece: MeshInstance3D) -> bool: return piece.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY)


## L'image du monde sans le navire, son ombre gardée : chaque mesh qui la projette en ombre seule.
func _sans_le_navire() -> Image:
	var avant := {}
	for piece: MeshInstance3D in _pieces():
		avant[piece] = piece.cast_shadow
		piece.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
	var image := await PIXELS.image(self)
	for piece: MeshInstance3D in avant:
		piece.cast_shadow = avant[piece]
	return image


## L'image du monde sans le navire ni son ombre.
func _navire_cache() -> Image:
	var scene: Node3D = _navires.get("_montes")[ID].scene
	scene.visible = false
	var image := await PIXELS.image(self)
	scene.visible = true
	return image


## Les pixels où `temoin` est l'image `sans` le navire : hors du navire (un pixel de son bord peut y tomber, d'une
## couleur égale à celle du fond : `_par_camera` n'en lit que l'intérieur).
static func _hors_du_navire(temoin: Image, sans: Image) -> Array[Vector2i]:
	var pixels: Array[Vector2i] = []
	for y in range(0, temoin.get_height(), 2):
		for x in range(0, temoin.get_width(), 2):
			if temoin.get_pixel(x, y) == sans.get_pixel(x, y):
				pixels.append(Vector2i(x, y))
	return pixels


## Les pixels de l'ombre du navire : où son ombre seule change l'image du monde sans lui.
static func _ombre(avec_l_ombre: Image, sans: Image) -> Array[Vector2i]:
	return PIXELS.masque(avec_l_ombre, sans)


## Les pixels intérieurs de chaque surface lue, au moins `INTERIEUR_LISIBLE` : la coque et le pont (le bois de la coque,
## peint de la palette, selon que sa face regarde le ciel), la toile du grand mât (peinte de la palette) et le bois de la
## pièce montée ; chacun marqué d'une matière sans éclairage, puis séparé par sa normale.
func _surfaces(temoin: Image) -> Dictionary:
	var marque := StandardMaterial3D.new()
	marque.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	marque.albedo_color = Color(1.0, 0.0, 1.0)
	var vers_le_ciel := ShaderMaterial.new()
	vers_le_ciel.shader = Shader.new()
	vers_le_ciel.shader.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled;\nvoid fragment() { ALBEDO = vec3(step(0.7, abs((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).y))); }\n"
	var lues := {"coque" = ["coque", 0], "toile peinte" = ["grand_mat", 1], "pièce montée" = ["hune", 0]}
	var surfaces := {}
	for nom: String in lues:
		var piece: MeshInstance3D = _pieces().filter(func(p: MeshInstance3D) -> bool: return p.name == lues[nom][0])[0]
		var rang: int = lues[nom][1]
		var avant := piece.get_surface_override_material(rang)
		piece.set_surface_override_material(rang, marque)
		var marquee := PIXELS.masque(temoin, await PIXELS.image(self))
		piece.set_surface_override_material(rang, vers_le_ciel)
		var normales := await PIXELS.image(self)
		piece.set_surface_override_material(rang, avant)
		if nom == "coque":
			surfaces["pont"] = PIXELS.interieur(marquee.filter(func(pixel: Vector2i) -> bool: return normales.get_pixelv(pixel).r > 0.5))
			marquee = marquee.filter(func(pixel: Vector2i) -> bool: return normales.get_pixelv(pixel).r <= 0.5)
		surfaces[nom] = PIXELS.interieur(marquee)
	for nom: String in surfaces.keys():
		if surfaces[nom].size() < INTERIEUR_LISIBLE:
			surfaces.erase(nom)
	return surfaces


## (c) Coupée sous le pont supérieur : ce que la coupe découvre hors du navire (les pixels que la coupe change, où le
## navire coupé rend l'image sans lui), voilé, est ce qu'il est à la part 1.
func _coupe() -> void:
	_navires.voir(null)
	var entier := await PIXELS.image(self)
	var sans := await _sans_le_navire()
	_poser_le_navire({ID: PONT_SUPERIEUR})
	var coupe := await PIXELS.image(self)
	var decouverts: Array[Vector2i] = []
	for y in range(0, coupe.get_height(), 2):
		for x in range(0, coupe.get_width(), 2):
			if coupe.get_pixel(x, y) != entier.get_pixel(x, y) and coupe.get_pixel(x, y) == sans.get_pixel(x, y):
				decouverts.append(Vector2i(x, y))
	print("[voile-du-navire] coupé sous le pont supérieur : %d pixels découverts hors du navire" % decouverts.size())
	if decouverts.size() < DECOUVERTS_LISIBLES:
		_fautes.append("coupe : %d pixels découverts hors du navire, au moins %d attendus" % [decouverts.size(), DECOUVERTS_LISIBLES])
	for etat in [EXPLOREE, INCONNUE]:
		_navires.voir(null)
		_navires.voir(_vision(etat))
		var voilee := await PIXELS.image(self)
		var autres := decouverts.filter(func(pixel: Vector2i) -> bool: return voilee.get_pixelv(pixel) != coupe.get_pixelv(pixel)).size()
		print("[voile-du-navire] coupé, état %d : %d pixels découverts autres qu'à la part 1" % [etat, autres])
		if autres > 0:
			_fautes.append("coupe, état %d : (c) %d pixels découverts hors du navire voilés" % [etat, autres])
	_navires.voir(null)
	_poser_le_navire({})
