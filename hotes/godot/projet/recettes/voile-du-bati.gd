extends SceneTree

## Le voile de la vision sur le bâti (#3950) : sur le monde (`Monde`) d'un volume de deux couches, le sol de la
## première, sous l'éclairage du jeu (`scenes/Lumiere.tscn`, soleil compris), une nappe de toit à la seconde, colorée par
## ses sommets, une couronne texturée, un mur du kit et la boîte d'une arête sans pièce au kit. Sous chacun des trois
## regards, contre le témoin sans vision (`VolumeDeScene.voir(null)`), lu aux pixels de chacun (ceux que son instance vue
## peint) : la vision toute vue rend chaque pixel du témoin ; toute explorée, chacun à la part de lumière de l'explorée,
## toute inconnue, à celle de l'inconnue, et le mur du kit et la boîte à la part du sol voisin (la part de lumière du
## shader de monde et sa jumelle de `MiseEnPage.teinte_d_instance`, tenues égales) ; la première couche vue et la seconde
## explorée, le toit à la part de l'explorée : il lit le plan de sa couche ; la case d'un mur inconnue et sa voisine
## vue, le mur, cadré de près, rend la vision toute vue (sa teinte d'instance blanche, au moins `INTERIEUR_LISIBLE`
## pixels loin de son bord, ceux de la vision toute vue à `PIXELS_MELES` près) ; à mi-fondu de la vue vers l'inconnue,
## chacun à mi-chemin, l'état de l'explorée, à la part qu'il y prend ; sous l'éclairage d'un extérieur du jeu, dont le
## ciel se reflète, en plongée et au ras du sol, chacun, le sol compris, à la part de son état (`_a_l_ombre`).
##
## La part se lit en lumière linéaire, l'environnement de la recette en tonemap linéaire (`monde_du_bati`) : la teinte du
## noyau est une part de lumière linéaire, que la courbe filmique, transformation d'affichage, abaisserait encore sur les
## pixels sombres. La recette mesure le voile des surfaces : le brouillard volumétrique de Forward+ ajoute une lumière
## diffuse que la vision ne voile pas, la recette le coupe (`_a_l_ombre`).
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const RECETTE_RENDUE := true
const PIXELS := preload("res://recettes/lecture_des_pixels.gd")
const LARGEUR := 8
const HAUTEUR := 6
const METRES_PAR_CASE := 2.0
## Les teintes de `src/data/ambiance.json` (`fogTint`).
const TEINTES := {visible = 1.0, explored = 0.42, unknown = 0.15}
const VUE := 255
const EXPLOREE := 128
const INCONNUE := 0
## L'écart toléré entre la part de lumière lue et l'attendue, sous l'éclairage du jeu.
const TOLERANCE := 0.04
## `CREUX_DU_PILOTE` de `hotes/godot/recette.mjs` ; `projet/scripts/monde.gd`, `@contrat Monde`.
const CREUX_DU_PILOTE := 0.1
## Le mur du kit sépare la case (2, 4), la sienne, de sa voisine (2, 3) ; la boîte, (5, 4) de (5, 3).
const MUR := {cle = "kit", famille = "colombage", milieu = {x = 2.0, y = 3.5}, cases = [{x = 2, y = 4, z = 0}, {x = 2, y = 3, z = 0}]}
const BOITE := {cle = "boite", famille = null, milieu = {x = 5.0, y = 3.5}, cases = [{x = 5, y = 4, z = 0}, {x = 5, y = 3, z = 0}]}
## Le moins de pixels (un sur deux de chaque sens) loin du bord d'un mur cadré de près, et la part d'entre eux que le
## rendu peut mêler au sol vu à travers la pièce du kit (un pixel sur 15 500 en tactique).
const INTERIEUR_LISIBLE := 40
const PIXELS_MELES := 0.001
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[voile-du-bati] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	var monde := monde_du_bati(root)
	var volume := monde.volume
	volume.set_process(false)
	var objets := _objets(monde)
	for regard in ["plateau", "tactique", "immersion"]:
		regarder(monde, regard)
		volume.voir(null)
		var temoin := await PIXELS.image(self)
		var masques := {}
		for nom: String in objets:
			for vu: Node3D in objets[nom]:
				vu.visible = false
			var sans := await PIXELS.image(self)
			for vu: Node3D in objets[nom]:
				vu.visible = true
			masques[nom] = PIXELS.masque(temoin, sans)
			if masques[nom].is_empty():
				_fautes.append("%s, %s : aucun pixel à l'écran" % [regard, nom])
		var sol := PIXELS.hors_des(temoin, masques.values())
		var explorees := {}
		volume.voir(_vision(func(_case: Vector2i, _couche: int) -> int: return VUE))
		if (await PIXELS.image(self)).get_data() != temoin.get_data():
			_fautes.append("%s : la vision toute vue n'est pas le témoin" % regard)
		for etat: Array in [[EXPLOREE, TEINTES.explored, "explorée"], [INCONNUE, TEINTES.unknown, "inconnue"]]:
			volume.voir(null)
			volume.voir(_vision(func(_case: Vector2i, _couche: int) -> int: return etat[0]))
			var voilee := await PIXELS.image(self)
			var du_sol := PIXELS.part(temoin, voilee, sol)
			print("[voile-du-bati] %s, %s : sol %.3f" % [regard, etat[2], du_sol])
			for nom: String in objets:
				var part := PIXELS.part(temoin, voilee, masques[nom])
				if etat[0] == EXPLOREE:
					explorees[nom] = part
				print("[voile-du-bati] %s, %s : %s %.3f, attendue %.3f" % [regard, etat[2], nom, part, etat[1]])
				if absf(part - etat[1]) > TOLERANCE:
					_fautes.append("%s, %s : %s à la part %.3f, attendue %.3f" % [regard, etat[2], nom, part, etat[1]])
				if nom in ["mur du kit", "boîte"] and absf(part - du_sol) > TOLERANCE:
					_fautes.append("%s, %s : %s à la part %.3f, le sol voisin %.3f" % [regard, etat[2], nom, part, du_sol])
		volume.voir(null)
		volume.voir(_vision(func(_case: Vector2i, couche: int) -> int: return VUE if couche == 0 else EXPLOREE))
		var par_couche := PIXELS.part(temoin, await PIXELS.image(self), masques.toit)
		print("[voile-du-bati] %s, première couche vue, seconde explorée : toit %.3f, à l'explorée %.3f" % [regard, par_couche, explorees.toit])
		if absf(par_couche - explorees.toit) > TOLERANCE / 2.0:
			_fautes.append("%s : le toit de la seconde couche à la part %.3f, pas à celle de l'explorée de son plan %.3f" % [regard, par_couche, explorees.toit])
		volume.voir(null)
		volume.voir(_vision(func(_case: Vector2i, _couche: int) -> int: return VUE))
		volume.voir(_vision(func(_case: Vector2i, _couche: int) -> int: return INCONNUE))
		volume.avancer_le_fondu(volume.DUREE_DU_FONDU_S / 2.0)
		var fondue := await PIXELS.image(self)
		for nom: String in objets:
			var part := PIXELS.part(temoin, fondue, masques[nom])
			print("[voile-du-bati] %s, mi-fondu : %s %.3f, à l'explorée %.3f" % [regard, nom, part, explorees[nom]])
			if absf(part - explorees[nom]) > TOLERANCE / 2.0:
				_fautes.append("%s, mi-fondu : %s à la part %.3f, à l'explorée %.3f" % [regard, nom, part, explorees[nom]])
		volume.avancer_le_fondu(volume.DUREE_DU_FONDU_S)
		volume.voir(null)
		if (await PIXELS.image(self)).get_data() != temoin.get_data():
			_fautes.append("%s : sans vision, l'image n'est pas celle du témoin" % regard)
		await _entre(monde, regard, objets)
	await _a_l_ombre(monde, objets)
	for faute in _fautes:
		push_error("[voile-du-bati] " + faute)
	print("[voile-du-bati] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le monde de la recette posé sous `racine`, en tonemap linéaire, de deux couches : le sol de toutes les cases de la première, une nappe de
## toit à 3 m sur les cases (1, 1) à (2, 2) de la seconde, colorée par ses sommets, une couronne à 2,5 m sur (5, 1) et
## (6, 1) de la première, texturée, puis le mur du kit et la boîte.
static func monde_du_bati(racine: Node) -> Monde:
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	racine.add_child(monde)
	(monde.get_node("Lumiere/Environnement") as WorldEnvironment).environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var sol := _dalles("sol/0/0/0", Rect2i(0, 0, LARGEUR, HAUTEUR), 0, 0.0, "terrain--sol-d-essai", 0.5).merged({rangee = 0})
	var toits := [_dalles("maison", Rect2i(1, 1, 2, 2), 1, 3.0, "roof--tuile", 0.6)]
	var couronnes := [_dalles("rempart", Rect2i(5, 1, 2, 1), 0, 2.5, "terrain--pierre", 1.0)]
	var plat := []
	for y in HAUTEUR:
		var rangee := []
		rangee.resize(LARGEUR)
		rangee.fill(0.0)
		plat.append(rangee)
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [{z = 0, rangees = plat}, {z = 1, rangees = plat}], morceaux = [sol]}, toits = toits, couronnes = couronnes},
		{volume = [sol], toits = toits, couronnes = couronnes})
	monde.volume.poser_les_aretes([MUR, BOITE].map(func(a: Dictionary) -> Dictionary:
		return a.merged({sens = {x = 1.0, y = 0.0}, pied = 0.0, hauteurM = 4.0, piece = "mur", bloc = "0/0/0"})))
	return monde


