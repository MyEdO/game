extends SceneTree

## Le voile de la vision sur les décors servis par leur modèle (#4335, `VolumeDeScene.voile`, `art/voile.gdshader`), sur
## le noyau vivant (`--pont=<chemin>` après `--`, que `construire.mjs --rendus` passe) : la forêt du scénario `SCENARIO`,
## sur son pont espion (`PontDuDecor`) et son combat (`scenes/Combat.tscn`), une fois chaque pose de ses décors servis
## posée (`MontageDesModeles.poses`) et sa vision posée. Calques de l'écran et combattants cachés, tonemap linéaire (la
## part se lit en lumière linéaire), brouillard volumétrique coupé, MSAA coupé, le fondu avancé par la recette seule, sous
## la caméra tactique centrée sur le décor servi le plus proche du centre de la carte dont le modèle montre
## `INTERIEUR_LISIBLE` pixels intérieurs (le visé), dans une fenêtre de
## `FENETRE`. Les décors servis puis non servis (`modeles`, `monde` et `morceaux`, leurs primitives repeintes par le
## volume), sous la vision servie : l'image d'après, celle d'avant, écrites sous `--sortie=<dossier>` s'il est donné.
## La part d'un pixel est sa luminance voilée sur celle de la même image sans vision, lue aux pixels intérieurs des
## modèles (que leurs meshes peints en noir changent, `PIXELS.masque`) : tout vu, l'image sans vision au pixel ; tout
## exploré, puis tout inconnu, chaque modèle à la part de son état (`PIXELS.borne_du_pilote` sous le pilote de
## compatibilité) ; les cases à `BLOC` cases au plus de celle du visé inconnues, les autres vues, le visé à la part de
## l'inconnu et les décors à `LOIN` cases au moins de lui à la part du vu : chaque décor se voile à ses cases, jamais
## d'un état par modèle.
##
## Rendu réel, sous chacun des deux rendus : `node hotes/godot/construire.mjs --rendus`.

const RECETTE_RENDUE := true
const PIXELS := preload("res://recettes/lecture_des_pixels.gd")
const COMBAT := "res://scenes/Combat.tscn"
## La forêt : la route forestière de l'embuscade, qu'une centaine d'arbres borde.
const SCENARIO := "embuscade"
const FENETRE := Vector2i(800, 450)
## L'attente la plus longue d'un état : le lancement du processus et le démarrage de la partie compris.
const ATTENTE_S := 150.0
const VUE := 255
const EXPLOREE := 128
const INCONNUE := 0
## L'écart toléré entre la part lue d'un modèle et l'attendue, sous l'éclairage du jeu.
const TOLERANCE := 0.04
## La distance de la caméra tactique, en cases.
const DISTANCE := 14.0
## Les cases (distance de Tchebychev à la case du visé) inconnues sous le masque des cases, et la distance au moins des
## décors lus vus : le voile d'un fragment regarde au plus deux cases autour de lui.
const BLOC := 2
const LOIN := 5
## Le moins de pixels intérieurs d'un modèle lu.
const INTERIEUR_LISIBLE := 40
var _fautes: Array[String] = []
var _signales: Array[String] = []
var _monde: Monde
var _modeles: MontageDesModeles
var _vue: Dictionary
var _servi: Dictionary
var _sortie := ""


