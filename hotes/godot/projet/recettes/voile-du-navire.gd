extends SceneTree

## Le voile de la vision sur un navire (#3950, `VolumeDeScene.voile`, `art/voile.gdshader`), sur le noyau vivant
## (`--pont=<chemin>` après `--`, que `construire.mjs --rendus` passe) : le script commun des recettes rendues d'un
## navire, `voile-de-la-caraque.gd` et `voile-de-la-barge.gd`, qui déclarent `RECETTE_RENDUE` et leur scénario
## (`_scenario`) ; lui ne le déclare pas, `rendre` ne le joue pas seul. La partie tourne sur son pont espion
## (`PontEspion`) et son combat (`scenes/Combat.tscn`). Le monde, le navire, les cases que couvrent ses morceaux, leur
## sol (`monde.hauteurs`) et le masque (la réponse `vision`) viennent du pont. Calques de l'écran et combattants cachés,
## tonemap linéaire (la part se lit en lumière linéaire), brouillard volumétrique coupé, MSAA coupé (une arête ne mêle
## pas deux positions), le fondu avancé par la recette seule, sous la caméra tactique centrée sur le navire servi, dans
## une fenêtre de `FENETRE`. La part d'un pixel est sa luminance voilée sur celle de la même image sans vision. Sous
## Forward+ seulement (la passe des positions, `_positions`, n'est lisible que là) : la position brute de chaque pixel
## du navire, reprojetée par la caméra, retombe sur son pixel (`REPROJECTION_PX`, sur un échantillon d'au moins
## `ECHANTILLON` pixels) ; (a) un pixel pur (toutes les cases que la portée du voile atteint depuis lui, `_regardables`,
## au même état) a la part de la teinte de cet état, pour le masque servi, pour chaque couche de pont, cette couche
## seule inconnue puis seule vue, et pour les cases existantes vues, les autres inconnues ; le navire a, sous un
## masque, `PURS_LISIBLES` pixels purs vus et autant d'inconnus, et autant de purs vus sous ce dernier masque ;
## (b) le flanc dont la part chute de plus de `CHUTE` quand l'eau (toute colonne sans case de pont) passe inconnue,
## d'au moins `EAU_LISIBLE` pixels, a une part médiane d'au moins `EAU_VUE` sous le masque servi, et la teinte inconnue
## sous l'eau retournée si tous ses pixels sont purs. Sous les deux rendus : le masque servi tout vu donne l'image sans
## vision au pixel ; sous chacun des trois regards (tactique, plateau, immersion, `_uniformes`), tout exploré (octets à
## 128), puis tout inconnu (à 0), chaque surface lue (sous la caméra tactique, le plancher, le flanc et la mâture au
## moins) prend la part de son état (`_borne_du_pilote`) ; à mi-fondu de la vue vers l'inconnu, la part qu'elle prend
## explorée ; coupé sous son avant-dernière couche de pont, ce que la coupe découvre est, voilé, ce qu'il est sans
## voile ; sous l'œil de l'immersion, sur une case de pont couverte, elle et ce qui est dessous vus, le reste inconnu, le
## plafond à la part 1. Les appels de dessin, voilé et sans voile, imprimés.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const PIXELS := preload("res://recettes/lecture_des_pixels.gd")
const COMBAT := "res://scenes/Combat.tscn"
## La taille de la fenêtre rendue : chaque image coûte sous le rendu logiciel de la CI.
const FENETRE := Vector2i(640, 360)
## L'attente la plus longue d'un état : le lancement du processus et le démarrage de la partie compris.
const ATTENTE_S := 150.0
const VUE := 255
const EXPLOREE := 128
const INCONNUE := 0
## L'écart toléré entre la part lue d'un pixel pur et la teinte de son état.
const ECART_DU_PUR := 0.03
## L'écart, en pixels, entre un pixel et sa position reprojetée ; le moins de pixels de l'échantillon qui le prouve.
const REPROJECTION_PX := 1.0
const ECHANTILLON := 50
## L'étendue de la carte (x et z) et de la hauteur, et le bas de la hauteur, codées par la passe des positions (unités
## de plateau), et sa précision : un octet de la partie fractionnaire.
const ETENDUE := 32.0
const ETENDUE_DE_HAUTEUR := 16.0
const BAS := 4.0
const PRECISION := 1.0 / 255.0
## Le moins de pixels purs d'un état sous un masque, et du flanc qui regarde l'eau.
const PURS_LISIBLES := 100
const EAU_LISIBLE := 200
## La chute de part qui range un pixel de flanc dans ce qui regarde l'eau, et sa part médiane quand toute l'eau est vue.
const CHUTE := 0.3
const EAU_VUE := 0.96
## L'écart toléré entre la part lue d'une surface et l'attendue, sous l'éclairage du jeu.
const TOLERANCE := 0.04
## Le moins de pixels intérieurs d'une surface mesurée.
const INTERIEUR_LISIBLE := 40
## Le moins de pixels que la coupe découvre.
const DECOUVERTS_LISIBLES := 200
## La distance de la caméra tactique, en cases, par scénario.
const DISTANCE := {"a-bord-de-la-caraque": 30.0, "a-bord-de-la-barge": 16.0}
var _fautes: Array[String] = []
var _signales: Array[String] = []
var _nom := ""
var _monde: Monde
var _navires: MontageDesNavires
var _vue: Dictionary
var _id := ""
## Le masque servi, le sol de chaque couche (`monde.hauteurs`, en mètres), les couches et les cases de pont servies.
var _servi: Dictionary
var _hauteurs: Array
var _couches: Array
var _ponts := {}
## Les sols existants de chaque colonne (`Vector2i`), du plus haut au plus bas : [sol en unités de plateau, couche] ;
## une case existe à la couche 0 partout, au-dessus si un morceau servi la couvre (ponts et `pose/`).
var _existants := {}
## Le meilleur compte de pixels purs vus et inconnus du navire, sur tous les masques.
var _meilleurs := {}
var _sortie := ""