## La caméra du regard `regard` posée sur le monde `monde`, le volume entier à l'écran.
static func regarder(monde: Monde, regard: String) -> void:
	monde.regarder(regard)
	if regard == "immersion":
		monde.poser_l_oeil(Vector3(LARGEUR / 2.0, 7.0, HAUTEUR + 4.0), 0.0, -1.0)
	else:
		monde.cadrer(Vector3(LARGEUR / 2.0, 0.0, HAUTEUR / 2.0), 0.0, 14.0)


## Sous le regard `regard`, les deux murs cadrés de près (en immersion, l'œil du regard) : la case de chacun inconnue et
## sa voisine vue, chacun rend le témoin de la vision toute vue, teinte d'instance blanche et pixels loin de son bord, au
## moins `INTERIEUR_LISIBLE`, identiques.
func _entre(monde: Monde, regard: String, objets: Dictionary) -> void:
	var volume := monde.volume
	if regard != "immersion":
		monde.cadrer(Vector3(3.5, 0.0, 3.5), 0.0, Monde.DISTANCE_MIN)
	volume.voir(_vision(func(_c: Vector2i, _couche: int) -> int: return VUE))
	var temoin := await PIXELS.image(self)
	var masques := {}
	for nom in ["mur du kit", "boîte"]:
		for vu: Node3D in objets[nom]:
			vu.visible = false
		var sans := await PIXELS.image(self)
		for vu: Node3D in objets[nom]:
			vu.visible = true
		masques[nom] = PIXELS.interieur(PIXELS.masque(temoin, sans))
	volume.voir(_vision(func(c: Vector2i, _couche: int) -> int: return INCONNUE if c.y == 4 else VUE))
	var entre := await PIXELS.image(self)
	for nom in ["mur du kit", "boîte"]:
		var teintes: Array = objets[nom].map(func(vu: MultiMeshInstance3D) -> Color: return vu.multimesh.get_instance_color(0))
		var autres: int = masques[nom].filter(func(pixel: Vector2i) -> bool: return temoin.get_pixelv(pixel) != entre.get_pixelv(pixel)).size()
		print("[voile-du-bati] %s, la case du mur inconnue, sa voisine vue : %s teint %s, %d pixels intérieurs dont %d autres que le témoin" % [regard, nom, teintes[0], masques[nom].size(), autres])
		if masques[nom].size() < INTERIEUR_LISIBLE or not teintes.all(func(teinte: Color) -> bool: return teinte == Color.WHITE) or autres > masques[nom].size() * PIXELS_MELES:
			_fautes.append("%s : %s entre sa case inconnue et sa voisine vue n'est pas rendu en vue (%d pixels intérieurs)" % [regard, nom, masques[nom].size()])
	volume.voir(null)