## Le pont espion sur la partie de `SCENARIO`.
class PontDuDecor extends PontEspion:
	var entree_des_modeles := {}

	func appeler(methode: String, entree: Variant = null) -> Dictionary:
		if methode == "modeles":
			entree_des_modeles = entree
		return super(methode, entree)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[voile-du-decor] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	root.size = FENETRE
	root.msaa_3d = Viewport.MSAA_DISABLED
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--sortie="):
			_sortie = argument.trim_prefix("--sortie=")
	var pont := PontDuDecor.new()
	pont.scenario = SCENARIO
	if await _demarrer(pont):
		await _voiler(pont)
	_fautes.append_array(_signales)
	for faute in _fautes:
		push_error("[voile-du-decor] " + faute)
	print("[voile-du-decor] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le nombre de poses des décors que la vue sert.
func _poses_servies() -> int:
	return _vue.get("corps", {}).get("decors", {}).values().reduce(func(somme: int, servi: Dictionary) -> int: return somme + servi.poses.size(), 0)


## Le combat de `SCENARIO` sur `pont`, une fois chaque pose de ses décors servis et sa vision posées ; rend s'il l'est.
func _demarrer(pont: PontDuDecor) -> bool:
	PontDuNoyau.remplacer(self, pont)
	pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	var combat: Node = (load(COMBAT) as PackedScene).instantiate()
	root.add_child(combat)
	var plateau: Plateau = combat.get_node("Plateau")
	_monde = plateau.get_node("Monde")
	_modeles = plateau.get_node("Modeles")
	var limite := Time.get_ticks_msec() + int(ATTENTE_S * 1000.0)
	var pret := func() -> bool:
		_vue = combat.get("_vue")
		return _poses_servies() > 0 and _modeles.poses().size() == _poses_servies() and _monde.volume.get("_vision") != null
	while Time.get_ticks_msec() < limite and _signales.is_empty() and not pret.call():
		await process_frame
	if not pret.call():
		_fautes.append("%s : décors servis (%d poses, %d posées) ou vision non posés (%s)" % [SCENARIO, _poses_servies(), _modeles.poses().size(), _signales])
		return false
	for couche: CanvasLayer in root.find_children("*", "CanvasLayer", true, false):
		couche.visible = false
	plateau.get_node("Combattants").visible = false
	_monde.volume.set_process(false)
	_monde.volume.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S)
	var environnement := (_monde.get_node("Lumiere/Environnement") as WorldEnvironment).environment
	environnement.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	environnement.volumetric_fog_enabled = false
	_servi = pont.reponses.vision
	print("[voile-du-decor] %s : %d poses de décor servies (%s), toutes posées" % [SCENARIO, _poses_servies(), ", ".join(PackedStringArray(_vue.corps.decors.keys()))])
	return true


## Par clé de pose (`MontageDesModeles._poses_servies`), chaque pose servie d'un décor (celles qui portent une `case`).
func _poses() -> Dictionary:
	var servis: Dictionary = _modeles.get("_servis")
	var poses := {}
	for cle: String in servis:
		if servis[cle].has("case"):
			poses[cle] = servis[cle]
	return poses


## La clé de la pose la plus proche du centre de la carte dont le modèle, sous la caméra cadrée sur elle, montre
## `INTERIEUR_LISIBLE` pixels intérieurs, la caméra laissée sur elle ; la plus proche si aucune ne les montre.
func _visee() -> String:
	var centre := Vector2(_monde.taille()) / 2.0
	var poses := _poses()
	var cles := poses.keys()
	cles.sort_custom(func(a: String, b: String) -> bool: return Vector2(poses[a].x, poses[a].y).distance_to(centre) < Vector2(poses[b].x, poses[b].y).distance_to(centre))
	_monde.regarder("tactique")
	for cle: String in cles + [cles[0]]:
		var pose: Dictionary = poses[cle]
		_monde.cadrer(MiseEnPage.point_de_la_carte(pose.x, pose.y, MiseEnPage.hauteur_au_plateau(pose.piedM, _vue.plateau.metresParCase)), MiseEnPage.lacet_de_l_azimut(30.0), DISTANCE)
		if (await _pixels_des([cle], await _voir(null))).size() >= INTERIEUR_LISIBLE:
			return cle
	return cles[0]


## La distance de Tchebychev entre les cases des poses `a` et `b`.
func _ecart(a: String, b: String) -> int:
	var ca: Dictionary = _poses()[a].case
	var cb: Dictionary = _poses()[b].case
	return maxi(absi(int(ca.x) - int(cb.x)), absi(int(ca.y) - int(cb.y)))


## L'image de la vision `vision`, posée sans fondu.
func _voir(vision: Variant) -> Image:
	_monde.volume.voir(null)
	_monde.volume.voir(vision)
	return await PIXELS.image(self)