## Le pont du noyau vivant, sur la partie du scénario `scenario` : il garde la dernière réponse de chaque méthode, et
## chaque morceau reçu.
class PontEspion extends PontDuNoyau:
	var scenario := ""
	var reponses := {}
	var morceaux: Array = []

	func appeler(methode: String, entree: Variant = null) -> Dictionary:
		var reponse := super(methode, entree)
		reponses[methode] = reponse
		if methode == "morceaux":
			morceaux.append_array(reponse.get("volume", []))
		return reponse

	func parametre(cle: String) -> String:
		return scenario if cle == "scenario" else super(cle)


## Le scénario de la recette, que chaque recette d'un navire donne.
func _scenario() -> String:
	return ""


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[voile-du-navire] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	root.size = FENETRE
	root.msaa_3d = Viewport.MSAA_DISABLED
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--sortie="):
			_sortie = argument.trim_prefix("--sortie=")
	var debut := Time.get_ticks_msec()
	if await _demarrer(_scenario()) != null:
		_chrono("démarrage", debut)
		_cadrer("tactique")
		await _tactique()
		_chrono("tactique", debut)
		await _coupe()
		_chrono("coupe", debut)
		await _plateau()
		_chrono("plateau", debut)
		await _immersion()
		_chrono("immersion", debut)
		if Lumiere.rendu_complet():
			for etat: int in _meilleurs:
				_verifier(_meilleurs[etat] >= PURS_LISIBLES, "%s : (a) au mieux %d pixels purs à l'état %d, au moins %d attendus" % [_nom, _meilleurs[etat], etat, PURS_LISIBLES])
	_fautes.append_array(_signales)
	for faute in _fautes:
		push_error("[voile-du-navire] " + faute)
	print("[voile-du-navire] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le combat de `scenario` sur son pont espion, une fois son navire posé et sa vision posée ; `null` sinon.
func _demarrer(scenario: String) -> Node:
	_nom = scenario
	_signales.clear()
	var pont := PontEspion.new()
	pont.scenario = scenario
	PontDuNoyau.remplacer(self, pont)
	pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	var combat: Node = (load(COMBAT) as PackedScene).instantiate()
	root.add_child(combat)
	var plateau: Plateau = combat.get_node("Plateau")
	_monde = plateau.get_node("Monde")
	_navires = plateau.get_node("Navires")
	var limite := Time.get_ticks_msec() + int(ATTENTE_S * 1000.0)
	while Time.get_ticks_msec() < limite and _signales.is_empty() and (_navires.poses().is_empty() or _monde.volume.get("_vision") == null):
		await process_frame
	if _navires.poses().is_empty() or _monde.volume.get("_vision") == null:
		_fautes.append("%s : navire ou vision non posés (%s)" % [_nom, _signales])
		combat.queue_free()
		return null
	for couche: CanvasLayer in root.find_children("*", "CanvasLayer", true, false):
		couche.visible = false
	plateau.get_node("Combattants").visible = false
	_monde.volume.set_process(false)
	_monde.volume.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S)
	var environnement := (_monde.get_node("Lumiere/Environnement") as WorldEnvironment).environment
	environnement.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	environnement.volumetric_fog_enabled = false
	_vue = combat.get("_vue")
	_id = _navires.poses()[0]
	_servi = pont.reponses.vision
	_hauteurs = pont.reponses.monde.monde.hauteurs
	_couches = _monde.couches()
	_ponts = {}
	var couvertes := {}
	for morceau: Dictionary in pont.morceaux:
		var cases := PackedFloat32Array(morceau.cases)
		for t in cases.size() / 3:
			couvertes[Vector3i(int(cases[3 * t]), int(cases[3 * t + 1]), int(cases[3 * t + 2]))] = true
		for surface: Dictionary in morceau.surfaces:
			if surface.has("navire"):
				for t in range(int(surface.debut) / 3, int(surface.fin) / 3):
					_ponts[Vector3i(int(cases[3 * t]), int(cases[3 * t + 1]), int(cases[3 * t + 2]))] = true
	_existants = {}
	for y in int(_servi.rangeesParPlan):
		for x in int(_servi.largeur):
			var sols := []
			for couche in _couches.size():
				if couche == 0 or couvertes.has(Vector3i(x, y, _couches[couche])):
					sols.append([MiseEnPage.hauteur_au_plateau(_hauteurs[couche].rangees[y][x], _metres_par_case()), couche])
			sols.sort_custom(func(a: Array, b: Array) -> bool: return a[0] > b[0])
			_existants[Vector2i(x, y)] = sols
	_meilleurs = {VUE: 0, INCONNUE: 0}
	print("[voile-du-navire] %s : navire %s, %d cases de pont servies, couches %s" % [_nom, _id, _ponts.size(), _couches])
	return combat