## Sous l'éclairage d'un extérieur du jeu (`PIXELS.LUMIERE_DU_JEU`), sous deux caméras : la tactique d'un demi-tour (azimut
## 180), en plongée vers la face du mur du kit et de la boîte que son soleil laisse à l'ombre, et l'œil de l'immersion
## au ras du sol, qui le voit en rasant : toute explorée, toute inconnue, chacun, le sol compris, à la part de lumière
## de son état, contre le témoin sans vision, au plus `TOLERANCE` au-dessus et `CREUX_DU_PILOTE` de plus au-dessous. Le
## brouillard volumétrique, que la vision ne voile pas, coupé.
func _a_l_ombre(monde: Monde, objets: Dictionary) -> void:
	var volume := monde.volume
	(monde.get_node("Lumiere") as Lumiere).eclairer(PIXELS.LUMIERE_DU_JEU, METRES_PAR_CASE)
	(monde.get_node("Lumiere/Environnement") as WorldEnvironment).environment.volumetric_fog_enabled = false
	var lus := objets.merged({sol = [monde.get_node("VolumeDeScene/Volume/Morceaux").get_child(0).get_node("Vu")]})
	for camera in ["en plongée", "au ras du sol"]:
		if camera == "en plongée":
			monde.regarder("tactique")
			monde.cadrer(Vector3(3.5, 0.0, 3.5), MiseEnPage.lacet_de_l_azimut(180.0), 10.0)
		else:
			monde.regarder("immersion")
			monde.poser_l_oeil(Vector3(LARGEUR / 2.0, 3.5, HAUTEUR + 4.0), 0.0, -0.25)
		volume.voir(null)
		var temoin := await PIXELS.image(self)
		var masques := {}
		for nom: String in lus:
			for vu: Node3D in lus[nom]:
				vu.visible = false
			var sans := await PIXELS.image(self)
			for vu: Node3D in lus[nom]:
				vu.visible = true
			masques[nom] = PIXELS.masque(temoin, sans)
		for etat: Array in [[EXPLOREE, TEINTES.explored, "explorée"], [INCONNUE, TEINTES.unknown, "inconnue"]]:
			volume.voir(null)
			volume.voir(_vision(func(_case: Vector2i, _couche: int) -> int: return etat[0]))
			var voilee := await PIXELS.image(self)
			for nom: String in masques:
				if masques[nom].is_empty():
					continue
				var part := PIXELS.part(temoin, voilee, masques[nom])
				print("[voile-du-bati] sous le ciel du jeu, %s, %s : %s %.3f, attendue %.3f" % [camera, etat[2], nom, part, etat[1]])
				if part - etat[1] > TOLERANCE or part - etat[1] < -(TOLERANCE + CREUX_DU_PILOTE):
					_fautes.append("sous le ciel du jeu, %s, %s : %s à la part %.3f, attendue %.3f" % [camera, etat[2], nom, part, etat[1]])
		volume.voir(null)


