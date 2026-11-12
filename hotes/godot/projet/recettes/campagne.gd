extends SceneTree

## Une campagne jouée depuis l'accueil (#3009, `hotes/godot/pont/CONTRAT.md`, section « Méthodes ») : sur le pont de
## l'arbre, l'accueil (`scenes/Accueil.tscn`) publie ses entrées ; « Options » ouvre le panneau des réglages, où une
## préférence se règle et repose le volume des bus ; « Jouer » ouvre le combat sur une partie au groupe, sans
## scène, ses pré-tirés et ses campagnes montrés ; deux pré-tirés recrutés à leur bouton entrent au groupe, chacun en
## carte avec son renvoi ; « Lancer » de la Diligence pose sa scène ; « Sauvegardes » ouvre le panneau des
## emplacements, l'emplacement 1 écrit à son bouton se charge ensuite ; « Quitter la partie » rend l'accueil ;
## « Reprendre » montre les sauvegardes, l'automatique gardée en quittant, et l'emplacement 1 chargé rend la partie, son
## groupe et sa scène ; quittée, « Jouer » de nouveau, un pré-tiré recruté, l'Arène lancée, sans relancer le processus du
## noyau ; quittée, « Jouer » montre au roster le héros créé et engagé par le pont avant le premier clic, « Recruter »
## de sa carte le fait entrer au groupe, « Supprimer » le retire du roster ; ni panne ni refus ne se signale. Le code
## de sortie dit le verdict : 0 tenu, 1 une faute.