func _montage() -> MontageDeVehicule:
	return _navires.get("_montes")[_id]


func _metres_par_case() -> float:
	return _vue.plateau.metresParCase


## La caméra du regard `regard` (`tactique` ou `plateau`) centrée sur le navire servi.
func _cadrer(regard: String) -> void:
	var centre: Dictionary = _vue.corps.navires[_id].centre
	_monde.regarder(regard)
	_monde.cadrer(MiseEnPage.point_de_la_carte(centre.x - 0.5, centre.y - 0.5, 0.0), MiseEnPage.lacet_de_l_azimut(30.0), DISTANCE[_nom])


## Le masque servi, chaque octet à `octet`.
func _uniforme(octet: int) -> Dictionary:
	var octets := PackedByteArray()
	octets.resize(Marshalls.base64_to_raw(_servi.masque).size())
	octets.fill(octet)
	return _servi.merged({masque = Marshalls.raw_to_base64(octets)}, true)


## Le masque servi, l'octet de chaque case (`x`, `y`, couche d'indice `couche`) que `etat` rend.
func _masque(etat: Callable) -> Dictionary:
	var octets := Marshalls.base64_to_raw(_servi.masque)
	var largeur := int(_servi.largeur)
	var rangees := int(_servi.rangeesParPlan)
	for i in octets.size():
		octets[i] = etat.call(i % largeur, (i / largeur) % rangees, i / (largeur * rangees))
	return _servi.merged({masque = Marshalls.raw_to_base64(octets)}, true)


## L'image sous la vision `vision`, posée sans fondu.
func _voir(vision: Dictionary) -> Image:
	_monde.volume.voir(null)
	_monde.volume.voir(vision)
	return await PIXELS.image(self)


## La même image sans le voile du navire.
func _sans_voile() -> Image:
	_montage().voiler(null)
	var image := await PIXELS.image(self)
	_montage().voiler(_monde.volume.voile(_id))
	return image


## Les meshes que montre la scène du navire, hors de leurs doubles d'ombre.
func _pieces() -> Array:
	return _montage().scene.find_children("*", "MeshInstance3D", true, false).filter(func(piece: MeshInstance3D) -> bool: return piece.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY)


## L'image de chaque pièce du navire peinte de `matiere`, le reste de la scène tel quel.
func _peinte(matiere: Material) -> Image:
	for piece: MeshInstance3D in _pieces():
		piece.material_override = matiere
	var image := await PIXELS.image(self)
	for piece: MeshInstance3D in _pieces():
		piece.material_override = null
	return image


static func _matiere(code: String) -> ShaderMaterial:
	var matiere := ShaderMaterial.new()
	matiere.shader = Shader.new()
	matiere.shader.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled, fog_disabled;\nvarying vec3 p;\nvec3 octets(vec3 s) { return mix(pow((s + 0.055) / 1.055, vec3(2.4)), s / 12.92, lessThan(s, vec3(0.04045))); }\nvoid vertex() { p = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }\nvoid fragment() { vec3 n = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz); %s }\n" % code
	return matiere


## Les pixels intérieurs de chaque surface lue (au moins `INTERIEUR_LISIBLE`) : la coque, par sa normale, en plancher,
## plafond et flanc ; les autres pièces, en mâture.
func _surfaces() -> Dictionary:
	var noir := StandardMaterial3D.new()
	noir.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	noir.albedo_color = Color.BLACK
	var normale := _matiere("ALBEDO = vec3(step(0.7, n.y), step(0.7, -n.y), 1.0);")
	var images := []
	_montage().voiler(null)
	for marque in [{}, {coque = normale}, {autres = normale}]:
		for piece: MeshInstance3D in _pieces():
			piece.material_override = marque.get("coque" if piece.name == "coque" else "autres", noir)
		images.append(await PIXELS.image(self))
	for piece: MeshInstance3D in _pieces():
		piece.material_override = null
	_montage().voiler(_monde.volume.voile(_id))
	var surfaces := {}
	for nom in ["plancher", "plafond", "flanc", "mâture"]:
		var vide: Array[Vector2i] = []
		surfaces[nom] = vide
	for y in range(0, images[0].get_height(), 2):
		for x in range(0, images[0].get_width(), 2):
			var couleur: Color = images[1].get_pixel(x, y)
			if couleur != images[0].get_pixel(x, y):
				surfaces["plancher" if couleur.r > 0.5 else ("plafond" if couleur.g > 0.5 else "flanc")].append(Vector2i(x, y))
			elif images[2].get_pixel(x, y) != images[0].get_pixel(x, y):
				surfaces["mâture"].append(Vector2i(x, y))
	for nom: String in surfaces.keys():
		surfaces[nom] = PIXELS.interieur(surfaces[nom])
		if surfaces[nom].size() < INTERIEUR_LISIBLE:
			surfaces.erase(nom)
	return surfaces