## Les pixels intérieurs des modèles des poses `cles` : ceux que leurs meshes peints en noir changent, sans vision.
func _pixels_des(cles: Array, temoin: Image) -> Array[Vector2i]:
	var noir := StandardMaterial3D.new()
	noir.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	noir.albedo_color = Color.BLACK
	var pieces := []
	for cle: String in cles:
		pieces.append_array((_modeles.get("_montes")[cle] as MontageDeVehicule).scene.find_children("*", "MeshInstance3D", true, false))
	for piece: MeshInstance3D in pieces:
		piece.material_override = noir
	var peinte := await _voir(null)
	for piece: MeshInstance3D in pieces:
		piece.material_override = null
	return PIXELS.interieur(PIXELS.masque(temoin, peinte))


## Les images d'après et d'avant, les décors servis puis non servis, sous la vision servie, puis le voile des modèles
## sous les visions uniformes et sous le masque des cases.
func _voiler(pont: PontDuDecor) -> void:
	var visee: String = await _visee()
	var pose: Dictionary = _poses()[visee]
	if not await _avant_apres(pont):
		return
	var temoin := await _voir(null)
	var tous := await _pixels_des(_poses().keys(), temoin)
	var vise := await _pixels_des([visee], temoin)
	var loin := await _pixels_des(_poses().keys().filter(func(cle: String) -> bool: return _ecart(cle, visee) >= LOIN), temoin)
	print("[voile-du-decor] visé %s en %s : %d pixels des modèles, %d du visé, %d des décors loin de lui" % [visee, pose.case, tous.size(), vise.size(), loin.size()])
	for lus: Array in [["les modèles", tous], ["le visé", vise], ["les décors loin", loin]]:
		_verifier(lus[1].size() >= INTERIEUR_LISIBLE, "%s : %d pixels intérieurs, au moins %d attendus" % [lus[0], lus[1].size(), INTERIEUR_LISIBLE])
	_verifier((await _voir(PIXELS.uniforme(_servi, VUE))).get_data() == temoin.get_data(), "tout vu, l'image n'est pas celle sans vision")
	for etat: Array in [[EXPLOREE, _servi.teintes.explored, "exploré"], [INCONNUE, _servi.teintes.unknown, "inconnu"]]:
		_lire("tout %s" % etat[2], "les modèles", temoin, await _voir(PIXELS.uniforme(_servi, etat[0])), tous, etat[1])
	var c: Dictionary = pose.case
	var cases := await _voir(PIXELS.masque_de_vision(_servi, func(x: int, y: int, _couche: int) -> int: return INCONNUE if maxi(absi(x - int(c.x)), absi(y - int(c.y))) <= BLOC else VUE))
	_lire("cases du visé inconnues", "le visé", temoin, cases, vise, _servi.teintes.unknown)
	_lire("cases du visé inconnues", "les décors loin", temoin, cases, loin, _servi.teintes.visible)
	_monde.volume.voir(null)


## La part des pixels `pixels` de `voilee` sur `temoin` (`PIXELS.part`), sous la vision `vision`, pour `quoi` : la teinte
## `teinte` à `TOLERANCE` près, au plus la borne du pilote de compatibilité.
func _lire(vision: String, quoi: String, temoin: Image, voilee: Image, pixels: Array[Vector2i], teinte: float) -> void:
	if pixels.is_empty():
		return
	var lue := PIXELS.part(temoin, voilee, pixels)
	var haute := maxf(teinte, PIXELS.borne_du_pilote(PIXELS.luminance_mediane(temoin, pixels), teinte))
	print("[voile-du-decor] %s : %s %.3f, attendue de %.3f à %.3f (%d pixels)" % [vision, quoi, lue, teinte - TOLERANCE, haute + TOLERANCE, pixels.size()])
	_verifier(lue >= teinte - TOLERANCE and lue <= haute + TOLERANCE, "%s : %s à la part %.3f, attendue de %.3f à %.3f" % [vision, quoi, lue, teinte - TOLERANCE, haute + TOLERANCE])