## Les instances vues de chaque pièce du bâti, par son nom : celle de la nappe de toit et de la couronne, celles de chaque
## maillage du mur du kit et de la boîte.
func _objets(monde: Monde) -> Dictionary:
	var objets := {
		"toit" = [monde.get_node("VolumeDeScene/Volume/Toits").get_child(0).get_node("Vu")],
		"couronne" = [monde.get_node("VolumeDeScene/Volume/Couronnes").get_child(0).get_node("Vu")],
	}
	for groupe: Node3D in monde.get_node("VolumeDeScene/Aretes").get_children():
		objets[{kit = "mur du kit", boite = "boîte"}[groupe.get_meta("aretes")[0].cle]] = groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)
	return objets












## La vision (`VisionDuMonde`) des deux couches, chaque case à l'état que `etat_de` lui donne (sa case et l'indice de sa
## couche).
func _vision(etat_de: Callable) -> Dictionary:
	var octets := PackedByteArray()
	for couche in 2:
		for y in HAUTEUR:
			for x in LARGEUR:
				octets.append(etat_de.call(Vector2i(x, y), couche))
	return {masque = Marshalls.raw_to_base64(octets), largeur = LARGEUR, rangees = 2 * HAUTEUR, rangeesParPlan = HAUTEUR, teintes = TEINTES}


## La géométrie du monde `cle` : les dalles des cases de `cases`, à `hauteur` mètres, de la matière `matiere` et du gris
## `gris`, dans le repère des builders, chaque triangle à sa case de la couche `z`.
static func _dalles(cle: String, cases: Rect2i, z: int, hauteur: float, matiere: String, gris: float) -> Dictionary:
	var positions := []
	var normales := []
	var couleurs := []
	var de_chaque := []
	for y in range(cases.position.y, cases.end.y):
		for x in range(cases.position.x, cases.end.x):
			for coin: Array in [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [0.5, -0.5]]:
				positions.append_array([(x + coin[0]) * METRES_PAR_CASE, hauteur, (y + coin[1]) * METRES_PAR_CASE])
				normales.append_array([0.0, 1.0, 0.0])
				couleurs.append_array([gris, gris, gris, 1.0])
			de_chaque.append_array([x, y, z, x, y, z])
	return {cle = cle, empreinte = cle, positions = positions, normales = normales, couleurs = couleurs, cases = de_chaque,
		surfaces = [{debut = 0, fin = positions.size() / 3, matiere = matiere}]}