static func _changes(a: Image, b: Image, pixels: Array) -> int:
	return pixels.filter(func(pixel: Vector2i) -> bool: return a.get_pixelv(pixel) != b.get_pixelv(pixel)).size()


## Sous la caméra tactique : (a) et (b) sous Forward+, puis le tout vu, l'uniforme, le mi-fondu et les appels de dessin.
func _tactique() -> void:
	_monde.volume.voir(null)
	var temoin := await PIXELS.image(self)
	var appels_sans_vision := _appels()
	var voilee := await _voir(_servi)
	var surfaces := await _surfaces()
	for nom in ["plancher", "flanc", "mâture"]:
		if not surfaces.has(nom):
			_fautes.append("%s : le %s n'a pas %d pixels intérieurs" % [_nom, nom, INTERIEUR_LISIBLE])
	if (await _voir(_uniforme(VUE))).get_data() != temoin.get_data():
		_fautes.append("%s : tout vu, l'image n'est pas celle sans vision" % _nom)
	var appels_voilee := _appels()
	await _sans_voile()
	print("[voile-du-navire] %s : appels de dessin %d voilé, %d sans voile, %d sans vision" % [_nom, appels_voilee, _appels(), appels_sans_vision])
	await _uniformes(temoin, surfaces)
	if Lumiere.rendu_complet():
		await _oracles(surfaces.get("flanc", []))


## Sous le regard posé, d'image sans vision `temoin` et de surfaces lues `surfaces` (au moins une) : tout exploré
## (octets à 128), puis tout inconnu (à 0), chaque surface prend la part de son état (`_borne_du_pilote`) ; à mi-fondu
## de la vue vers l'inconnu, la part qu'elle prend explorée.
func _uniformes(temoin: Image, surfaces: Dictionary) -> void:
	var regard := _monde.regard()
	_verifier(not surfaces.is_empty(), "%s, %s : aucune surface n'a %d pixels intérieurs" % [_nom, regard, INTERIEUR_LISIBLE])
	var explorees := {}
	for etat: Array in [[EXPLOREE, _servi.teintes.explored, "exploré"], [INCONNUE, _servi.teintes.unknown, "inconnu"]]:
		var image := await _voir(_uniforme(etat[0]))
		for nom: String in surfaces:
			var lue := PIXELS.part(temoin, image, surfaces[nom])
			var haute := maxf(etat[1], _borne_du_pilote(_luminance_mediane(temoin, surfaces[nom]), etat[1]))
			if etat[0] == EXPLOREE:
				explorees[nom] = lue
			print("[voile-du-navire] %s, %s, tout %s : %s %.3f, attendue de %.3f à %.3f (%d pixels)" % [_nom, regard, etat[2], nom, lue, etat[1] - TOLERANCE, haute + TOLERANCE, surfaces[nom].size()])
			if lue < etat[1] - TOLERANCE or lue > haute + TOLERANCE:
				_fautes.append("%s, %s, tout %s : %s à la part %.3f, attendue de %.3f à %.3f" % [_nom, regard, etat[2], nom, lue, etat[1] - TOLERANCE, haute + TOLERANCE])
	await _voir(_uniforme(VUE))
	_monde.volume.voir(_uniforme(INCONNUE))
	_monde.volume.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S / 2.0)
	var fondue := await PIXELS.image(self)
	for nom: String in surfaces:
		var lue := PIXELS.part(temoin, fondue, surfaces[nom])
		print("[voile-du-navire] %s, %s, mi-fondu : %s %.3f, exploré %.3f" % [_nom, regard, nom, lue, explorees[nom]])
		if absf(lue - explorees[nom]) > TOLERANCE / 2.0:
			_fautes.append("%s, %s, mi-fondu : %s à la part %.3f, exploré %.3f" % [_nom, regard, nom, lue, explorees[nom]])
	_monde.volume.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S)
	_monde.volume.voir(null)


## Sous le regard plateau, cadré comme la caméra tactique : `_uniformes`.
func _plateau() -> void:
	_cadrer("plateau")
	_monde.volume.voir(null)
	var temoin := await PIXELS.image(self)
	await _uniformes(temoin, await _surfaces())
	_cadrer("tactique")


