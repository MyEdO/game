extends SceneTree

## Une campagne jouée depuis l'accueil (#3009, `hotes/godot/pont/CONTRAT.md`, section « Méthodes ») : sur le pont de
## l'arbre, l'accueil (`scenes/Accueil.tscn`) publie « Jouer » ; un clic ouvre le combat sur une partie au groupe, sans
## scène, ses pré-tirés et ses campagnes montrés ; deux pré-tirés recrutés à leur bouton entrent au groupe, chacun en
## carte avec son renvoi ; « Lancer » de la Diligence pose sa scène ; « Sauvegardes » ouvre le panneau des
## emplacements, l'emplacement 1 écrit à son bouton se charge ensuite ; « Quitter la partie » rend l'accueil ;
## « Reprendre » montre les sauvegardes, l'automatique gardée en quittant, et l'emplacement 1 chargé rend la partie, son
## groupe et sa scène ; quittée, « Jouer » de nouveau, un pré-tiré recruté, l'Arène lancée, sans relancer le processus du
## noyau ; ni panne ni refus ne se signale. Le code de sortie dit le verdict : 0 tenu, 1 une faute.

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
	_pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	_pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	_pont.en_recette = true
	change_scene_to_file(ACCUEIL)
	if await _jouer_une_campagne(2, "la-diligence") and await _sauvegarder_puis_reprendre():
		_cliquer(_publie("bouton/quitter"))
		if await _attendre(func() -> bool: return _au_menu(), "l'accueil après « Quitter la partie »"):
			print("[campagne] partie quittée : l'accueil")
			await _jouer_une_campagne(1, "arene")
	_fautes.append_array(_signales)
	current_scene.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[campagne] " + faute)
	print("[campagne] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


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


## Les boutons publiés d'un pré-tiré à recruter.
func _recrues() -> Array:
	return _pont.ecran.get("boutons", []).filter(func(b: Dictionary) -> bool: return str(b.get("element", "")).begins_with("bouton/recruter/"))


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
