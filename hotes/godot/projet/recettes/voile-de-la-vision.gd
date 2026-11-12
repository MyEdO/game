extends SceneTree

## Le voile de la vision du groupe (#3950) : sur le monde (`Monde`) d'un volume de deux couches, chacune son sol, la
## première aussi une colonne au plan `pose`, sous l'éclairage du jeu (`scenes/Lumiere.tscn`, soleil compris), la vision
## posée (`VolumeDeScene.voir`) multiplie la luminance de chaque dalle par la teinte de l'état de sa case, lue au rendu
## contre la même dalle sans vision : vue, explorée, inconnue, en
## dégradé continu entre deux cases d'états différents, sans bavure d'une couche sur l'autre au bord de leurs plans,
## sous chacun des trois regards ; une vision neuve se fond depuis la précédente (à mi-fondu, entre les deux), une
## vision reçue pendant un fondu attend sa fin ; sans vision (`voir(null)`), chaque pixel est celui du témoin.
##
## La part se lit en lumière linéaire, l'environnement de la recette en tonemap linéaire : la teinte du noyau est une
## part de lumière linéaire, que la courbe filmique, transformation d'affichage, abaisserait encore sur les pixels sombres.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const RECETTE_RENDUE := true
const LARGEUR := 8
const HAUTEUR := 6
const METRES_PAR_CASE := 2.0
## Les teintes de `src/data/ambiance.json` (`fogTint`).
const TEINTES := {visible = 1.0, explored = 0.42, unknown = 0.15}
const VUE := 255
const EXPLOREE := 128
const INCONNUE := 0
## L'état de chaque colonne de chaque couche : la couche 0 vue, explorée, inconnue, explorée (plan `pose`), puis vue
## sous la couche 1 ; la couche 1 inconnue sous la couche 0, puis vue, explorée, inconnue, inconnue.
const COLONNES := [[VUE, EXPLOREE, INCONNUE, EXPLOREE, VUE, VUE, VUE, VUE], [INCONNUE, INCONNUE, INCONNUE, INCONNUE, VUE, EXPLOREE, INCONNUE, INCONNUE]]
## L'écart toléré entre la part de lumière lue et l'attendue, sous l'éclairage du jeu (`scenes/Lumiere.tscn`).
const TOLERANCE := 0.04
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[voile-de-la-vision] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	(monde.get_node("Lumiere/Environnement") as WorldEnvironment).environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var morceaux := [
		_dalles("sol/0/0/0", 0, 3, 0, 0, 0.0),
		_dalles("pose/0/0/0", 3, 4, 0, HAUTEUR, 0.04),
		_dalles("sol/1/0/0", 4, LARGEUR, 1, 2 * HAUTEUR, 0.0),
	]
	var plat := []
	for y in HAUTEUR:
		var rangee := []
		rangee.resize(LARGEUR)
		rangee.fill(0.0)
		plat.append(rangee)
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [{z = 0, rangees = plat}, {z = 1, rangees = plat}], morceaux = morceaux},
		toits = [], couronnes = []}, {volume = morceaux, toits = [], couronnes = []})
	var volume := monde.volume
	volume.set_process(false)
	var premiere := _vision(COLONNES)
	var fondue := COLONNES.duplicate(true)
	fondue[0][2] = VUE
	var exploree := 128.0 / 255.0
	var lieux := {
		vue = [Vector2(0.0, 2.0), 1.0],
		exploree = [Vector2(1.0, 2.0), TEINTES.explored],
		inconnue = [Vector2(2.0, 2.0), TEINTES.unknown],
		"exploree au plan pose" = [Vector2(3.0, 2.0), TEINTES.explored],
		"vue a la couche 1" = [Vector2(4.0, 2.0), 1.0],
		"exploree a la couche 1" = [Vector2(5.0, 2.0), TEINTES.explored],
		"quart vers l'exploree" = [Vector2(0.25, 2.0), _lumiere(lerpf(1.0, exploree, 0.25))],
		"frontiere vue | exploree" = [Vector2(0.5, 2.0), _lumiere(lerpf(1.0, exploree, 0.5))],
		"trois quarts vers l'exploree" = [Vector2(0.75, 2.0), _lumiere(lerpf(1.0, exploree, 0.75))],
		"bord sud de la couche 0, vue" = [Vector2(0.0, HAUTEUR - 0.55), 1.0],
		"bord nord de la couche 1, inconnue" = [Vector2(6.0, -0.45), TEINTES.unknown],
	}
	for regard in ["plateau", "tactique", "immersion"]:
		_regarder(monde, regard)
		volume.voir(null)
		var temoin := await _image()
		volume.voir(premiere)
		if volume.etat_de_la_case(Vector2i(1, 2), 0) != EXPLOREE or volume.etat_de_la_case(Vector2i(4, 2), 1) != VUE:
			_fautes.append("%s : l'état lu dans l'image posée n'est pas celui de la vision" % regard)
		var voilee := await _image()
		for nom: String in lieux:
			_mesurer(monde, regard, nom, temoin, voilee, lieux[nom][0], lieux[nom][1])
		if regard == "plateau":
			volume.voir(_vision(fondue))
			if volume.part_du_fondu() != 0.0:
				_fautes.append("fondu : une vision neuve de la même taille se pose à la part %f, attendu 0" % volume.part_du_fondu())
			_mesurer(monde, regard, "fondu au départ", temoin, await _image(), Vector2(2.0, 2.0), TEINTES.unknown)
			volume.avancer_le_fondu(volume.DUREE_DU_FONDU_S / 2.0)
			_mesurer(monde, regard, "mi-fondu", temoin, await _image(), Vector2(2.0, 2.0), _lumiere(0.5))
			volume.voir(premiere)
			if volume.vision_en_attente() == null or volume.etat_de_la_case(Vector2i(2, 2), 0) != VUE:
				_fautes.append("fondu : la vision reçue pendant le fondu n'attend pas sa fin")
			volume.avancer_le_fondu(volume.DUREE_DU_FONDU_S / 2.0)
			if volume.vision_en_attente() != null or volume.part_du_fondu() != 0.0 or volume.etat_de_la_case(Vector2i(2, 2), 0) != INCONNUE:
				_fautes.append("fondu : la vision qui attendait ne se pose pas à la fin du fondu")
			volume.avancer_le_fondu(volume.DUREE_DU_FONDU_S)
			_mesurer(monde, regard, "fondu fini", temoin, await _image(), Vector2(2.0, 2.0), TEINTES.unknown)
		volume.voir(null)
		var levee := await _image()
		if levee.get_data() != temoin.get_data():
			_fautes.append("%s : sans vision, l'image n'est pas celle du témoin" % regard)
	for faute in _fautes:
		push_error("[voile-de-la-vision] " + faute)
	print("[voile-de-la-vision] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## La caméra du regard `regard` posée sur le monde `monde`, le volume entier à l'écran.
func _regarder(monde: Monde, regard: String) -> void:
	monde.regarder(regard)
	if regard == "immersion":
		monde.poser_l_oeil(Vector3(LARGEUR / 2.0, 7.0, HAUTEUR + 4.0), 0.0, -1.0)
	else:
		monde.cadrer(Vector3(LARGEUR / 2.0, 0.0, HAUTEUR / 2.0), 0.0, 14.0)


## La part de lumière d'un état `etat` de 0 à 1, linéaire par morceaux entre les trois `TEINTES`.
func _lumiere(etat: float) -> float:
	var exploree := 128.0 / 255.0
	if etat < exploree:
		return lerpf(TEINTES.unknown, TEINTES.explored, etat / exploree)
	return lerpf(TEINTES.explored, TEINTES.visible, (etat - exploree) / (1.0 - exploree))


## La part de lumière lue au lieu `lieu` (en cases continues, une case centrée sur l'entier) de l'image `voilee` contre
## celle du témoin `temoin`, confrontée à `attendue`.
func _mesurer(monde: Monde, regard: String, nom: String, temoin: Image, voilee: Image, lieu: Vector2, attendue: float) -> void:
	var point: Variant = monde.a_l_ecran(Vector3(lieu.x + 0.5, 0.0, lieu.y + 0.5))
	var pixel := Vector2i(Vector2(point) * Vector2(voilee.get_size()) / root.get_visible_rect().size) if point != null else Vector2i(-1, -1)
	if point == null or not Rect2i(Vector2i.ZERO, voilee.get_size()).has_point(pixel):
		_fautes.append("%s, %s : le lieu %s n'est pas à l'écran" % [regard, nom, lieu])
		return
	var avant := _luminance(temoin.get_pixelv(pixel))
	var apres := _luminance(voilee.get_pixelv(pixel))
	var part := apres / avant
	print("[voile-de-la-vision] %s, %s : luminance %.4f sur %.4f du témoin, part %.3f, attendue %.3f" % [regard, nom, apres, avant, part, attendue])
	if temoin.get_pixelv(pixel).r8 > 250 or absf(part - attendue) > TOLERANCE:
		_fautes.append("%s, %s : part de lumière %.3f, attendue %.3f" % [regard, nom, part, attendue])


## La luminance linéaire de la couleur `couleur` d'un pixel sRGB.
func _luminance(couleur: Color) -> float:
	var lineaire := couleur.srgb_to_linear()
	return 0.2126 * lineaire.r + 0.7152 * lineaire.g + 0.0722 * lineaire.b


## La vision (`VisionDuMonde`) des états `colonnes` : par couche, l'état de chaque colonne sur toutes ses rangées.
func _vision(colonnes: Array) -> Dictionary:
	var octets := PackedByteArray()
	for couche: Array in colonnes:
		for y in HAUTEUR:
			for etat: int in couche:
				octets.append(etat)
	return {masque = Marshalls.raw_to_base64(octets), largeur = LARGEUR, rangees = HAUTEUR * colonnes.size(), rangeesParPlan = HAUTEUR, teintes = TEINTES}


## Le morceau `cle` (`MorceauDuMonde`) du plan de première rangée `rangee` : les dalles grises des colonnes `x0` à `x1`
## (exclue) sur toutes les rangées de la couche d'indice `couche`, à `hauteur` mètres, dans le repère des builders.
func _dalles(cle: String, x0: int, x1: int, couche: int, rangee: int, hauteur: float) -> Dictionary:
	var positions := []
	var normales := []
	var couleurs := []
	var cases := []
	for y in HAUTEUR:
		for x in range(x0, x1):
			for coin: Array in [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [0.5, -0.5]]:
				positions.append_array([(x + coin[0]) * METRES_PAR_CASE, hauteur, (y + coin[1]) * METRES_PAR_CASE])
				normales.append_array([0.0, 1.0, 0.0])
				couleurs.append_array([0.5, 0.5, 0.5, 1.0])
			cases.append_array([x, y, couche, x, y, couche])
	return {cle = cle, empreinte = cle, rangee = rangee, positions = positions, normales = normales, couleurs = couleurs, cases = cases,
		surfaces = [{debut = 0, fin = positions.size() / 3, matiere = "terrain--sol-d-essai"}]}


func _image() -> Image:
	for _image_rendue in 12:
		await process_frame
	await RenderingServer.frame_post_draw
	return root.get_texture().get_image()