## (a) et (b) sous la caméra tactique : (a) pour le masque servi ; pour chaque couche de pont, cette couche seule
## inconnue, le reste vu, puis cette couche seule vue, le reste inconnu ; puis toute case existante (`_existants`)
## vue, toute autre inconnue, où chaque pixel est pur à la vue et en compte au moins `PURS_LISIBLES` ; (b) sur le
## flanc `flanc`.
func _oracles(flanc: Array) -> void:
	var debut := Time.get_ticks_msec()
	var existe := {}
	for colonne: Vector2i in _existants:
		for sol: Array in _existants[colonne]:
			existe[Vector3i(colonne.x, colonne.y, sol[1])] = true
	var masques := [["servi", _servi, 0], ["existantes vues", _masque(func(x: int, y: int, k: int) -> int: return VUE if existe.has(Vector3i(x, y, k)) else INCONNUE), PURS_LISIBLES]]
	for couche in _couches.size():
		if _ponts.keys().any(func(c: Vector3i) -> bool: return c.z == _couches[couche]):
			masques.append(["couche %d inconnue" % _couches[couche], _masque(func(_x: int, _y: int, k: int) -> int: return INCONNUE if k == couche else VUE), 0])
			masques.append(["couche %d seule vue" % _couches[couche], _masque(func(_x: int, _y: int, k: int) -> int: return VUE if k == couche else INCONNUE), 0])
	_monde.volume.voir(null)
	var temoin := await PIXELS.image(self)
	var positions := await _positions(temoin)
	var regardables := _regardables(positions)
	_chrono("oracles, passes", debut)
	for masque: Array in masques:
		var purs := _pur(masque[0], temoin, await _voir(masque[1]), positions, regardables, masque[1])
		if masque[2] > 0:
			_verifier(purs[VUE] >= masque[2], "%s : (a) %s, %d pixels purs à l'état %d, au moins %d attendus" % [_nom, masque[0], purs[VUE], VUE, masque[2]])
	await _eau_retournee(temoin, regardables, flanc)
	_chrono("oracles", debut)
	_monde.volume.voir(null)


## Les pixels du navire (un sur deux, intérieurs ; noirs quand ses pièces sont peintes en noir, blancs quand elles le
## sont en blanc, sans lumière) dont la position brute de la carte, lue par la passe des positions (le
## voile ôté : x, z et la hauteur, en deux passes de trois octets, l'une sur l'étendue, l'autre la partie
## fractionnaire), retombe, reprojetée par la caméra et portée à la taille de l'image, à `REPROJECTION_PX` de son
## pixel ; la faute comptée pour chaque pixel de l'échantillon (au moins `ECHANTILLON` pixels régulièrement pris) qui
## n'y retombe pas.
func _positions(temoin: Image) -> Dictionary:
	var matieres := [_matiere("ALBEDO = vec3(0.0);"), _matiere("ALBEDO = vec3(1.0);"), _matiere("ALBEDO = octets(vec3(p.x / %.1f, p.z / %.1f, (p.y + %.1f) / %.1f));" % [ETENDUE, ETENDUE, BAS, ETENDUE_DE_HAUTEUR]), _matiere("ALBEDO = octets(fract(vec3(p.x, p.z, p.y + %.1f)));" % BAS)]
	var images := []
	_montage().voiler(null)
	for matiere: ShaderMaterial in matieres:
		images.append(await _peinte(matiere))
	_montage().voiler(_monde.volume.voile(_id))
	var camera := root.get_viewport().get_camera_3d()
	var echelle := Vector2(temoin.get_size()) / root.get_visible_rect().size
	var dedans: Array[Vector2i] = []
	for y in range(0, temoin.get_height(), 2):
		for x in range(0, temoin.get_width(), 2):
			if images[0].get_pixel(x, y) == Color.BLACK and images[1].get_pixel(x, y) == Color.WHITE:
				dedans.append(Vector2i(x, y))
	dedans = PIXELS.interieur(dedans)
	var positions := {}
	var ecarts := {}
	for pixel in dedans:
		var grossiere: Color = images[2].get_pixelv(pixel)
		var fine: Color = images[3].get_pixelv(pixel)
		var p := Vector3(
				roundf(grossiere.r * ETENDUE - fine.r) + fine.r,
				roundf(grossiere.b * ETENDUE_DE_HAUTEUR - fine.b) + fine.b - BAS,
				roundf(grossiere.g * ETENDUE - fine.g) + fine.g)
		ecarts[pixel] = (camera.unproject_position(p) * echelle).distance_to(Vector2(pixel) + Vector2(0.5, 0.5))
		if ecarts[pixel] <= REPROJECTION_PX:
			positions[pixel] = p
	var pas := maxi(1, dedans.size() / (2 * ECHANTILLON))
	var echantillon := range(0, dedans.size(), pas).map(func(i: int) -> Vector2i: return dedans[i])
	var hors := echantillon.filter(func(pixel: Vector2i) -> bool: return ecarts[pixel] > REPROJECTION_PX)
	print("[voile-du-navire] %s : positions, %d pixels intérieurs du navire, %d reprojetés à %.0f px, échantillon %d, hors %d" % [_nom, dedans.size(), positions.size(), REPROJECTION_PX, echantillon.size(), hors.size()])
	_verifier(echantillon.size() >= ECHANTILLON and hors.is_empty(), "%s : la position de %d pixels de l'échantillon (%d) ne retombe pas sur eux, ainsi %s" % [_nom, hors.size(), echantillon.size(), hors.slice(0, 5).map(func(pixel: Vector2i) -> String: return "%s à %.1f px" % [pixel, ecarts[pixel]])])
	return positions