## Sous la vision servie, l'image des modèles (`apres`), puis celle des primitives (`avant`) sous l'index sans décor.
## L'index initial et ses modèles rétablis, les images s'écrivent sous `_sortie` si elle est donnée.
func _avant_apres(pont: PontDuDecor) -> bool:
	var rendu := RenderingServer.get_current_rendering_method()
	var apres := await _voir(_servi)
	var triangles_servis: int = _monde.volume.ce_qui_est_pose().triangles
	var entree := pont.entree_des_modeles
	var manifestes: Dictionary = entree.manifestes.duplicate()
	for id: String in manifestes.keys():
		if manifestes[id].get("categorie") == "decor":
			manifestes.erase(id)
	var sans_decors := pont.appeler("modeles", {manifestes = manifestes, osDesRigides = entree.osDesRigides})
	if not _verifier(sans_decors.get("ok") == true and sans_decors.decors.is_empty(), "l'index sans décors n'est pas servi"):
		return false
	var avant: Image
	if await _poser_le_volume(pont):
		_modeles.poser(_vue.corps.coques, {}, _vue.plateau.coupesDesNavires, _vue.plateau.metresParCase)
		_verifier(_modeles.poses().is_empty(), "sans décors servis, %d modèles encore posés" % _modeles.poses().size())
		var triangles_recette: int = _monde.volume.ce_qui_est_pose().triangles - triangles_servis
		if _verifier(triangles_recette > 0, "sans décors servis, aucun triangle supplémentaire peint par les recettes"):
			avant = await _voir(_servi)
			_verifier(avant.get_data() != apres.get_data(), "l'image des primitives est celle des modèles")
	if not _verifier(pont.appeler("modeles", entree).get("ok") == true, "l'index initial n'est pas rétabli"):
		return false
	if not await _poser_le_volume(pont):
		return false
	_modeles.poser(_vue.corps.coques, _vue.corps.decors, _vue.plateau.coupesDesNavires, _vue.plateau.metresParCase)
	_verifier(_monde.volume.ce_qui_est_pose().triangles == triangles_servis, "les décors servis de nouveau, le volume n'a pas retrouvé ses %d triangles peints" % triangles_servis)
	var limite := Time.get_ticks_msec() + int(ATTENTE_S * 1000.0)
	while Time.get_ticks_msec() < limite and _modeles.poses().size() != _poses_servies():
		await process_frame
	if not _verifier(_modeles.poses().size() == _poses_servies(), "les décors servis de nouveau, %d poses posées sur %d" % [_modeles.poses().size(), _poses_servies()]):
		return false
	if avant != null and not _sortie.is_empty():
		for image: Array in [["avant", avant], ["apres", apres]]:
			var chemin := _sortie.path_join("foret-%s-%s.png" % [image[0], rendu])
			(image[1] as Image).save_png(chemin)
			print("[voile-du-decor] %s écrite : %s" % [image[0], chemin])
	return true


## Le volume de la publication courante du pont, sous le cadrage déjà posé.
func _poser_le_volume(pont: PontDuDecor) -> bool:
	var monde := pont.appeler("monde")
	if not _verifier(monde.get("ok") == true and monde.monde != null, "le manifeste du monde n'est pas servi"):
		return false
	var manquants := _monde.volume.manquants(monde)
	if manquants.values().all(func(cles: Array) -> bool: return cles.is_empty()):
		return true
	var recus := pont.appeler("morceaux", manquants.merged({source = "partie"}))
	if not _verifier(recus.get("ok") == true, "les morceaux du monde ne sont pas servis"):
		return false
	var _textures_gardees := await TexturesDeMatiere.preparer_les_chemins(_monde, VolumeDeScene.textures_des_morceaux(recus))
	_monde.volume.poser(monde, recus)
	return _verifier(_monde.volume.manquants(monde).values().all(func(cles: Array) -> bool: return cles.is_empty()), "des morceaux du monde restent à poser")


## `vrai`, sinon la faute `faute` comptée.
func _verifier(vrai: bool, faute: String) -> bool:
	if not vrai:
		_fautes.append(faute)
	return vrai