const RECETTE_AUTONOME := true
const ACCUEIL := "res://scenes/Accueil.tscn"
const COMBAT := "res://scenes/Combat.tscn"
## L'attente la plus longue d'un état : le lancement du processus du noyau compris.
const ATTENTE_S := 120.0
var _fautes: Array[String] = []
## Chaque panne et chaque refus signalés par le pont.
var _signales: Array[String] = []
var _pont: PontDuNoyau


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[campagne] version=", Engine.get_version_info().string)
	_pont = root.get_node("Pont")
	_pont.en_recette = true
	change_scene_to_file(ACCUEIL)
	var ouvert := await _pont.rejoindre(func(message: String) -> void: _signales.append("refus : " + message), func(message: String) -> void: _signales.append("panne : " + message))
	var cree := _creer_un_heros() if ouvert else ""
	if cree != "" and await _regler_a_l_accueil() and await _jouer_une_campagne(2, "la-diligence") and await _sauvegarder_puis_reprendre():
		_cliquer(_publie("bouton/quitter"))
		if await _attendre(func() -> bool: return _au_menu(), "l'accueil après « Quitter la partie »"):
			print("[campagne] partie quittée : l'accueil")
			if await _jouer_une_campagne(1, "arene"):
				_cliquer(_publie("bouton/quitter"))
				await _composer_du_roster(cree)
	_fautes.append_array(_signales)
	current_scene.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[campagne] " + faute)
	print("[campagne] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## « Options » pressé à l'accueil, le panneau des réglages montre les préférences : « Oui » des dés fixés pressé, le
## pont dit la préférence réglée et le bus de la musique prend le volume que le pont lui donne ; « Non » la remet, et
## « Fermer » rend l'accueil.
func _regler_a_l_accueil() -> bool:
	if not await _attendre(func() -> bool: return _au_menu(), "l'accueil avant les réglages"):
		return false
	_cliquer(_texte("Options"))
	if not await _attendre(func() -> bool: return _publie("bouton/preference/des-fixes/true") != null, "le panneau des réglages"):
		return false
	var musique := AudioServer.get_bus_index("musique")
	var avant := AudioServer.get_bus_volume_linear(musique)
	_pont.appeler("reglages", {type = "preference", args = ["volume-musique", 0.25]})
	_cliquer(_publie("bouton/preference/des-fixes/true"))
	if not await _attendre(func() -> bool: return _pont.appeler("preferences").preferences["des-fixes"] == true, "les dés fixés réglés au panneau"):
		return false
	if not is_equal_approx(AudioServer.get_bus_volume_linear(musique), 0.25):
		_fautes.append("le bus de la musique à %s après un réglage du panneau, 0.25 attendu" % AudioServer.get_bus_volume_linear(musique))
	_pont.appeler("reglages", {type = "preference", args = ["volume-musique", avant]})
	_cliquer(_publie("bouton/preference/des-fixes/false"))
	if not await _attendre(func() -> bool: return _pont.appeler("preferences").preferences["des-fixes"] == false, "les dés fixés remis au panneau"):
		return false
	_cliquer(_publie("bouton/fermer"))
	if not await _attendre(func() -> bool: return _publie("bouton/fermer") == null and _au_menu(), "l'accueil après « Fermer »"):
		return false
	print("[campagne] réglages : les dés fixés réglés puis remis au panneau, le bus de la musique reposé")
	return true


## « Jouer » pressé à l'accueil, `nombre` pré-tirés recrutés à leur bouton, puis la campagne `campagne` lancée : si sa
## scène se pose.
func _jouer_une_campagne(nombre: int, campagne: String) -> bool:
	if not await _attendre(func() -> bool: return _au_menu(), "« Jouer » à l'accueil"):
		return false
	_cliquer(_texte("Jouer"))
	if not await _attendre(func() -> bool: return not _recrues().is_empty(), "les pré-tirés à recruter"):
		return false
	var vue: Dictionary = current_scene.get("_vue")
	if vue.projection.scene != null or not vue.zones["groupe.heros"].is_empty():
		_fautes.append("la partie ouverte au groupe a déjà une scène ou des héros")
	if _publie("bouton/lancer/" + campagne) != null:
		_fautes.append("groupe vide, « Lancer » de %s se joue" % campagne)
	for rang in nombre:
		_cliquer(_recrues()[0])
		if not await _attendre(func() -> bool: return _renvois() == rang + 1, "le héros recruté n° %d en carte, avec son renvoi" % (rang + 1)):
			return false
	var groupe: Array = current_scene.get("_vue").zones["groupe.heros"].map(func(e: Dictionary) -> String: return e.nom)
	print("[campagne] groupe composé : %s" % ", ".join(PackedStringArray(groupe)))
	if not await _attendre(func() -> bool: return _publie("bouton/lancer/" + campagne) != null, "« Lancer » de %s" % campagne):
		return false
	_cliquer(_publie("bouton/lancer/" + campagne))
	if not await _attendre(func() -> bool: return current_scene.get("_vue").projection.scene != null and _publie("bouton/quitter") != null and _renvois() == 0 and _recrues().is_empty(), "la scène de %s, « Quitter la partie » offert, la composition retirée" % campagne):
		return false
	vue = current_scene.get("_vue")
	print("[campagne] %s lancée : scène %s" % [campagne, vue.projection.scene.id])
	if vue.zones["groupe.heros"].map(func(e: Dictionary) -> String: return e.nom) != groupe:
		_fautes.append("le groupe en scène n'est pas le groupe composé")
	var avis: String = current_scene.get_node("Ecran/Interface/Avis/Panne").text
	if avis != "":
		_fautes.append("avis de panne du combat : %s" % avis.left(300))
	return true


## Un héros créé et engagé par le pont, sans l'écran, dans une partie ouverte au groupe puis quittée : chaque page de la
## création jouée par ses boutons, ses tirages puis chaque choix ouvert tranché par sa première valeur libre. Son nom,
## vide s'il n'entre pas au groupe.
func _creer_un_heros() -> String:
	var zones: Dictionary = _pont.appeler("ouvrir", {graine = 7}).vue.zones
	zones = _creation(zones, _element(zones["groupe.gestes"], "creation"))
	for _page in 12:
		if _element(zones["creation.gestes"], "suivante") == null:
			break
		for id: String in ["tirage", "defaut", "bourse", "nom", "physique"]:
			var tirage: Variant = _element(zones["creation.corps"], id)
			if tirage != null and tirage.type == "bouton" and tirage.refus == null:
				zones = _creation(zones, tirage)
		for e: Dictionary in zones["creation.corps"]:
			if str(e.id).begins_with("augmentation/"):
				zones = _creation(zones, e.valeurs.filter(func(b: Dictionary) -> bool: return b.libelle == "5")[0])
				break
		var destin: Variant = _element(zones["creation.corps"], "destin")
		if destin != null:
			zones = _creation(zones, destin.valeurs.back())
		for _choix in 40:
			if _element(zones["creation.gestes"], "suivante").refus == null:
				break
			zones = _creation(zones, _a_trancher(zones["creation.corps"]))
		zones = _creation(zones, _element(zones["creation.gestes"], "suivante"))
	var engager: Variant = _element(zones["creation.gestes"], "engager")
	if engager == null or engager.refus != null:
		_fautes.append("la création par le pont n'atteint pas son engagement : %s" % str(zones["creation.titre"]))
		return ""
	var nom: String = zones["creation.corps"][0].libelle
	zones = _creation(zones, engager)
	var groupe: Array = zones["groupe.heros"].map(func(e: Dictionary) -> String: return e.nom)
	_pont.appeler("quitter")
	if groupe != [nom]:
		_fautes.append("%s engagé n'est pas au groupe : %s" % [nom, groupe])
		return ""
	print("[campagne] %s créé et engagé par le pont, la partie quittée" % nom)
	return nom


## Les zones de la vue après le geste de la création que porte le bouton `b` ; `zones` si le pont le refuse.
func _creation(zones: Dictionary, b: Dictionary) -> Dictionary:
	return _pont.appeler("creation", b.jeu).get("vue", {zones = zones}).zones


## L'élément d'id `id` de `elements`, `null` s'il n'y est pas.
func _element(elements: Array, id: String) -> Variant:
	for e: Dictionary in elements:
		if e.id == id:
			return e
	return null


## Le bouton qui solde la page de corps `corps` : la première valeur libre de son premier choix sans valeur pressée,
## sinon son premier bouton libre qui n'est pas pressé.
func _a_trancher(corps: Array) -> Dictionary:
	for e: Dictionary in corps:
		if e.type in ["choix", "liste"] and not e.valeurs.any(func(b: Dictionary) -> bool: return b.presse):
			return e.valeurs.filter(func(b: Dictionary) -> bool: return b.refus == null)[0]
	return corps.filter(func(e: Dictionary) -> bool: return e.type == "bouton" and not e.presse and e.refus == null)[0]


## « Jouer » pressé à l'accueil, la carte du héros `nom` au roster : « Recruter » de sa carte le fait entrer au groupe,
## où il ne se recrute plus, puis « Supprimer » le retire du roster.
func _composer_du_roster(nom: String) -> bool:
	if not await _attendre(func() -> bool: return _au_menu(), "l'accueil avant le roster"):
		return false
	_cliquer(_texte("Jouer"))
	if not await _attendre(func() -> bool: return _carte_du_roster(nom) != null and _publie("bouton/recruter/" + _id_au_roster(nom)) != null, "%s au roster, « Recruter » offert" % nom):
		return false
	var id := _id_au_roster(nom)
	if _publie("bouton/exporter/" + id) == null or _publie("bouton/importer") == null:
		_fautes.append("le roster n'offre pas « Exporter » de %s et « Importer un personnage… »" % nom)
	print("[campagne] roster : %s" % ", ".join(PackedStringArray(_roster().map(func(e: Dictionary) -> String: return e.nom))))
	_cliquer(_publie("bouton/recruter/" + id))
	if not await _attendre(func() -> bool: return _renvois() == 1 and _publie("bouton/recruter/" + id) == null, "%s recruté du roster, son recrutement refusé ensuite" % nom):
		return false
	var groupe: Array = current_scene.get("_vue").zones["groupe.heros"].map(func(e: Dictionary) -> String: return e.id)
	if groupe != ["heros/" + id]:
		_fautes.append("le héros recruté du roster n'entre pas au groupe sous son id : %s" % str(groupe))
	_cliquer(_publie("bouton/retirer/" + id))
	if not await _attendre(func() -> bool: return _carte_du_roster(nom) == null and _publie("bouton/retirer/" + id) == null, "%s retiré du roster" % nom):
		return false
	print("[campagne] %s recruté du roster, puis retiré du roster" % nom)
	return true


## La carte du héros `nom` au roster que montre le combat, `null` s'il n'y est pas.
func _carte_du_roster(nom: String) -> Variant:
	for e: Dictionary in _roster():
		if e.nom == nom:
			return e
	return null


## L'id du héros `nom` au roster, celui que porte sa carte (`roster/<id>`).
func _id_au_roster(nom: String) -> String:
	return str(_carte_du_roster(nom).id).trim_prefix("roster/")


## La partie en cours écrite à l'emplacement 1 au panneau des sauvegardes, quittée, puis chargée de cet emplacement
## depuis « Reprendre » de l'accueil : si elle revient, son groupe et sa scène ceux d'avant.
func _sauvegarder_puis_reprendre() -> bool:
	var avant: Dictionary = current_scene.get("_vue")
	_cliquer(_publie("bouton/sauvegardes"))
	if not await _attendre(func() -> bool: return _publie("bouton/sauvegarder/1") != null, "le panneau des sauvegardes, l'emplacement 1 à écrire"):
		return false
	_cliquer(_publie("bouton/sauvegarder/1"))
	if not await _attendre(func() -> bool: return _publie("bouton/charger/1") != null, "l'emplacement 1 écrit, qui se charge"):
		return false
	_cliquer(_publie("bouton/fermer"))
	if not await _attendre(func() -> bool: return _publie("bouton/fermer") == null and _publie("bouton/quitter") != null, "le panneau fermé sur la partie"):
		return false
	_cliquer(_publie("bouton/quitter"))
	if not await _attendre(func() -> bool: return _au_menu(), "l'accueil après la sauvegarde"):
		return false
	_cliquer(_texte("Reprendre"))
	if not await _attendre(func() -> bool: return _publie("bouton/charger/auto") != null and _publie("bouton/charger/1") != null, "les sauvegardes à charger, l'automatique gardée en quittant"):
		return false
	_cliquer(_publie("bouton/charger/1"))
	if not await _attendre(func() -> bool: return _en_partie() and _publie("bouton/charger/1") == null, "la partie de l'emplacement 1"):
		return false
	var apres: Dictionary = current_scene.get("_vue")
	print("[campagne] partie reprise : scène %s" % apres.projection.scene.id)
	var noms := func(vue: Dictionary) -> Array: return vue.zones["groupe.heros"].map(func(e: Dictionary) -> String: return e.nom)
	if apres.projection.scene.id != avant.projection.scene.id or noms.call(apres) != noms.call(avant):
		_fautes.append("la partie reprise n'est pas celle sauvegardée : scène %s, groupe %s" % [apres.projection.scene.id, noms.call(apres)])
	return true


## Si le combat est la scène courante, une partie en scène montrée, « Quitter la partie » publié.
func _en_partie() -> bool:
	if current_scene == null or current_scene.scene_file_path != COMBAT:
		return false
	var vue: Dictionary = current_scene.get("_vue")
	return not vue.is_empty() and vue.projection.scene != null and _publie("bouton/quitter") != null


## Si l'accueil est la scène courante et publie « Jouer ».
func _au_menu() -> bool:
	return current_scene != null and current_scene.scene_file_path == ACCUEIL and _texte("Jouer") != null


## Le bouton publié qui dessine l'élément `element`, `null` hors de l'écran.
func _publie(element: String) -> Variant:
	for bouton: Dictionary in _pont.ecran.get("boutons", []):
		if bouton.get("element") == element:
			return bouton
	return null


## Le bouton publié de texte `texte`, `null` hors de l'écran.
func _texte(texte: String) -> Variant:
	for bouton: Dictionary in _pont.ecran.get("boutons", []):
		if bouton.get("texte") == texte:
			return bouton
	return null


## Les boutons publiés qui recrutent un pré-tiré : ceux d'un recrutement, hors ceux des cartes du roster.
func _recrues() -> Array:
	var du_roster: Array = _roster().map(func(e: Dictionary) -> String: return "bouton/recruter/" + str(e.id).trim_prefix("roster/"))
	return _pont.ecran.get("boutons", []).filter(func(b: Dictionary) -> bool: return str(b.get("element", "")).begins_with("bouton/recruter/") and not du_roster.has(b.element))


## Les cartes de la zone du roster de la vue du combat ; aucune hors du combat.
func _roster() -> Array:
	if current_scene == null or current_scene.scene_file_path != COMBAT:
		return []
	return current_scene.get("_vue").get("zones", {}).get("groupe.roster", [])


## Le nombre de boutons publiés qui renvoient un héros du groupe.
func _renvois() -> int:
	return _pont.ecran.get("boutons", []).filter(func(b: Dictionary) -> bool: return str(b.get("element", "")).begins_with("bouton/renvoyer/")).size()


## Un clic gauche au centre du bouton publié `bouton`, comme un joueur.
func _cliquer(bouton: Dictionary) -> void:
	for appuye in [true, false]:
		var clic := InputEventMouseButton.new()
		clic.button_index = MOUSE_BUTTON_LEFT
		clic.pressed = appuye
		clic.position = Vector2(bouton.x, bouton.y)
		clic.global_position = clic.position
		root.push_input(clic, true)


## Si `tenu` se tient avant `ATTENTE_S` et avant toute panne ou tout refus signalé.
func _attendre(tenu: Callable, quoi: String) -> bool:
	var limite := Time.get_ticks_msec() + int(ATTENTE_S * 1000.0)
	while Time.get_ticks_msec() < limite and _signales.is_empty():
		if tenu.call():
			return true
		await process_frame
	_fautes.append("attente échue : %s" % quoi)
	return false