## Les cases (texels de la vision) que la portée du voile (`_pur`) atteint depuis chaque pixel de `positions`, sa
## position à `PRECISION` près : chaque colonne que le point regardé peut prendre, chaque couche que le voile peut y
## choisir pour une hauteur de l'intervalle vertical (le sol existant le plus haut à ou sous son bas, ou le plus bas
## de la colonne s'il n'y en a pas, et tout sol existant dans l'intervalle), et dans le plan de chaque couche, la
## case de la colonne et ses voisines existantes à une case.
func _regardables(positions: Dictionary) -> Dictionary:
	var largeur := int(_servi.largeur)
	var rangees := int(_servi.rangeesParPlan)
	var portee := 1.0 + PRECISION
	var existe := {}
	for colonne: Vector2i in _existants:
		for sol: Array in _existants[colonne]:
			existe[colonne.x + largeur * (colonne.y + rangees * int(sol[1]))] = true
	var resultat := {}
	for pixel: Vector2i in positions:
		var p: Vector3 = positions[pixel]
		var bas := p.y - 0.5 - PRECISION
		var haut := p.y + 0.5 + PRECISION
		var cases := {}
		for cy in range(clampi(floori(p.z - portee), 0, rangees - 1), clampi(floori(p.z + portee), 0, rangees - 1) + 1):
			for cx in range(clampi(floori(p.x - portee), 0, largeur - 1), clampi(floori(p.x + portee), 0, largeur - 1) + 1):
				var sols: Array = _existants[Vector2i(cx, cy)]
				var couches := []
				for sol: Array in sols:
					if sol[0] <= haut:
						couches.append(sol[1])
						if sol[0] <= bas:
							break
				if sols.back()[0] > bas:
					couches.append(sols.back()[1])
				for couche: int in couches:
					cases[cx + largeur * (cy + rangees * couche)] = true
					for vy in range(maxi(cy - 1, 0), mini(cy + 1, rangees - 1) + 1):
						for vx in range(maxi(cx - 1, 0), mini(cx + 1, largeur - 1) + 1):
							if existe.has(vx + largeur * (vy + rangees * couche)):
								cases[vx + largeur * (vy + rangees * couche)] = true
		resultat[pixel] = cases.keys()
	return resultat


## Un pixel du témoin dont la part se lit : assez lumineux, et aucun canal écrêté par la fenêtre (sa lumière vraie
## y est inconnue).
static func _lisible(couleur: Color) -> bool:
	return PIXELS.luminance(couleur) > PIXELS.LUMINANCE_LISIBLE and maxf(couleur.r, maxf(couleur.g, couleur.b)) < 1.0


## L'état commun des cases `cases` sous les octets `octets`, -1 s'ils diffèrent.
static func _etat_pur(cases: Array, octets: PackedByteArray) -> int:
	var etat := int(octets[cases[0]])
	for i: int in cases:
		if octets[i] != etat:
			return -1
	return etat


## (a) Sous la vision `vision` (masque `nom`), d'image `voilee` : chaque pixel pur de `regardables` (toutes ses cases au
## même état) a la part de la teinte de son état, à `ECART_DU_PUR` près ; les comptes imprimés et rendus, les fautes
## détaillées et peintes. La portée du voile depuis un fragment de position P et de normale n (`art/voile.gdshader`) :
## dans son `fragment`, le point regardé est à la hauteur P.y + 0,5·n.y (`point`), dans [P.y − 0,5 ; P.y + 0,5] ; à
## l'horizontale, il est décalé de 0,5 puis 1 fois la projection horizontale de n (`horizontale`), de longueur au plus
## 1, dans [P − 1 ; P + 1] sur chaque axe, et le fragment prend le meilleur des deux états (`max`). Dans
## `etat_regarde`, en chaque point, sa colonne (`colonne`) et, dans cette colonne, la couche au sol existant le plus
## haut à ou sous sa hauteur (`couche`), la plus basse sinon (`basse`) ; dans le plan de cette couche (`plan`), le
## mélange des quatre texels qui entourent le point (`dans_le_plan`, `base`), une case de part et d'autre de sa colonne
## au plus, chacun s'il existe (`sols` fini), la case de la colonne si aucun (`poids` nul). L'enclos de `_regardables`
## est cette portée élargie de la précision de la passe des positions (`PRECISION`).
func _pur(nom: String, temoin: Image, voilee: Image, positions: Dictionary, regardables: Dictionary, vision: Dictionary) -> Dictionary:
	var octets := Marshalls.base64_to_raw(vision.masque)
	var teintes := {VUE: float(_servi.teintes.visible), EXPLOREE: float(_servi.teintes.explored), INCONNUE: float(_servi.teintes.unknown)}
	var purs := {VUE: 0, EXPLOREE: 0, INCONNUE: 0}
	var fautives: Array[Vector2i] = []
	for pixel: Vector2i in regardables:
		var etat := _etat_pur(regardables[pixel], octets)
		if etat < 0 or not _lisible(temoin.get_pixelv(pixel)):
			continue
		var x := PIXELS.luminance(temoin.get_pixelv(pixel))
		purs[etat] += 1
		if absf(PIXELS.luminance(voilee.get_pixelv(pixel)) / x - teintes[etat]) > ECART_DU_PUR:
			fautives.append(pixel)
	for etat: int in _meilleurs:
		_meilleurs[etat] = maxi(_meilleurs[etat], purs[etat])
	print("[voile-du-navire] %s, (a) %s : %d pixels du navire, purs 255=%d 128=%d 0=%d, fautes %d" % [_nom, nom, positions.size(), purs[VUE], purs[EXPLOREE], purs[INCONNUE], fautives.size()])
	if fautives.is_empty():
		return purs
	_fautes.append("%s, (a) %s : %d pixels purs hors de la teinte" % [_nom, nom, fautives.size()])
	for pixel in fautives.slice(0, 5):
		var x := PIXELS.luminance(temoin.get_pixelv(pixel))
		print("[voile-du-navire]   faute %s : position %s, part %.3f, cases %s" % [pixel, positions[pixel], PIXELS.luminance(voilee.get_pixelv(pixel)) / x, regardables[pixel].map(func(i: int) -> String: return "%d:%d" % [i, octets[i]])])
	if not _sortie.is_empty():
		var image := voilee.duplicate() as Image
		for pixel in fautives:
			image.set_pixelv(pixel, Color.MAGENTA)
		image.save_png(_sortie.path_join("%s-%s-fautes.png" % [_nom, nom.replace(" ", "-")]))
	return purs


## (b) Sous la caméra tactique, le flanc `flanc` qui regarde l'eau (sa part chute de plus de `CHUTE` quand toute colonne
## sans case de pont passe inconnue) : au moins `EAU_LISIBLE` pixels, une part médiane d'au moins `EAU_VUE` sous le
## masque servi ; sous l'eau retournée, la teinte inconnue à `ECART_DU_PUR` près si tous ses pixels sont purs.
func _eau_retournee(temoin: Image, regardables: Dictionary, flanc: Array) -> void:
	var colonnes := {}
	for c: Vector3i in _ponts:
		colonnes[Vector2i(c.x, c.y)] = true
	var servis := Marshalls.base64_to_raw(_servi.masque)
	var largeur := int(_servi.largeur)
	var rangees := int(_servi.rangeesParPlan)
	var retournee := _masque(func(x: int, y: int, couche: int) -> int: return servis[x + largeur * (y + rangees * couche)] if colonnes.has(Vector2i(x, y)) else INCONNUE)
	var servie := await _voir(_servi)
	var image := await _voir(retournee)
	var octets := Marshalls.base64_to_raw(retournee.masque)
	var avant := PackedFloat32Array()
	var apres := PackedFloat32Array()
	var tous_purs := true
	for pixel: Vector2i in flanc:
		if not _lisible(temoin.get_pixelv(pixel)):
			continue
		var x := PIXELS.luminance(temoin.get_pixelv(pixel))
		var part := PIXELS.luminance(servie.get_pixelv(pixel)) / x
		var retournee_part := PIXELS.luminance(image.get_pixelv(pixel)) / x
		if part - retournee_part > CHUTE:
			avant.append(part)
			apres.append(retournee_part)
			tous_purs = tous_purs and regardables.has(pixel) and _etat_pur(regardables[pixel], octets) == INCONNUE
	if not _verifier(avant.size() >= EAU_LISIBLE, "%s : (b) %d pixels du flanc regardent l'eau, au moins %d attendus" % [_nom, avant.size(), EAU_LISIBLE]):
		return
	avant.sort()
	apres.sort()
	var n := avant.size()
	print("[voile-du-navire] %s : (b) %d pixels du flanc regardent l'eau ; servi : médiane %.3f, p10 %.3f, p90 %.3f ; retournée : médiane %.3f, p10 %.3f, p90 %.3f ; %s" % [_nom, n, avant[n / 2], avant[n / 10], avant[n * 9 / 10], apres[n / 2], apres[n / 10], apres[n * 9 / 10], "tous purs" if tous_purs else "pas tous purs"])
	_verifier(avant[n / 2] >= EAU_VUE, "%s : (b) le flanc qui regarde l'eau vue à la part médiane %.3f" % [_nom, avant[n / 2]])
	if tous_purs:
		_verifier(absf(apres[n / 2] - float(_servi.teintes.unknown)) <= ECART_DU_PUR, "%s : (b) le flanc qui regarde l'eau retournée à la part médiane %.3f" % [_nom, apres[n / 2]])


## Le temps écoulé depuis `debut`, imprimé à l'étape `etape`.
func _chrono(etape: String, debut: int) -> void:
	print("[voile-du-navire] %s : %s à %.1f s" % [_nom, etape, (Time.get_ticks_msec() - debut) / 1000.0])


## Coupé sous le sol le plus bas de son avant-dernière couche de pont : ce que la coupe découvre (les pixels que la coupe
## change, où le navire coupé rend l'image sans lui) est, voilé, ce qu'il est sans voile.
func _coupe() -> void:
	var couche: int = _couches[_couches.size() - 2]
	var coupe := INF
	for c: Vector3i in _ponts:
		if c.z == couche:
			coupe = minf(coupe, _hauteurs[_couches.size() - 2].rangees[c.y][c.x])
	_monde.volume.voir(null)
	var entier := await PIXELS.image(self)
	_navires.poser(_vue.corps.navires, {_id: coupe}, _metres_par_case())
	var coupee := await PIXELS.image(self)
	_montage().scene.visible = false
	var sans := await PIXELS.image(self)
	_montage().scene.visible = true
	var decouverts: Array[Vector2i] = []
	for y in range(0, coupee.get_height(), 2):
		for x in range(0, coupee.get_width(), 2):
			if coupee.get_pixel(x, y) != entier.get_pixel(x, y) and coupee.get_pixel(x, y) == sans.get_pixel(x, y):
				decouverts.append(Vector2i(x, y))
	print("[voile-du-navire] %s, coupé sous %.2f m : %d pixels découverts" % [_nom, coupe, decouverts.size()])
	if decouverts.size() < DECOUVERTS_LISIBLES:
		_fautes.append("%s : coupé, %d pixels découverts, au moins %d attendus" % [_nom, decouverts.size(), DECOUVERTS_LISIBLES])
	for etat in [EXPLOREE, INCONNUE]:
		var autres := _changes(await _voir(_uniforme(etat)), await _sans_voile(), decouverts)
		if autres > 0:
			_fautes.append("%s, coupé, état %d : %d pixels découverts voilés" % [_nom, etat, autres])
	_monde.volume.voir(null)
	_navires.poser(_vue.corps.navires, _vue.plateau.coupesDesNavires, _metres_par_case())
	await process_frame


## Sous l'œil de l'immersion, à 1,2 m du sol de la première case de pont de la deuxième couche couverte dans sa colonne :
## `_uniformes`, puis, elle et ce qui est dessous vus, le reste inconnu, le plafond à la part 1.
func _immersion() -> void:
	var cases := _ponts.keys().filter(func(c: Vector3i) -> bool: return c.z == _couches[1] and _couches.slice(2).any(func(z: int) -> bool: return _ponts.has(Vector3i(c.x, c.y, z))))
	cases.sort()
	if not _verifier(not cases.is_empty(), "%s, immersion : aucune case de pont couverte à la deuxième couche" % _nom):
		return
	var oeil: Vector3i = cases[cases.size() / 2]
	var sol: float = _hauteurs[1].rangees[oeil.y][oeil.x]
	_monde.regarder("immersion")
	_monde.poser_l_oeil(MiseEnPage.point_de_la_carte(oeil.x, oeil.y, MiseEnPage.hauteur_au_plateau(sol + 1.2, _metres_par_case())), PI / 2.0, 0.0)
	_monde.volume.voir(null)
	var temoin := await PIXELS.image(self)
	var surfaces := await _surfaces()
	await _uniformes(temoin, surfaces)
	var voilee := await _voir(_masque(func(_x: int, _y: int, couche: int) -> int: return VUE if couche <= 1 else INCONNUE))
	for nom in ["plafond", "plancher"]:
		if surfaces.has(nom):
			print("[voile-du-navire] %s, immersion en %s : %s %.3f (%d pixels)" % [_nom, oeil, nom, PIXELS.part(temoin, voilee, surfaces[nom]), surfaces[nom].size()])
	if _verifier(surfaces.has("plafond"), "%s, immersion : le plafond n'a pas %d pixels intérieurs" % [_nom, INTERIEUR_LISIBLE]):
		var lue := PIXELS.part(temoin, voilee, surfaces.plafond)
		_verifier(lue >= 1.0 - TOLERANCE, "%s, immersion : plafond à la part %.3f" % [_nom, lue])
	_monde.volume.voir(null)
	_cadrer("tactique")


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


## `vrai`, sinon la faute `faute` comptée.
func _verifier(vrai: bool, faute: String) -> bool:
	if not vrai:
		_fautes.append(faute)
	return vrai
